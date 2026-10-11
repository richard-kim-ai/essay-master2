// 교사 첨삭 신청(건별 결제) API. 이용권과 별개로, 이용권 결제자가 앱 안에서 건별로 추가 결제해 신청한다.
// 신청 자격·환불 기준은 '가격 및 환불정책' 4·7·8조를 따른다. 교사 지급은 계약급여로 따로 집행하므로 정산 금액과 연결하지 않는다.
import { TRPCError } from "@trpc/server";
import { nanoid } from "nanoid";
import { z } from "zod";
import { getTeacherFeedbackProduct, type TeacherFeedbackKey } from "../shared/plans";
import { FEEDBACK_ITEMS, computeDueAt, describeScope, isOpenRequestStatus, isRequestOverdue, validateRequestScope } from "../shared/teacherFeedbackRequest";
import { protectedProcedure, router } from "./_core/trpc";
import * as billingDb from "./billingDb";
import { getPaymentProvider } from "./billing/providers";
import * as db from "./db";
import { resolveStudentFunding } from "./institutionDb";
import { sendPushToUser } from "./push";
import { RATE_RULES, consumeRateLimit } from "./rateLimit";
import * as requestDb from "./teacherFeedbackRequestDb";

type SessionUser = { id: number; name?: string | null; email?: string | null; role: string; tag?: string | null; teacherStatus?: string | null; teacherId?: number | null };

const productKeySchema = z.enum(["tf_core", "tf_standard", "tf_comprehensive"]);
const AI_TUTOR_OPEN_ID = "ai_tutor_bot_system";
export const REFUND_NOTICE = "결과를 전달하기 전에 취소하면 결제금액을 전액 환불합니다. 교사 배정·작업 착수를 이유로 공제하지 않습니다.";

function assertLearner(user: SessionUser) {
  if (user.role !== "user" || user.tag === "학부모") throw new TRPCError({ code: "FORBIDDEN", message: "학습자 계정만 교사 첨삭을 신청할 수 있습니다." });
}

function assertApprovedTeacher(user: SessionUser) {
  if (user.role !== "teacher" || user.teacherStatus !== "approved") throw new TRPCError({ code: "FORBIDDEN", message: "승인된 교사만 첨삭 신청을 처리할 수 있습니다." });
}

function assertAdmin(user: SessionUser) {
  if (user.role !== "admin") throw new TRPCError({ code: "FORBIDDEN", message: "관리자 권한이 필요합니다." });
}

function parseItems(scopeJson: string): string[] {
  try {
    const parsed = JSON.parse(scopeJson);
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === "string") : [];
  } catch {
    return [];
  }
}

export type EligibilityResult =
  | { ok: true; essay: NonNullable<Awaited<ReturnType<typeof db.getEssaySubmissionById>>>; teacher: { id: number; name: string | null }; productKey: TeacherFeedbackKey; items: string[]; priceKrw: number; productName: string }
  | { ok: false; reasons: string[] };

/**
 * 신청할 수 있는지 판단한다(결제 전 안내와 결제 직전 검사에 같은 함수를 쓴다).
 * 이용권 결제자(현재 이용 중인 유료 이용권 보유)만 신청할 수 있고, 기관 계약 학생도 막지 않는다.
 */
export async function evaluateRequestEligibility(user: SessionUser, input: { essayId: number; productKey: TeacherFeedbackKey; items?: string[] }): Promise<EligibilityResult> {
  const reasons: string[] = [];
  const product = getTeacherFeedbackProduct(input.productKey);
  if (!product) return { ok: false, reasons: ["선택한 교사 첨삭 상품을 찾을 수 없습니다."] };

  if (user.role !== "user" || user.tag === "학부모") {
    return { ok: false, reasons: ["학습자 계정만 교사 첨삭을 신청할 수 있습니다."] };
  }

  const [active, awaiting] = await Promise.all([billingDb.listActiveSubscriptions(user.id), billingDb.listAwaitingStartSubscriptions(user.id)]);
  if (active.length === 0) {
    reasons.push("이용권 결제자만 신청할 수 있습니다. 이용권을 결제하고 이용 중이어야 합니다.");
    if (awaiting.length > 0) reasons.push("결제한 이용권이 '시작 대기' 상태입니다. 결제 화면에서 '유료 이용 시작'을 눌러 주세요.");
  }

  const scope = validateRequestScope(input.productKey, input.items);
  if (!scope.ok) reasons.push(scope.error);

  const essay = await db.getEssaySubmissionById(input.essayId);
  if (!essay || essay.userId !== user.id) {
    reasons.push("본인의 글만 교사 첨삭을 신청할 수 있습니다.");
    return { ok: false, reasons };
  }
  if (essay.status === "reviewed" || (await db.getTeacherFeedbackByEssay(essay.id))) reasons.push("이미 교사 첨삭이 등록된 글입니다.");
  if (!essay.content.trim()) reasons.push("본문을 작성한 뒤 신청해 주세요. 첨삭에 필요한 원문이 없으면 신청을 받을 수 없습니다.");
  if (await requestDb.getOpenRequestByEssay(essay.id)) reasons.push("이 글에는 이미 진행 중인 교사 첨삭 신청이 있습니다.");

  // 요청한 사용자(ctx.user)의 담당 교사 정보를 그대로 쓴다(같은 사용자를 다시 조회하지 않는다).
  const teacher = user.teacherId ? await db.getUserById(user.teacherId) : undefined;
  if (!teacher || teacher.role !== "teacher" || teacher.teacherStatus !== "approved" || teacher.openId === AI_TUTOR_OPEN_ID) {
    reasons.push("배정된 첨삭 교사가 없습니다. 마이페이지에서 담당 교사를 선택해 주세요.");
  }

  if (reasons.length > 0 || !scope.ok || !teacher) return { ok: false, reasons };
  return { ok: true, essay, teacher: { id: teacher.id, name: teacher.name ?? null }, productKey: input.productKey, items: scope.items, priceKrw: product.priceKrw, productName: product.name };
}

function describeRow<T extends { status: string; dueAt: Date | string; scopeJson?: string; productKey: string }>(row: T, now = new Date()) {
  const items = row.scopeJson ? parseItems(row.scopeJson) : [];
  return { ...row, items, scopeLabel: describeScope(row.productKey as TeacherFeedbackKey, items), overdue: isRequestOverdue(row, now) };
}

export const teacherFeedbackRequestRouter = router({
  /** 결제 전 안내: 가격·완료 예정일·담당 교사·신청 가능 여부와 이유. 아무것도 만들지 않는다. */
  quote: protectedProcedure
    .input(z.object({ essayId: z.number().int().positive(), productKey: productKeySchema, items: z.array(z.string()).max(4).optional() }))
    .query(async ({ ctx, input }) => {
      const product = getTeacherFeedbackProduct(input.productKey);
      const [result, funding] = await Promise.all([evaluateRequestEligibility(ctx.user, input), resolveStudentFunding(ctx.user.id).catch(() => ({ kind: "none" as const }))]);
      return {
        eligible: result.ok,
        // 기관 계약이 비용을 부담하는 학생은 이 신청(개인 결제)과 별개로 기존 계약 경로의 무료 요청도 쓸 수 있다.
        contractFunded: funding.kind === "contract",
        reasons: result.ok ? [] : result.reasons,
        productName: product?.name ?? "",
        priceKrw: product?.priceKrw ?? 0,
        dueAt: computeDueAt(new Date()),
        teacherName: result.ok ? result.teacher.name : null,
        essayTitle: result.ok ? result.essay.title : null,
        refundNotice: REFUND_NOTICE,
      };
    }),

  /** 결제하고 신청한다. 결제가 끝나면 글이 교사에게 제출되고, 담당 교사에게 알림이 간다. */
  create: protectedProcedure
    .input(z.object({ essayId: z.number().int().positive(), productKey: productKeySchema, items: z.array(z.string()).max(4).optional() }))
    .mutation(async ({ ctx, input }) => {
      assertLearner(ctx.user);
      const limit = consumeRateLimit("checkout", String(ctx.user.id), RATE_RULES.checkoutByUser);
      if (!limit.allowed) throw new TRPCError({ code: "TOO_MANY_REQUESTS", message: "결제 요청이 너무 많습니다. 잠시 후 다시 시도해 주세요." });

      const eligibility = await evaluateRequestEligibility(ctx.user, input);
      if (!eligibility.ok) throw new TRPCError({ code: "BAD_REQUEST", message: eligibility.reasons[0] ?? "교사 첨삭을 신청할 수 없습니다." });

      const provider = getPaymentProvider();
      const order = await billingDb.createPaymentOrder({
        userId: ctx.user.id,
        planKey: eligibility.productKey,
        amountKrw: eligibility.priceKrw,
        provider: provider.name,
        isTest: provider.isTest,
        providerOrderId: `EM-${Date.now().toString(36).toUpperCase()}-${nanoid(8).toUpperCase()}`,
      });
      const result = await provider.createCheckout({
        orderId: order.providerOrderId,
        amountKrw: eligibility.priceKrw,
        planName: eligibility.productName,
        buyer: { id: ctx.user.id, name: ctx.user.name ?? null, email: ctx.user.email ?? null },
      });
      if (result.status === "failed") {
        await billingDb.markOrderFailed(order.id, result.reason);
        throw new TRPCError({ code: "BAD_REQUEST", message: result.reason });
      }
      if (result.status === "redirect") {
        return { status: "redirect" as const, orderId: order.id, redirectUrl: result.url, isTest: provider.isTest, request: null };
      }

      let request;
      try {
        request = await requestDb.createPaidRequest({
          orderId: order.id,
          paymentKey: result.paymentKey,
          userId: ctx.user.id,
          essayId: eligibility.essay.id,
          productKey: eligibility.productKey,
          priceKrw: eligibility.priceKrw,
          teacherId: eligibility.teacher.id,
          items: eligibility.items,
        });
      } catch {
        // 결제 직후 신청을 저장하지 못한 경우: 결제를 되돌리고 신청을 만들지 않는다.
        await provider.refund({ paymentKey: result.paymentKey, amountKrw: eligibility.priceKrw, reason: "교사 첨삭 신청 저장 실패" }).catch(() => undefined);
        await billingDb.markOrderFailed(order.id, "교사 첨삭 신청을 저장하지 못해 결제를 취소했습니다.").catch(() => undefined);
        throw new TRPCError({ code: "CONFLICT", message: "교사 첨삭 신청을 저장하지 못했습니다. 결제는 취소되었으니 잠시 후 다시 시도해 주세요." });
      }
      if (!request) throw new TRPCError({ code: "CONFLICT", message: "이미 처리된 결제입니다." });

      const productName = eligibility.productName;
      await requestDb.notifyUser(eligibility.teacher.id, "새 교사 첨삭 신청이 도착했어요", `${ctx.user.name ?? "학생"}님이 「${eligibility.essay.title}」에 ${productName}를 신청했습니다. 완료 예정일까지 첨삭해 주세요.`).catch(() => undefined);
      void sendPushToUser(eligibility.teacher.id, { title: "새 교사 첨삭 신청", body: `${eligibility.essay.title} · ${productName}`, url: "/teacher-mypage", tag: `tf-request-${request.id}` });
      return { status: "paid" as const, orderId: order.id, redirectUrl: null, isTest: provider.isTest, request: describeRow(request) };
    }),

  /** 내 신청 목록(상태·완료 예정일·지연 여부). */
  mine: protectedProcedure.query(async ({ ctx }) => {
    const rows = await requestDb.listRequestsForUser(ctx.user.id);
    const now = new Date();
    return rows.map((row) => describeRow(row, now));
  }),

  /** 결과 전달 전 취소: 결제금액을 전액 환불한다(교사 배정·작업 착수·교사비 지급을 이유로 공제하지 않는다). */
  cancel: protectedProcedure
    .input(z.object({ requestId: z.number().int().positive() }))
    .mutation(async ({ ctx, input }) => {
      assertLearner(ctx.user);
      const request = await requestDb.getRequestById(input.requestId);
      if (!request || request.userId !== ctx.user.id) throw new TRPCError({ code: "NOT_FOUND", message: "신청을 찾을 수 없습니다." });
      if (!isOpenRequestStatus(request.status)) throw new TRPCError({ code: "BAD_REQUEST", message: "이미 결과가 전달되었거나 취소된 신청은 취소할 수 없습니다." });
      const order = await billingDb.getPaymentOrder(request.orderId);
      if (!order || order.status !== "paid") throw new TRPCError({ code: "BAD_REQUEST", message: "환불할 수 있는 결제 내역을 찾을 수 없습니다. 고객지원으로 문의해 주세요." });

      // 환불이 끝나기 전에 교사가 결과를 전달하지 못하도록 먼저 취소를 선점한다.
      const previous = request.status as "paid" | "in_progress";
      const claimed = await requestDb.claimCancel(request.id, ctx.user.id, previous, "학생이 전달 전 취소");
      if (!claimed) throw new TRPCError({ code: "BAD_REQUEST", message: "이미 결과가 전달되었거나 취소된 신청입니다." });

      const provider = getPaymentProvider(order.provider);
      const refund = await provider
        .refund({ paymentKey: order.providerPaymentKey ?? "", amountKrw: order.amountKrw, reason: "교사 첨삭 신청 취소(전달 전 전액 환불)" })
        .catch((error: unknown) => ({ refunded: false as const, reason: error instanceof Error ? error.message : String(error) }));
      if (!refund.refunded) {
        await requestDb.releaseCancel(request.id, previous);
        throw new TRPCError({ code: "BAD_REQUEST", message: refund.reason ?? "환불을 처리하지 못했습니다. 잠시 후 다시 시도하거나 고객지원으로 문의해 주세요." });
      }
      await billingDb.markOrderRefunded(order.id);
      await requestDb.notifyUser(request.teacherId, "교사 첨삭 신청이 취소되었어요", "학생이 결과 전달 전에 신청을 취소했습니다. 대기열에서 제외됩니다.").catch(() => undefined);
      return { refundedKrw: order.amountKrw };
    }),

  /** 전달된 첨삭이 약속한 범위에 못 미칠 때 무료 보완을 요청한다(정책 8조). */
  requestRework: protectedProcedure
    .input(z.object({ requestId: z.number().int().positive(), note: z.string().trim().min(5).max(2000) }))
    .mutation(async ({ ctx, input }) => {
      assertLearner(ctx.user);
      const request = await requestDb.getRequestById(input.requestId);
      if (!request || request.userId !== ctx.user.id) throw new TRPCError({ code: "NOT_FOUND", message: "신청을 찾을 수 없습니다." });
      if (request.status !== "delivered") throw new TRPCError({ code: "BAD_REQUEST", message: "결과가 전달된 신청만 보완을 요청할 수 있습니다." });
      const changed = await requestDb.requestRework(request.id, ctx.user.id, input.note);
      if (!changed) throw new TRPCError({ code: "BAD_REQUEST", message: "보완을 요청할 수 없는 상태입니다." });
      await requestDb.notifyUser(request.teacherId, "교사 첨삭 보완 요청이 도착했어요", `학생이 보완을 요청했습니다: ${input.note.slice(0, 120)}`).catch(() => undefined);
      return { dueAt: computeDueAt(new Date()) };
    }),

  // ----- 교사 -----
  /** 내게 배정된, 아직 전달하지 않은 신청(완료 예정일이 가까운 순). */
  queue: protectedProcedure.query(async ({ ctx }) => {
    assertApprovedTeacher(ctx.user);
    const rows = await requestDb.listOpenRequestsForTeacher(ctx.user.id);
    const now = new Date();
    return rows.map((row) => describeRow(row, now));
  }),

  /** 작업 시작(결제 완료 → 작업 중). */
  start: protectedProcedure
    .input(z.object({ requestId: z.number().int().positive() }))
    .mutation(async ({ ctx, input }) => {
      assertApprovedTeacher(ctx.user);
      const request = await requestDb.getRequestById(input.requestId);
      if (!request || request.teacherId !== ctx.user.id) throw new TRPCError({ code: "NOT_FOUND", message: "신청을 찾을 수 없습니다." });
      const changed = await requestDb.markRequestStarted(request.id, ctx.user.id);
      if (!changed && request.status !== "in_progress") throw new TRPCError({ code: "BAD_REQUEST", message: "작업을 시작할 수 없는 상태입니다(취소되었거나 이미 전달됨)." });
      return { essayId: request.essayId };
    }),

  // ----- 관리자 -----
  adminList: protectedProcedure
    .input(z.object({ status: z.enum(["paid", "in_progress", "delivered", "cancelled", "refunded"]).optional(), limit: z.number().int().min(1).max(300).default(100) }))
    .query(async ({ ctx, input }) => {
      assertAdmin(ctx.user);
      const rows = await requestDb.listRequestsAdmin(input);
      const now = new Date();
      return rows.map((row) => describeRow(row, now));
    }),

  /** 신청 화면용 평가항목 목록(핵심 첨삭에서 고르는 항목). */
  items: protectedProcedure.query(() => FEEDBACK_ITEMS),
});
