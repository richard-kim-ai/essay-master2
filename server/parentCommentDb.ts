import { desc, eq } from "drizzle-orm";
import { appNotifications, parentComments } from "../drizzle/schema";
import { getDb } from "./db";

// 학부모 코멘트 저장·조회. 예전 코멘트는 학생의 운영자 메모(users.adminNotes)에
// "[학부모 코멘트(이름)] 내용 (날짜)" 한 줄로 쌓였으므로, 조회할 때는 그 줄도 함께 읽어 기존 기록이 사라지지 않게 한다.

export type ParentCommentItem = {
  id: string;
  parentName: string;
  comment: string;
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
      createdAt: parsed && !Number.isNaN(parsed.getTime()) ? parsed : null,
      legacy: true,
    });
  });
  return items;
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
  const current: ParentCommentItem[] = rows.map((row) => ({
    id: String(row.id),
    parentName: row.parentName || "학부모",
    comment: row.comment,
    createdAt: row.createdAt,
    legacy: false,
  }));
  const merged = [...current, ...parseLegacyParentComments(legacyNotes)];
  // 최신순. 날짜를 읽지 못한 옛 기록은 맨 아래에 둔다.
  return merged.sort((a, b) => (b.createdAt?.getTime() ?? 0) - (a.createdAt?.getTime() ?? 0));
}

/** 코멘트를 저장하고 학생에게 알림을 보낸다. 알림이 실패해도 코멘트는 남는다. */
export async function addParentComment(input: { studentId: number; parentId: number; parentName: string | null; comment: string }) {
  const db = await getDb();
  if (!db) throw new Error("DATABASE_UNAVAILABLE");
  const comment = input.comment.trim();
  const parentName = (input.parentName || "학부모").slice(0, 100);
  await db.insert(parentComments).values({ studentId: input.studentId, parentId: input.parentId, parentName, comment });
  try {
    await db.insert(appNotifications).values({
      userId: input.studentId,
      title: "학부모 코멘트가 도착했습니다",
      message: `${parentName}님이 응원·지도 코멘트를 남겼습니다. 마이페이지에서 확인해 보세요.`,
      category: "system",
    });
  } catch (error) {
    console.warn("[parent-comments] 학생 알림 저장 실패:", error instanceof Error ? error.message.slice(0, 120) : error);
  }
}
