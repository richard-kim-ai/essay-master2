import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("./billingDb", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./billingDb")>();
  return {
    ...actual,
    listActiveSubscriptions: vi.fn(),
    listAwaitingStartSubscriptions: vi.fn(),
    createPaymentOrder: vi.fn(),
    markOrderFailed: vi.fn(),
  };
});
vi.mock("./teacherFeedbackRequestDb", () => ({
  createPassForPaidOrder: vi.fn(),
  listPassesForUser: vi.fn(),
  listPassesAdmin: vi.fn(),
  createRequestUsingPass: vi.fn(),
  getRequestById: vi.fn(),
  getOpenRequestByEssay: vi.fn(),
  listRequestsForUser: vi.fn(),
  listOpenRequestsForTeacher: vi.fn(),
  listRequestsAdmin: vi.fn(),
  markRequestStarted: vi.fn(),
  markDeliveredByEssay: vi.fn(),
  cancelRequestRestoreSession: vi.fn(),
  requestRework: vi.fn(),
  notifyUser: vi.fn(async () => undefined),
}));
vi.mock("./db", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./db")>();
  return { ...actual, getEssaySubmissionById: vi.fn(), getUserById: vi.fn(), getTeacherFeedbackByEssay: vi.fn(), getLinkedStudentsForParent: vi.fn() };
});
const fundingState = vi.hoisted(() => ({ kind: "none" as "none" | "contract" }));
vi.mock("./institutionDb", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./institutionDb")>();
  return { ...actual, resolveStudentFunding: vi.fn(async () => ({ kind: fundingState.kind })) };
});
vi.mock("./push", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./push")>();
  return { ...actual, sendPushToUser: vi.fn(async () => ({ sent: 0, skipped: true })) };
});

vi.mock("./giftPurchase", async (importOriginal) => ({ ...(await importOriginal<typeof import("./giftPurchase")>()), notifyGiftPurchase: vi.fn(async () => undefined) }));

import * as billingDb from "./billingDb";
import { notifyGiftPurchase } from "./giftPurchase";
import * as db from "./db";
import * as requestDb from "./teacherFeedbackRequestDb";
import { appRouter } from "./routers";
import { resetRateLimits } from "./rateLimit";
import { addBusinessDays, computeDueAt, isPassUsable, isRequestOverdue, passRemaining, pickPassToUse, totalRemainingSessions, unusedPassRefundKrw } from "../shared/teacherFeedbackRequest";
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

const student: TestUser = { id: 10, role: "user", tag: "중고등", teacherId: 20 };
const parent: TestUser = { id: 11, role: "user", tag: "학부모" };
const teacher: TestUser = { id: 20, role: "teacher", teacherStatus: "approved" };
const otherTeacher: TestUser = { id: 21, role: "teacher", teacherStatus: "approved" };
const pendingTeacher: TestUser = { id: 22, role: "teacher", teacherStatus: "pending" };
const admin: TestUser = { id: 1, role: "admin" };

const essay = { id: 5, userId: 10, title: "교육과 기술", content: "기술 발전은 교육에 큰 영향을 준다.", status: "draft" };
const humanTeacher = { id: 20, role: "teacher", teacherStatus: "approved", name: "김교사", openId: "teacher-20" };
const activeSubscription = { id: 3, planKey: "ai_basic" };
const future = (days: number) => new Date(Date.now() + days * 24 * 60 * 60 * 1000);
const pass = (overrides: Record<string, unknown> = {}) => ({ id: 1, userId: 10, status: "active", sessions: 3, sessionsUsed: 0, priceKrw: 19900, expiresAt: future(60), productKey: "tf_pass_3", orderId: 7, createdAt: new Date(), ...overrides });

beforeEach(() => {
  vi.clearAllMocks();
  resetRateLimits();
  fundingState.kind = "none";
  delete process.env.PAYMENT_PROVIDER;
  vi.mocked(billingDb.listActiveSubscriptions).mockResolvedValue([activeSubscription] as any);
  vi.mocked(billingDb.listAwaitingStartSubscriptions).mockResolvedValue([]);
  vi.mocked(billingDb.createPaymentOrder).mockResolvedValue({ id: 7, providerOrderId: "EM-TF" } as any);
  // 서버 코드는 .catch(...)로 부르므로 프로미스를 돌려줘야 한다.
  vi.mocked(billingDb.markOrderFailed).mockResolvedValue(undefined as any);
  vi.mocked(requestDb.notifyUser).mockResolvedValue(undefined);
  vi.mocked(requestDb.listPassesForUser).mockResolvedValue([pass()] as any);
  vi.mocked(requestDb.createPassForPaidOrder).mockResolvedValue(pass({ id: 9 }) as any);
  vi.mocked(requestDb.getOpenRequestByEssay).mockResolvedValue(undefined);
  vi.mocked(requestDb.createRequestUsingPass).mockResolvedValue({ id: 31, essayId: 5, passId: 1, status: "paid", dueAt: new Date("2026-10-19T14:59:59Z") } as any);
  vi.mocked(db.getEssaySubmissionById).mockResolvedValue(essay as any);
  vi.mocked(db.getTeacherFeedbackByEssay).mockResolvedValue(undefined);
  vi.mocked(db.getUserById).mockResolvedValue(humanTeacher as any);
});

describe("완료 예정일(영업일 계산, 한국 시간)", () => {
  it("신청일부터 3영업일째 날 23:59:59(KST)까지로 계산하고 토·일은 세지 않는다", () => {
    // 수 10:00 → 목·금·월 → 월요일 23:59:59 KST
    expect(computeDueAt(new Date("2026-10-14T01:00:00Z")).toISOString()).toBe("2026-10-19T14:59:59.000Z");
    // 금 15:00 → 월·화·수 → 수요일
    expect(computeDueAt(new Date("2026-10-16T06:00:00Z")).toISOString()).toBe("2026-10-21T14:59:59.000Z");
    // 토 09:00 → 월·화·수 → 수요일(토·일 제외)
    expect(computeDueAt(new Date("2026-10-17T00:00:00Z")).toISOString()).toBe("2026-10-21T14:59:59.000Z");
  });

  it("UTC로는 전날이어도 한국 날짜 기준으로 센다(목 00:30 KST = 수 15:30 UTC)", () => {
    expect(computeDueAt(new Date("2026-10-14T15:30:00Z")).toISOString()).toBe("2026-10-20T14:59:59.000Z");
  });

  it("0영업일이면 같은 날 23:59:59(KST)이다", () => {
    expect(addBusinessDays(new Date("2026-10-14T01:00:00Z"), 0).toISOString()).toBe("2026-10-14T14:59:59.000Z");
  });

  it("전달 전(신청 완료·작업 중)이고 예정일이 지났을 때만 지연이다", () => {
    const now = new Date("2026-10-20T00:00:00Z");
    const dueAt = new Date("2026-10-19T14:59:59Z");
    expect(isRequestOverdue({ status: "paid", dueAt }, now)).toBe(true);
    expect(isRequestOverdue({ status: "in_progress", dueAt }, now)).toBe(true);
    expect(isRequestOverdue({ status: "delivered", dueAt }, now)).toBe(false);
    expect(isRequestOverdue({ status: "refunded", dueAt }, now)).toBe(false);
    expect(isRequestOverdue({ status: "paid", dueAt: new Date("2026-10-21T00:00:00Z") }, now)).toBe(false);
  });
});

describe("첨삭지도권 규칙(잔여 횟수·유효기간·사용 순서·환불액)", () => {
  const now = new Date("2026-10-14T00:00:00Z");
  const base = { status: "active", sessions: 3, sessionsUsed: 0, priceKrw: 19900, expiresAt: new Date("2026-12-01T00:00:00Z") };

  it("남은 횟수는 총 횟수에서 사용한 횟수를 뺀 값이고 음수가 되지 않는다", () => {
    expect(passRemaining({ sessions: 3, sessionsUsed: 1 })).toBe(2);
    expect(passRemaining({ sessions: 3, sessionsUsed: 5 })).toBe(0);
  });

  it("환불되었거나 유효기간이 지났거나 횟수를 다 쓴 권은 쓸 수 없다", () => {
    expect(isPassUsable(base, now)).toBe(true);
    expect(isPassUsable({ ...base, status: "refunded" }, now)).toBe(false);
    expect(isPassUsable({ ...base, expiresAt: new Date("2026-10-13T00:00:00Z") }, now)).toBe(false);
    expect(isPassUsable({ ...base, sessionsUsed: 3 }, now)).toBe(false);
  });

  it("먼저 만료되는 권부터(만료가 같으면 먼저 산 권부터) 쓰고, 쓸 수 없는 권은 건너뛴다", () => {
    const later = { ...base, id: 5, expiresAt: new Date("2026-12-20T00:00:00Z") };
    const sooner = { ...base, id: 9, expiresAt: new Date("2026-11-01T00:00:00Z") };
    const sameEndOlder = { ...base, id: 2, expiresAt: new Date("2026-11-01T00:00:00Z") };
    const exhausted = { ...base, id: 1, sessionsUsed: 3, expiresAt: new Date("2026-10-20T00:00:00Z") };
    expect(pickPassToUse([later, sooner, sameEndOlder, exhausted], now)?.id).toBe(2);
    expect(pickPassToUse([exhausted], now)).toBeUndefined();
  });

  it("남은 횟수 합계는 쓸 수 있는 권만 더한다", () => {
    expect(totalRemainingSessions([{ ...base, sessionsUsed: 1 }, { ...base, sessions: 5, priceKrw: 31900, sessionsUsed: 2 }, { ...base, status: "refunded" }], now)).toBe(2 + 3);
  });

  it("미사용 환불액은 결제금액 × 미사용 횟수 ÷ 총 횟수이고, 원 미만은 올림하되 결제금액을 넘지 않는다", () => {
    expect(unusedPassRefundKrw({ sessions: 3, sessionsUsed: 0, priceKrw: 19900 })).toBe(19900);
    expect(unusedPassRefundKrw({ sessions: 3, sessionsUsed: 1, priceKrw: 19900 })).toBe(13267); // 13266.67 → 올림
    expect(unusedPassRefundKrw({ sessions: 5, sessionsUsed: 5, priceKrw: 31900 })).toBe(0);
    expect(unusedPassRefundKrw({ sessions: 1, sessionsUsed: 0, priceKrw: 6900 })).toBe(6900);
    expect(unusedPassRefundKrw({ sessions: 0, sessionsUsed: 0, priceKrw: 6900 })).toBe(0);
  });
});

describe("첨삭지도권 목록·구매(passes, purchasePass)", () => {
  it("판매 중인 상품은 1·3·5회분이고 가격이 정해진 값이다", async () => {
    const products = await callerFor(student).teacherFeedbackRequest.products();
    expect(products.map((product) => [product.key, product.sessions, product.priceKrw])).toEqual([["tf_pass_1", 1, 6900], ["tf_pass_3", 3, 19900], ["tf_pass_5", 5, 31900]]);
    for (const product of products) expect(product.periodDays).toBe(90);
  });

  it("내 첨삭지도권은 잔여 횟수와 구매 가능 여부(이용권 결제자)를 함께 돌려준다", async () => {
    vi.mocked(requestDb.listPassesForUser).mockResolvedValue([pass({ sessionsUsed: 1 }), pass({ id: 2, expiresAt: new Date("2000-01-01T00:00:00Z") })] as any);
    const result = await callerFor(student).teacherFeedbackRequest.passes();
    expect(result.totalRemaining).toBe(2);
    expect(result.canBuy).toBe(true);
    expect(result.passes.map((item) => [item.id, item.remaining, item.usable, item.expired])).toEqual([[1, 2, true, false], [2, 3, false, true]]);
  });

  it("이용권 결제자가 구매하면 주문이 만들어지고 권이 생성된다(금액·횟수는 서버가 정한다)", async () => {
    const result = await callerFor(student).teacherFeedbackRequest.purchasePass({ productKey: "tf_pass_3", priceKrw: 1, sessions: 99 } as any);
    expect(result).toMatchObject({ status: "paid", isTest: true, orderId: 7 });
    expect(billingDb.createPaymentOrder).toHaveBeenCalledWith(expect.objectContaining({ userId: 10, planKey: "tf_pass_3", amountKrw: 19900, provider: "mock", isTest: true }));
    expect(requestDb.createPassForPaidOrder).toHaveBeenCalledWith(expect.objectContaining({ orderId: 7, userId: 10, productKey: "tf_pass_3", sessions: 3, priceKrw: 19900, periodDays: 90 }));
  });

  it("이용권 결제자만 구매할 수 있다(체험만 쓰는 사용자·시작 대기 중인 사용자는 불가)", async () => {
    vi.mocked(billingDb.listActiveSubscriptions).mockResolvedValue([]);
    await expect(callerFor(student).teacherFeedbackRequest.purchasePass({ productKey: "tf_pass_1" })).rejects.toMatchObject({ code: "BAD_REQUEST", message: expect.stringContaining("이용권 결제자만") });
    expect(billingDb.createPaymentOrder).not.toHaveBeenCalled();

    vi.mocked(billingDb.listAwaitingStartSubscriptions).mockResolvedValue([{ id: 9 }] as any);
    const status = await callerFor(student).teacherFeedbackRequest.passes();
    expect(status.canBuy).toBe(false);
    expect(status.buyReasons.join(" ")).toContain("유료 이용 시작");
  });

  it("학습자만 본인에게 구매할 수 있다(교사·관리자·비로그인 불가, 학부모는 자녀를 지정하지 않으면 불가)", async () => {
    for (const user of [teacher, admin]) {
      await expect(callerFor(user).teacherFeedbackRequest.purchasePass({ productKey: "tf_pass_1" })).rejects.toMatchObject({ code: "FORBIDDEN" });
    }
    await expect(callerFor(parent).teacherFeedbackRequest.purchasePass({ productKey: "tf_pass_1" })).rejects.toMatchObject({ code: "BAD_REQUEST" });
    await expect(callerFor(null).teacherFeedbackRequest.purchasePass({ productKey: "tf_pass_1" })).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    expect(billingDb.createPaymentOrder).not.toHaveBeenCalled();
  });

  describe("학부모가 연결된 자녀에게 첨삭지도권 구매해 주기", () => {
    beforeEach(() => {
      vi.mocked(db.getLinkedStudentsForParent).mockResolvedValue([{ id: 10, name: "홍길동" }] as any);
    });

    it("자녀가 이용권을 이용 중이면 구매할 수 있고, 권은 자녀 계정에 생기며 주문에는 학부모가 결제자로 기록된다", async () => {
      const result = await callerFor(parent).teacherFeedbackRequest.purchasePass({ productKey: "tf_pass_3", studentId: 10 });
      expect(result).toMatchObject({ status: "paid", giftedTo: "홍길동" });
      expect(billingDb.listActiveSubscriptions).toHaveBeenCalledWith(10);
      expect(billingDb.createPaymentOrder).toHaveBeenCalledWith(expect.objectContaining({ userId: 10, payerUserId: 11, planKey: "tf_pass_3", amountKrw: 19900 }));
      expect(requestDb.createPassForPaidOrder).toHaveBeenCalledWith(expect.objectContaining({ userId: 10, productKey: "tf_pass_3", sessions: 3 }));
      expect(notifyGiftPurchase).toHaveBeenCalledWith(expect.objectContaining({ studentId: 10 }));
    });

    it("자녀가 이용 중인 이용권이 없으면 먼저 이용권을 구매해 달라고 안내하고 결제하지 않는다", async () => {
      vi.mocked(billingDb.listActiveSubscriptions).mockResolvedValue([]);
      await expect(callerFor(parent).teacherFeedbackRequest.purchasePass({ productKey: "tf_pass_1", studentId: 10 })).rejects.toMatchObject({ code: "BAD_REQUEST", message: expect.stringContaining("자녀가 이용 중인 이용권") });
      expect(billingDb.createPaymentOrder).not.toHaveBeenCalled();
      const status = await callerFor(parent).teacherFeedbackRequest.passes({ studentId: 10 });
      expect(status.canBuy).toBe(false);
      expect(status.buyReasons.join(" ")).toContain("자녀");
    });

    it("연결되지 않은 학생에게는 구매할 수 없고, 자녀 없이 조회하면 자녀 선택을 안내한다", async () => {
      await expect(callerFor(parent).teacherFeedbackRequest.purchasePass({ productKey: "tf_pass_1", studentId: 99 })).rejects.toMatchObject({ code: "FORBIDDEN" });
      expect(billingDb.createPaymentOrder).not.toHaveBeenCalled();
      const none = await callerFor(parent).teacherFeedbackRequest.passes();
      expect(none.canBuy).toBe(false);
      expect(none.buyReasons.join(" ")).toContain("자녀를 선택");
    });

    it("학부모가 보는 첨삭지도권은 자녀의 것이다", async () => {
      vi.mocked(requestDb.listPassesForUser).mockResolvedValue([pass({ sessionsUsed: 1 })] as any);
      const result = await callerFor(parent).teacherFeedbackRequest.passes({ studentId: 10 });
      expect(requestDb.listPassesForUser).toHaveBeenCalledWith(10);
      expect(result.totalRemaining).toBe(2);
      expect(result.canBuy).toBe(true);
    });
  });

  it("건별(핵심·일반·종합) 상품은 더 이상 구매할 수 없다", async () => {
    await expect(callerFor(student).teacherFeedbackRequest.purchasePass({ productKey: "tf_standard" as any })).rejects.toThrow();
    await expect(callerFor(student).teacherFeedbackRequest.purchasePass({ productKey: "tf_core" as any })).rejects.toThrow();
  });

  it("실제 결제 제공자가 연동되지 않았으면 권을 만들지 않고 주문을 실패 처리한다", async () => {
    process.env.PAYMENT_PROVIDER = "portone";
    await expect(callerFor(student).teacherFeedbackRequest.purchasePass({ productKey: "tf_pass_1" })).rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect(billingDb.markOrderFailed).toHaveBeenCalledWith(7, expect.stringContaining("연동"));
    expect(requestDb.createPassForPaidOrder).not.toHaveBeenCalled();
  });

  it("결제 후 권 저장에 실패하면 결제를 되돌리고(주문 실패 처리) 권을 남기지 않는다", async () => {
    vi.mocked(requestDb.createPassForPaidOrder).mockRejectedValueOnce(new Error("db down"));
    await expect(callerFor(student).teacherFeedbackRequest.purchasePass({ productKey: "tf_pass_1" })).rejects.toMatchObject({ code: "CONFLICT", message: expect.stringContaining("결제는 취소") });
    expect(billingDb.markOrderFailed).toHaveBeenCalledWith(7, expect.any(String));
  });

  it("이미 처리된 결제(중복 호출)는 두 번째 권을 만들지 않는다", async () => {
    vi.mocked(requestDb.createPassForPaidOrder).mockResolvedValueOnce(null);
    await expect(callerFor(student).teacherFeedbackRequest.purchasePass({ productKey: "tf_pass_1" })).rejects.toMatchObject({ code: "CONFLICT" });
  });

  it("결제 요청을 짧은 시간에 반복하면 제한한다", async () => {
    const caller = callerFor(student);
    for (let i = 0; i < 10; i += 1) await caller.teacherFeedbackRequest.purchasePass({ productKey: "tf_pass_1" });
    await expect(caller.teacherFeedbackRequest.purchasePass({ productKey: "tf_pass_1" })).rejects.toMatchObject({ code: "TOO_MANY_REQUESTS" });
  });
});

describe("신청 가능 여부(quote)", () => {
  it("유효한 첨삭지도권이 있고 본인 글·담당 교사가 있으면 신청할 수 있다", async () => {
    const result = await callerFor(student).teacherFeedbackRequest.quote({ essayId: 5 });
    expect(result).toMatchObject({ eligible: true, reasons: [], remaining: 3, teacherName: "김교사", essayTitle: "교육과 기술", contractFunded: false });
    expect(result.cancelNotice).toContain("돌아옵니다");
    expect(result.dueAt).toBeInstanceOf(Date);
  });

  it("첨삭지도권이 없으면 신청할 수 없고, 이용권 결제자에게는 구매를 안내한다", async () => {
    vi.mocked(requestDb.listPassesForUser).mockResolvedValue([]);
    const result = await callerFor(student).teacherFeedbackRequest.quote({ essayId: 5 });
    expect(result).toMatchObject({ eligible: false, remaining: 0, canBuyPass: true });
    expect(result.reasons[0]).toContain("첨삭지도권을 구매해 주세요");
  });

  it("이용권이 없으면 구매·신청 모두 '이용권 결제자만' 안내한다", async () => {
    vi.mocked(requestDb.listPassesForUser).mockResolvedValue([]);
    vi.mocked(billingDb.listActiveSubscriptions).mockResolvedValue([]);
    const result = await callerFor(student).teacherFeedbackRequest.quote({ essayId: 5 });
    expect(result).toMatchObject({ eligible: false, canBuyPass: false });
    expect(result.reasons.join(" ")).toContain("이용권 결제자만");
  });

  it("횟수를 다 썼거나 유효기간이 지난 권만 있으면 신청할 수 없다", async () => {
    vi.mocked(requestDb.listPassesForUser).mockResolvedValue([pass({ sessionsUsed: 3 }), pass({ id: 2, expiresAt: new Date("2000-01-01T00:00:00Z") })] as any);
    const result = await callerFor(student).teacherFeedbackRequest.quote({ essayId: 5 });
    expect(result).toMatchObject({ eligible: false, remaining: 0 });
  });

  it("남의 글, 빈 글, 이미 첨삭된 글, 진행 중 신청이 있는 글, 담당 교사가 없거나 AI 봇인 경우는 신청할 수 없다", async () => {
    vi.mocked(db.getEssaySubmissionById).mockResolvedValueOnce({ ...essay, userId: 99 } as any);
    expect((await callerFor(student).teacherFeedbackRequest.quote({ essayId: 5 })).eligible).toBe(false);

    vi.mocked(db.getEssaySubmissionById).mockResolvedValueOnce({ ...essay, content: "   " } as any);
    expect((await callerFor(student).teacherFeedbackRequest.quote({ essayId: 5 })).reasons.join(" ")).toContain("원문");

    vi.mocked(db.getTeacherFeedbackByEssay).mockResolvedValueOnce({ id: 1 } as any);
    expect((await callerFor(student).teacherFeedbackRequest.quote({ essayId: 5 })).reasons.join(" ")).toContain("이미 교사 첨삭");

    vi.mocked(requestDb.getOpenRequestByEssay).mockResolvedValueOnce({ id: 1 } as any);
    expect((await callerFor(student).teacherFeedbackRequest.quote({ essayId: 5 })).reasons.join(" ")).toContain("진행 중인 교사 첨삭 신청");

    vi.mocked(db.getUserById).mockResolvedValueOnce({ id: 14670001, role: "teacher", teacherStatus: "approved", openId: "ai_tutor_bot_system" } as any);
    expect((await callerFor({ ...student, teacherId: 14670001 }).teacherFeedbackRequest.quote({ essayId: 5 })).reasons.join(" ")).toContain("담당 교사");
    // 담당 교사가 지정되지 않은 학생
    expect((await callerFor({ ...student, teacherId: null }).teacherFeedbackRequest.quote({ essayId: 5 })).reasons.join(" ")).toContain("담당 교사");
  });

  it("기관 계약이 비용을 부담하는 학생도 개인 첨삭지도권으로 신청할 수 있고, 계약 학생임이 함께 표시된다", async () => {
    fundingState.kind = "contract";
    const result = await callerFor(student).teacherFeedbackRequest.quote({ essayId: 5 });
    expect(result).toMatchObject({ eligible: true, contractFunded: true });
    await expect(callerFor(student).teacherFeedbackRequest.create({ essayId: 5 })).resolves.toMatchObject({ status: "paid" });
  });
});

describe("교사 첨삭 신청(create): 첨삭지도권 1회 차감", () => {
  it("신청하면 먼저 만료되는 권에서 1회를 차감해 신청이 만들어지고 담당 교사에게 알림이 간다", async () => {
    vi.mocked(requestDb.listPassesForUser).mockResolvedValue([pass({ id: 5, expiresAt: future(80) }), pass({ id: 2, expiresAt: future(10) })] as any);
    const result = await callerFor(student).teacherFeedbackRequest.create({ essayId: 5 });
    expect(result).toMatchObject({ status: "paid", remaining: 5 });
    expect(requestDb.createRequestUsingPass).toHaveBeenCalledWith({ userId: 10, essayId: 5, passId: 2, teacherId: 20 });
    expect(requestDb.notifyUser).toHaveBeenCalledWith(20, expect.stringContaining("교사 첨삭 신청"), expect.any(String));
  });

  it("첨삭지도권이 없으면 신청하지 않는다(결제 화면으로 안내)", async () => {
    vi.mocked(requestDb.listPassesForUser).mockResolvedValue([]);
    await expect(callerFor(student).teacherFeedbackRequest.create({ essayId: 5 })).rejects.toMatchObject({ code: "BAD_REQUEST", message: expect.stringContaining("첨삭지도권") });
    expect(requestDb.createRequestUsingPass).not.toHaveBeenCalled();
  });

  it("학습자만 신청할 수 있다(학부모·교사·관리자·비로그인 불가)", async () => {
    for (const user of [parent, teacher, admin]) {
      await expect(callerFor(user).teacherFeedbackRequest.create({ essayId: 5 })).rejects.toMatchObject({ code: "FORBIDDEN" });
    }
    await expect(callerFor(null).teacherFeedbackRequest.create({ essayId: 5 })).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    expect(requestDb.createRequestUsingPass).not.toHaveBeenCalled();
  });

  it("동시에 다른 신청이 마지막 횟수를 가져가 차감에 실패하면 신청을 만들지 않는다", async () => {
    vi.mocked(requestDb.createRequestUsingPass).mockResolvedValueOnce(null);
    await expect(callerFor(student).teacherFeedbackRequest.create({ essayId: 5 })).rejects.toMatchObject({ code: "CONFLICT", message: expect.stringContaining("첨삭지도권") });
    expect(requestDb.notifyUser).not.toHaveBeenCalled();
  });

  it("저장 중 오류가 나면(같은 글의 중복 신청 포함) 차감되지 않았다고 안내하고 알림을 보내지 않는다", async () => {
    vi.mocked(requestDb.createRequestUsingPass).mockRejectedValueOnce(new Error("DUPLICATE_OPEN_REQUEST"));
    await expect(callerFor(student).teacherFeedbackRequest.create({ essayId: 5 })).rejects.toMatchObject({ code: "CONFLICT", message: expect.stringContaining("차감되지 않았습니다") });
    expect(requestDb.notifyUser).not.toHaveBeenCalled();
  });
});

describe("전달 전 취소(횟수 복원)와 보완 요청", () => {
  const openRequest = { id: 31, userId: 10, teacherId: 20, passId: 1, status: "paid" };

  beforeEach(() => {
    vi.mocked(requestDb.getRequestById).mockResolvedValue(openRequest as any);
    vi.mocked(requestDb.cancelRequestRestoreSession).mockResolvedValue(true);
  });

  it("결과를 전달하기 전에 취소하면 첨삭지도권 1회가 복원되고 교사에게 알린다", async () => {
    await expect(callerFor(student).teacherFeedbackRequest.cancel({ requestId: 31 })).resolves.toEqual({ restored: 1 });
    expect(requestDb.cancelRequestRestoreSession).toHaveBeenCalledWith(31, 10, expect.any(String));
    expect(requestDb.notifyUser).toHaveBeenCalledWith(20, expect.stringContaining("취소"), expect.any(String));
  });

  it("작업 중인 신청도 전달 전이면 취소할 수 있다(교사 작업 착수를 이유로 차감하지 않는다)", async () => {
    vi.mocked(requestDb.getRequestById).mockResolvedValue({ ...openRequest, status: "in_progress" } as any);
    await expect(callerFor(student).teacherFeedbackRequest.cancel({ requestId: 31 })).resolves.toEqual({ restored: 1 });
  });

  it("이미 전달·취소·환불된 신청과 남의 신청은 취소할 수 없다", async () => {
    for (const status of ["delivered", "cancelled", "refunded"]) {
      vi.mocked(requestDb.getRequestById).mockResolvedValueOnce({ ...openRequest, status } as any);
      await expect(callerFor(student).teacherFeedbackRequest.cancel({ requestId: 31 })).rejects.toMatchObject({ code: "BAD_REQUEST" });
    }
    vi.mocked(requestDb.getRequestById).mockResolvedValueOnce({ ...openRequest, userId: 99 } as any);
    await expect(callerFor(student).teacherFeedbackRequest.cancel({ requestId: 31 })).rejects.toMatchObject({ code: "NOT_FOUND" });
    expect(requestDb.cancelRequestRestoreSession).not.toHaveBeenCalled();
  });

  it("취소하는 사이 교사가 전달해 취소에 실패하면 횟수를 복원하지 않는다(DB가 열린 상태일 때만 취소)", async () => {
    vi.mocked(requestDb.cancelRequestRestoreSession).mockResolvedValueOnce(false);
    await expect(callerFor(student).teacherFeedbackRequest.cancel({ requestId: 31 })).rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect(requestDb.notifyUser).not.toHaveBeenCalled();
  });

  it("전달된 첨삭에 한해 무료 보완을 요청할 수 있고, 그때 예정일이 다시 계산된다(횟수는 더 차감하지 않는다)", async () => {
    vi.mocked(requestDb.getRequestById).mockResolvedValue({ ...openRequest, status: "delivered" } as any);
    vi.mocked(requestDb.requestRework).mockResolvedValue(true);
    const result = await callerFor(student).teacherFeedbackRequest.requestRework({ requestId: 31, note: "근거에 대한 피드백이 빠졌어요." });
    expect(result.dueAt).toBeInstanceOf(Date);
    expect(requestDb.requestRework).toHaveBeenCalledWith(31, 10, "근거에 대한 피드백이 빠졌어요.");
    expect(requestDb.createRequestUsingPass).not.toHaveBeenCalled();

    vi.mocked(requestDb.getRequestById).mockResolvedValue(openRequest as any);
    await expect(callerFor(student).teacherFeedbackRequest.requestRework({ requestId: 31, note: "아직 전달 전이에요" })).rejects.toMatchObject({ code: "BAD_REQUEST" });
    await expect(callerFor(student).teacherFeedbackRequest.requestRework({ requestId: 31, note: "짧음" })).rejects.toThrow();
  });
});

describe("교사 대기열·관리자 조회", () => {
  it("승인된 교사만 자기에게 배정된 대기열을 본다(지연 여부 포함)", async () => {
    vi.mocked(requestDb.listOpenRequestsForTeacher).mockResolvedValue([
      { id: 31, status: "paid", dueAt: new Date("2000-01-01T00:00:00Z") },
      { id: 32, status: "in_progress", dueAt: new Date("2999-01-01T00:00:00Z") },
    ] as any);
    const rows = await callerFor(teacher).teacherFeedbackRequest.queue();
    expect(requestDb.listOpenRequestsForTeacher).toHaveBeenCalledWith(20);
    expect(rows.map((row) => [row.id, row.overdue])).toEqual([[31, true], [32, false]]);
    for (const user of [student, pendingTeacher, admin]) {
      await expect(callerFor(user).teacherFeedbackRequest.queue()).rejects.toMatchObject({ code: "FORBIDDEN" });
    }
    await expect(callerFor(null).teacherFeedbackRequest.queue()).rejects.toMatchObject({ code: "UNAUTHORIZED" });
  });

  it("작업 시작은 담당 교사만 할 수 있다", async () => {
    vi.mocked(requestDb.getRequestById).mockResolvedValue({ id: 31, teacherId: 20, essayId: 5, status: "paid" } as any);
    vi.mocked(requestDb.markRequestStarted).mockResolvedValue(true);
    await expect(callerFor(teacher).teacherFeedbackRequest.start({ requestId: 31 })).resolves.toEqual({ essayId: 5 });
    await expect(callerFor(otherTeacher).teacherFeedbackRequest.start({ requestId: 31 })).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(callerFor(student).teacherFeedbackRequest.start({ requestId: 31 })).rejects.toMatchObject({ code: "FORBIDDEN" });
    // 이미 취소·전달된 신청은 시작할 수 없다.
    vi.mocked(requestDb.getRequestById).mockResolvedValue({ id: 31, teacherId: 20, essayId: 5, status: "cancelled" } as any);
    vi.mocked(requestDb.markRequestStarted).mockResolvedValue(false);
    await expect(callerFor(teacher).teacherFeedbackRequest.start({ requestId: 31 })).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });

  it("전체 신청 목록과 판매된 첨삭지도권 목록(미사용 환불 예상액 포함)은 관리자만 본다", async () => {
    vi.mocked(requestDb.listRequestsAdmin).mockResolvedValue([{ id: 31, status: "paid", dueAt: new Date("2999-01-01T00:00:00Z"), passId: 1 }] as any);
    vi.mocked(requestDb.listPassesAdmin).mockResolvedValue([pass({ sessionsUsed: 1 }), pass({ id: 2, status: "refunded" })] as any);
    await expect(callerFor(admin).teacherFeedbackRequest.adminList({})).resolves.toHaveLength(1);
    const passes = await callerFor(admin).teacherFeedbackRequest.adminPasses({});
    expect(passes.map((item) => [item.id, item.unusedRefundKrw])).toEqual([[1, 13267], [2, 0]]);
    for (const user of [student, teacher]) {
      await expect(callerFor(user).teacherFeedbackRequest.adminList({})).rejects.toMatchObject({ code: "FORBIDDEN" });
      await expect(callerFor(user).teacherFeedbackRequest.adminPasses({})).rejects.toMatchObject({ code: "FORBIDDEN" });
    }
  });

  it("내 신청 목록은 본인 것만 조회한다", async () => {
    vi.mocked(requestDb.listRequestsForUser).mockResolvedValue([{ id: 31, status: "delivered", dueAt: new Date("2000-01-01T00:00:00Z") }] as any);
    const rows = await callerFor(student).teacherFeedbackRequest.mine();
    expect(requestDb.listRequestsForUser).toHaveBeenCalledWith(10);
    // 전달 완료된 신청은 예정일이 지났어도 지연이 아니다.
    expect(rows[0].overdue).toBe(false);
  });
});
