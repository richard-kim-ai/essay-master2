// 교사 첨삭 신청(건별 결제)의 데이터 접근. 화면 단위 규칙은 teacherFeedbackRequestRouter.ts, 순수 규칙은 shared/teacherFeedbackRequest.ts에 있다.
import { and, desc, eq, inArray, sql } from "drizzle-orm";
import { appNotifications, essaySubmission, paymentOrders, teacherFeedbackRequests, users } from "../drizzle/schema";
import { OPEN_REQUEST_STATUSES, computeDueAt, type TeacherFeedbackRequestStatus } from "../shared/teacherFeedbackRequest";
import { getDb } from "./db";

async function requireDb() {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  return db;
}

// mysql2의 update 결과(ResultSetHeader)에서 바뀐 행 수를 읽는다. billingDb.ts와 같은 방식이다.
function changedRows(result: unknown) {
  const header = Array.isArray(result) ? result[0] : result;
  return Number((header as { affectedRows?: number } | undefined)?.affectedRows ?? 0);
}

/**
 * 주문을 결제 완료로 확정하고 신청을 만든다(한 번만). 이미 확정된 주문이면 아무것도 바꾸지 않고 null을 돌려준다.
 * 초안 상태의 글은 이 시점에 '제출됨'으로 바꿔 교사가 볼 수 있게 한다.
 */
export async function createPaidRequest(input: {
  orderId: number;
  paymentKey: string;
  userId: number;
  essayId: number;
  productKey: string;
  priceKrw: number;
  teacherId: number;
  items: string[];
  now?: Date;
}) {
  const db = await requireDb();
  const now = input.now ?? new Date();
  return db.transaction(async (tx) => {
    const paid = await tx.update(paymentOrders)
      .set({ status: "paid", providerPaymentKey: input.paymentKey, paidAt: now })
      .where(and(eq(paymentOrders.id, input.orderId), eq(paymentOrders.status, "pending")));
    if (changedRows(paid) === 0) return null;

    await tx.insert(teacherFeedbackRequests).values({
      userId: input.userId,
      essayId: input.essayId,
      productKey: input.productKey,
      priceKrw: input.priceKrw,
      scopeJson: JSON.stringify(input.items),
      teacherId: input.teacherId,
      status: "paid",
      orderId: input.orderId,
      dueAt: computeDueAt(now),
    });
    await tx.update(essaySubmission)
      .set({ status: "submitted", submittedAt: now, syncRevision: sql`${essaySubmission.syncRevision} + 1` })
      .where(and(eq(essaySubmission.id, input.essayId), eq(essaySubmission.userId, input.userId), eq(essaySubmission.status, "draft")));
    const [request] = await tx.select().from(teacherFeedbackRequests).where(eq(teacherFeedbackRequests.orderId, input.orderId));
    return request ?? null;
  });
}

export async function getRequestById(requestId: number) {
  const db = await requireDb();
  const [row] = await db.select().from(teacherFeedbackRequests).where(eq(teacherFeedbackRequests.id, requestId));
  return row;
}

/** 글에 대해 아직 결과가 전달되지 않은 신청(결제 완료·작업 중). 없으면 undefined. */
export async function getOpenRequestByEssay(essayId: number) {
  const db = await requireDb();
  const [row] = await db.select().from(teacherFeedbackRequests)
    .where(and(eq(teacherFeedbackRequests.essayId, essayId), inArray(teacherFeedbackRequests.status, [...OPEN_REQUEST_STATUSES])))
    .orderBy(desc(teacherFeedbackRequests.id))
    .limit(1);
  return row;
}

export async function listRequestsForUser(userId: number) {
  const db = await requireDb();
  return db.select({
    id: teacherFeedbackRequests.id,
    essayId: teacherFeedbackRequests.essayId,
    essayTitle: essaySubmission.title,
    productKey: teacherFeedbackRequests.productKey,
    priceKrw: teacherFeedbackRequests.priceKrw,
    scopeJson: teacherFeedbackRequests.scopeJson,
    status: teacherFeedbackRequests.status,
    dueAt: teacherFeedbackRequests.dueAt,
    deliveredAt: teacherFeedbackRequests.deliveredAt,
    reworkCount: teacherFeedbackRequests.reworkCount,
    createdAt: teacherFeedbackRequests.createdAt,
  })
    .from(teacherFeedbackRequests)
    .leftJoin(essaySubmission, eq(essaySubmission.id, teacherFeedbackRequests.essayId))
    .where(eq(teacherFeedbackRequests.userId, userId))
    .orderBy(desc(teacherFeedbackRequests.id))
    .limit(100);
}

/** 담당 교사에게 배정된, 아직 전달하지 않은 신청들(완료 예정일이 가까운 순). */
export async function listOpenRequestsForTeacher(teacherId: number) {
  const db = await requireDb();
  return db.select({
    id: teacherFeedbackRequests.id,
    essayId: teacherFeedbackRequests.essayId,
    essayTitle: essaySubmission.title,
    studentName: users.name,
    productKey: teacherFeedbackRequests.productKey,
    scopeJson: teacherFeedbackRequests.scopeJson,
    status: teacherFeedbackRequests.status,
    dueAt: teacherFeedbackRequests.dueAt,
    reworkCount: teacherFeedbackRequests.reworkCount,
    reworkNote: teacherFeedbackRequests.reworkNote,
    createdAt: teacherFeedbackRequests.createdAt,
  })
    .from(teacherFeedbackRequests)
    .leftJoin(essaySubmission, eq(essaySubmission.id, teacherFeedbackRequests.essayId))
    .leftJoin(users, eq(users.id, teacherFeedbackRequests.userId))
    .where(and(eq(teacherFeedbackRequests.teacherId, teacherId), inArray(teacherFeedbackRequests.status, [...OPEN_REQUEST_STATUSES])))
    .orderBy(teacherFeedbackRequests.dueAt)
    .limit(200);
}

export async function listRequestsAdmin(input: { status?: TeacherFeedbackRequestStatus; limit: number }) {
  const db = await requireDb();
  const base = db.select({
    id: teacherFeedbackRequests.id,
    userId: teacherFeedbackRequests.userId,
    studentName: users.name,
    studentEmail: users.email,
    essayId: teacherFeedbackRequests.essayId,
    essayTitle: essaySubmission.title,
    teacherId: teacherFeedbackRequests.teacherId,
    productKey: teacherFeedbackRequests.productKey,
    priceKrw: teacherFeedbackRequests.priceKrw,
    status: teacherFeedbackRequests.status,
    orderId: teacherFeedbackRequests.orderId,
    dueAt: teacherFeedbackRequests.dueAt,
    deliveredAt: teacherFeedbackRequests.deliveredAt,
    reworkCount: teacherFeedbackRequests.reworkCount,
    createdAt: teacherFeedbackRequests.createdAt,
  })
    .from(teacherFeedbackRequests)
    .leftJoin(users, eq(users.id, teacherFeedbackRequests.userId))
    .leftJoin(essaySubmission, eq(essaySubmission.id, teacherFeedbackRequests.essayId));
  const query = input.status ? base.where(eq(teacherFeedbackRequests.status, input.status)) : base;
  return query.orderBy(desc(teacherFeedbackRequests.id)).limit(input.limit);
}

/** 담당 교사가 작업을 시작한다(결제 완료 → 작업 중). */
export async function markRequestStarted(requestId: number, teacherId: number) {
  const db = await requireDb();
  const result = await db.update(teacherFeedbackRequests)
    .set({ status: "in_progress" })
    .where(and(eq(teacherFeedbackRequests.id, requestId), eq(teacherFeedbackRequests.teacherId, teacherId), eq(teacherFeedbackRequests.status, "paid")));
  return changedRows(result) > 0;
}

/** 첨삭이 등록되면 그 글의 열린 신청을 '전달 완료'로 바꾼다. 바뀐 신청이 있으면 true. */
export async function markDeliveredByEssay(essayId: number, teacherFeedbackId: number | null, now = new Date()) {
  const db = await requireDb();
  const result = await db.update(teacherFeedbackRequests)
    .set({ status: "delivered", deliveredAt: now, teacherFeedbackId })
    .where(and(eq(teacherFeedbackRequests.essayId, essayId), inArray(teacherFeedbackRequests.status, [...OPEN_REQUEST_STATUSES])));
  return changedRows(result) > 0;
}

/**
 * 취소를 선점한다(전달 전 신청만). 환불이 끝나기 전에 교사가 결과를 전달하는 경쟁을 막기 위해
 * 먼저 상태를 '취소'로 바꾸고, 환불이 실패하면 releaseCancel로 되돌린다.
 */
export async function claimCancel(requestId: number, userId: number, previousStatus: "paid" | "in_progress", reason: string, now = new Date()) {
  const db = await requireDb();
  const result = await db.update(teacherFeedbackRequests)
    .set({ status: "cancelled", cancelledAt: now, cancelReason: reason.slice(0, 255) })
    .where(and(eq(teacherFeedbackRequests.id, requestId), eq(teacherFeedbackRequests.userId, userId), eq(teacherFeedbackRequests.status, previousStatus)));
  return changedRows(result) > 0;
}

export async function releaseCancel(requestId: number, previousStatus: "paid" | "in_progress") {
  const db = await requireDb();
  await db.update(teacherFeedbackRequests)
    .set({ status: previousStatus, cancelledAt: null, cancelReason: null })
    .where(and(eq(teacherFeedbackRequests.id, requestId), eq(teacherFeedbackRequests.status, "cancelled")));
}

/** 전달된 첨삭이 약속한 범위에 못 미칠 때 학생이 무료 보완을 요청한다(전달 완료 → 작업 중, 완료 예정일 다시 계산). */
export async function requestRework(requestId: number, userId: number, note: string, now = new Date()) {
  const db = await requireDb();
  const result = await db.update(teacherFeedbackRequests)
    .set({ status: "in_progress", reworkCount: sql`${teacherFeedbackRequests.reworkCount} + 1`, reworkNote: note.slice(0, 2000), dueAt: computeDueAt(now) })
    .where(and(eq(teacherFeedbackRequests.id, requestId), eq(teacherFeedbackRequests.userId, userId), eq(teacherFeedbackRequests.status, "delivered")));
  return changedRows(result) > 0;
}

export async function notifyUser(userId: number, title: string, message: string) {
  const db = await requireDb();
  await db.insert(appNotifications).values({ userId, title: title.slice(0, 255), message, category: "teacher_feedback" });
}
