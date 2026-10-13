import { and, desc, eq, inArray, isNull, ne } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { appNotifications, essaySubmission, parentComments } from "../drizzle/schema";
import { getDb } from "./db";

// 학부모 코멘트 저장·조회. 예전 코멘트는 학생의 운영자 메모(users.adminNotes)에
// "[학부모 코멘트(이름)] 내용 (날짜)" 한 줄로 쌓였으므로, 조회할 때는 그 줄도 함께 읽어 기존 기록이 사라지지 않게 한다.

export type ParentCommentItem = {
  id: string;
  parentName: string;
  comment: string;
  /** 코멘트가 달린 학생의 글. 글과 연결되지 않은 옛 기록은 null. */
  essayId: number | null;
  essayTitle: string | null;
  createdAt: Date | null;
  /** 운영자 메모에 섞여 저장된 옛 기록이면 true. */
  legacy: boolean;
};

const LEGACY_LINE = /^\[학부모 코멘트\((.*?)\)\]\s*([\s\S]*?)(?:\s*\(([^()]*)\))?$/;

/** 운영자 메모의 학부모 코멘트 줄만 골라 구조화한다. 날짜는 읽을 수 있을 때만 채운다. */
export function parseLegacyParentComments(notes: string | null | undefined): ParentCommentItem[] {
  if (!notes) return [];
  const items: ParentCommentItem[] = [];
  notes.split("\n").forEach((line, index) => {
    if (!line.startsWith("[학부모 코멘트")) return;
    const match = LEGACY_LINE.exec(line.trim());
    if (!match) return;
    const parsed = match[3] ? new Date(match[3]) : null;
    items.push({
      id: `legacy-${index}`,
      parentName: match[1] || "학부모",
      comment: match[2].trim(),
      essayId: null,
      essayTitle: null,
      createdAt: parsed && !Number.isNaN(parsed.getTime()) ? parsed : null,
      legacy: true,
    });
  });
  return items;
}

type Db = NonNullable<Awaited<ReturnType<typeof getDb>>>;

async function essayTitles(db: Db, ids: Array<number | null>) {
  const unique = Array.from(new Set(ids.filter((id): id is number => typeof id === "number")));
  const map = new Map<number, string>();
  if (unique.length === 0) return map;
  try {
    const rows = await db.select({ id: essaySubmission.id, title: essaySubmission.title }).from(essaySubmission).where(inArray(essaySubmission.id, unique));
    for (const row of rows) map.set(row.id, row.title);
  } catch (error) {
    console.warn("[parent-comments] 글 제목 조회 실패:", error instanceof Error ? error.message.slice(0, 120) : error);
  }
  return map;
}

/** 새 테이블이 아직 없는(마이그레이션 전) 환경에서도 옛 기록은 계속 보이도록 테이블 오류는 빈 목록으로 처리한다. */
export async function listParentCommentsForStudent(studentId: number, legacyNotes?: string | null): Promise<ParentCommentItem[]> {
  const db = await getDb();
  let rows: Array<typeof parentComments.$inferSelect> = [];
  if (db) {
    try {
      rows = await db.select().from(parentComments).where(eq(parentComments.studentId, studentId)).orderBy(desc(parentComments.createdAt)).limit(200);
    } catch (error) {
      console.warn("[parent-comments] 조회 실패(마이그레이션 0060 적용 전일 수 있음):", error instanceof Error ? error.message.slice(0, 120) : error);
    }
  }
  const titles = db ? await essayTitles(db, rows.map((row) => row.essayId)) : new Map<number, string>();
  const current: ParentCommentItem[] = rows.map((row) => ({
    id: String(row.id),
    parentName: row.parentName || "학부모",
    comment: row.comment,
    essayId: row.essayId,
    essayTitle: row.essayId ? titles.get(row.essayId) ?? null : null,
    createdAt: row.createdAt,
    legacy: false,
  }));
  const merged = [...current, ...parseLegacyParentComments(legacyNotes)];
  // 최신순. 날짜를 읽지 못한 옛 기록은 맨 아래에 둔다.
  return merged.sort((a, b) => (b.createdAt?.getTime() ?? 0) - (a.createdAt?.getTime() ?? 0));
}

/** 한 편의 글에 달린 학부모 코멘트(최신순). 글과 연결된 코멘트만 해당한다. */
export async function listParentCommentsForEssay(essayId: number): Promise<ParentCommentItem[]> {
  const db = await getDb();
  if (!db) return [];
  try {
    const rows = await db.select().from(parentComments).where(eq(parentComments.essayId, essayId)).orderBy(desc(parentComments.createdAt)).limit(100);
    const titles = await essayTitles(db, [essayId]);
    return rows.map((row) => ({ id: String(row.id), parentName: row.parentName || "학부모", comment: row.comment, essayId, essayTitle: titles.get(essayId) ?? null, createdAt: row.createdAt, legacy: false }));
  } catch (error) {
    console.warn("[parent-comments] 글별 조회 실패(마이그레이션 0060 적용 전일 수 있음):", error instanceof Error ? error.message.slice(0, 120) : error);
    return [];
  }
}

/**
 * 코멘트를 남길 수 있는 글인지 확인하고 제목을 돌려준다. 자녀가 제출했거나 첨삭을 받은 글(휴지통 제외)만 가능하다.
 * 작성 중인 초안과 글이 없는 코멘트는 학생에게 맥락이 없으므로 받지 않는다.
 */
export async function assertCommentableEssay(studentId: number, essayId: number): Promise<string> {
  const db = await getDb();
  if (!db) throw new TRPCError({ code: "SERVICE_UNAVAILABLE", message: "잠시 후 다시 시도해 주세요." });
  const [essay] = await db
    .select({ title: essaySubmission.title })
    .from(essaySubmission)
    .where(and(eq(essaySubmission.id, essayId), eq(essaySubmission.userId, studentId), isNull(essaySubmission.deletedAt), ne(essaySubmission.status, "draft")));
  if (!essay) throw new TRPCError({ code: "BAD_REQUEST", message: "자녀가 제출한 글에만 코멘트를 남길 수 있습니다. 글을 선택해 주세요." });
  return essay.title;
}

/** 코멘트를 저장하고 학생에게 알림을 보낸다. 알림이 실패해도 코멘트는 남는다. */
export async function addParentComment(input: { studentId: number; parentId: number; parentName: string | null; essayId: number; essayTitle: string; comment: string }) {
  const db = await getDb();
  if (!db) throw new Error("DATABASE_UNAVAILABLE");
  const comment = input.comment.trim();
  const parentName = (input.parentName || "학부모").slice(0, 100);
  await db.insert(parentComments).values({ studentId: input.studentId, parentId: input.parentId, parentName, essayId: input.essayId, comment });
  try {
    await db.insert(appNotifications).values({
      userId: input.studentId,
      title: "학부모 코멘트가 도착했습니다",
      message: `${parentName}님이 "${input.essayTitle.slice(0, 60)}" 글에 코멘트를 남겼습니다. 첨삭 결과 화면에서 확인해 보세요.`,
      category: "system",
    });
  } catch (error) {
    console.warn("[parent-comments] 학생 알림 저장 실패:", error instanceof Error ? error.message.slice(0, 120) : error);
  }
}
