// 결제·이용권·교사 정산의 데이터 접근. 화면 단위 규칙은 billingRouter.ts, 금액 계산은 shared/settlement.ts에 있다.
import { and, count, desc, eq, gte, inArray, isNull, like, lt, or, sql } from "drizzle-orm";
import {
  aiUsageLogs,
  classAssignmentSubmissions,
  classAssignments,
  paymentOrders,
  subscriptions,
  teacherActivityAccounting,
  teacherFeedback,
  teacherSettlementRates,
  teacherSettlements,
  users,
  workbookTeacherFeedback,
} from "../drizzle/schema";
import { getDb, getSiteSetting, saveSiteSetting } from "./db";
import { getLedgerStart } from "./institutionDb";
import {
  DEFAULT_WITHHOLDING_PCT,
  SETTLEMENT_ACTIVITIES,
  emptyCounts,
  resolveRates,
  type ActivityCounts,
  type ActivityRates,
  type ActivityType,
  type SettlementTotals,
} from "../shared/settlement";

async function requireDb() {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  return db;
}

// ========== 주문·이용권 ==========

export async function createPaymentOrder(input: { userId: number; planKey: string; amountKrw: number; provider: string; isTest: boolean; providerOrderId: string }) {
  const db = await requireDb();
  await db.insert(paymentOrders).values({
    userId: input.userId,
    planKey: input.planKey,
    amountKrw: input.amountKrw,
    provider: input.provider,
    isTest: input.isTest ? 1 : 0,
    providerOrderId: input.providerOrderId,
    status: "pending",
  });
  const [order] = await db.select().from(paymentOrders).where(eq(paymentOrders.providerOrderId, input.providerOrderId));
  return order;
}

export async function getPaymentOrder(orderId: number) {
  const db = await requireDb();
  const [order] = await db.select().from(paymentOrders).where(eq(paymentOrders.id, orderId));
  return order;
}

export async function markOrderFailed(orderId: number, reason: string) {
  const db = await requireDb();
  await db.update(paymentOrders).set({ status: "failed", failureReason: reason.slice(0, 255) }).where(and(eq(paymentOrders.id, orderId), eq(paymentOrders.status, "pending")));
}

/**
 * 주문을 결제 완료로 확정하고 이용권을 만든다(한 번만). 이미 확정된 주문이면 아무것도 바꾸지 않고 null을 돌려준다.
 * 같은 사용자의 이전 이용권은 새 이용권이 시작되는 시점에 끝낸다.
 */
export async function confirmOrderAndActivateSubscription(input: { orderId: number; paymentKey: string; planKey: string; periodDays: number; aiEvaluationsLimit: number; now?: Date }) {
  const db = await requireDb();
  const now = input.now ?? new Date();
  return db.transaction(async (tx) => {
    const [result] = await tx.update(paymentOrders)
      .set({ status: "paid", providerPaymentKey: input.paymentKey, paidAt: now })
      .where(and(eq(paymentOrders.id, input.orderId), eq(paymentOrders.status, "pending")));
    if (Number((result as { affectedRows?: number }).affectedRows ?? 0) === 0) return null;

    const [order] = await tx.select().from(paymentOrders).where(eq(paymentOrders.id, input.orderId));
    await tx.update(subscriptions)
      .set({ status: "expired", currentPeriodEnd: now })
      .where(and(eq(subscriptions.userId, order.userId), inArray(subscriptions.status, ["active", "cancelled"]), gte(subscriptions.currentPeriodEnd, now)));
    const periodEnd = new Date(now.getTime() + input.periodDays * 24 * 60 * 60 * 1000);
    await tx.insert(subscriptions).values({
      userId: order.userId,
      planKey: input.planKey,
      status: "active",
      currentPeriodStart: now,
      currentPeriodEnd: periodEnd,
      aiEvaluationsLimit: input.aiEvaluationsLimit,
      orderId: order.id,
    });
    const [subscription] = await tx.select().from(subscriptions).where(eq(subscriptions.orderId, order.id));
    return subscription;
  });
}

/** 지금 유효한 이용권(취소했어도 결제한 기간이 남았으면 포함). 없으면 undefined. */
export async function getCurrentSubscription(userId: number, now = new Date()) {
  const db = await requireDb();
  const rows = await db.select().from(subscriptions)
    .where(and(eq(subscriptions.userId, userId), inArray(subscriptions.status, ["active", "cancelled"]), gte(subscriptions.currentPeriodEnd, now)))
    .orderBy(desc(subscriptions.currentPeriodEnd))
    .limit(1);
  return rows[0];
}

export async function cancelCurrentSubscription(userId: number, now = new Date()) {
  const db = await requireDb();
  const current = await getCurrentSubscription(userId, now);
  if (!current || current.status !== "active") return undefined;
  await db.update(subscriptions).set({ status: "cancelled", cancelledAt: now }).where(eq(subscriptions.id, current.id));
  return { ...current, status: "cancelled" as const, cancelledAt: now };
}

export async function listOrdersForUser(userId: number, limit = 20) {
  const db = await requireDb();
  return db.select().from(paymentOrders).where(eq(paymentOrders.userId, userId)).orderBy(desc(paymentOrders.createdAt)).limit(limit);
}

export async function listOrdersAdmin(input: { status?: "pending" | "paid" | "failed" | "cancelled" | "refunded"; search?: string; limit: number; offset: number }) {
  const db = await requireDb();
  const conditions = [];
  if (input.status) conditions.push(eq(paymentOrders.status, input.status));
  if (input.search) {
    const pattern = `%${input.search}%`;
    conditions.push(or(like(users.email, pattern), like(users.name, pattern), like(paymentOrders.providerOrderId, pattern)));
  }
  return db.select({
    id: paymentOrders.id,
    userId: paymentOrders.userId,
    userName: users.name,
    userEmail: users.email,
    planKey: paymentOrders.planKey,
    amountKrw: paymentOrders.amountKrw,
    status: paymentOrders.status,
    provider: paymentOrders.provider,
    providerOrderId: paymentOrders.providerOrderId,
    isTest: paymentOrders.isTest,
    paidAt: paymentOrders.paidAt,
    refundedAt: paymentOrders.refundedAt,
    failureReason: paymentOrders.failureReason,
    createdAt: paymentOrders.createdAt,
  })
    .from(paymentOrders)
    .leftJoin(users, eq(users.id, paymentOrders.userId))
    .where(conditions.length ? and(...conditions) : undefined)
    .orderBy(desc(paymentOrders.createdAt))
    .limit(input.limit)
    .offset(input.offset);
}

export async function summarizeBilling(now = new Date()) {
  const db = await requireDb();
  const orders = await db.select({ status: paymentOrders.status, amountKrw: paymentOrders.amountKrw, isTest: paymentOrders.isTest }).from(paymentOrders);
  // 실제 결제 금액에는 임시(테스트) 결제를 섞지 않는다. 테스트 주문은 따로 센다.
  const paid = orders.filter((order) => order.status === "paid" && order.isTest !== 1);
  const refunded = orders.filter((order) => order.status === "refunded" && order.isTest !== 1);
  const testPaid = orders.filter((order) => order.status === "paid" && order.isTest === 1);
  const [{ value: activeSubscriptions }] = await db.select({ value: count() }).from(subscriptions)
    .where(and(inArray(subscriptions.status, ["active", "cancelled"]), gte(subscriptions.currentPeriodEnd, now)));
  return {
    paidCount: paid.length,
    paidTotalKrw: paid.reduce((sum, order) => sum + order.amountKrw, 0),
    refundedCount: refunded.length,
    refundedTotalKrw: refunded.reduce((sum, order) => sum + order.amountKrw, 0),
    testOrderCount: orders.filter((order) => order.isTest === 1).length,
    testPaidTotalKrw: testPaid.reduce((sum, order) => sum + order.amountKrw, 0),
    activeSubscriptions: Number(activeSubscriptions),
  };
}

export async function listSubscriptionsAdmin(limit = 100) {
  const db = await requireDb();
  return db.select({
    id: subscriptions.id,
    userId: subscriptions.userId,
    userName: users.name,
    userEmail: users.email,
    planKey: subscriptions.planKey,
    status: subscriptions.status,
    currentPeriodStart: subscriptions.currentPeriodStart,
    currentPeriodEnd: subscriptions.currentPeriodEnd,
    aiEvaluationsLimit: subscriptions.aiEvaluationsLimit,
    cancelledAt: subscriptions.cancelledAt,
  })
    .from(subscriptions)
    .leftJoin(users, eq(users.id, subscriptions.userId))
    .orderBy(desc(subscriptions.createdAt))
    .limit(limit);
}

/** 결제 완료 주문을 환불 처리하고, 그 주문으로 만든 이용권을 즉시 끝낸다. */
export async function markOrderRefunded(orderId: number, now = new Date()) {
  const db = await requireDb();
  return db.transaction(async (tx) => {
    const [result] = await tx.update(paymentOrders).set({ status: "refunded", refundedAt: now }).where(and(eq(paymentOrders.id, orderId), eq(paymentOrders.status, "paid")));
    if (Number((result as { affectedRows?: number }).affectedRows ?? 0) === 0) return false;
    await tx.update(subscriptions).set({ status: "expired", currentPeriodEnd: now }).where(and(eq(subscriptions.orderId, orderId), inArray(subscriptions.status, ["active", "cancelled"])));
    return true;
  });
}

// ========== AI 평가 사용량(동시 요청에도 한도를 넘지 않도록 먼저 예약) ==========

export async function countAiUsage(userId: number, actionTypes: string[], since?: Date) {
  const db = await requireDb();
  const conditions = [eq(aiUsageLogs.userId, userId), inArray(aiUsageLogs.actionType, actionTypes)];
  if (since) conditions.push(gte(aiUsageLogs.createdAt, since));
  const [{ value }] = await db.select({ value: count() }).from(aiUsageLogs).where(and(...conditions));
  return Number(value);
}

/**
 * 사용 기록을 먼저 남긴 뒤 한도 안인지 확인한다. 한도를 넘으면 방금 남긴 기록을 지우고 false를 돌려준다.
 * (확인 후 기록하는 방식은 동시에 여러 요청이 들어오면 한도를 넘길 수 있다.)
 */
export async function reserveAiUsage(input: { userId: number; actionType: string; countedActionTypes: string[]; since?: Date; limit: number }) {
  const db = await requireDb();
  const [inserted] = await db.insert(aiUsageLogs).values({ userId: input.userId, actionType: input.actionType, tokensUsed: 0 });
  const reservationId = Number((inserted as { insertId?: number }).insertId ?? 0);
  const used = await countAiUsage(input.userId, input.countedActionTypes, input.since);
  if (used > input.limit) {
    if (reservationId) await db.delete(aiUsageLogs).where(eq(aiUsageLogs.id, reservationId));
    return { reserved: false as const, reservationId: 0 };
  }
  return { reserved: true as const, reservationId };
}

/** AI 호출이 실패하면 예약한 사용 기록을 돌려준다. */
export async function releaseAiUsage(reservationId: number) {
  if (!reservationId) return;
  const db = await requireDb();
  await db.delete(aiUsageLogs).where(eq(aiUsageLogs.id, reservationId));
}

export async function recordAiUsageTokens(reservationId: number, tokensUsed: number) {
  if (!reservationId) return;
  const db = await requireDb();
  await db.update(aiUsageLogs).set({ tokensUsed }).where(eq(aiUsageLogs.id, reservationId));
}

// ========== 교사 정산 ==========

const WITHHOLDING_SETTING_KEY = "settlement_withholding_pct";

export async function getSettlementRates(): Promise<ActivityRates> {
  const db = await requireDb();
  const rows = await db.select().from(teacherSettlementRates);
  return resolveRates(Object.fromEntries(rows.map((row) => [row.activityType, row.unitAmountKrw])));
}

export async function saveSettlementRate(activityType: ActivityType, unitAmountKrw: number, adminId: number) {
  const db = await requireDb();
  await db.insert(teacherSettlementRates).values({ activityType, unitAmountKrw, updatedBy: adminId })
    .onDuplicateKeyUpdate({ set: { unitAmountKrw, updatedBy: adminId } });
}

export async function getWithholdingPct(): Promise<number> {
  const stored = await getSiteSetting(WITHHOLDING_SETTING_KEY);
  const parsed = Number(stored);
  return stored !== null && stored !== undefined && stored !== "" && Number.isFinite(parsed) ? parsed : DEFAULT_WITHHOLDING_PCT;
}

export async function saveWithholdingPct(pct: number, adminId: number) {
  await saveSiteSetting(WITHHOLDING_SETTING_KEY, String(pct), adminId);
}

export async function listApprovedTeachers() {
  const db = await requireDb();
  return db.select({ id: users.id, name: users.name, email: users.email }).from(users).where(and(eq(users.role, "teacher"), eq(users.teacherStatus, "approved")));
}

export type ActivityBreakdown = { included: ActivityCounts; excludedAuto: number; excludedManual: number; /** 장부 도입 이후인데 장부에 기록되지 않은 활동(정리 전에는 금액에 넣지 않고 확정도 막는다) */ unreconciled: number };

/**
 * 한 달 동안 교사별 활동 건수. 정산 대상 여부는 활동이 처음 완료된 시점에 고정해 둔 장부(teacher_activity_accounting)를 따르고,
 * 장부 도입 전의 과거 활동(장부에 없는 것)은 이전처럼 개별 정산 대상으로 센다.
 */
export async function countTeacherActivityBreakdown(start: Date, end: Date, teacherId?: number): Promise<Map<number, ActivityBreakdown>> {
  const db = await requireDb();
  const result = new Map<number, ActivityBreakdown>();
  const bucket = (id: number) => {
    let entry = result.get(id);
    if (!entry) { entry = { included: emptyCounts(), excludedAuto: 0, excludedManual: 0, unreconciled: 0 }; result.set(id, entry); }
    return entry;
  };
  const addIncluded = (id: number, type: string, value: number) => {
    const included = bucket(id).included;
    if (type in included) included[type as ActivityType] += value;
  };

  const ledgerConditions = [gte(teacherActivityAccounting.occurredAt, start), lt(teacherActivityAccounting.occurredAt, end)];
  if (teacherId !== undefined) ledgerConditions.push(eq(teacherActivityAccounting.teacherId, teacherId));
  const ledgerRows = await db.select({
    teacherId: teacherActivityAccounting.teacherId,
    activityType: teacherActivityAccounting.activityType,
    automaticExclusion: teacherActivityAccounting.automaticExclusion,
    manualExcluded: teacherActivityAccounting.manualExcluded,
    value: count(),
  }).from(teacherActivityAccounting).where(and(...ledgerConditions))
    .groupBy(teacherActivityAccounting.teacherId, teacherActivityAccounting.activityType, teacherActivityAccounting.automaticExclusion, teacherActivityAccounting.manualExcluded);
  for (const row of ledgerRows) {
    const value = Number(row.value);
    if (row.automaticExclusion !== "none") bucket(row.teacherId).excludedAuto += value;
    else if (row.manualExcluded === 1) bucket(row.teacherId).excludedManual += value;
    else addIncluded(row.teacherId, row.activityType, value);
  }

  // 장부에 없는 활동: 장부 도입 전의 과거 활동은 이전처럼 개별 정산 대상이고,
  // 장부 도입 이후의 활동인데 장부에 없으면 기록에 실패한 것이므로 정리 전까지 금액에 넣지 않는다(기관 업무가 개별 정산으로 새는 것을 막는다).
  const ledgerStart = await getLedgerStart();
  const recentOf = (column: Parameters<typeof gte>[0]) => (ledgerStart ? sql<number>`coalesce(sum(case when ${column} >= ${ledgerStart} then 1 else 0 end), 0)` : sql<number>`0`);
  const addLegacy = (id: number, type: ActivityType, total: number, recent: number) => {
    addIncluded(id, type, total - recent);
    bucket(id).unreconciled += recent;
  };

  const essayConditions = [gte(teacherFeedback.createdAt, start), lt(teacherFeedback.createdAt, end), isNull(teacherActivityAccounting.id)];
  if (teacherId !== undefined) essayConditions.push(eq(teacherFeedback.teacherId, teacherId));
  const essayRows = await db.select({ teacherId: teacherFeedback.teacherId, value: count(), recent: recentOf(teacherFeedback.createdAt) }).from(teacherFeedback)
    .leftJoin(teacherActivityAccounting, and(eq(teacherActivityAccounting.activityType, "essay_feedback"), eq(teacherActivityAccounting.sourceId, teacherFeedback.id)))
    .where(and(...essayConditions)).groupBy(teacherFeedback.teacherId);
  for (const row of essayRows) addLegacy(row.teacherId, "essay_feedback", Number(row.value), Number(row.recent));

  // 반 과제 채점(과거): 과제를 만든 교사가 채점 담당으로 본다.
  const reviewConditions = [eq(classAssignmentSubmissions.status, "reviewed"), gte(classAssignmentSubmissions.reviewedAt, start), lt(classAssignmentSubmissions.reviewedAt, end), isNull(teacherActivityAccounting.id)];
  if (teacherId !== undefined) reviewConditions.push(eq(classAssignments.createdBy, teacherId));
  const reviewRows = await db.select({ teacherId: classAssignments.createdBy, value: count(), recent: recentOf(classAssignmentSubmissions.reviewedAt) })
    .from(classAssignmentSubmissions)
    .innerJoin(classAssignments, eq(classAssignments.id, classAssignmentSubmissions.assignmentId))
    .leftJoin(teacherActivityAccounting, and(eq(teacherActivityAccounting.activityType, "assignment_review"), eq(teacherActivityAccounting.sourceId, classAssignmentSubmissions.id)))
    .where(and(...reviewConditions)).groupBy(classAssignments.createdBy);
  for (const row of reviewRows) addLegacy(row.teacherId, "assignment_review", Number(row.value), Number(row.recent));

  const workbookConditions = [gte(workbookTeacherFeedback.createdAt, start), lt(workbookTeacherFeedback.createdAt, end), isNull(teacherActivityAccounting.id)];
  if (teacherId !== undefined) workbookConditions.push(eq(workbookTeacherFeedback.teacherId, teacherId));
  const workbookRows = await db.select({ teacherId: workbookTeacherFeedback.teacherId, value: count(), recent: recentOf(workbookTeacherFeedback.createdAt) }).from(workbookTeacherFeedback)
    .leftJoin(teacherActivityAccounting, and(eq(teacherActivityAccounting.activityType, "workbook_feedback"), eq(teacherActivityAccounting.sourceId, workbookTeacherFeedback.id)))
    .where(and(...workbookConditions)).groupBy(workbookTeacherFeedback.teacherId);
  for (const row of workbookRows) addLegacy(row.teacherId, "workbook_feedback", Number(row.value), Number(row.recent));

  return result;
}

/** 정산 대상(개별 정산) 건수만 모은 교사별 집계. 정산서 산출에 쓴다. */
export async function countTeacherActivities(start: Date, end: Date, teacherId?: number): Promise<Map<number, ActivityCounts>> {
  const breakdown = await countTeacherActivityBreakdown(start, end, teacherId);
  return new Map(Array.from(breakdown.entries()).map(([id, entry]) => [id, entry.included]));
}

export async function getSettlement(teacherId: number, periodMonth: string) {
  const db = await requireDb();
  const [row] = await db.select().from(teacherSettlements).where(and(eq(teacherSettlements.teacherId, teacherId), eq(teacherSettlements.periodMonth, periodMonth)));
  return row;
}

export async function getSettlementById(id: number) {
  const db = await requireDb();
  const [row] = await db.select().from(teacherSettlements).where(eq(teacherSettlements.id, id));
  return row;
}

export async function listSettlementsForTeacher(teacherId: number) {
  const db = await requireDb();
  return db.select().from(teacherSettlements).where(eq(teacherSettlements.teacherId, teacherId)).orderBy(desc(teacherSettlements.periodMonth));
}

export async function listSettlementsByMonth(periodMonth: string) {
  const db = await requireDb();
  return db.select().from(teacherSettlements).where(eq(teacherSettlements.periodMonth, periodMonth));
}

/** 정산서를 산출(초안)한다. 이미 확정·지급된 정산서는 바꾸지 않는다(false). */
export async function upsertDraftSettlement(teacherId: number, periodMonth: string, totals: SettlementTotals) {
  const db = await requireDb();
  const existing = await getSettlement(teacherId, periodMonth);
  if (existing && existing.status !== "draft") return false;
  const values = {
    itemsJson: JSON.stringify(totals.items),
    grossKrw: totals.grossKrw,
    withholdingPct: String(totals.withholdingPct),
    withholdingKrw: totals.withholdingKrw,
    netKrw: totals.netKrw,
  };
  if (existing) {
    // 갱신 조건에도 초안 상태를 넣어, 읽은 뒤 다른 요청이 확정해도 확정된 금액을 덮어쓰지 않는다.
    const [result] = await db.update(teacherSettlements).set(values).where(and(eq(teacherSettlements.id, existing.id), eq(teacherSettlements.status, "draft")));
    return Number((result as { affectedRows?: number }).affectedRows ?? 0) > 0;
  }
  await db.insert(teacherSettlements).values({ teacherId, periodMonth, status: "draft", ...values });
  return true;
}

export async function confirmSettlement(id: number, adminId: number, now = new Date()) {
  const db = await requireDb();
  const [result] = await db.update(teacherSettlements)
    .set({ status: "confirmed", confirmedBy: adminId, confirmedAt: now })
    .where(and(eq(teacherSettlements.id, id), eq(teacherSettlements.status, "draft")));
  return Number((result as { affectedRows?: number }).affectedRows ?? 0) > 0;
}

export async function markSettlementPaid(id: number, adminId: number, note: string | undefined, now = new Date()) {
  const db = await requireDb();
  const [result] = await db.update(teacherSettlements)
    .set({ status: "paid", paidBy: adminId, paidAt: now, ...(note !== undefined ? { note } : {}) })
    .where(and(eq(teacherSettlements.id, id), eq(teacherSettlements.status, "confirmed")));
  return Number((result as { affectedRows?: number }).affectedRows ?? 0) > 0;
}

export const SETTLEMENT_ACTIVITY_TYPES = SETTLEMENT_ACTIVITIES.map((activity) => activity.type);
