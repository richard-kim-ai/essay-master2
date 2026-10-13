// 교사 첨삭지도권(횟수권)과 교사 첨삭 신청 API.
// 이용권 결제자가 일반 첨삭 1종을 1·3·5회분 권으로 구매하고, 신청할 때마다 1회씩 차감한다.
// 환불 기준은 '가격 및 환불정책' 7·8조를 따르고, 교사 지급은 계약급여로 따로 집행하므로 정산 금액과 연결하지 않는다.
import { TRPCError } from "@trpc/server";
import { nanoid } from "nanoid";
import { z } from "zod";
import { TEACHER_FEEDBACK_PASSES, getTeacherFeedbackPass } from "../shared/plans";
import { computeDueAt, isOpenRequestStatus, isRequestOverdue, passRemaining, pickPassToUse, totalRemainingSessions, unusedPassRefundKrw } from "../shared/teacherFeedbackRequest";
import { protectedProcedure, router } from "./_core/trpc";
import * as billingDb from "./billingDb";
import { getPaymentProvider } from "./billing/providers";
import * as db from "./db";
import { notifyGiftPurchase, resolvePurchaseTarget } from "./giftPurchase";
import { resolveStudentFunding } from "./institutionDb";
import { sendPushToUser } from "./push";
import { RATE_RULES, consumeRateLimit } from "./rateLimit";
import * as requestDb from "./teacherFeedbackRequestDb";

type SessionUser = { id: number; name?: string | null; email?: string | null; role: string; tag?: string | null; teacherStatus?: string | null; teacherId?: number | null };

const passKeySchema = z.enum(["tf_pass_1", "tf_pass_3", "tf_pass_5"]);
const AI_TUTOR_OPEN_ID = "ai_tutor_bot_system";
export const CANCEL_NOTICE = "결과를 전달하기 전에 취소하면 첨삭지도권 1회가 그대로 돌아옵니다. 교사 배정·작업 착수를 이유로 차감하지 않습니다.";

function assertLearner(user: SessionUser) {
  if (user.role !== "user" || user.tag === "학부모") throw new TRPCError({ code: "FORBIDDEN", message: "학습자 계정만 교사 첨삭지도권을 이용할 수 있습니다." });
}

function assertApprovedTeacher(user: SessionUser) {
  if (user.role !== "teacher" || user.teacherStatus !== "approved") throw new TRPCError({ code: "FORBIDDEN", message: "승인된 교사만 첨삭 신청을 처리할 수 있습니다." });
}

function assertAdmin(user: SessionUser) {
  if (user.role !== "admin") throw new TRPCError({ code: "FORBIDDEN", message: "관리자 권한이 필요합니다." });
}

/** 이용권 결제자인지: 현재 이용 중인 유료 이용권(시작한 이용권, 기간 안)이 있어야 하고, 시작 대기 이용권은 포함하지 않는다. */
async function checkPassHolder(userId: number, forGift = false) {
  const [active, awaiting] = await Promise.all([billingDb.listActiveSubscriptions(userId), billingDb.listAwaitingStartSubscriptions(userId)]);
  const reasons: string[] = [];
  if (active.length === 0) {
    if (forGift) {
      // 학부모가 자녀에게 구매해 주는 경우: 자녀가 이용 중인 이용권이 있어야 첨삭지도권을 받을 수 있다.
      reasons.push("자녀가 이용 중인 이용권이 있어야 첨삭지도권을 구매해 줄 수 있습니다. 먼저 이용권을 구매해 주세요.");
      if (awaiting.length > 0) reasons.push("구매한 이용권이 '시작 대기' 상태입니다. 자녀가 이용권 화면에서 '유료 이용 시작'을 누르면 첨삭지도권을 구매할 수 있습니다.");
    } else {
      reasons.push("이용권 결제자만 구매·신청할 수 있습니다. 이용권을 결제하고 이용 중이어야 합니다.");
      if (awaiting.length > 0) reasons.push("결제한 이용권이 '시작 대기' 상태입니다. 결제 화면에서 '유료 이용 시작'을 눌러 주세요.");
    }
  }
  return { ok: active.length > 0, reasons };
}

export type RequestEligibility =
  | { ok: true; essay: NonNullable<Awaited<ReturnType<typeof db.getEssaySubmissionById>>>; teacher: { id: number; name: string | null }; passId: number; remaining: number }
  | { ok: false; reasons: string[]; remaining: number; canBuyPass: boolean };

/**
 * 글에 교사 첨삭을 신청할 수 있는지 판단한다(신청 전 안내와 신청 직전 검사에 같은 함수를 쓴다).
 * 유효한 첨삭지도권(남은 횟수·유효기간 안)이 있어야 하고, 기관 계약 학생도 막지 않는다.
 */
export async function evaluateRequestEligibility(user: SessionUser, essayId: number, now = new Date()): Promise<RequestEligibility> {
  if (user.role !== "user" || user.tag === "학부모") {
    return { ok: false, reasons: ["학습자 계정만 교사 첨삭을 신청할 수 있습니다."], remaining: 0, canBuyPass: false };
  }
  const reasons: string[] = [];
  const passes = await requestDb.listPassesForUser(user.id);
  const remaining = totalRemainingSessions(passes, now);
  const pass = pickPassToUse(passes, now);
  let canBuyPass = false;
  if (!pass) {
    // 권이 없으면 구매를 안내한다. 권은 이용권 결제자만 구매할 수 있다.
    const holder = await checkPassHolder(user.id);
    canBuyPass = holder.ok;
    reasons.push(holder.ok ? "사용할 수 있는 교사 첨삭지도권이 없습니다. 첨삭지도권을 구매해 주세요." : "교사 첨삭지도권이 없습니다.", ...holder.reasons);
  }

  const essay = await db.getEssaySubmissionById(essayId);
  if (!essay || essay.userId !== user.id) {
    reasons.push("본인의 글만 교사 첨삭을 신청할 수 있습니다.");
    return { ok: false, reasons, remaining, canBuyPass };
  }
  if (essay.status === "reviewed" || (await db.getTeacherFeedbackByEssay(essay.id))) reasons.push("이미 교사 첨삭이 등록된 글입니다.");
  if (!essay.content.trim()) reasons.push("본문을 작성한 뒤 신청해 주세요. 첨삭에 필요한 원문이 없으면 신청을 받을 수 없습니다.");
  if (await requestDb.getOpenRequestByEssay(essay.id)) reasons.push("이 글에는 이미 진행 중인 교사 첨삭 신청이 있습니다.");

  // 요청한 사용자(ctx.user)의 담당 교사 정보를 그대로 쓴다(같은 사용자를 다시 조회하지 않는다).
  const teacher = user.teacherId ? await db.getUserById(user.teacherId) : undefined;
  if (!teacher || teacher.role !== "teacher" || teacher.teacherStatus !== "approved" || teacher.openId === AI_TUTOR_OPEN_ID) {
    reasons.push("배정된 첨삭 교사가 없습니다. 마이페이지에서 담당 교사를 선택해 주세요.");
  }

  if (reasons.length > 0 || !pass || !teacher) return { ok: false, reasons, remaining, canBuyPass };
  return { ok: true, essay, teacher: { id: teacher.id, name: teacher.name ?? null }, passId: pass.id, remaining };
}

function describeRequest<T extends { status: string; dueAt: Date | string }>(row: T, now = new Date()) {
  return { ...row, overdue: isRequestOverdue(row, now) };
}

function describePass<T extends { status: string; sessions: number; sessionsUsed: number; expiresAt: Date | string; priceKrw: number }>(pass: T, now = new Date()) {
  const expired = new Date(pass.expiresAt).getTime() <= now.getTime();
  return { ...pass, remaining: passRemaining(pass), expired, usable: pass.status === "active" && !expired && passRemaining(pass) > 0 };
}

export const teacherFeedbackRequestRouter = router({
  /** 판매 중인 교사 첨삭지도권 상품. */
  products: protectedProcedure.query(() => TEACHER_FEEDBACK_PASSES),

  /** 내 첨삭지도권(잔여 횟수·유효기간)과 구매 가능 여부(이용권 결제자). */
  passes: protectedProcedure.input(z.object({ studentId: z.number().int().positive().optional() }).optional()).query(async ({ ctx, input }) => {
    const now = new Date();
    // 학부모는 연결된 자녀의 첨삭지도권을 본다(자녀를 고르지 않았거나 연결되지 않았으면 구매 불가 안내).
    const isParent = ctx.user.role === "user" && ctx.user.tag === "학부모";
    const learner = ctx.user.role === "user" && !isParent;
    const giftTarget = isParent && input?.studentId ? await resolvePurchaseTarget(ctx.user, input.studentId).catch(() => null) : null;
    const subjectId = giftTarget ? giftTarget.beneficiaryId : learner ? ctx.user.id : null;
    const [passes, holder] = await Promise.all([
      subjectId ? requestDb.listPassesForUser(subjectId) : Promise.resolve([]),
      subjectId ? checkPassHolder(subjectId, Boolean(giftTarget)) : Promise.resolve({ ok: false, reasons: [isParent ? "첨삭지도권을 받을 자녀를 선택해 주세요. 자녀 계정을 먼저 연결해야 합니다." : "학습자 계정만 구매할 수 있습니다."] }),
    ]);
    return {
      passes: passes.map((pass) => describePass(pass, now)),
      totalRemaining: totalRemainingSessions(passes, now),
      canBuy: holder.ok,
      buyReasons: holder.reasons,
    };
  }),

  /** 첨삭지도권 구매: 이용권 결제자만 가능하다. 결제가 끝나면 권이 만들어진다(구매일부터 유효기간). */
  purchasePass: protectedProcedure
    .input(z.object({ productKey: passKeySchema, /** 학부모가 연결된 자녀에게 구매해 줄 때 자녀의 계정 id */ studentId: z.number().int().positive().optional() }))
    .mutation(async ({ ctx, input }) => {
      // 학생 본인이면 본인에게, 학부모면 연결을 승인한 자녀에게 지급한다.
      const target = await resolvePurchaseTarget(ctx.user, input.studentId);
      const limit = consumeRateLimit("checkout", String(ctx.user.id), RATE_RULES.checkoutByUser);
      if (!limit.allowed) throw new TRPCError({ code: "TOO_MANY_REQUESTS", message: "결제 요청이 너무 많습니다. 잠시 후 다시 시도해 주세요." });
      const product = getTeacherFeedbackPass(input.productKey);
      if (!product) throw new TRPCError({ code: "BAD_REQUEST", message: "선택한 첨삭지도권을 찾을 수 없습니다." });
      const holder = await checkPassHolder(target.beneficiaryId, target.isGift);
      if (!holder.ok) throw new TRPCError({ code: "BAD_REQUEST", message: holder.reasons[0] });

      const provider = getPaymentProvider();
      const order = await billingDb.createPaymentOrder({
        userId: target.beneficiaryId,
        payerUserId: target.payerUserId,
        planKey: product.key,
        amountKrw: product.priceKrw,
        provider: provider.name,
        isTest: provider.isTest,
        providerOrderId: `EM-${Date.now().toString(36).toUpperCase()}-${nanoid(8).toUpperCase()}`,
      });
      const result = await provider.createCheckout({
        orderId: order.providerOrderId,
        amountKrw: product.priceKrw,
        planName: product.name,
        buyer: { id: ctx.user.id, name: ctx.user.name ?? null, email: ctx.user.email ?? null },
      });
      if (result.status === "failed") {
        await billingDb.markOrderFailed(order.id, result.reason);
        throw new TRPCError({ code: "BAD_REQUEST", message: result.reason });
      }
      if (result.status === "redirect") {
        return { status: "redirect" as const, orderId: order.id, redirectUrl: result.url, isTest: provider.isTest, pass: null };
      }

      let pass;
      try {
        pass = await requestDb.createPassForPaidOrder({
          orderId: order.id,
          paymentKey: result.paymentKey,
          userId: target.beneficiaryId,
          productKey: product.key,
          sessions: product.sessions,
          priceKrw: product.priceKrw,
          periodDays: product.periodDays,
        });
      } catch {
        // 결제 직후 권을 저장하지 못한 경우: 결제를 되돌리고 권을 만들지 않는다.
        await provider.refund({ paymentKey: result.paymentKey, amountKrw: product.priceKrw, reason: "교사 첨삭지도권 저장 실패" }).catch(() => undefined);
        await billingDb.markOrderFailed(order.id, "교사 첨삭지도권을 저장하지 못해 결제를 취소했습니다.").catch(() => undefined);
        throw new TRPCError({ code: "CONFLICT", message: "교사 첨삭지도권을 저장하지 못했습니다. 결제는 취소되었으니 잠시 후 다시 시도해 주세요." });
      }
      if (!pass) throw new TRPCError({ code: "CONFLICT", message: "이미 처리된 결제입니다." });
      if (target.isGift) await notifyGiftPurchase({ studentId: target.beneficiaryId, parentName: ctx.user.name ?? null, itemName: product.name });
      return { status: "paid" as const, orderId: order.id, redirectUrl: null, isTest: provider.isTest, pass: describePass(pass), giftedTo: target.isGift ? target.beneficiaryName : null };
    }),

  /** 신청 전 안내: 남은 횟수·완료 예정일·담당 교사·신청 가능 여부와 이유. 아무것도 만들지 않는다. */
  quote: protectedProcedure
    .input(z.object({ essayId: z.number().int().positive() }))
    .query(async ({ ctx, input }) => {
      const [result, funding] = await Promise.all([evaluateRequestEligibility(ctx.user, input.essayId), resolveStudentFunding(ctx.user.id).catch(() => ({ kind: "none" as const }))]);
      return {
        eligible: result.ok,
        reasons: result.ok ? [] : result.reasons,
        remaining: result.remaining,
        canBuyPass: result.ok ? false : result.canBuyPass,
        // 기관 계약이 비용을 부담하는 학생은 이 신청(개인 첨삭지도권)과 별개로 기존 계약 경로의 무료 요청도 쓸 수 있다.
        contractFunded: funding.kind === "contract",
        dueAt: computeDueAt(new Date()),
        teacherName: result.ok ? result.teacher.name : null,
        essayTitle: result.ok ? result.essay.title : null,
        cancelNotice: CANCEL_NOTICE,
      };
    }),

  /** 첨삭지도권 1회를 차감해 신청한다. 글이 교사에게 제출되고, 담당 교사에게 알림이 간다. */
  create: protectedProcedure
    .input(z.object({ essayId: z.number().int().positive() }))
    .mutation(async ({ ctx, input }) => {
      assertLearner(ctx.user);
      const eligibility = await evaluateRequestEligibility(ctx.user, input.essayId);
      if (!eligibility.ok) throw new TRPCError({ code: "BAD_REQUEST", message: eligibility.reasons[0] ?? "교사 첨삭을 신청할 수 없습니다." });

      let request;
      try {
        request = await requestDb.createRequestUsingPass({ userId: ctx.user.id, essayId: eligibility.essay.id, passId: eligibility.passId, teacherId: eligibility.teacher.id });
      } catch {
        // 같은 글에 다른 신청이 동시에 생겼거나 저장에 실패한 경우: 트랜잭션이 되돌려져 횟수는 차감되지 않는다.
        throw new TRPCError({ code: "CONFLICT", message: "교사 첨삭 신청을 저장하지 못했습니다. 첨삭지도권은 차감되지 않았습니다. 잠시 후 다시 시도해 주세요." });
      }
      if (!request) throw new TRPCError({ code: "CONFLICT", message: "사용할 수 있는 첨삭지도권이 없습니다. 다른 신청에 방금 사용되었을 수 있어요." });

      await requestDb.notifyUser(eligibility.teacher.id, "새 교사 첨삭 신청이 도착했어요", `${ctx.user.name ?? "학생"}님이 「${eligibility.essay.title}」의 교사 첨삭을 신청했습니다. 완료 예정일까지 첨삭해 주세요.`).catch(() => undefined);
      void sendPushToUser(eligibility.teacher.id, { title: "새 교사 첨삭 신청", body: eligibility.essay.title, url: "/teacher-mypage", tag: `tf-request-${request.id}` });
      return { status: "paid" as const, request: describeRequest(request), remaining: eligibility.remaining - 1 };
    }),

  /** 내 신청 목록(상태·완료 예정일·지연 여부). */
  mine: protectedProcedure.query(async ({ ctx }) => {
    const rows = await requestDb.listRequestsForUser(ctx.user.id);
    const now = new Date();
    return rows.map((row) => describeRequest(row, now));
  }),

  /** 결과 전달 전 취소: 첨삭지도권 1회를 돌려받는다(교사 배정·작업 착수를 이유로 차감하지 않는다). */
  cancel: protectedProcedure
    .input(z.object({ requestId: z.number().int().positive() }))
    .mutation(async ({ ctx, input }) => {
      assertLearner(ctx.user);
      const request = await requestDb.getRequestById(input.requestId);
      if (!request || request.userId !== ctx.user.id) throw new TRPCError({ code: "NOT_FOUND", message: "신청을 찾을 수 없습니다." });
      if (!isOpenRequestStatus(request.status)) throw new TRPCError({ code: "BAD_REQUEST", message: "이미 결과가 전달되었거나 취소된 신청은 취소할 수 없습니다." });
      const restored = await requestDb.cancelRequestRestoreSession(request.id, ctx.user.id, "학생이 전달 전 취소");
      if (!restored) throw new TRPCError({ code: "BAD_REQUEST", message: "이미 결과가 전달되었거나 취소된 신청입니다." });
      await requestDb.notifyUser(request.teacherId, "교사 첨삭 신청이 취소되었어요", "학생이 결과 전달 전에 신청을 취소했습니다. 대기열에서 제외됩니다.").catch(() => undefined);
      return { restored: 1 };
    }),

  /** 전달된 첨삭이 약속한 범위에 못 미칠 때 무료 보완을 요청한다(정책 8조). 횟수는 더 차감하지 않는다. */
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
    return rows.map((row) => describeRequest(row, now));
  }),

  /** 작업 시작(신청 완료 → 작업 중). */
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
      return rows.map((row) => describeRequest(row, now));
    }),

  /** 판매된 첨삭지도권 목록(잔여 횟수·유효기간·미사용 환불 예상액). 환불은 '결제 내역' 탭에서 주문을 환불한다. */
  adminPasses: protectedProcedure
    .input(z.object({ limit: z.number().int().min(1).max(300).default(100) }))
    .query(async ({ ctx, input }) => {
      assertAdmin(ctx.user);
      const rows = await requestDb.listPassesAdmin(input.limit);
      const now = new Date();
      return rows.map((row) => ({ ...describePass(row, now), unusedRefundKrw: row.status === "active" ? unusedPassRefundKrw(row) : 0 }));
    }),
});
