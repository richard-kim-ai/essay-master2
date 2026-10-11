import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("./billingDb", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./billingDb")>();
  return {
    ...actual,
    listActiveSubscriptions: vi.fn(),
    listAwaitingStartSubscriptions: vi.fn(),
    createPaymentOrder: vi.fn(),
    markOrderFailed: vi.fn(),
    getPaymentOrder: vi.fn(),
    markOrderRefunded: vi.fn(),
  };
});
vi.mock("./teacherFeedbackRequestDb", () => ({
  createPaidRequest: vi.fn(),
  getRequestById: vi.fn(),
  getOpenRequestByEssay: vi.fn(),
  listRequestsForUser: vi.fn(),
  listOpenRequestsForTeacher: vi.fn(),
  listRequestsAdmin: vi.fn(),
  markRequestStarted: vi.fn(),
  markDeliveredByEssay: vi.fn(),
  claimCancel: vi.fn(),
  releaseCancel: vi.fn(),
  requestRework: vi.fn(),
  notifyUser: vi.fn(async () => undefined),
}));
vi.mock("./db", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./db")>();
  return { ...actual, getEssaySubmissionById: vi.fn(), getUserById: vi.fn(), getTeacherFeedbackByEssay: vi.fn() };
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

import * as billingDb from "./billingDb";
import * as db from "./db";
import * as requestDb from "./teacherFeedbackRequestDb";
import { appRouter } from "./routers";
import { resetRateLimits } from "./rateLimit";
import { addBusinessDays, computeDueAt, isRequestOverdue, validateRequestScope } from "../shared/teacherFeedbackRequest";
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

beforeEach(() => {
  vi.clearAllMocks();
  resetRateLimits();
  delete process.env.PAYMENT_PROVIDER;
  vi.mocked(billingDb.listActiveSubscriptions).mockResolvedValue([activeSubscription] as any);
  vi.mocked(billingDb.listAwaitingStartSubscriptions).mockResolvedValue([]);
  vi.mocked(db.getEssaySubmissionById).mockResolvedValue(essay as any);
  vi.mocked(db.getTeacherFeedbackByEssay).mockResolvedValue(undefined);
  vi.mocked(db.getUserById).mockResolvedValue(humanTeacher as any);
  vi.mocked(requestDb.getOpenRequestByEssay).mockResolvedValue(undefined);
  vi.mocked(requestDb.notifyUser).mockResolvedValue(undefined);
  vi.mocked(billingDb.createPaymentOrder).mockResolvedValue({ id: 7, providerOrderId: "EM-TF" } as any);
  // 서버 코드는 markOrderFailed(...).catch(...)로 부르므로 프로미스를 돌려줘야 한다.
  vi.mocked(billingDb.markOrderFailed).mockResolvedValue(undefined as any);
  vi.mocked(requestDb.createPaidRequest).mockResolvedValue({ id: 31, essayId: 5, productKey: "tf_standard", status: "paid", dueAt: new Date("2026-10-19T14:59:59Z"), scopeJson: "[]" } as any);
});

describe("완료 예정일(영업일 계산, 한국 시간)", () => {
  it("결제일부터 3영업일째 날 23:59:59(KST)까지로 계산하고 토·일은 세지 않는다", () => {
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

  it("전달 전(결제 완료·작업 중)이고 예정일이 지났을 때만 지연이다", () => {
    const now = new Date("2026-10-20T00:00:00Z");
    const dueAt = new Date("2026-10-19T14:59:59Z");
    expect(isRequestOverdue({ status: "paid", dueAt }, now)).toBe(true);
    expect(isRequestOverdue({ status: "in_progress", dueAt }, now)).toBe(true);
    expect(isRequestOverdue({ status: "delivered", dueAt }, now)).toBe(false);
    expect(isRequestOverdue({ status: "refunded", dueAt }, now)).toBe(false);
    expect(isRequestOverdue({ status: "paid", dueAt: new Date("2026-10-21T00:00:00Z") }, now)).toBe(false);
  });
});

describe("신청 범위(핵심 첨삭의 평가항목)", () => {
  it("핵심 첨삭은 평가항목을 1~2개 고르고, 중복은 합친다", () => {
    expect(validateRequestScope("tf_core", ["logic"])).toEqual({ ok: true, items: ["logic"] });
    expect(validateRequestScope("tf_core", ["logic", "logic", "expression"])).toEqual({ ok: true, items: ["logic", "expression"] });
    expect(validateRequestScope("tf_core", [])).toMatchObject({ ok: false });
    expect(validateRequestScope("tf_core", undefined)).toMatchObject({ ok: false });
    expect(validateRequestScope("tf_core", ["logic", "structure", "evidence"])).toMatchObject({ ok: false });
    expect(validateRequestScope("tf_core", ["unknown"])).toMatchObject({ ok: false });
  });

  it("일반·종합 첨삭은 항목 선택이 없다", () => {
    expect(validateRequestScope("tf_standard", undefined)).toEqual({ ok: true, items: [] });
    expect(validateRequestScope("tf_comprehensive", ["logic"])).toMatchObject({ ok: false });
  });
});

describe("신청 가능 여부(quote)", () => {
  it("이용권 결제자(이용 중인 유료 이용권 보유)이고 본인 글·담당 교사가 있으면 신청할 수 있다", async () => {
    const result = await callerFor(student).teacherFeedbackRequest.quote({ essayId: 5, productKey: "tf_standard" });
    expect(result).toMatchObject({ eligible: true, reasons: [], productName: "교사 일반 첨삭지도", priceKrw: 6900, teacherName: "김교사", essayTitle: "교육과 기술" });
    expect(result.refundNotice).toContain("전액 환불");
    expect(result.contractFunded).toBe(false);
    expect(result.dueAt).toBeInstanceOf(Date);
  });

  it("기관 계약이 비용을 부담하는 학생도 개인 결제로 신청할 수 있고, 계약 학생임이 함께 표시된다", async () => {
    fundingState.kind = "contract";
    try {
      const result = await callerFor(student).teacherFeedbackRequest.quote({ essayId: 5, productKey: "tf_standard" });
      expect(result).toMatchObject({ eligible: true, contractFunded: true });
      await expect(callerFor(student).teacherFeedbackRequest.create({ essayId: 5, productKey: "tf_standard" })).resolves.toMatchObject({ status: "paid" });
    } finally {
      fundingState.kind = "none";
    }
  });

  it("이용권이 없으면(체험만) 신청할 수 없고 '이용권 결제자만' 안내한다", async () => {
    vi.mocked(billingDb.listActiveSubscriptions).mockResolvedValue([]);
    const result = await callerFor(student).teacherFeedbackRequest.quote({ essayId: 5, productKey: "tf_standard" });
    expect(result.eligible).toBe(false);
    expect(result.reasons[0]).toContain("이용권 결제자만 신청할 수 있습니다");
  });

  it("결제만 하고 '유료 이용 시작' 전이면 시작을 안내한다", async () => {
    vi.mocked(billingDb.listActiveSubscriptions).mockResolvedValue([]);
    vi.mocked(billingDb.listAwaitingStartSubscriptions).mockResolvedValue([{ id: 9 }] as any);
    const result = await callerFor(student).teacherFeedbackRequest.quote({ essayId: 5, productKey: "tf_standard" });
    expect(result.eligible).toBe(false);
    expect(result.reasons.join(" ")).toContain("유료 이용 시작");
  });

  it("남의 글, 빈 글, 이미 첨삭된 글, 진행 중 신청이 있는 글, 담당 교사가 없거나 AI 봇인 경우는 신청할 수 없다", async () => {
    vi.mocked(db.getEssaySubmissionById).mockResolvedValueOnce({ ...essay, userId: 99 } as any);
    expect((await callerFor(student).teacherFeedbackRequest.quote({ essayId: 5, productKey: "tf_standard" })).eligible).toBe(false);

    vi.mocked(db.getEssaySubmissionById).mockResolvedValueOnce({ ...essay, content: "   " } as any);
    expect((await callerFor(student).teacherFeedbackRequest.quote({ essayId: 5, productKey: "tf_standard" })).reasons.join(" ")).toContain("원문");

    vi.mocked(db.getTeacherFeedbackByEssay).mockResolvedValueOnce({ id: 1 } as any);
    expect((await callerFor(student).teacherFeedbackRequest.quote({ essayId: 5, productKey: "tf_standard" })).reasons.join(" ")).toContain("이미 교사 첨삭");

    vi.mocked(requestDb.getOpenRequestByEssay).mockResolvedValueOnce({ id: 1 } as any);
    expect((await callerFor(student).teacherFeedbackRequest.quote({ essayId: 5, productKey: "tf_standard" })).reasons.join(" ")).toContain("진행 중인 교사 첨삭 신청");

    vi.mocked(db.getUserById).mockResolvedValueOnce({ id: 14670001, role: "teacher", teacherStatus: "approved", openId: "ai_tutor_bot_system" } as any);
    expect((await callerFor({ ...student, teacherId: 14670001 }).teacherFeedbackRequest.quote({ essayId: 5, productKey: "tf_standard" })).reasons.join(" ")).toContain("담당 교사");
    // 담당 교사가 지정되지 않은 학생
    expect((await callerFor({ ...student, teacherId: null }).teacherFeedbackRequest.quote({ essayId: 5, productKey: "tf_standard" })).reasons.join(" ")).toContain("담당 교사");
  });

  it("핵심 첨삭은 평가항목을 골라야 신청할 수 있다", async () => {
    expect((await callerFor(student).teacherFeedbackRequest.quote({ essayId: 5, productKey: "tf_core" })).eligible).toBe(false);
    expect((await callerFor(student).teacherFeedbackRequest.quote({ essayId: 5, productKey: "tf_core", items: ["logic", "evidence"] })).eligible).toBe(true);
  });
});

describe("신청·결제(create)", () => {
  it("결제가 끝나면 신청이 만들어지고 담당 교사에게 알림이 간다(상품 금액은 서버가 정한다)", async () => {
    const result = await callerFor(student).teacherFeedbackRequest.create({ essayId: 5, productKey: "tf_standard", priceKrw: 1 } as any);
    expect(result).toMatchObject({ status: "paid", isTest: true, orderId: 7 });
    expect(billingDb.createPaymentOrder).toHaveBeenCalledWith(expect.objectContaining({ userId: 10, planKey: "tf_standard", amountKrw: 6900, provider: "mock", isTest: true }));
    expect(requestDb.createPaidRequest).toHaveBeenCalledWith(expect.objectContaining({ orderId: 7, userId: 10, essayId: 5, productKey: "tf_standard", priceKrw: 6900, teacherId: 20, items: [] }));
    expect(requestDb.notifyUser).toHaveBeenCalledWith(20, expect.stringContaining("교사 첨삭 신청"), expect.any(String));
  });

  it("핵심 첨삭은 선택한 평가항목이 신청에 저장된다", async () => {
    await callerFor(student).teacherFeedbackRequest.create({ essayId: 5, productKey: "tf_core", items: ["logic", "expression"] });
    expect(requestDb.createPaidRequest).toHaveBeenCalledWith(expect.objectContaining({ productKey: "tf_core", priceKrw: 3900, items: ["logic", "expression"] }));
  });

  it("이용권이 없으면 결제하지 않는다", async () => {
    vi.mocked(billingDb.listActiveSubscriptions).mockResolvedValue([]);
    await expect(callerFor(student).teacherFeedbackRequest.create({ essayId: 5, productKey: "tf_standard" })).rejects.toMatchObject({ code: "BAD_REQUEST", message: expect.stringContaining("이용권 결제자만") });
    expect(billingDb.createPaymentOrder).not.toHaveBeenCalled();
  });

  it("학습자만 신청할 수 있다(학부모·교사·관리자·비로그인 불가)", async () => {
    for (const user of [parent, teacher, admin]) {
      await expect(callerFor(user).teacherFeedbackRequest.create({ essayId: 5, productKey: "tf_standard" })).rejects.toMatchObject({ code: "FORBIDDEN" });
    }
    await expect(callerFor(null).teacherFeedbackRequest.create({ essayId: 5, productKey: "tf_standard" })).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    expect(billingDb.createPaymentOrder).not.toHaveBeenCalled();
  });

  it("실제 결제 제공자가 연동되지 않았으면 신청을 만들지 않고 주문을 실패 처리한다", async () => {
    process.env.PAYMENT_PROVIDER = "portone";
    await expect(callerFor(student).teacherFeedbackRequest.create({ essayId: 5, productKey: "tf_standard" })).rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect(billingDb.markOrderFailed).toHaveBeenCalledWith(7, expect.stringContaining("연동"));
    expect(requestDb.createPaidRequest).not.toHaveBeenCalled();
  });

  it("결제 후 신청 저장에 실패하면 결제를 되돌리고(주문 실패 처리) 신청을 남기지 않는다", async () => {
    vi.mocked(requestDb.createPaidRequest).mockRejectedValueOnce(new Error("db down"));
    await expect(callerFor(student).teacherFeedbackRequest.create({ essayId: 5, productKey: "tf_standard" })).rejects.toMatchObject({ code: "CONFLICT", message: expect.stringContaining("결제는 취소") });
    expect(billingDb.markOrderFailed).toHaveBeenCalledWith(7, expect.any(String));
    expect(requestDb.notifyUser).not.toHaveBeenCalled();
  });

  it("이미 처리된 결제(중복 호출)는 두 번째 신청을 만들지 않는다", async () => {
    vi.mocked(requestDb.createPaidRequest).mockResolvedValueOnce(null);
    await expect(callerFor(student).teacherFeedbackRequest.create({ essayId: 5, productKey: "tf_standard" })).rejects.toMatchObject({ code: "CONFLICT" });
  });

  it("결제 요청을 짧은 시간에 반복하면 제한한다", async () => {
    const caller = callerFor(student);
    for (let i = 0; i < 10; i += 1) await caller.teacherFeedbackRequest.create({ essayId: 5, productKey: "tf_standard" });
    await expect(caller.teacherFeedbackRequest.create({ essayId: 5, productKey: "tf_standard" })).rejects.toMatchObject({ code: "TOO_MANY_REQUESTS" });
  });
});

describe("전달 전 취소(전액 환불)와 보완 요청", () => {
  const paidRequest = { id: 31, userId: 10, teacherId: 20, orderId: 7, status: "paid" };

  beforeEach(() => {
    vi.mocked(requestDb.getRequestById).mockResolvedValue(paidRequest as any);
    vi.mocked(billingDb.getPaymentOrder).mockResolvedValue({ id: 7, status: "paid", provider: "mock", providerPaymentKey: "mock_EM-TF", amountKrw: 6900 } as any);
    vi.mocked(requestDb.claimCancel).mockResolvedValue(true);
    vi.mocked(billingDb.markOrderRefunded).mockResolvedValue(true);
  });

  it("결과를 전달하기 전에 취소하면 결제금액 전액을 환불하고 주문을 환불 처리한다", async () => {
    await expect(callerFor(student).teacherFeedbackRequest.cancel({ requestId: 31 })).resolves.toEqual({ refundedKrw: 6900 });
    expect(requestDb.claimCancel).toHaveBeenCalledWith(31, 10, "paid", expect.any(String));
    expect(billingDb.markOrderRefunded).toHaveBeenCalledWith(7);
    expect(requestDb.releaseCancel).not.toHaveBeenCalled();
    expect(requestDb.notifyUser).toHaveBeenCalledWith(20, expect.stringContaining("취소"), expect.any(String));
  });

  it("작업 중인 신청도 전달 전이면 취소할 수 있다(교사 작업 착수를 이유로 공제하지 않는다)", async () => {
    vi.mocked(requestDb.getRequestById).mockResolvedValue({ ...paidRequest, status: "in_progress" } as any);
    await expect(callerFor(student).teacherFeedbackRequest.cancel({ requestId: 31 })).resolves.toEqual({ refundedKrw: 6900 });
    expect(requestDb.claimCancel).toHaveBeenCalledWith(31, 10, "in_progress", expect.any(String));
  });

  it("이미 전달·취소·환불된 신청과 남의 신청은 취소할 수 없다", async () => {
    for (const status of ["delivered", "cancelled", "refunded"]) {
      vi.mocked(requestDb.getRequestById).mockResolvedValueOnce({ ...paidRequest, status } as any);
      await expect(callerFor(student).teacherFeedbackRequest.cancel({ requestId: 31 })).rejects.toMatchObject({ code: "BAD_REQUEST" });
    }
    vi.mocked(requestDb.getRequestById).mockResolvedValueOnce({ ...paidRequest, userId: 99 } as any);
    await expect(callerFor(student).teacherFeedbackRequest.cancel({ requestId: 31 })).rejects.toMatchObject({ code: "NOT_FOUND" });
    expect(billingDb.markOrderRefunded).not.toHaveBeenCalled();
  });

  it("취소를 선점하는 사이 교사가 전달해 선점에 실패하면 환불하지 않는다", async () => {
    vi.mocked(requestDb.claimCancel).mockResolvedValueOnce(false);
    await expect(callerFor(student).teacherFeedbackRequest.cancel({ requestId: 31 })).rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect(billingDb.markOrderRefunded).not.toHaveBeenCalled();
  });

  it("환불에 실패하면 취소 선점을 되돌리고 신청을 그대로 둔다", async () => {
    vi.mocked(billingDb.getPaymentOrder).mockResolvedValue({ id: 7, status: "paid", provider: "portone", providerPaymentKey: "x", amountKrw: 6900 } as any);
    await expect(callerFor(student).teacherFeedbackRequest.cancel({ requestId: 31 })).rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect(requestDb.releaseCancel).toHaveBeenCalledWith(31, "paid");
    expect(billingDb.markOrderRefunded).not.toHaveBeenCalled();
  });

  it("전달된 첨삭에 한해 무료 보완을 요청할 수 있고, 그때 예정일이 다시 계산된다", async () => {
    vi.mocked(requestDb.getRequestById).mockResolvedValue({ ...paidRequest, status: "delivered" } as any);
    vi.mocked(requestDb.requestRework).mockResolvedValue(true);
    const result = await callerFor(student).teacherFeedbackRequest.requestRework({ requestId: 31, note: "근거에 대한 피드백이 빠졌어요." });
    expect(result.dueAt).toBeInstanceOf(Date);
    expect(requestDb.requestRework).toHaveBeenCalledWith(31, 10, "근거에 대한 피드백이 빠졌어요.");
    expect(requestDb.notifyUser).toHaveBeenCalledWith(20, expect.stringContaining("보완"), expect.any(String));

    vi.mocked(requestDb.getRequestById).mockResolvedValue(paidRequest as any);
    await expect(callerFor(student).teacherFeedbackRequest.requestRework({ requestId: 31, note: "아직 전달 전이에요" })).rejects.toMatchObject({ code: "BAD_REQUEST" });
    await expect(callerFor(student).teacherFeedbackRequest.requestRework({ requestId: 31, note: "짧음" })).rejects.toThrow();
  });
});

describe("교사 대기열·관리자 조회", () => {
  it("승인된 교사만 자기에게 배정된 대기열을 본다(지연 여부 포함)", async () => {
    vi.mocked(requestDb.listOpenRequestsForTeacher).mockResolvedValue([
      { id: 31, status: "paid", dueAt: new Date("2000-01-01T00:00:00Z"), scopeJson: '["logic"]', productKey: "tf_core" },
      { id: 32, status: "in_progress", dueAt: new Date("2999-01-01T00:00:00Z"), scopeJson: "[]", productKey: "tf_standard" },
    ] as any);
    const rows = await callerFor(teacher).teacherFeedbackRequest.queue();
    expect(requestDb.listOpenRequestsForTeacher).toHaveBeenCalledWith(20);
    expect(rows.map((row) => [row.id, row.overdue])).toEqual([[31, true], [32, false]]);
    expect(rows[0].scopeLabel).toBe("논리");
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

  it("전체 신청 목록은 관리자만 본다", async () => {
    vi.mocked(requestDb.listRequestsAdmin).mockResolvedValue([{ id: 31, status: "paid", dueAt: new Date("2999-01-01T00:00:00Z"), productKey: "tf_standard" }] as any);
    await expect(callerFor(admin).teacherFeedbackRequest.adminList({})).resolves.toHaveLength(1);
    for (const user of [student, teacher]) await expect(callerFor(user).teacherFeedbackRequest.adminList({})).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("내 신청 목록은 본인 것만 조회한다", async () => {
    vi.mocked(requestDb.listRequestsForUser).mockResolvedValue([{ id: 31, status: "delivered", dueAt: new Date("2000-01-01T00:00:00Z"), productKey: "tf_standard", scopeJson: "[]" }] as any);
    const rows = await callerFor(student).teacherFeedbackRequest.mine();
    expect(requestDb.listRequestsForUser).toHaveBeenCalledWith(10);
    // 전달 완료된 신청은 예정일이 지났어도 지연이 아니다.
    expect(rows[0].overdue).toBe(false);
  });
});
