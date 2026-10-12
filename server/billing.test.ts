import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("./billingDb", () => ({
  createPaymentOrder: vi.fn(),
  getPaymentOrder: vi.fn(),
  markOrderFailed: vi.fn(),
  confirmOrderAndActivateSubscription: vi.fn(),
  listActiveSubscriptions: vi.fn(),
  listAwaitingStartSubscriptions: vi.fn(),
  startSubscription: vi.fn(),
  listOrdersForUser: vi.fn(),
  listOrdersByPayer: vi.fn(),
  listOrdersAdmin: vi.fn(),
  summarizeBilling: vi.fn(),
  listSubscriptionsAdmin: vi.fn(),
  markOrderRefunded: vi.fn(),
  countAiUsage: vi.fn(),
  reserveAiUsage: vi.fn(),
  releaseAiUsage: vi.fn(),
  recordAiUsageTokens: vi.fn(),
  getSettlementRates: vi.fn(),
  saveSettlementRate: vi.fn(),
  getWithholdingPct: vi.fn(),
  saveWithholdingPct: vi.fn(),
  listApprovedTeachers: vi.fn(),
  countTeacherActivities: vi.fn(),
  countTeacherActivityBreakdown: vi.fn(),
  getSettlement: vi.fn(),
  getSettlementById: vi.fn(),
  listSettlementsForTeacher: vi.fn(),
  listSettlementsByMonth: vi.fn(),
  upsertDraftSettlement: vi.fn(),
  confirmSettlement: vi.fn(),
  markSettlementPaid: vi.fn(),
}));

vi.mock("./institutionDb", () => ({
  listTeacherActivitiesForMonth: vi.fn(),
  getAccounting: vi.fn(),
  resolveActivitySource: vi.fn(),
  reconcileUnaccountedActivities: vi.fn(),
  ensureAccountingRow: vi.fn(),
  setManualExclusion: vi.fn(),
  resolveStudentFunding: vi.fn(async () => ({ kind: "none" })),
}));

vi.mock("./db", async (importOriginal) => ({ ...(await importOriginal<typeof import("./db")>()), getLinkedStudentsForParent: vi.fn(), getUserById: vi.fn() }));
vi.mock("./giftPurchase", async (importOriginal) => ({ ...(await importOriginal<typeof import("./giftPurchase")>()), notifyGiftPurchase: vi.fn(async () => undefined) }));
vi.mock("./teacherFeedbackRequestDb", async (importOriginal) => ({ ...(await importOriginal<typeof import("./teacherFeedbackRequestDb")>()), listPassesForUser: vi.fn(async () => []) }));

import * as billingDb from "./billingDb";
import * as db from "./db";
import { notifyGiftPurchase } from "./giftPurchase";
import * as institution from "./institutionDb";
import { appRouter } from "./routers";
import { getPaymentProvider, mockProvider } from "./billing/providers";
import { evaluateAiEntitlement } from "./billing/entitlements";
import { PLANS, TEACHER_FEEDBACK_PASSES, formatKrw, getPlan, getPlanName } from "../shared/plans";
import { computeSettlement, currentMonthKst, defaultRates, emptyCounts, monthRange, resolveRates } from "../shared/settlement";
import { resetRateLimits } from "./rateLimit";
import type { TrpcContext } from "./_core/context";

type TestUser = Record<string, unknown> & { id: number };
function callerFor(user: TestUser | null) {
  const ctx = {
    user: user && { openId: `u-${user.id}`, email: `u${user.id}@example.com`, name: `사용자${user.id}`, loginMethod: "email", role: "user", createdAt: new Date(), updatedAt: new Date(), lastSignedIn: new Date(), ...user },
    req: { protocol: "https", headers: {} } as any,
    res: { clearCookie: vi.fn(), cookie: vi.fn() } as any,
  } as unknown as TrpcContext;
  return appRouter.createCaller(ctx);
}

const student: TestUser = { id: 10, role: "user", tag: "중고등" };
const parent: TestUser = { id: 11, role: "user", tag: "학부모" };
const teacher: TestUser = { id: 20, role: "teacher", teacherStatus: "approved" };
const pendingTeacher: TestUser = { id: 21, role: "teacher", teacherStatus: "pending" };
const admin: TestUser = { id: 1, role: "admin" };

beforeEach(() => {
  vi.clearAllMocks();
  resetRateLimits();
  delete process.env.PAYMENT_PROVIDER;
});

describe("이용권 정의", () => {
  it("가격 및 환불정책(1·5조)과 같은 상품·가격·횟수·기간이다", () => {
    expect(PLANS.map((plan) => plan.key)).toEqual(["study", "ai_basic", "ai_focus", "ai_pass"]);
    expect(getPlan("study")).toMatchObject({ priceKrw: 14900, aiEvaluations: 0, periodDays: 30, kind: "package" });
    expect(getPlan("ai_basic")).toMatchObject({ priceKrw: 24900, aiEvaluations: 10, periodDays: 30, kind: "package" });
    expect(getPlan("ai_focus")).toMatchObject({ priceKrw: 39900, aiEvaluations: 20, periodDays: 30, kind: "package" });
    expect(getPlan("ai_pass")).toMatchObject({ priceKrw: 14900, aiEvaluations: 10, periodDays: 90, kind: "addon" });
    expect(formatKrw(24900)).toBe("24,900원");
  });

  it("환불 계산용 구성 금액(학습권+AI권)의 합은 가격과 같고, 정책 5조 표와 같다", () => {
    for (const plan of PLANS) expect(plan.studyAmountKrw + plan.aiAmountKrw).toBe(plan.priceKrw);
    expect(PLANS.map((plan) => [plan.studyAmountKrw, plan.aiAmountKrw])).toEqual([[14900, 0], [12450, 12450], [13300, 26600], [0, 14900]]);
  });

  it("교사 첨삭지도권은 일반 첨삭 1종의 1·3·5회분 3종이고, 이용권 목록에는 섞이지 않는다", () => {
    expect(TEACHER_FEEDBACK_PASSES.map((product) => [product.key, product.sessions, product.priceKrw])).toEqual([["tf_pass_1", 1, 6900], ["tf_pass_3", 3, 19900], ["tf_pass_5", 5, 31900]]);
    // 횟수가 많을수록 1회당 금액이 같거나 낮다(할인 없이 비싸지지 않는다).
    const perSession = TEACHER_FEEDBACK_PASSES.map((product) => product.priceKrw / product.sessions);
    expect(perSession[1]).toBeLessThanOrEqual(perSession[0]);
    expect(perSession[2]).toBeLessThanOrEqual(perSession[1]);
    expect(PLANS.some((plan) => plan.key.startsWith("tf_"))).toBe(false);
    // 관리자 결제 내역 등에서 주문 이름을 알아볼 수 있다.
    expect(getPlanName("tf_pass_3")).toBe("교사 첨삭지도권 3회분");
    // 이용권 결제 API로는 교사 첨삭지도권을 결제할 수 없다(별도 구매 흐름에서만 결제).
    expect(getPlan("tf_pass_1")).toBeUndefined();
  });

  it("예전 요금제(starter·growth)는 판매하지 않지만 이름은 알아볼 수 있다", () => {
    expect(getPlan("starter")).toBeUndefined();
    expect(getPlanName("starter")).toBe("스타터(종료)");
    expect(getPlanName("growth")).toBe("성장(종료)");
    expect(getPlanName("ai_basic")).toBe("AI 기본형");
  });
});

describe("결제 제공자", () => {
  it("설정이 없으면 임시(mock) 결제이고, 곧바로 결제 완료로 처리한다", async () => {
    const provider = getPaymentProvider();
    expect(provider).toBe(mockProvider);
    expect(provider.isTest).toBe(true);
    await expect(provider.createCheckout({ orderId: "EM-1", amountKrw: 9900, planName: "AI 기본형", buyer: { id: 1, name: null, email: null } })).resolves.toEqual({ status: "paid", paymentKey: "mock_EM-1" });
  });

  it("아직 연동되지 않은 실제 제공자는 성공한 것처럼 처리하지 않고 실패한다", async () => {
    for (const name of ["portone", "tosspayments"]) {
      const provider = getPaymentProvider(name);
      expect(provider.isTest).toBe(false);
      const result = await provider.createCheckout({ orderId: "EM-1", amountKrw: 9900, planName: "AI 기본형", buyer: { id: 1, name: null, email: null } });
      expect(result.status).toBe("failed");
    }
    expect(() => getPaymentProvider("unknown-pg")).toThrow();
  });
});

describe("AI 평가 이용 자격(entitlements)", () => {
  const now = new Date("2026-10-12T00:00:00Z");
  const days = (n: number) => new Date(now.getTime() - n * 24 * 60 * 60 * 1000);
  const ahead = (n: number) => new Date(now.getTime() + n * 24 * 60 * 60 * 1000);
  const fresh = { role: "user", createdAt: days(2) };
  const old = { role: "user", createdAt: days(30) };
  const sub = (overrides: Record<string, unknown> = {}) => ({ id: 1, status: "active" as const, planKey: "ai_basic", currentPeriodStart: days(3), currentPeriodEnd: ahead(27), aiEvaluationsLimit: 10, used: 0, ...overrides });

  it("가입 7일 안에는 무료 체험 AI 2회를 쓰고, 다 쓰면 이용권이 필요하다", () => {
    expect(evaluateAiEntitlement({ user: fresh, subscriptions: [], usedInTrial: 0, now })).toMatchObject({ mode: "trial", canUse: true, limit: 2, remaining: 2 });
    expect(evaluateAiEntitlement({ user: fresh, subscriptions: [], usedInTrial: 1, now })).toMatchObject({ mode: "trial", canUse: true, remaining: 1 });
    const used = evaluateAiEntitlement({ user: fresh, subscriptions: [], usedInTrial: 2, now });
    expect(used).toMatchObject({ mode: "trial", canUse: false, remaining: 0 });
    expect(used.reason).toContain("이용권");
  });

  it("체험이 끝나고 이용권이 없으면 이용할 수 없다", () => {
    const result = evaluateAiEntitlement({ user: old, subscriptions: [], usedInTrial: 0, now });
    expect(result).toMatchObject({ mode: "none", canUse: false });
    expect(result.reason).toContain("이용권");
  });

  it("이용권이 있으면 기간 안에서 결제한 횟수까지 쓴다", () => {
    expect(evaluateAiEntitlement({ user: old, subscriptions: [sub({ used: 9 })], usedInTrial: 0, now })).toMatchObject({ mode: "plan", canUse: true, limit: 10, remaining: 1 });
    const exhausted = evaluateAiEntitlement({ user: old, subscriptions: [sub({ used: 10 })], usedInTrial: 0, now });
    expect(exhausted).toMatchObject({ mode: "plan", canUse: false, remaining: 0 });
    expect(exhausted.reason).toContain("AI 추가권");
  });

  it("학습형(AI 0회)은 학습 이용권일 뿐 AI 횟수를 주지 않는다", () => {
    const result = evaluateAiEntitlement({ user: old, subscriptions: [sub({ planKey: "study", aiEvaluationsLimit: 0 })], usedInTrial: 0, now });
    expect(result).toMatchObject({ canUse: false, mode: "none" });
  });

  it("무료 체험분을 먼저 쓰고, 유료는 먼저 만료되는 이용권부터(만료가 같으면 먼저 산 것부터) 차감한다", () => {
    const later = sub({ id: 5, planKey: "ai_focus", aiEvaluationsLimit: 20, currentPeriodEnd: ahead(20) });
    const sooner = sub({ id: 9, planKey: "ai_pass", aiEvaluationsLimit: 10, currentPeriodEnd: ahead(10) });
    const sameEndOlder = sub({ id: 2, planKey: "ai_pass", aiEvaluationsLimit: 10, currentPeriodEnd: ahead(10) });
    const result = evaluateAiEntitlement({ user: fresh, subscriptions: [later, sooner, sameEndOlder], usedInTrial: 0, now });
    expect(result.mode).toBe("trial");
    expect(result.sources?.map((source) => source.kind === "trial" ? "trial" : source.subscriptionId)).toEqual(["trial", 2, 9, 5]);
    expect(result.remaining).toBe(2 + 10 + 10 + 20);
    // 체험분을 다 쓰면 만료가 가까운 추가권부터
    const afterTrial = evaluateAiEntitlement({ user: fresh, subscriptions: [later, sooner, sameEndOlder], usedInTrial: 2, now });
    expect(afterTrial.mode).toBe("plan");
    expect(afterTrial.sources?.[0]).toMatchObject({ subscriptionId: 2 });
  });

  it("여러 이용권의 남은 횟수는 합산되고, 다 쓴 이용권은 건너뛴다", () => {
    const first = sub({ id: 1, aiEvaluationsLimit: 10, used: 10, currentPeriodEnd: ahead(5) });
    const second = sub({ id: 2, planKey: "ai_pass", aiEvaluationsLimit: 10, used: 4, currentPeriodEnd: ahead(60) });
    const result = evaluateAiEntitlement({ user: old, subscriptions: [first, second], usedInTrial: 0, now });
    expect(result).toMatchObject({ mode: "plan", canUse: true, limit: 20, used: 14, remaining: 6 });
    expect(result.sources).toHaveLength(1);
    expect(result.sources?.[0]).toMatchObject({ subscriptionId: 2, remaining: 6 });
  });

  it("해지한 이용권도 결제한 기간이 끝날 때까지 유효하고, 만료되면 무효다", () => {
    expect(evaluateAiEntitlement({ user: old, subscriptions: [sub({ status: "cancelled" })], usedInTrial: 0, now }).mode).toBe("plan");
    expect(evaluateAiEntitlement({ user: old, subscriptions: [sub({ currentPeriodEnd: days(1) })], usedInTrial: 0, now }).mode).toBe("none");
    expect(evaluateAiEntitlement({ user: old, subscriptions: [sub({ status: "expired" })], usedInTrial: 0, now }).mode).toBe("none");
  });

  it("시작 대기 이용권이 있으면 이용할 수 없을 때 '유료 이용 시작'을 안내한다", () => {
    const result = evaluateAiEntitlement({ user: old, subscriptions: [], awaitingStartCount: 1, usedInTrial: 0, now });
    expect(result).toMatchObject({ mode: "none", canUse: false, awaitingStartCount: 1 });
    expect(result.reason).toContain("유료 이용 시작");
  });

  it("관리자·교사는 한도가 없고, 학부모는 이용할 수 없다", () => {
    expect(evaluateAiEntitlement({ user: { role: "admin", createdAt: days(1) }, subscriptions: [], usedInTrial: 0, now }).mode).toBe("unlimited");
    expect(evaluateAiEntitlement({ user: { role: "teacher", teacherStatus: "approved", createdAt: days(1) }, subscriptions: [], usedInTrial: 0, now }).mode).toBe("unlimited");
    // 승인 전 교사는 한도 없이 쓸 수 없다.
    expect(evaluateAiEntitlement({ user: { role: "teacher", teacherStatus: "pending", createdAt: days(1) }, subscriptions: [], usedInTrial: 0, now }).canUse).toBe(false);
    expect(evaluateAiEntitlement({ user: { role: "user", tag: "학부모", createdAt: days(1) }, subscriptions: [], usedInTrial: 0, now }).canUse).toBe(false);
  });
});

describe("이용권 결제(billing)", () => {
  const order = { id: 7, providerOrderId: "EM-TEST", userId: 10 };

  beforeEach(() => {
    vi.mocked(billingDb.createPaymentOrder).mockResolvedValue(order as any);
    vi.mocked(billingDb.confirmOrderAndActivateSubscription).mockResolvedValue({ id: 3, planKey: "ai_basic", awaitingStart: 1 } as any);
  });

  it("임시 결제에서는 결제하면 곧바로 결제가 완료된다(주문은 테스트 결제로 기록, 30일 상품은 시작 대기)", async () => {
    const result = await callerFor(student).billing.startCheckout({ planKey: "ai_basic" });
    expect(result).toMatchObject({ status: "paid", isTest: true, orderId: 7 });
    expect(billingDb.createPaymentOrder).toHaveBeenCalledWith(expect.objectContaining({ userId: 10, planKey: "ai_basic", amountKrw: 24900, provider: "mock", isTest: true }));
    expect(billingDb.confirmOrderAndActivateSubscription).toHaveBeenCalledWith(expect.objectContaining({ orderId: 7, planKey: "ai_basic", kind: "package", periodDays: 30, aiEvaluationsLimit: 10 }));
  });

  it("AI 추가권은 구매일부터 90일·AI 10회로 만들어진다", async () => {
    await callerFor(student).billing.startCheckout({ planKey: "ai_pass" });
    expect(billingDb.confirmOrderAndActivateSubscription).toHaveBeenCalledWith(expect.objectContaining({ planKey: "ai_pass", kind: "addon", periodDays: 90, aiEvaluationsLimit: 10 }));
  });

  it("학습형은 AI 횟수 0회로 만들어진다", async () => {
    await callerFor(student).billing.startCheckout({ planKey: "study" });
    expect(billingDb.createPaymentOrder).toHaveBeenCalledWith(expect.objectContaining({ amountKrw: 14900 }));
    expect(billingDb.confirmOrderAndActivateSubscription).toHaveBeenCalledWith(expect.objectContaining({ kind: "package", aiEvaluationsLimit: 0 }));
  });

  it("금액과 이용 횟수는 서버의 상품 정의로 정하고, 클라이언트가 보낸 값은 쓰지 않는다", async () => {
    await callerFor(student).billing.startCheckout({ planKey: "ai_focus", amountKrw: 1, aiEvaluationsLimit: 9999 } as any);
    expect(billingDb.createPaymentOrder).toHaveBeenCalledWith(expect.objectContaining({ amountKrw: 39900 }));
    expect(billingDb.confirmOrderAndActivateSubscription).toHaveBeenCalledWith(expect.objectContaining({ aiEvaluationsLimit: 20 }));
    await expect(callerFor(student).billing.startCheckout({ planKey: "free" as any })).rejects.toThrow();
    // 판매를 종료한 예전 요금제로는 결제할 수 없다.
    await expect(callerFor(student).billing.startCheckout({ planKey: "starter" as any })).rejects.toThrow();
  });

  it("학습자만 본인에게 결제할 수 있다(교사·관리자·비로그인 불가, 학부모는 자녀를 지정하지 않으면 불가)", async () => {
    for (const user of [teacher, admin]) {
      await expect(callerFor(user).billing.startCheckout({ planKey: "ai_basic" })).rejects.toMatchObject({ code: "FORBIDDEN" });
    }
    await expect(callerFor(parent).billing.startCheckout({ planKey: "ai_basic" })).rejects.toMatchObject({ code: "BAD_REQUEST", message: expect.stringContaining("자녀를 선택") });
    await expect(callerFor(null).billing.startCheckout({ planKey: "ai_basic" })).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    expect(billingDb.createPaymentOrder).not.toHaveBeenCalled();
  });

  it("본인 결제는 결제자를 따로 기록하지 않는다", async () => {
    await callerFor(student).billing.startCheckout({ planKey: "ai_basic" });
    expect(billingDb.createPaymentOrder).toHaveBeenCalledWith(expect.objectContaining({ userId: 10, payerUserId: null }));
    expect(notifyGiftPurchase).not.toHaveBeenCalled();
  });

  describe("학부모가 연결된 자녀에게 구매해 주기", () => {
    beforeEach(() => {
      vi.mocked(db.getLinkedStudentsForParent).mockResolvedValue([{ id: 10, name: "홍길동" }] as any);
    });

    it("이용권은 자녀(학생) 계정에 지급되고 주문에는 결제한 학부모가 기록되며, 자녀에게 알림이 간다", async () => {
      const result = await callerFor(parent).billing.startCheckout({ planKey: "ai_basic", studentId: 10 });
      expect(result).toMatchObject({ status: "paid", giftedTo: "홍길동" });
      expect(billingDb.createPaymentOrder).toHaveBeenCalledWith(expect.objectContaining({ userId: 10, payerUserId: 11, planKey: "ai_basic", amountKrw: 24900 }));
      expect(notifyGiftPurchase).toHaveBeenCalledWith(expect.objectContaining({ studentId: 10, itemName: getPlanName("ai_basic"), needsStart: true }));
    });

    it("연결을 승인하지 않은 학생에게는 구매해 줄 수 없다", async () => {
      await expect(callerFor(parent).billing.startCheckout({ planKey: "ai_basic", studentId: 99 })).rejects.toMatchObject({ code: "FORBIDDEN" });
      expect(billingDb.createPaymentOrder).not.toHaveBeenCalled();
    });

    it("학생·교사가 다른 학생 id를 보내 대신 결제할 수는 없다", async () => {
      await expect(callerFor(student).billing.startCheckout({ planKey: "ai_basic", studentId: 77 })).rejects.toMatchObject({ code: "FORBIDDEN" });
      await expect(callerFor(teacher).billing.startCheckout({ planKey: "ai_basic", studentId: 10 })).rejects.toMatchObject({ code: "FORBIDDEN" });
      expect(billingDb.createPaymentOrder).not.toHaveBeenCalled();
    });

    it("학부모의 결제 내역은 자녀에게 구매해 준 주문(결제한 사람 기준)이다", async () => {
      vi.mocked(billingDb.listOrdersByPayer).mockResolvedValue([{ id: 1 }] as any);
      vi.mocked(billingDb.listOrdersForUser).mockResolvedValue([{ id: 2 }] as any);
      expect(await callerFor(parent).billing.myOrders()).toEqual([{ id: 1 }]);
      expect(billingDb.listOrdersByPayer).toHaveBeenCalledWith(11);
      expect(await callerFor(student).billing.myOrders()).toEqual([{ id: 2 }]);
    });

    it("학부모는 연결된 자녀의 이용권 상태를 볼 수 있고, 연결되지 않은 학생은 볼 수 없다", async () => {
      vi.mocked(db.getUserById).mockResolvedValue({ id: 10, name: "홍길동", role: "user", tag: "중고등", createdAt: new Date() } as any);
      vi.mocked(billingDb.listActiveSubscriptions).mockResolvedValue([{ id: 3, planKey: "ai_basic", aiEvaluationsLimit: 10, currentPeriodStart: new Date(), currentPeriodEnd: new Date(Date.now() + 86400000), status: "active" }] as any);
      vi.mocked(billingDb.listAwaitingStartSubscriptions).mockResolvedValue([] as any);
      vi.mocked(billingDb.countAiUsage).mockResolvedValue(0 as any);
      const result = await callerFor(parent).billing.studentBilling({ studentId: 10 });
      expect(result.studentName).toBe("홍길동");
      expect(result.subscriptions).toHaveLength(1);
      expect(result.passRemaining).toBe(0);
      await expect(callerFor(parent).billing.studentBilling({ studentId: 99 })).rejects.toMatchObject({ code: "FORBIDDEN" });
    });
  });

  it("실제 제공자가 연동되지 않은 상태에서는 이용권을 만들지 않고 실패 처리한다", async () => {
    process.env.PAYMENT_PROVIDER = "portone";
    await expect(callerFor(student).billing.startCheckout({ planKey: "ai_basic" })).rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect(billingDb.markOrderFailed).toHaveBeenCalledWith(7, expect.stringContaining("연동"));
    expect(billingDb.confirmOrderAndActivateSubscription).not.toHaveBeenCalled();
  });

  it("결제 요청을 짧은 시간에 반복하면 제한한다", async () => {
    const caller = callerFor(student);
    for (let i = 0; i < 10; i += 1) await caller.billing.startCheckout({ planKey: "ai_basic" });
    await expect(caller.billing.startCheckout({ planKey: "ai_basic" })).rejects.toMatchObject({ code: "TOO_MANY_REQUESTS" });
  });

  it("요금제 목록은 로그인하지 않아도 보이고, 임시 결제 여부를 알려 준다", async () => {
    await expect(callerFor(null).billing.plans()).resolves.toMatchObject({ provider: "mock", isTest: true });
  });

  it("'유료 이용 시작'은 학습자 본인이 누른 시각부터 기간을 시작한다(본인 이용권만, 한 번만)", async () => {
    const periodStart = new Date("2026-10-13T00:00:00Z");
    const periodEnd = new Date("2026-11-12T00:00:00Z");
    vi.mocked(billingDb.startSubscription).mockResolvedValueOnce({ id: 3, currentPeriodStart: periodStart, currentPeriodEnd: periodEnd } as any);
    await expect(callerFor(student).billing.startPaidUse({ subscriptionId: 3 })).resolves.toEqual({ periodStart, periodEnd });
    expect(billingDb.startSubscription).toHaveBeenCalledWith(10, 3);

    // 이미 시작했거나 환불됐거나 남의 이용권이면 시작하지 않는다.
    vi.mocked(billingDb.startSubscription).mockResolvedValueOnce(undefined);
    await expect(callerFor(student).billing.startPaidUse({ subscriptionId: 3 })).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });

  it("학습자가 아니면 '유료 이용 시작'을 할 수 없다", async () => {
    for (const user of [parent, teacher, admin]) {
      await expect(callerFor(user).billing.startPaidUse({ subscriptionId: 3 })).rejects.toMatchObject({ code: "FORBIDDEN" });
    }
    await expect(callerFor(null).billing.startPaidUse({ subscriptionId: 3 })).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    expect(billingDb.startSubscription).not.toHaveBeenCalled();
  });

  it("내 이용권 조회는 이용 중인 것·시작 대기인 것·AI 이용 자격을 함께 돌려준다", async () => {
    vi.mocked(billingDb.listActiveSubscriptions).mockResolvedValue([]);
    vi.mocked(billingDb.listAwaitingStartSubscriptions).mockResolvedValue([{ id: 3, planKey: "ai_basic" }] as any);
    const result = await callerFor(student).billing.mySubscription();
    expect(result.awaitingStart).toHaveLength(1);
    expect(result.subscriptions).toEqual([]);
    expect(result.entitlement).toBeDefined();
  });
});

describe("관리자 결제 관리", () => {
  it("결제 내역·이용권·요약은 관리자만 볼 수 있다", async () => {
    for (const user of [student, teacher, parent]) {
      await expect(callerFor(user).billing.adminOrders({})).rejects.toMatchObject({ code: "FORBIDDEN" });
      await expect(callerFor(user).billing.adminSubscriptions()).rejects.toMatchObject({ code: "FORBIDDEN" });
      await expect(callerFor(user).billing.adminSummary()).rejects.toMatchObject({ code: "FORBIDDEN" });
      await expect(callerFor(user).billing.adminRefund({ orderId: 1, reason: "테스트" })).rejects.toMatchObject({ code: "FORBIDDEN" });
    }
    vi.mocked(billingDb.listOrdersAdmin).mockResolvedValue([]);
    await expect(callerFor(admin).billing.adminOrders({})).resolves.toEqual([]);
  });

  it("결제 완료 주문만 환불하고, 환불하면 주문 처리 함수를 호출한다", async () => {
    vi.mocked(billingDb.getPaymentOrder).mockResolvedValueOnce({ id: 1, status: "pending", provider: "mock", amountKrw: 9900 } as any);
    await expect(callerFor(admin).billing.adminRefund({ orderId: 1, reason: "고객 요청" })).rejects.toMatchObject({ code: "BAD_REQUEST" });

    vi.mocked(billingDb.getPaymentOrder).mockResolvedValueOnce({ id: 1, status: "paid", provider: "mock", providerPaymentKey: "mock_EM-1", amountKrw: 9900 } as any);
    await callerFor(admin).billing.adminRefund({ orderId: 1, reason: "고객 요청" });
    expect(billingDb.markOrderRefunded).toHaveBeenCalledWith(1);
  });

  it("실제 제공자로 결제된 주문은 제공자가 환불하지 못하면 환불 처리하지 않는다", async () => {
    vi.mocked(billingDb.getPaymentOrder).mockResolvedValue({ id: 2, status: "paid", provider: "portone", providerPaymentKey: "k", amountKrw: 9900 } as any);
    await expect(callerFor(admin).billing.adminRefund({ orderId: 2, reason: "고객 요청" })).rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect(billingDb.markOrderRefunded).not.toHaveBeenCalled();
  });
});

describe("정산 계산(shared/settlement)", () => {
  it("활동 건수 × 단가의 합이 총액이고, 원천징수를 뺀 금액이 실수령액이다", () => {
    const rates = defaultRates();
    const totals = computeSettlement({ essay_feedback: 10, assignment_review: 5, workbook_feedback: 20 }, rates, 3.3);
    expect(totals.grossKrw).toBe(10 * rates.essay_feedback + 5 * rates.assignment_review + 20 * rates.workbook_feedback);
    expect(totals.withholdingKrw).toBe(Math.floor((totals.grossKrw * 3.3) / 100));
    expect(totals.netKrw).toBe(totals.grossKrw - totals.withholdingKrw);
    expect(totals.items.map((item) => item.count)).toEqual([10, 5, 20]);
  });

  it("활동이 없으면 0원이고, 음수·소수 건수는 바로잡는다", () => {
    expect(computeSettlement(emptyCounts(), defaultRates()).grossKrw).toBe(0);
    expect(computeSettlement({ essay_feedback: -3, assignment_review: 2.9 }, defaultRates()).items.map((item) => item.count)).toEqual([0, 2, 0]);
  });

  it("저장된 단가가 없거나 잘못된 값이면 기본 단가를 쓴다", () => {
    expect(resolveRates({})).toEqual(defaultRates());
    expect(resolveRates({ essay_feedback: 5000, workbook_feedback: -1, unknown: 9 }).essay_feedback).toBe(5000);
    expect(resolveRates({ workbook_feedback: -1 }).workbook_feedback).toBe(defaultRates().workbook_feedback);
  });

  it("정산 월은 한국 시간 기준 한 달 범위로 자른다", () => {
    const { start, end } = monthRange("2026-12");
    expect(start.toISOString()).toBe("2026-11-30T15:00:00.000Z");
    expect(end.toISOString()).toBe("2026-12-31T15:00:00.000Z");
    expect(() => monthRange("2026-13")).toThrow();
    expect(currentMonthKst(new Date("2026-10-31T16:00:00Z"))).toBe("2026-11");
  });
});

describe("교사 정산(settlement) 접근", () => {
  beforeEach(() => {
    vi.mocked(billingDb.getSettlementRates).mockResolvedValue(defaultRates());
    vi.mocked(billingDb.getWithholdingPct).mockResolvedValue(3.3);
    const included = { essay_feedback: 4, assignment_review: 1, workbook_feedback: 2 };
    vi.mocked(billingDb.countTeacherActivities).mockResolvedValue(new Map([[20, included]]));
    vi.mocked(billingDb.countTeacherActivityBreakdown).mockResolvedValue(new Map([[20, { included, excludedAuto: 5, excludedManual: 1 }]]));
    vi.mocked(billingDb.getSettlement).mockResolvedValue(undefined);
    vi.mocked(billingDb.listApprovedTeachers).mockResolvedValue([{ id: 20, name: "김교사", email: "t@example.com" }] as any);
    vi.mocked(billingDb.listSettlementsByMonth).mockResolvedValue([]);
  });

  it("승인된 교사만 본인의 정산을 보고, 학생·학부모·승인 전 교사·비로그인은 볼 수 없다", async () => {
    const overview = await callerFor(teacher).settlement.myOverview({ month: "2026-09" });
    expect(overview.counts).toEqual({ essay_feedback: 4, assignment_review: 1, workbook_feedback: 2 });
    expect(overview.estimate.grossKrw).toBe(4 * 3000 + 1 * 2000 + 2 * 1000);
    // 본인 교사 id로만 집계하고, 정산에서 제외된 활동(기관 계약·직접 제외)도 업무량에는 그대로 보여 준다.
    expect(billingDb.countTeacherActivityBreakdown).toHaveBeenCalledWith(expect.any(Date), expect.any(Date), 20);
    expect(overview.workload).toEqual({ total: 7 + 5 + 1, included: 7, excludedAuto: 5, excludedManual: 1, unreconciled: 0 });

    for (const user of [student, parent, pendingTeacher, admin]) {
      await expect(callerFor(user).settlement.myOverview({})).rejects.toMatchObject({ code: "FORBIDDEN" });
    }
    await expect(callerFor(null).settlement.myOverview({})).rejects.toMatchObject({ code: "UNAUTHORIZED" });
  });

  it("교사에게는 확정·지급된 정산서만 보여주고, 산출 중(초안)은 숨긴다", async () => {
    const row = (id: number, status: string) => ({ id, teacherId: 20, periodMonth: `2026-0${id}`, status, itemsJson: "[]", grossKrw: 1000, withholdingPct: "3.3", withholdingKrw: 33, netKrw: 967, note: null, confirmedAt: null, paidAt: null });
    vi.mocked(billingDb.listSettlementsForTeacher).mockResolvedValue([row(3, "draft"), row(2, "confirmed"), row(1, "paid")] as any);
    const statements = await callerFor(teacher).settlement.myStatements();
    expect(statements.map((statement) => statement.status)).toEqual(["confirmed", "paid"]);
  });

  it("정산 산출·확정·지급·단가 설정은 관리자만 할 수 있다", async () => {
    for (const user of [student, teacher, pendingTeacher]) {
      const caller = callerFor(user);
      await expect(caller.settlement.adminOverview({ month: "2026-09" })).rejects.toMatchObject({ code: "FORBIDDEN" });
      await expect(caller.settlement.adminGenerate({ month: "2026-09" })).rejects.toMatchObject({ code: "FORBIDDEN" });
      await expect(caller.settlement.adminConfirm({ id: 1 })).rejects.toMatchObject({ code: "FORBIDDEN" });
      await expect(caller.settlement.adminMarkPaid({ id: 1 })).rejects.toMatchObject({ code: "FORBIDDEN" });
      await expect(caller.settlement.adminSaveRate({ activityType: "essay_feedback", unitAmountKrw: 9999999 })).rejects.toThrow();
      await expect(caller.settlement.adminSaveRate({ activityType: "essay_feedback", unitAmountKrw: 5000 })).rejects.toMatchObject({ code: "FORBIDDEN" });
      await expect(caller.settlement.adminSaveWithholding({ pct: 3.3 })).rejects.toMatchObject({ code: "FORBIDDEN" });
    }
  });

  it("관리자는 교사별 정산 현황을 보고 정산서를 산출한다", async () => {
    vi.mocked(billingDb.upsertDraftSettlement).mockResolvedValue(true);
    const overview = await callerFor(admin).settlement.adminOverview({ month: "2026-09" });
    expect(overview.rows).toHaveLength(1);
    expect(overview.rows[0].estimate.grossKrw).toBe(4 * 3000 + 2000 + 2000);
    await expect(callerFor(admin).settlement.adminGenerate({ month: "2026-09" })).resolves.toEqual({ generated: 1, skipped: 0 });
    expect(billingDb.upsertDraftSettlement).toHaveBeenCalledWith(20, "2026-09", expect.objectContaining({ grossKrw: 16000, netKrw: 16000 - Math.floor(16000 * 0.033) }));
  });

  it("진행 중인 달은 확정할 수 없고, 지난달 초안은 확정할 수 있다", async () => {
    vi.mocked(billingDb.getSettlementById).mockResolvedValueOnce({ id: 1, periodMonth: currentMonthKst(), status: "draft" } as any);
    await expect(callerFor(admin).settlement.adminConfirm({ id: 1 })).rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect(billingDb.confirmSettlement).not.toHaveBeenCalled();

    vi.mocked(billingDb.getSettlementById).mockResolvedValueOnce({ id: 2, periodMonth: "2020-01", status: "draft" } as any);
    vi.mocked(billingDb.confirmSettlement).mockResolvedValueOnce(true);
    await callerFor(admin).settlement.adminConfirm({ id: 2 });
    expect(billingDb.confirmSettlement).toHaveBeenCalledWith(2, 1);
  });

  it("확정되지 않은 정산서는 지급 완료로 바꿀 수 없다", async () => {
    vi.mocked(billingDb.markSettlementPaid).mockResolvedValueOnce(false);
    await expect(callerFor(admin).settlement.adminMarkPaid({ id: 5 })).rejects.toMatchObject({ code: "BAD_REQUEST" });
    vi.mocked(billingDb.markSettlementPaid).mockResolvedValueOnce(true);
    await expect(callerFor(admin).settlement.adminMarkPaid({ id: 5, note: "10월 말 이체" })).resolves.toEqual({ success: true });
  });
});

describe("교사 정산 제외(setActivityExclusion)", () => {
  const ledgerRow = (overrides = {}) => ({ id: 1, activityType: "essay_feedback", sourceId: 9, teacherId: 20, occurredAt: new Date("2020-01-15T00:00:00Z"), automaticExclusion: "none", manualExcluded: 0, manualExcludedBy: null, ...overrides });
  const input = { activityType: "essay_feedback" as const, sourceId: 9, excluded: true, reason: "교내 연수 지원 업무" };

  beforeEach(() => {
    vi.mocked(institution.getAccounting).mockResolvedValue(ledgerRow() as any);
    vi.mocked(billingDb.getSettlement).mockResolvedValue(undefined);
  });

  it("교사는 본인 활동을 사유와 함께 정산에서 제외할 수 있다", async () => {
    await callerFor(teacher).settlement.setActivityExclusion(input);
    expect(institution.setManualExclusion).toHaveBeenCalledWith({ activityType: "essay_feedback", sourceId: 9, excluded: true, reason: "교내 연수 지원 업무", actorId: 20 });
  });

  it("학생·학부모·승인 전 교사·비로그인은 정산 제외를 바꿀 수 없다", async () => {
    for (const user of [student, parent, pendingTeacher]) await expect(callerFor(user).settlement.setActivityExclusion(input)).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(callerFor(null).settlement.setActivityExclusion(input)).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    expect(institution.setManualExclusion).not.toHaveBeenCalled();
  });

  it("다른 교사의 활동은 바꿀 수 없다(관리자는 가능)", async () => {
    vi.mocked(institution.getAccounting).mockResolvedValue(ledgerRow({ teacherId: 99 }) as any);
    await expect(callerFor(teacher).settlement.setActivityExclusion(input)).rejects.toMatchObject({ code: "FORBIDDEN" });
    await callerFor(admin).settlement.setActivityExclusion(input);
    expect(institution.setManualExclusion).toHaveBeenCalledTimes(1);
  });

  it("사유가 없으면 제외할 수 없다", async () => {
    await expect(callerFor(teacher).settlement.setActivityExclusion({ ...input, reason: " " })).rejects.toThrow();
    expect(institution.setManualExclusion).not.toHaveBeenCalled();
  });

  it("기관 계약·소속으로 자동 제외된 활동은 바꿀 수 없다(되돌려서 정산받는 우회 불가)", async () => {
    for (const automaticExclusion of ["institution_contract", "institution_member", "teacher_member"]) {
      vi.mocked(institution.getAccounting).mockResolvedValue(ledgerRow({ automaticExclusion }) as any);
      await expect(callerFor(teacher).settlement.setActivityExclusion({ ...input, excluded: false })).rejects.toMatchObject({ code: "BAD_REQUEST" });
    }
    expect(institution.setManualExclusion).not.toHaveBeenCalled();
  });

  it("이미 확정·지급된 정산 월의 활동은 바꿀 수 없다", async () => {
    for (const status of ["confirmed", "paid"]) {
      vi.mocked(billingDb.getSettlement).mockResolvedValue({ id: 1, status } as any);
      await expect(callerFor(teacher).settlement.setActivityExclusion(input)).rejects.toMatchObject({ code: "BAD_REQUEST" });
    }
    expect(institution.setManualExclusion).not.toHaveBeenCalled();
  });

  it("교사는 관리자가 제외한 활동을 스스로 되돌릴 수 없다", async () => {
    vi.mocked(institution.getAccounting).mockResolvedValue(ledgerRow({ manualExcluded: 1, manualExcludedBy: 1 }) as any);
    await expect(callerFor(teacher).settlement.setActivityExclusion({ ...input, excluded: false })).rejects.toMatchObject({ code: "FORBIDDEN" });
    vi.mocked(institution.getAccounting).mockResolvedValue(ledgerRow({ manualExcluded: 1, manualExcludedBy: 20 }) as any);
    await callerFor(teacher).settlement.setActivityExclusion({ ...input, excluded: false });
    expect(institution.setManualExclusion).toHaveBeenCalledWith(expect.objectContaining({ excluded: false }));
  });

  it("활동 목록에는 자동 제외 사유와 변경 가능 여부를 보여 준다", async () => {
    vi.mocked(billingDb.getSettlement).mockResolvedValue(undefined);
    vi.mocked(institution.listTeacherActivitiesForMonth).mockResolvedValue([
      { activityType: "essay_feedback", sourceId: 1, occurredAt: new Date(), studentName: "가", automaticExclusion: "institution_contract", manualExcluded: 0, manualExclusionReason: null },
      { activityType: "essay_feedback", sourceId: 2, occurredAt: new Date(), studentName: "나", automaticExclusion: "none", manualExcluded: 1, manualExclusionReason: "연수" },
      { activityType: "workbook_feedback", sourceId: 3, occurredAt: new Date(), studentName: "다", automaticExclusion: "none", manualExcluded: 0, manualExclusionReason: null },
    ] as any);
    const { activities, frozen } = await callerFor(teacher).settlement.myActivities({ month: "2026-09" });
    expect(frozen).toBe(false);
    expect(activities.map((activity) => [activity.excluded, activity.canToggle])).toEqual([[true, false], [true, true], [false, true]]);
    expect(activities[0].label).toContain("기관 계약");
  });

  it("확정하기 직전에 지금의 활동·제외 상태로 다시 계산한다(오래된 초안이 그대로 확정되지 않는다)", async () => {
    vi.mocked(billingDb.getSettlementById).mockResolvedValue({ id: 2, teacherId: 20, periodMonth: "2020-01", status: "draft" } as any);
    vi.mocked(billingDb.countTeacherActivities).mockResolvedValue(new Map([[20, { essay_feedback: 1, assignment_review: 0, workbook_feedback: 0 }]]));
    vi.mocked(billingDb.upsertDraftSettlement).mockResolvedValue(true);
    vi.mocked(billingDb.confirmSettlement).mockResolvedValue(true);
    await callerFor(admin).settlement.adminConfirm({ id: 2 });
    expect(billingDb.upsertDraftSettlement).toHaveBeenCalledWith(20, "2020-01", expect.objectContaining({ grossKrw: 3000 }));
    const upsertOrder = vi.mocked(billingDb.upsertDraftSettlement).mock.invocationCallOrder[0];
    const confirmOrder = vi.mocked(billingDb.confirmSettlement).mock.invocationCallOrder[0];
    expect(upsertOrder).toBeLessThan(confirmOrder);
  });
});

describe("정산 제외: 소유 확인·멱등·미정리 활동", () => {
  const input = { activityType: "essay_feedback" as const, sourceId: 9, excluded: true, reason: "교내 연수 지원 업무" };
  beforeEach(() => {
    vi.mocked(billingDb.getSettlement).mockResolvedValue(undefined);
    vi.mocked(institution.getAccounting).mockResolvedValue(undefined);
  });

  it("다른 교사의 과거 활동에는 소유자를 확인하기 전에 어떤 기록도 만들지 않는다", async () => {
    vi.mocked(institution.resolveActivitySource).mockResolvedValue({ teacherId: 99, studentId: 3, groupId: null, occurredAt: new Date("2020-01-15") });
    await expect(callerFor(teacher).settlement.setActivityExclusion(input)).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(institution.ensureAccountingRow).not.toHaveBeenCalled();
    expect(institution.setManualExclusion).not.toHaveBeenCalled();
  });

  it("존재하지 않는 활동은 찾을 수 없음으로 응답한다", async () => {
    vi.mocked(institution.resolveActivitySource).mockResolvedValue(undefined);
    await expect(callerFor(teacher).settlement.setActivityExclusion(input)).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("본인의 과거 활동은 소유 확인 뒤에 장부에 기록하고 제외한다", async () => {
    vi.mocked(institution.resolveActivitySource).mockResolvedValue({ teacherId: 20, studentId: 3, groupId: null, occurredAt: new Date("2020-01-15") });
    vi.mocked(institution.ensureAccountingRow).mockResolvedValue({ id: 1, teacherId: 20, occurredAt: new Date("2020-01-15"), automaticExclusion: "none", manualExcluded: 0, manualExcludedBy: null } as any);
    await callerFor(teacher).settlement.setActivityExclusion(input);
    expect(institution.ensureAccountingRow).toHaveBeenCalledTimes(1);
    expect(institution.setManualExclusion).toHaveBeenCalledTimes(1);
  });

  it("관리자가 제외한 활동을 교사가 다시 제외해 소유권을 가져간 뒤 되돌릴 수 없다", async () => {
    vi.mocked(institution.getAccounting).mockResolvedValue({ id: 1, teacherId: 20, occurredAt: new Date("2020-01-15"), automaticExclusion: "none", manualExcluded: 1, manualExcludedBy: 1 } as any);
    await expect(callerFor(teacher).settlement.setActivityExclusion(input)).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(callerFor(teacher).settlement.setActivityExclusion({ ...input, excluded: false })).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(institution.setManualExclusion).not.toHaveBeenCalled();
  });

  it("장부에 기록되지 않은 최근 활동이 있으면 정산을 확정할 수 없고, 정리는 관리자만 한다", async () => {
    vi.mocked(billingDb.getSettlementById).mockResolvedValue({ id: 2, teacherId: 20, periodMonth: "2020-01", status: "draft" } as any);
    vi.mocked(billingDb.countTeacherActivityBreakdown).mockResolvedValue(new Map([[20, { included: { essay_feedback: 1, assignment_review: 0, workbook_feedback: 0 }, excludedAuto: 0, excludedManual: 0, unreconciled: 2 }]]));
    await expect(callerFor(admin).settlement.adminConfirm({ id: 2 })).rejects.toMatchObject({ code: "BAD_REQUEST", message: expect.stringContaining("장부 정리") });
    expect(billingDb.confirmSettlement).not.toHaveBeenCalled();

    for (const user of [student, teacher]) await expect(callerFor(user).settlement.adminReconcile({ month: "2020-01", teacherId: 20 })).rejects.toMatchObject({ code: "FORBIDDEN" });
    vi.mocked(institution.reconcileUnaccountedActivities).mockResolvedValue(2);
    await expect(callerFor(admin).settlement.adminReconcile({ month: "2020-01", teacherId: 20 })).resolves.toEqual({ reconciled: 2 });
  });
});
