// 교사 첨삭지도권(횟수권)과 교사 첨삭 신청의 데이터 접근.
// 화면 단위 규칙은 teacherFeedbackRequestRouter.ts, 순수 규칙은 shared/teacherFeedbackRequest.ts에 있다.
import { and, desc, eq, gt, inArray, lt, sql } from "drizzle-orm";
import { appNotifications, essaySubmission, paymentOrders, teacherFeedbackPasses, teacherFeedbackRequests, users } from "../drizzle/schema";
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

// ========== 교사 첨삭지도권 ==========

/**
 * 주문을 결제 완료로 확정하고 첨삭지도권을 만든다(한 번만). 이미 확정된 주문이면 아무것도 바꾸지 않고 null을 돌려준다.
 */
export async function createPassForPaidOrder(input: {
  orderId: number;
  paymentKey: string;
  userId: number;
  productKey: string;
  sessions: number;
  priceKrw: number;
  periodDays: number;
  now?: Date;
}) {
  const db = await requireDb();
  const now = input.now ?? new Date();
  return db.transaction(async (tx) => {
    const paid = await tx.update(paymentOrders)
      .set({ status: "paid", providerPaymentKey: input.paymentKey, paidAt: now })
      .where(and(eq(paymentOrders.id, input.orderId), eq(paymentOrders.status, "pending")));
    if (changedRows(paid) === 0) return null;
    await tx.insert(teacherFeedbackPasses).values({
      userId: input.userId,
      productKey: input.productKey,
      sessions: input.sessions,
      sessionsUsed: 0,
      priceKrw: input.priceKrw,
      orderId: input.orderId,
      status: "active",
      expiresAt: new Date(now.getTime() + input.periodDays * 24 * 60 * 60 * 1000),
    });
    const [pass] = await tx.select().from(teacherFeedbackPasses).where(eq(teacherFeedbackPasses.orderId, input.orderId));
    return pass ?? null;
  });
}

/** 내 첨삭지도권(환불되지 않은 것, 최근 순). 만료·소진 여부는 호출한 쪽이 판단한다. */
export async function listPassesForUser(userId: number) {
  const db = await requireDb();
  return db.select().from(teacherFeedbackPasses)
    .where(and(eq(teacherFeedbackPasses.userId, userId), eq(teacherFeedbackPasses.status, "active")))
    .orderBy(desc(teacherFeedbackPasses.id))
    .limit(100);
}

export async function getPassById(passId: number) {
  const db = await requireDb();
  const [row] = await db.select().from(teacherFeedbackPasses).where(eq(teacherFeedbackPasses.id, passId));
  return row;
}

export async function listPassesAdmin(limit: number) {
  const db = await requireDb();
  return db.select({
    id: teacherFeedbackPasses.id,
    userId: teacherFeedbackPasses.userId,
    userName: users.name,
    userEmail: users.email,
    productKey: teacherFeedbackPasses.productKey,
    sessions: teacherFeedbackPasses.sessions,
    sessionsUsed: teacherFeedbackPasses.sessionsUsed,
    priceKrw: teacherFeedbackPasses.priceKrw,
    orderId: teacherFeedbackPasses.orderId,
    status: teacherFeedbackPasses.status,
    expiresAt: teacherFeedbackPasses.expiresAt,
    createdAt: teacherFeedbackPasses.createdAt,
  })
    .from(teacherFeedbackPasses)
    .leftJoin(users, eq(users.id, teacherFeedbackPasses.userId))
    .orderBy(desc(teacherFeedbackPasses.id))
    .limit(limit);
}

// ========== 교사 첨삭 신청 ==========

/**
 * 첨삭지도권 1회를 차감해 신청을 만든다(한 트랜잭션). 차감은 '환불되지 않음·유효기간 안·남은 횟수 있음'일 때만 되는
 * 조건부 갱신이라 동시에 여러 번 신청해도 횟수를 넘지 못한다. 차감할 수 없으면 null.
 * 초안 상태의 글은 이 시점에 '제출됨'으로 바꿔 교사가 볼 수 있게 한다.
 */
export async function createRequestUsingPass(input: { userId: number; essayId: number; passId: number; teacherId: number; now?: Date }) {
  const db = await requireDb();
  const now = input.now ?? new Date();
  return db.transaction(async (tx) => {
    const consumed = await tx.update(teacherFeedbackPasses)
      .set({ sessionsUsed: sql`${teacherFeedbackPasses.sessionsUsed} + 1` })
      .where(and(
        eq(teacherFeedbackPasses.id, input.passId),
        eq(teacherFeedbackPasses.userId, input.userId),
        eq(teacherFeedbackPasses.status, "active"),
        gt(teacherFeedbackPasses.expiresAt, now),
        lt(teacherFeedbackPasses.sessionsUsed, teacherFeedbackPasses.sessions),
      ));
    if (changedRows(consumed) === 0) return null;

    // 같은 글에 열린 신청이 이미 있으면 되돌린다(트랜잭션 롤백).
    const [open] = await tx.select({ id: teacherFeedbackRequests.id }).from(teacherFeedbackRequests)
      .where(and(eq(teacherFeedbackRequests.essayId, input.essayId), inArray(teacherFeedbackRequests.status, [...OPEN_REQUEST_STATUSES])))
      .limit(1);
    if (open) throw new Error("DUPLICATE_OPEN_REQUEST");

    await tx.insert(teacherFeedbackRequests).values({
      userId: input.userId,
      essayId: input.essayId,
      passId: input.passId,
      teacherId: input.teacherId,
      status: "paid",
      dueAt: computeDueAt(now),
    });
    await tx.update(essaySubmission)
      .set({ status: "submitted", submittedAt: now, syncRevision: sql`${essaySubmission.syncRevision} + 1` })
      .where(and(eq(essaySubmission.id, input.essayId), eq(essaySubmission.userId, input.userId), eq(essaySubmission.status, "draft")));
    const [request] = await tx.select().from(teacherFeedbackRequests)
      .where(and(eq(teacherFeedbackRequests.essayId, input.essayId), eq(teacherFeedbackRequests.passId, input.passId)))
      .orderBy(desc(teacherFeedbackRequests.id))
      .limit(1);
    return request ?? null;
  });
}

export async function getRequestById(requestId: number) {
  const db = await requireDb();
  const [row] = await db.select().from(teacherFeedbackRequests).where(eq(teacherFeedbackRequests.id, requestId));
  return row;
}

/** 글에 대해 아직 결과가 전달되지 않은 신청(신청 완료·작업 중). 없으면 undefined. */
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
    passId: teacherFeedbackRequests.passId,
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
    passId: teacherFeedbackRequests.passId,
    status: teacherFeedbackRequests.status,
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

/** 담당 교사가 작업을 시작한다(신청 완료 → 작업 중). */
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
 * 결과 전달 전에 신청을 취소하고 첨삭지도권 1회를 돌려준다(한 트랜잭션). 전달·취소된 신청이면 false.
 * 돈을 환불하지 않고 횟수를 복원하므로 교사가 전달하는 경쟁은 '열린 상태일 때만 취소'하는 조건 하나로 막는다.
 */
export async function cancelRequestRestoreSession(requestId: number, userId: number, reason: string, now = new Date()) {
  const db = await requireDb();
  return db.transaction(async (tx) => {
    const cancelled = await tx.update(teacherFeedbackRequests)
      .set({ status: "cancelled", cancelledAt: now, cancelReason: reason.slice(0, 255) })
      .where(and(eq(teacherFeedbackRequests.id, requestId), eq(teacherFeedbackRequests.userId, userId), inArray(teacherFeedbackRequests.status, [...OPEN_REQUEST_STATUSES])));
    if (changedRows(cancelled) === 0) return false;
    const [request] = await tx.select({ passId: teacherFeedbackRequests.passId }).from(teacherFeedbackRequests).where(eq(teacherFeedbackRequests.id, requestId));
    if (request) {
      await tx.update(teacherFeedbackPasses)
        .set({ sessionsUsed: sql`GREATEST(${teacherFeedbackPasses.sessionsUsed} - 1, 0)` })
        .where(eq(teacherFeedbackPasses.id, request.passId));
    }
    return true;
  });
}

/** 전달된 첨삭이 약속한 범위에 못 미칠 때 학생이 무료 보완을 요청한다(전달 완료 → 작업 중, 완료 예정일 다시 계산). 횟수는 더 차감하지 않는다. */
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
