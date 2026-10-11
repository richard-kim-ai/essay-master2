import { TRPCError } from "@trpc/server";
import { and, desc, eq, inArray, isNotNull, isNull, sql } from "drizzle-orm";
import {
  essaySubmission,
  users,
  teacherFeedback,
  aiAutoFeedback,
  teacherFeedbackRequests,
  teacherAiDrafts,
} from "../drizzle/schema";
import { getDb } from "./db";

export type EssaySyncInput = {
  id?: number;
  clientId: string;
  title: string;
  content: string;
  baseRevision?: number;
};

export async function syncEssayDraft(userId: number, input: EssaySyncInput) {
  const db = await getDb();
  if (!db)
    throw new TRPCError({
      code: "SERVICE_UNAVAILABLE",
      message: "서버에 연결할 수 없습니다. 글은 기기에 그대로 보관됩니다.",
    });
  const find = async () =>
    (
      await db
        .select()
        .from(essaySubmission)
        .where(
          input.id
            ? eq(essaySubmission.id, input.id)
            : eq(essaySubmission.clientId, input.clientId)
        )
        .limit(1)
    )[0];
  let row = await find();
  if (!row && input.id)
    throw new TRPCError({
      code: "NOT_FOUND",
      message: "서버 글을 찾지 못했습니다. 기기 글을 새 글로 보관해 주세요.",
    });
  if (!row) {
    await db
      .insert(essaySubmission)
      .values({
        userId,
        clientId: input.clientId,
        title: input.title,
        content: input.content,
        status: "draft",
      })
      .onDuplicateKeyUpdate({ set: { clientId: input.clientId } });
    row = await find();
  }
  if (!row || row.userId !== userId)
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "본인의 글만 동기화할 수 있습니다.",
    });
  if (row.deletedAt)
    throw new TRPCError({
      code: "CONFLICT",
      message: "휴지통에 있는 글입니다. 휴지통에서 복원한 뒤 수정해 주세요.",
    });
  // 업로드 응답 유실 뒤 같은 요청을 재전송해도 새 글이나 추가 수정이 생기지 않는다.
  if (row.title === input.title && row.content === input.content) return row;
  if (row.status !== "draft")
    throw new TRPCError({
      code: "CONFLICT",
      message: "첨삭을 요청한 원문은 보존됩니다. 새 글로 복사해 수정해 주세요.",
    });
  if (
    input.baseRevision === undefined ||
    input.baseRevision !== row.syncRevision
  )
    throw new TRPCError({
      code: "CONFLICT",
      message:
        "다른 기기에서 수정된 글이 있습니다. 서버 글을 확인하거나 기기 글을 새 글로 보관해 주세요.",
    });
  const [result] = await db
    .update(essaySubmission)
    .set({
      title: input.title,
      content: input.content,
      syncRevision: sql`${essaySubmission.syncRevision} + 1`,
      aiFeedbackId: null,
    })
    .where(
      and(
        eq(essaySubmission.id, row.id),
        eq(essaySubmission.userId, userId),
        eq(essaySubmission.syncRevision, input.baseRevision),
        eq(essaySubmission.status, "draft")
      )
    );
  if (!result.affectedRows)
    throw new TRPCError({
      code: "CONFLICT",
      message: "글의 상태가 변경되었습니다. 새로 동기화한 뒤 확인해 주세요.",
    });
  return (
    await db
      .select()
      .from(essaySubmission)
      .where(eq(essaySubmission.id, row.id))
      .limit(1)
  )[0];
}

export async function getEssayWorkspace(userId: number) {
  const db = await getDb();
  if (!db)
    throw new TRPCError({
      code: "SERVICE_UNAVAILABLE",
      message: "서버 보관함에 연결할 수 없습니다.",
    });
  const rows = await db
    .select({
      essay: essaySubmission,
      teacher: teacherFeedback,
      ai: aiAutoFeedback,
    })
    .from(essaySubmission)
    .leftJoin(teacherFeedback, eq(teacherFeedback.essayId, essaySubmission.id))
    .leftJoin(
      aiAutoFeedback,
      eq(aiAutoFeedback.id, essaySubmission.aiFeedbackId)
    )
    .where(and(eq(essaySubmission.userId, userId), isNull(essaySubmission.deletedAt)));
  return rows.map(({ essay, teacher, ai }) => ({
    ...essay,
    teacherFeedback: teacher,
    aiFeedback: ai,
  }));
}

export async function requestEssayTeacherFeedback(
  userId: number,
  essayId: number
) {
  const db = await getDb();
  if (!db)
    throw new TRPCError({
      code: "SERVICE_UNAVAILABLE",
      message: "서버에 연결할 수 없습니다.",
    });
  const [essay] = await db
    .select()
    .from(essaySubmission)
    .where(eq(essaySubmission.id, essayId))
    .limit(1);
  if (!essay || essay.userId !== userId)
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "본인의 글만 첨삭을 요청할 수 있습니다.",
    });
  if (essay.deletedAt)
    throw new TRPCError({ code: "BAD_REQUEST", message: "휴지통에 있는 글은 첨삭을 요청할 수 없습니다. 먼저 복원해 주세요." });
  if (essay.status !== "draft") return { status: essay.status };
  const [student] = await db
    .select()
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  const [teacher] = student?.teacherId
    ? await db
        .select()
        .from(users)
        .where(eq(users.id, student.teacherId))
        .limit(1)
    : [];
  if (
    !teacher ||
    teacher.role !== "teacher" ||
    teacher.teacherStatus !== "approved" ||
    teacher.openId === "ai_tutor_bot_system"
  ) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message:
        "배정된 첨삭 교사가 없습니다. AI 첨삭을 이용하거나 마이페이지에서 담당 교사를 연결해 주세요.",
    });
  }
  if (!essay.content.trim())
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "본문을 작성한 뒤 첨삭을 요청해 주세요.",
    });
  await db
    .update(essaySubmission)
    .set({
      status: "submitted",
      submittedAt: new Date(),
      syncRevision: sql`${essaySubmission.syncRevision} + 1`,
    })
    .where(
      and(
        eq(essaySubmission.id, essayId),
        eq(essaySubmission.userId, userId),
        eq(essaySubmission.status, "draft")
      )
    );
  return { status: "submitted" as const };
}

export type EssayReviewFilter = {
  status?: "submitted" | "reviewed" | "all";
  studentId?: number;
  search?: string;
};

/**
 * 교사·관리자가 첨삭할 학생 글 목록.
 * - 관리자: 모든 학생의 제출 글. 승인된 교사: 자신이 담당하는 학생의 제출 글만.
 * - 학생이 아직 제출하지 않은 초안은 보여 주지 않는다(제출·첨삭 완료된 글만).
 * - 글마다 첨삭 여부와 최근 첨삭 신청(상태·완료 예정일)을 함께 돌려준다.
 */
export async function listEssaysForReview(
  viewer: { id: number; role: string; teacherStatus?: string | null },
  filter: EssayReviewFilter = {}
) {
  const isAdmin = viewer.role === "admin";
  const isApprovedTeacher = viewer.role === "teacher" && viewer.teacherStatus === "approved";
  if (!isAdmin && !isApprovedTeacher)
    throw new TRPCError({ code: "FORBIDDEN", message: "승인된 교사 또는 관리자만 학생 글 목록을 볼 수 있습니다." });
  const db = await getDb();
  if (!db)
    throw new TRPCError({ code: "SERVICE_UNAVAILABLE", message: "서버에 연결할 수 없습니다." });

  const status = filter.status ?? "submitted";
  const conditions = [
    status === "all" ? inArray(essaySubmission.status, ["submitted", "reviewed"]) : eq(essaySubmission.status, status),
  ];
  conditions.push(isNull(essaySubmission.deletedAt));
  if (!isAdmin) conditions.push(eq(users.teacherId, viewer.id));
  if (filter.studentId) conditions.push(eq(essaySubmission.userId, filter.studentId));

  const rows = await db
    .select({
      essayId: essaySubmission.id,
      title: essaySubmission.title,
      status: essaySubmission.status,
      submittedAt: essaySubmission.submittedAt,
      updatedAt: essaySubmission.updatedAt,
      aiFeedbackId: essaySubmission.aiFeedbackId,
      content: essaySubmission.content,
      studentId: users.id,
      studentName: users.name,
      studentEmail: users.email,
    })
    .from(essaySubmission)
    .innerJoin(users, eq(users.id, essaySubmission.userId))
    .where(and(...conditions))
    .orderBy(desc(essaySubmission.submittedAt), desc(essaySubmission.updatedAt))
    .limit(300);
  if (!rows.length) return [];

  const essayIds = rows.map((row) => row.essayId);
  const feedbacks = await db
    .select({ essayId: teacherFeedback.essayId, id: teacherFeedback.id, teacherId: teacherFeedback.teacherId, updatedAt: teacherFeedback.updatedAt, overallScore: teacherFeedback.overallScore })
    .from(teacherFeedback)
    .where(inArray(teacherFeedback.essayId, essayIds));
  const requests = await db
    .select({ essayId: teacherFeedbackRequests.essayId, status: teacherFeedbackRequests.status, dueAt: teacherFeedbackRequests.dueAt, createdAt: teacherFeedbackRequests.createdAt })
    .from(teacherFeedbackRequests)
    .where(inArray(teacherFeedbackRequests.essayId, essayIds))
    .orderBy(desc(teacherFeedbackRequests.createdAt));
  const feedbackByEssay = new Map(feedbacks.map((feedback) => [feedback.essayId, feedback]));
  const latestRequestByEssay = new Map<number, (typeof requests)[number]>();
  for (const request of requests) if (!latestRequestByEssay.has(request.essayId)) latestRequestByEssay.set(request.essayId, request);

  const needle = filter.search?.trim().toLowerCase();
  return rows
    .filter((row) => !needle || [row.title, row.studentName, row.studentEmail].some((value) => (value ?? "").toLowerCase().includes(needle)))
    .map(({ content, ...row }) => {
      const feedback = feedbackByEssay.get(row.essayId);
      const request = latestRequestByEssay.get(row.essayId);
      return {
        ...row,
        preview: content.replace(/\s+/g, " ").trim().slice(0, 140),
        hasTeacherFeedback: Boolean(feedback),
        teacherFeedbackScore: feedback?.overallScore ?? null,
        requestStatus: request?.status ?? null,
        requestDueAt: request?.dueAt ?? null,
      };
    });
}

// ========== 글 삭제(휴지통) ==========

async function requireDb() {
  const db = await getDb();
  if (!db)
    throw new TRPCError({ code: "SERVICE_UNAVAILABLE", message: "서버에 연결할 수 없습니다." });
  return db;
}

async function loadOwnedEssay(db: NonNullable<Awaited<ReturnType<typeof getDb>>>, userId: number, essayId: number) {
  const [essay] = await db.select().from(essaySubmission).where(eq(essaySubmission.id, essayId)).limit(1);
  if (!essay) throw new TRPCError({ code: "NOT_FOUND", message: "글을 찾을 수 없습니다." });
  if (essay.userId !== userId)
    throw new TRPCError({ code: "FORBIDDEN", message: "본인의 글만 삭제·복원할 수 있습니다." });
  return essay;
}

/** 글을 휴지통으로 옮긴다. 교사 첨삭이 진행 중인 글은 옮길 수 없다. */
export async function trashEssay(userId: number, essayId: number) {
  const db = await requireDb();
  const essay = await loadOwnedEssay(db, userId, essayId);
  if (essay.purgedAt) throw new TRPCError({ code: "NOT_FOUND", message: "이미 영구 삭제된 글입니다." });
  if (essay.deletedAt) return { id: essay.id, deletedAt: essay.deletedAt };

  const [openRequest] = await db
    .select({ id: teacherFeedbackRequests.id })
    .from(teacherFeedbackRequests)
    .where(and(eq(teacherFeedbackRequests.essayId, essayId), inArray(teacherFeedbackRequests.status, ["paid", "in_progress"])))
    .limit(1);
  let waitingForTeacher = Boolean(openRequest);
  if (!waitingForTeacher && essay.status === "submitted") {
    const [feedback] = await db.select({ id: teacherFeedback.id }).from(teacherFeedback).where(eq(teacherFeedback.essayId, essayId)).limit(1);
    waitingForTeacher = !feedback;
  }
  if (waitingForTeacher)
    throw new TRPCError({
      code: "CONFLICT",
      message: "교사 첨삭이 진행 중인 글은 삭제할 수 없습니다. 첨삭 신청을 취소하거나 첨삭이 끝난 뒤 삭제해 주세요.",
    });

  const deletedAt = new Date();
  await db
    .update(essaySubmission)
    .set({ deletedAt, syncRevision: sql`${essaySubmission.syncRevision} + 1` })
    .where(and(eq(essaySubmission.id, essayId), eq(essaySubmission.userId, userId), isNull(essaySubmission.deletedAt)));
  return { id: essayId, deletedAt };
}

/** 휴지통의 글을 다시 글 목록으로 되돌린다. */
export async function restoreEssay(userId: number, essayId: number) {
  const db = await requireDb();
  const essay = await loadOwnedEssay(db, userId, essayId);
  if (essay.purgedAt) throw new TRPCError({ code: "NOT_FOUND", message: "영구 삭제된 글은 복원할 수 없습니다." });
  if (!essay.deletedAt) return { id: essay.id };
  await db
    .update(essaySubmission)
    .set({ deletedAt: null, syncRevision: sql`${essaySubmission.syncRevision} + 1` })
    .where(and(eq(essaySubmission.id, essayId), eq(essaySubmission.userId, userId)));
  return { id: essayId };
}

/**
 * 휴지통의 글을 영구 삭제한다.
 * 교사 첨삭·신청·AI 초안 기록이 걸린 글은 정산·기록이 깨지지 않도록 행은 남기고 제목·본문만 비운다.
 */
export async function purgeEssay(userId: number, essayId: number) {
  const db = await requireDb();
  const essay = await loadOwnedEssay(db, userId, essayId);
  if (essay.purgedAt) return { id: essay.id, mode: "already" as const };
  if (!essay.deletedAt)
    throw new TRPCError({ code: "BAD_REQUEST", message: "먼저 휴지통으로 옮긴 글만 영구 삭제할 수 있습니다." });

  const linked = await Promise.all([
    db.select({ id: teacherFeedback.id }).from(teacherFeedback).where(eq(teacherFeedback.essayId, essayId)).limit(1),
    db.select({ id: teacherFeedbackRequests.id }).from(teacherFeedbackRequests).where(eq(teacherFeedbackRequests.essayId, essayId)).limit(1),
    db.select({ id: teacherAiDrafts.id }).from(teacherAiDrafts).where(eq(teacherAiDrafts.essayId, essayId)).limit(1),
  ]);
  if (linked.some((rows) => rows.length > 0)) {
    await db
      .update(essaySubmission)
      .set({ title: "삭제된 글", content: "", aiFeedbackId: null, purgedAt: new Date() })
      .where(and(eq(essaySubmission.id, essayId), eq(essaySubmission.userId, userId)));
    return { id: essayId, mode: "emptied" as const };
  }
  await db.delete(essaySubmission).where(and(eq(essaySubmission.id, essayId), eq(essaySubmission.userId, userId), isNotNull(essaySubmission.deletedAt)));
  return { id: essayId, mode: "deleted" as const };
}

/** 휴지통 목록(최근에 지운 순). 영구 삭제된 글은 나오지 않는다. */
export async function listTrashedEssays(userId: number) {
  const db = await requireDb();
  const rows = await db
    .select({
      id: essaySubmission.id,
      title: essaySubmission.title,
      status: essaySubmission.status,
      content: essaySubmission.content,
      deletedAt: essaySubmission.deletedAt,
      updatedAt: essaySubmission.updatedAt,
    })
    .from(essaySubmission)
    .where(and(eq(essaySubmission.userId, userId), isNotNull(essaySubmission.deletedAt), isNull(essaySubmission.purgedAt)))
    .orderBy(desc(essaySubmission.deletedAt));
  return rows.map(({ content, ...row }) => ({ ...row, preview: content.replace(/\s+/g, " ").trim().slice(0, 140) }));
}

/** 휴지통을 비운다(글마다 영구 삭제 규칙을 그대로 적용). */
export async function emptyTrash(userId: number) {
  const trashed = await listTrashedEssays(userId);
  const results = { deleted: 0, emptied: 0 };
  for (const row of trashed) {
    const result = await purgeEssay(userId, row.id);
    if (result.mode === "deleted") results.deleted += 1;
    else if (result.mode === "emptied") results.emptied += 1;
  }
  return { count: results.deleted + results.emptied, ...results };
}
