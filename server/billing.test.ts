import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("./billingDb", () => ({
  createPaymentOrder: vi.fn(),
  getPaymentOrder: vi.fn(),
  markOrderFailed: vi.fn(),
  confirmOrderAndActivateSubscription: vi.fn(),
  getCurrentSubscription: vi.fn(),
  cancelCurrentSubscription: vi.fn(),
  listOrdersForUser: vi.fn(),
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
  getSettlement: vi.fn(),
  getSettlementById: vi.fn(),
  listSettlementsForTeacher: vi.fn(),
  listSettlementsByMonth: vi.fn(),
  upsertDraftSettlement: vi.fn(),
  confirmSettlement: vi.fn(),
  markSettlementPaid: vi.fn(),
}));

import * as billingDb from "./billingDb";
import { appRouter } from "./routers";
import { getPaymentProvider, mockProvider } from "./billing/providers";
import { evaluateAiEntitlement } from "./billing/entitlements";
import { PLANS, formatKrw, getPlan } from "../shared/plans";
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
  it("요금 페이지에 안내한 가격·횟수와 같다(스타터 월 5회 9,900원, 성장 월 20회 24,900원)", () => {
    expect(getPlan("starter")).toMatchObject({ priceKrw: 9900, monthlyAiEvaluations: 5 });
    expect(getPlan("growth")).toMatchObject({ priceKrw: 24900, monthlyAiEvaluations: 20 });
    expect(PLANS).toHaveLength(2);
    expect(formatKrw(24900)).toBe("24,900원");
  });
});

describe("결제 제공자", () => {
  it("설정이 없으면 임시(mock) 결제이고, 곧바로 결제 완료로 처리한다", async () => {
    const provider = getPaymentProvider();
    expect(provider).toBe(mockProvider);
    expect(provider.isTest).toBe(true);
    await expect(provider.createCheckout({ orderId: "EM-1", amountKrw: 9900, planName: "스타터", buyer: { id: 1, name: null, email: null } })).resolves.toEqual({ status: "paid", paymentKey: "mock_EM-1" });
  });

  it("아직 연동되지 않은 실제 제공자는 성공한 것처럼 처리하지 않고 실패한다", async () => {
    for (const name of ["portone", "tosspayments"]) {
      const provider = getPaymentProvider(name);
      expect(provider.isTest).toBe(false);
      const result = await provider.createCheckout({ orderId: "EM-1", amountKrw: 9900, planName: "스타터", buyer: { id: 1, name: null, email: null } });
      expect(result.status).toBe("failed");
    }
    expect(() => getPaymentProvider("unknown-pg")).toThrow();
  });
});

describe("AI 평가 이용 자격(entitlements)", () => {
  const now = new Date("2026-10-12T00:00:00Z");
  const days = (n: number) => new Date(now.getTime() - n * 24 * 60 * 60 * 1000);
  const plan = (overrides = {}) => ({ status: "active" as const, planKey: "starter", currentPeriodStart: days(3), currentPeriodEnd: new Date(now.getTime() + 27 * 86400000), aiEvaluationsLimit: 5, ...overrides });

  it("가입 7일 안에는 체험 1회, 사용하면 이용권이 필요하다", () => {
    const fresh = evaluateAiEntitlement({ user: { role: "user", createdAt: days(2) }, subscription: null, usedInPlanPeriod: 0, usedInTrial: 0, now });
    expect(fresh).toMatchObject({ mode: "trial", canUse: true, limit: 1, remaining: 1 });
    const used = evaluateAiEntitlement({ user: { role: "user", createdAt: days(2) }, subscription: null, usedInPlanPeriod: 0, usedInTrial: 1, now });
    expect(used).toMatchObject({ mode: "trial", canUse: false });
  });

  it("체험이 끝나고 이용권이 없으면 이용할 수 없다(예전의 무료 일 5회는 없다)", () => {
    const result = evaluateAiEntitlement({ user: { role: "user", createdAt: days(30) }, subscription: null, usedInPlanPeriod: 0, usedInTrial: 0, now });
    expect(result).toMatchObject({ mode: "none", canUse: false });
    expect(result.reason).toContain("이용권");
  });

  it("이용권이 있으면 기간 안에서 결제한 횟수까지 쓴다", () => {
    expect(evaluateAiEntitlement({ user: { role: "user", createdAt: days(30) }, subscription: plan(), usedInPlanPeriod: 4, usedInTrial: 1, now })).toMatchObject({ mode: "plan", canUse: true, limit: 5, remaining: 1 });
    expect(evaluateAiEntitlement({ user: { role: "user", createdAt: days(30) }, subscription: plan(), usedInPlanPeriod: 5, usedInTrial: 1, now })).toMatchObject({ mode: "plan", canUse: false, remaining: 0 });
  });

  it("해지한 이용권도 결제한 기간이 끝날 때까지 유효하고, 만료되면 무효다", () => {
    expect(evaluateAiEntitlement({ user: { role: "user", createdAt: days(30) }, subscription: plan({ status: "cancelled" }), usedInPlanPeriod: 0, usedInTrial: 0, now }).mode).toBe("plan");
    expect(evaluateAiEntitlement({ user: { role: "user", createdAt: days(30) }, subscription: plan({ currentPeriodEnd: days(1) }), usedInPlanPeriod: 0, usedInTrial: 0, now }).mode).toBe("none");
    expect(evaluateAiEntitlement({ user: { role: "user", createdAt: days(30) }, subscription: plan({ status: "expired" }), usedInPlanPeriod: 0, usedInTrial: 0, now }).mode).toBe("none");
  });

  it("관리자·교사는 한도가 없고, 학부모는 이용할 수 없다", () => {
    expect(evaluateAiEntitlement({ user: { role: "admin", createdAt: days(1) }, subscription: null, usedInPlanPeriod: 0, usedInTrial: 0, now }).mode).toBe("unlimited");
    expect(evaluateAiEntitlement({ user: { role: "teacher", createdAt: days(1) }, subscription: null, usedInPlanPeriod: 0, usedInTrial: 0, now }).mode).toBe("unlimited");
    expect(evaluateAiEntitlement({ user: { role: "user", tag: "학부모", createdAt: days(1) }, subscription: null, usedInPlanPeriod: 0, usedInTrial: 0, now }).canUse).toBe(false);
  });
});

describe("이용권 결제(billing)", () => {
  const order = { id: 7, providerOrderId: "EM-TEST", userId: 10 };

  beforeEach(() => {
    vi.mocked(billingDb.createPaymentOrder).mockResolvedValue(order as any);
    vi.mocked(billingDb.confirmOrderAndActivateSubscription).mockResolvedValue({ id: 3, planKey: "starter" } as any);
  });

  it("임시 결제에서는 결제하면 곧바로 이용권이 만들어진다(주문은 테스트 결제로 기록)", async () => {
    const result = await callerFor(student).billing.startCheckout({ planKey: "starter" });
    expect(result).toMatchObject({ status: "paid", isTest: true, orderId: 7 });
    expect(billingDb.createPaymentOrder).toHaveBeenCalledWith(expect.objectContaining({ userId: 10, planKey: "starter", amountKrw: 9900, provider: "mock", isTest: true }));
    expect(billingDb.confirmOrderAndActivateSubscription).toHaveBeenCalledWith(expect.objectContaining({ orderId: 7, planKey: "starter", periodDays: 30, aiEvaluationsLimit: 5 }));
  });

  it("금액과 이용 횟수는 서버의 요금제 정의로 정하고, 클라이언트가 보낸 값은 쓰지 않는다", async () => {
    await callerFor(student).billing.startCheckout({ planKey: "growth", amountKrw: 1, aiEvaluationsLimit: 9999 } as any);
    expect(billingDb.createPaymentOrder).toHaveBeenCalledWith(expect.objectContaining({ amountKrw: 24900 }));
    expect(billingDb.confirmOrderAndActivateSubscription).toHaveBeenCalledWith(expect.objectContaining({ aiEvaluationsLimit: 20 }));
    await expect(callerFor(student).billing.startCheckout({ planKey: "free" as any })).rejects.toThrow();
  });

  it("학습자만 결제할 수 있다(학부모·교사·관리자·비로그인 불가)", async () => {
    for (const user of [parent, teacher, admin]) {
      await expect(callerFor(user).billing.startCheckout({ planKey: "starter" })).rejects.toMatchObject({ code: "FORBIDDEN" });
    }
    await expect(callerFor(null).billing.startCheckout({ planKey: "starter" })).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    expect(billingDb.createPaymentOrder).not.toHaveBeenCalled();
  });

  it("실제 제공자가 연동되지 않은 상태에서는 이용권을 만들지 않고 실패 처리한다", async () => {
    process.env.PAYMENT_PROVIDER = "portone";
    await expect(callerFor(student).billing.startCheckout({ planKey: "starter" })).rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect(billingDb.markOrderFailed).toHaveBeenCalledWith(7, expect.stringContaining("연동"));
    expect(billingDb.confirmOrderAndActivateSubscription).not.toHaveBeenCalled();
  });

  it("결제 요청을 짧은 시간에 반복하면 제한한다", async () => {
    const caller = callerFor(student);
    for (let i = 0; i < 10; i += 1) await caller.billing.startCheckout({ planKey: "starter" });
    await expect(caller.billing.startCheckout({ planKey: "starter" })).rejects.toMatchObject({ code: "TOO_MANY_REQUESTS" });
  });

  it("요금제 목록은 로그인하지 않아도 보이고, 임시 결제 여부를 알려 준다", async () => {
    await expect(callerFor(null).billing.plans()).resolves.toMatchObject({ provider: "mock", isTest: true });
  });

  it("해지 시 이용권이 없으면 안내하고, 있으면 남은 기간을 알려 준다", async () => {
    vi.mocked(billingDb.cancelCurrentSubscription).mockResolvedValueOnce(undefined);
    await expect(callerFor(student).billing.cancelSubscription()).rejects.toMatchObject({ code: "BAD_REQUEST" });
    const end = new Date("2026-11-01T00:00:00Z");
    vi.mocked(billingDb.cancelCurrentSubscription).mockResolvedValueOnce({ currentPeriodEnd: end } as any);
    await expect(callerFor(student).billing.cancelSubscription()).resolves.toEqual({ periodEnd: end });
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
    vi.mocked(billingDb.countTeacherActivities).mockResolvedValue(new Map([[20, { essay_feedback: 4, assignment_review: 1, workbook_feedback: 2 }]]));
    vi.mocked(billingDb.getSettlement).mockResolvedValue(undefined);
    vi.mocked(billingDb.listApprovedTeachers).mockResolvedValue([{ id: 20, name: "김교사", email: "t@example.com" }] as any);
    vi.mocked(billingDb.listSettlementsByMonth).mockResolvedValue([]);
  });

  it("승인된 교사만 본인의 정산을 보고, 학생·학부모·승인 전 교사·비로그인은 볼 수 없다", async () => {
    const overview = await callerFor(teacher).settlement.myOverview({ month: "2026-09" });
    expect(overview.counts).toEqual({ essay_feedback: 4, assignment_review: 1, workbook_feedback: 2 });
    expect(overview.estimate.grossKrw).toBe(4 * 3000 + 1 * 2000 + 2 * 1000);
    // 본인 교사 id로만 집계한다
    expect(billingDb.countTeacherActivities).toHaveBeenCalledWith(expect.any(Date), expect.any(Date), 20);

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
