// 결제(이용권)와 교사 정산 API.
import { TRPCError } from "@trpc/server";
import { nanoid } from "nanoid";
import { z } from "zod";
import { PLANS, getPlan } from "../shared/plans";
import {
  SETTLEMENT_ACTIVITIES,
  computeSettlement,
  currentMonthKst,
  emptyCounts,
  isValidMonth,
  monthRange,
  type ActivityType,
  type SettlementItem,
} from "../shared/settlement";
import { protectedProcedure, publicProcedure, router } from "./_core/trpc";
import * as billingDb from "./billingDb";
import * as institution from "./institutionDb";
import { exclusionLabel, isSettlementExcluded, type AutomaticExclusion } from "../shared/institution";
import { getPaymentProvider } from "./billing/providers";
import { getAiEntitlement } from "./billing/service";
import { RATE_RULES, consumeRateLimit } from "./rateLimit";

type SessionUser = { id: number; role: string; tag?: string | null; teacherStatus?: string | null };

function assertAdmin(user: SessionUser) {
  if (user.role !== "admin") throw new TRPCError({ code: "FORBIDDEN", message: "관리자 권한이 필요합니다." });
}

function assertApprovedTeacher(user: SessionUser) {
  if (user.role !== "teacher" || user.teacherStatus !== "approved") throw new TRPCError({ code: "FORBIDDEN", message: "승인된 교사만 정산 내역을 볼 수 있습니다." });
}

function assertLearner(user: SessionUser) {
  if (user.role !== "user" || user.tag === "학부모") throw new TRPCError({ code: "FORBIDDEN", message: "학습자 계정만 이용권을 결제할 수 있습니다." });
}

const monthInput = z.string().refine(isValidMonth, "정산 월은 YYYY-MM 형식이어야 합니다.");

function parseItems(itemsJson: string): SettlementItem[] {
  try {
    return JSON.parse(itemsJson) as SettlementItem[];
  } catch {
    return [];
  }
}

function describeStatement(row: NonNullable<Awaited<ReturnType<typeof billingDb.getSettlement>>>) {
  return {
    id: row.id,
    teacherId: row.teacherId,
    periodMonth: row.periodMonth,
    status: row.status,
    items: parseItems(row.itemsJson),
    grossKrw: row.grossKrw,
    withholdingPct: Number(row.withholdingPct),
    withholdingKrw: row.withholdingKrw,
    netKrw: row.netKrw,
    note: row.note,
    confirmedAt: row.confirmedAt,
    paidAt: row.paidAt,
  };
}

export const billingRouter = router({
  /** 이용권 목록과 결제 방식(임시 결제 여부). 로그인하지 않아도 볼 수 있다. */
  plans: publicProcedure.query(() => {
    const provider = getPaymentProvider();
    return { plans: PLANS, provider: provider.name, isTest: provider.isTest };
  }),

  mySubscription: protectedProcedure.query(async ({ ctx }) => {
    const [subscription, entitlement] = await Promise.all([billingDb.getCurrentSubscription(ctx.user.id), getAiEntitlement(ctx.user)]);
    return { subscription: subscription ?? null, entitlement };
  }),

  myOrders: protectedProcedure.query(({ ctx }) => billingDb.listOrdersForUser(ctx.user.id)),

  startCheckout: protectedProcedure
    .input(z.object({ planKey: z.enum(["starter", "growth"]) }))
    .mutation(async ({ ctx, input }) => {
      assertLearner(ctx.user);
      const limit = consumeRateLimit("checkout", String(ctx.user.id), RATE_RULES.checkoutByUser);
      if (!limit.allowed) throw new TRPCError({ code: "TOO_MANY_REQUESTS", message: "결제 요청이 너무 많습니다. 잠시 후 다시 시도해 주세요." });

      const plan = getPlan(input.planKey);
      if (!plan) throw new TRPCError({ code: "BAD_REQUEST", message: "선택한 이용권을 찾을 수 없습니다." });
      const provider = getPaymentProvider();
      const order = await billingDb.createPaymentOrder({
        userId: ctx.user.id,
        planKey: plan.key,
        amountKrw: plan.priceKrw,
        provider: provider.name,
        isTest: provider.isTest,
        providerOrderId: `EM-${Date.now().toString(36).toUpperCase()}-${nanoid(8).toUpperCase()}`,
      });

      const result = await provider.createCheckout({
        orderId: order.providerOrderId,
        amountKrw: plan.priceKrw,
        planName: plan.name,
        buyer: { id: ctx.user.id, name: ctx.user.name ?? null, email: ctx.user.email ?? null },
      });

      if (result.status === "failed") {
        await billingDb.markOrderFailed(order.id, result.reason);
        throw new TRPCError({ code: "BAD_REQUEST", message: result.reason });
      }
      if (result.status === "redirect") {
        return { status: "redirect" as const, orderId: order.id, redirectUrl: result.url, isTest: provider.isTest, subscription: null };
      }
      const subscription = await billingDb.confirmOrderAndActivateSubscription({
        orderId: order.id,
        paymentKey: result.paymentKey,
        planKey: plan.key,
        periodDays: plan.periodDays,
        aiEvaluationsLimit: plan.monthlyAiEvaluations,
      });
      return { status: "paid" as const, orderId: order.id, redirectUrl: null, isTest: provider.isTest, subscription: subscription ?? null };
    }),

  /** 이용권 해지. 이미 결제한 기간이 끝날 때까지는 계속 이용할 수 있다. */
  cancelSubscription: protectedProcedure.mutation(async ({ ctx }) => {
    assertLearner(ctx.user);
    const cancelled = await billingDb.cancelCurrentSubscription(ctx.user.id);
    if (!cancelled) throw new TRPCError({ code: "BAD_REQUEST", message: "해지할 이용권이 없습니다." });
    return { periodEnd: cancelled.currentPeriodEnd };
  }),

  // ----- 관리자 -----
  adminSummary: protectedProcedure.query(async ({ ctx }) => {
    assertAdmin(ctx.user);
    const provider = getPaymentProvider();
    return { ...(await billingDb.summarizeBilling()), provider: provider.name, isTest: provider.isTest };
  }),

  adminOrders: protectedProcedure
    .input(z.object({
      status: z.enum(["pending", "paid", "failed", "cancelled", "refunded"]).optional(),
      search: z.string().trim().max(100).optional(),
      limit: z.number().int().min(1).max(200).default(50),
      offset: z.number().int().min(0).default(0),
    }))
    .query(async ({ ctx, input }) => {
      assertAdmin(ctx.user);
      return billingDb.listOrdersAdmin(input);
    }),

  adminSubscriptions: protectedProcedure.query(async ({ ctx }) => {
    assertAdmin(ctx.user);
    return billingDb.listSubscriptionsAdmin(200);
  }),

  adminRefund: protectedProcedure
    .input(z.object({ orderId: z.number().int().positive(), reason: z.string().trim().min(2).max(200) }))
    .mutation(async ({ ctx, input }) => {
      assertAdmin(ctx.user);
      const order = await billingDb.getPaymentOrder(input.orderId);
      if (!order) throw new TRPCError({ code: "NOT_FOUND", message: "주문을 찾을 수 없습니다." });
      if (order.status !== "paid") throw new TRPCError({ code: "BAD_REQUEST", message: "결제 완료 상태의 주문만 환불할 수 있습니다." });
      // 환불은 주문을 만든 제공자로 처리한다(설정이 바뀌었어도 임시 결제 주문을 실제 제공자로 환불하지 않는다).
      const provider = getPaymentProvider(order.provider);
      const refund = await provider.refund({ paymentKey: order.providerPaymentKey ?? "", amountKrw: order.amountKrw, reason: input.reason });
      if (!refund.refunded) throw new TRPCError({ code: "BAD_REQUEST", message: refund.reason ?? "환불을 처리하지 못했습니다." });
      await billingDb.markOrderRefunded(order.id);
      return { success: true as const };
    }),
});

export const settlementRouter = router({
  /** 교사 본인의 한 달 정산(확정 전에는 현재 활동 기준 예상액). */
  myOverview: protectedProcedure
    .input(z.object({ month: monthInput.optional() }))
    .query(async ({ ctx, input }) => {
      assertApprovedTeacher(ctx.user);
      const month = input.month ?? currentMonthKst();
      const { start, end } = monthRange(month);
      const [rates, withholdingPct, breakdownByTeacher, statement] = await Promise.all([
        billingDb.getSettlementRates(),
        billingDb.getWithholdingPct(),
        billingDb.countTeacherActivityBreakdown(start, end, ctx.user.id),
        billingDb.getSettlement(ctx.user.id, month),
      ]);
      const breakdown = breakdownByTeacher.get(ctx.user.id) ?? { included: emptyCounts(), excludedAuto: 0, excludedManual: 0, unreconciled: 0 };
      const counts = breakdown.included;
      const estimate = computeSettlement(counts, rates, withholdingPct);
      const includedTotal = Object.values(counts).reduce((sum, value) => sum + value, 0);
      return {
        month,
        isCurrentMonth: month === currentMonthKst(),
        // 전체 활동 = 정산 대상 + 기관 계약·소속으로 자동 제외 + 교사가 직접 제외(기관 업무량도 숨기지 않고 보여 준다)
        workload: { total: includedTotal + breakdown.excludedAuto + breakdown.excludedManual, included: includedTotal, excludedAuto: breakdown.excludedAuto, excludedManual: breakdown.excludedManual, unreconciled: breakdown.unreconciled ?? 0 },
        counts,
        rates,
        activities: SETTLEMENT_ACTIVITIES,
        estimate,
        // 확정·지급된 정산서는 그 시점의 금액이 기준이다(이후 단가가 바뀌어도 변하지 않는다).
        statement: statement && statement.status !== "draft" ? describeStatement(statement) : null,
      };
    }),

  /** 이 달에 한 활동 목록과 정산 대상 여부. 교사는 자기 활동을 정산에서 제외(또는 되돌리기)할 수 있다. */
  myActivities: protectedProcedure
    .input(z.object({ month: monthInput }))
    .query(async ({ ctx, input }) => {
      assertApprovedTeacher(ctx.user);
      const { start, end } = monthRange(input.month);
      const [rows, statement] = await Promise.all([institution.listTeacherActivitiesForMonth(ctx.user.id, start, end), billingDb.getSettlement(ctx.user.id, input.month)]);
      // 확정·지급된 달은 바꿀 수 없다.
      const frozen = Boolean(statement && statement.status !== "draft");
      return {
        frozen,
        activities: rows.map((row) => ({
          activityType: row.activityType,
          sourceId: row.sourceId,
          occurredAt: row.occurredAt,
          studentName: row.studentName,
          excluded: isSettlementExcluded({ automaticExclusion: row.automaticExclusion as AutomaticExclusion, manualExcluded: row.manualExcluded }),
          label: exclusionLabel({ automaticExclusion: row.automaticExclusion as AutomaticExclusion, manualExcluded: row.manualExcluded }),
          automatic: row.automaticExclusion !== "none",
          manualReason: row.manualExclusionReason,
          // 자동 제외(기관 계약·소속)는 바꿀 수 없고, 수동 제외만 되돌릴 수 있다.
          canToggle: !frozen && row.automaticExclusion === "none",
        })),
      };
    }),

  /** 교사가 자기 활동을 개별 정산에서 제외하거나 되돌린다. 사유가 필요하고 변경 이력이 남는다. */
  setActivityExclusion: protectedProcedure
    .input(z.object({
      activityType: z.enum(SETTLEMENT_ACTIVITIES.map((activity) => activity.type) as [ActivityType, ...ActivityType[]]),
      sourceId: z.number().int().positive(),
      excluded: z.boolean(),
      reason: z.string().trim().min(2).max(500),
    }))
    .mutation(async ({ ctx, input }) => {
      if (ctx.user.role !== "admin") assertApprovedTeacher(ctx.user);
      // 소유자 확인이 끝나기 전에는 아무것도 기록하지 않는다(다른 교사의 활동에 장부 행이 만들어지는 일을 막는다).
      const existingRow = await institution.getAccounting(input.activityType, input.sourceId);
      const source = existingRow ? { teacherId: existingRow.teacherId } : await institution.resolveActivitySource(input.activityType, input.sourceId);
      if (!source) throw new TRPCError({ code: "NOT_FOUND", message: "활동을 찾을 수 없습니다." });
      if (ctx.user.role !== "admin" && source.teacherId !== ctx.user.id) throw new TRPCError({ code: "FORBIDDEN", message: "본인의 활동만 정산 제외를 바꿀 수 있습니다." });
      const row = existingRow ?? await institution.ensureAccountingRow(input.activityType, input.sourceId);
      if (!row) throw new TRPCError({ code: "NOT_FOUND", message: "활동을 찾을 수 없습니다." });
      if (row.automaticExclusion !== "none") throw new TRPCError({ code: "BAD_REQUEST", message: "기관 계약·소속으로 자동 제외된 활동은 바꿀 수 없습니다." });
      // 확정·지급된 정산서가 있는 달의 활동은 바꿀 수 없다.
      const statement = await billingDb.getSettlement(row.teacherId, currentMonthKst(new Date(row.occurredAt)));
      if (statement && statement.status !== "draft") throw new TRPCError({ code: "BAD_REQUEST", message: "이미 확정된 정산 월의 활동은 바꿀 수 없습니다." });
      // 되돌리기는 제외한 사람 본인이나 관리자만 할 수 있다. 이미 제외된 활동을 다시 제외해도 처음 제외한 사람은 바뀌지 않는다.
      if (ctx.user.role !== "admin" && row.manualExcluded === 1 && row.manualExcludedBy !== null && row.manualExcludedBy !== ctx.user.id) throw new TRPCError({ code: "FORBIDDEN", message: "다른 사람이 제외한 활동은 바꿀 수 없습니다." });
      await institution.setManualExclusion({ activityType: input.activityType, sourceId: input.sourceId, excluded: input.excluded, reason: input.reason, actorId: ctx.user.id });
      return { success: true as const };
    }),

  myStatements: protectedProcedure.query(async ({ ctx }) => {
    assertApprovedTeacher(ctx.user);
    const rows = await billingDb.listSettlementsForTeacher(ctx.user.id);
    // 교사에게는 확정된 정산서만 보여준다(초안은 운영팀 작업 중인 값).
    return rows.filter((row) => row.status !== "draft").map(describeStatement);
  }),

  // ----- 관리자 -----
  adminOverview: protectedProcedure
    .input(z.object({ month: monthInput }))
    .query(async ({ ctx, input }) => {
      assertAdmin(ctx.user);
      const { start, end } = monthRange(input.month);
      const [teachers, rates, withholdingPct, counts, statements] = await Promise.all([
        billingDb.listApprovedTeachers(),
        billingDb.getSettlementRates(),
        billingDb.getWithholdingPct(),
        billingDb.countTeacherActivityBreakdown(start, end),
        billingDb.listSettlementsByMonth(input.month),
      ]);
      const statementByTeacher = new Map(statements.map((row) => [row.teacherId, row]));
      const rows = teachers.map((teacher) => {
        const statement = statementByTeacher.get(teacher.id);
        const breakdown = counts.get(teacher.id) ?? { included: emptyCounts(), excludedAuto: 0, excludedManual: 0, unreconciled: 0 };
        const teacherCounts = breakdown.included;
        return {
          teacherId: teacher.id,
          name: teacher.name,
          email: teacher.email,
          counts: teacherCounts,
          excludedAuto: breakdown.excludedAuto,
          excludedManual: breakdown.excludedManual,
          unreconciled: breakdown.unreconciled ?? 0,
          estimate: computeSettlement(teacherCounts, rates, withholdingPct),
          statement: statement ? describeStatement(statement) : null,
        };
      });
      return { month: input.month, isClosed: input.month < currentMonthKst(), rates, withholdingPct, activities: SETTLEMENT_ACTIVITIES, rows };
    }),

  /** 정산서를 산출(초안 저장)한다. 확정·지급된 정산서는 건너뛴다. */
  adminGenerate: protectedProcedure
    .input(z.object({ month: monthInput, teacherIds: z.array(z.number().int().positive()).max(500).optional() }))
    .mutation(async ({ ctx, input }) => {
      assertAdmin(ctx.user);
      const { start, end } = monthRange(input.month);
      const [teachers, rates, withholdingPct, counts] = await Promise.all([
        billingDb.listApprovedTeachers(),
        billingDb.getSettlementRates(),
        billingDb.getWithholdingPct(),
        billingDb.countTeacherActivities(start, end),
      ]);
      let generated = 0;
      let skipped = 0;
      for (const teacher of teachers) {
        if (input.teacherIds && !input.teacherIds.includes(teacher.id)) continue;
        const totals = computeSettlement(counts.get(teacher.id) ?? emptyCounts(), rates, withholdingPct);
        // 활동이 없는 교사의 빈 정산서는 만들지 않는다.
        if (totals.grossKrw === 0 && !(await billingDb.getSettlement(teacher.id, input.month))) continue;
        if (await billingDb.upsertDraftSettlement(teacher.id, input.month, totals)) generated += 1;
        else skipped += 1;
      }
      return { generated, skipped };
    }),

  /** 장부 기록에 실패했던 최근 활동을 지금의 정책으로 기록해 정리한다(그 뒤 정산서를 다시 산출·확정한다). */
  adminReconcile: protectedProcedure
    .input(z.object({ month: monthInput, teacherId: z.number().int().positive() }))
    .mutation(async ({ ctx, input }) => {
      assertAdmin(ctx.user);
      const { start, end } = monthRange(input.month);
      return { reconciled: await institution.reconcileUnaccountedActivities(input.teacherId, start, end) };
    }),

  adminConfirm: protectedProcedure
    .input(z.object({ id: z.number().int().positive() }))
    .mutation(async ({ ctx, input }) => {
      assertAdmin(ctx.user);
      const statement = await billingDb.getSettlementById(input.id);
      if (!statement) throw new TRPCError({ code: "NOT_FOUND", message: "정산서를 찾을 수 없습니다." });
      // 진행 중인 달은 건수가 계속 늘어나므로 확정할 수 없다.
      if (statement.periodMonth >= currentMonthKst()) throw new TRPCError({ code: "BAD_REQUEST", message: "해당 월이 끝난 뒤에 확정할 수 있습니다." });
      if (statement.status !== "draft") throw new TRPCError({ code: "BAD_REQUEST", message: "산출 중(초안) 상태의 정산서만 확정할 수 있습니다." });
      // 확정하기 직전에 지금의 활동·제외 상태·단가로 다시 계산한다(오래된 초안이 그대로 확정되지 않도록).
      const { start, end } = monthRange(statement.periodMonth);
      // 장부에 기록되지 않은 최근 활동이 있으면 금액이 틀릴 수 있으므로 정리하기 전에는 확정할 수 없다.
      const pending = (await billingDb.countTeacherActivityBreakdown(start, end, statement.teacherId)).get(statement.teacherId)?.unreconciled ?? 0;
      if (pending > 0) throw new TRPCError({ code: "BAD_REQUEST", message: `장부에 기록되지 않은 활동이 ${pending}건 있습니다. '장부 정리'를 한 뒤 다시 산출·확정해 주세요.` });
      const [rates, withholdingPct, counts] = await Promise.all([billingDb.getSettlementRates(), billingDb.getWithholdingPct(), billingDb.countTeacherActivities(start, end, statement.teacherId)]);
      await billingDb.upsertDraftSettlement(statement.teacherId, statement.periodMonth, computeSettlement(counts.get(statement.teacherId) ?? emptyCounts(), rates, withholdingPct));
      if (!(await billingDb.confirmSettlement(statement.id, ctx.user.id))) throw new TRPCError({ code: "BAD_REQUEST", message: "산출 중(초안) 상태의 정산서만 확정할 수 있습니다." });
      return { success: true as const };
    }),

  adminMarkPaid: protectedProcedure
    .input(z.object({ id: z.number().int().positive(), note: z.string().trim().max(500).optional() }))
    .mutation(async ({ ctx, input }) => {
      assertAdmin(ctx.user);
      if (!(await billingDb.markSettlementPaid(input.id, ctx.user.id, input.note))) throw new TRPCError({ code: "BAD_REQUEST", message: "확정된 정산서만 지급 완료로 처리할 수 있습니다." });
      return { success: true as const };
    }),

  adminSaveRate: protectedProcedure
    .input(z.object({ activityType: z.enum(SETTLEMENT_ACTIVITIES.map((activity) => activity.type) as [ActivityType, ...ActivityType[]]), unitAmountKrw: z.number().int().min(0).max(1_000_000) }))
    .mutation(async ({ ctx, input }) => {
      assertAdmin(ctx.user);
      await billingDb.saveSettlementRate(input.activityType, input.unitAmountKrw, ctx.user.id);
      return { success: true as const };
    }),

  adminSaveWithholding: protectedProcedure
    .input(z.object({ pct: z.number().min(0).max(100) }))
    .mutation(async ({ ctx, input }) => {
      assertAdmin(ctx.user);
      await billingDb.saveWithholdingPct(Math.round(input.pct * 100) / 100, ctx.user.id);
      return { success: true as const };
    }),
});
