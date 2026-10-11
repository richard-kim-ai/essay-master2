import { beforeEach, describe, expect, it, vi } from "vitest";

// AI 평가 호출 전에 사용 횟수를 이용권별로 예약하는 순서를 확인한다.
// 평가 엔진까지 가지 않도록, 예약 직후 단계(hasAiLearningConsent)에서 오류를 내 예약이 되돌려지는 것까지 본다.
const reserveAiUsage = vi.hoisted(() => vi.fn());
const releaseAiUsage = vi.hoisted(() => vi.fn());
const entitlementState = vi.hoisted(() => ({ current: null as any }));

vi.mock("./billingDb", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./billingDb")>();
  return { ...actual, reserveAiUsage, releaseAiUsage, recordAiUsageTokens: vi.fn() };
});

vi.mock("./billing/service", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./billing/service")>();
  return { ...actual, getAiEntitlement: vi.fn(async () => entitlementState.current) };
});

vi.mock("./db", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./db")>();
  return { ...actual, hasAiLearningConsent: vi.fn(async () => { throw new Error("stop-after-reservation"); }) };
});

import { appRouter } from "./routers";
import { resetRateLimits } from "./rateLimit";
import type { TrpcContext } from "./_core/context";

function caller() {
  const user = { id: 10, role: "user", tag: "중고등", name: "학생", email: "s@example.com", openId: "u-10", loginMethod: "email", createdAt: new Date(), updatedAt: new Date(), lastSignedIn: new Date() };
  const ctx = { user, req: { protocol: "https", headers: {}, socket: {} } as any, res: {} as any } as unknown as TrpcContext;
  return appRouter.createCaller(ctx);
}

const essay = { essayTitle: "교육과 기술", essayContent: "기술 발전은 교육에 큰 영향을 준다. 첫째, 학습 자료 접근이 쉬워진다. 둘째, 개별 학습이 가능해진다.", courseType: "middle_high" as const, level: 1 };
const start = new Date("2026-10-01T00:00:00Z");

const trial = { kind: "trial" as const, limit: 2, used: 1, remaining: 1 };
const planA = { kind: "plan" as const, subscriptionId: 2, planKey: "ai_pass", limit: 10, used: 3, remaining: 7, periodStart: start };
const planB = { kind: "plan" as const, subscriptionId: 5, planKey: "ai_focus", limit: 20, used: 0, remaining: 20, periodStart: start };

beforeEach(() => {
  vi.clearAllMocks();
  resetRateLimits();
  // 서버 코드는 releaseAiUsage(...).catch(...)로 부르므로 프로미스를 돌려줘야 한다.
  releaseAiUsage.mockResolvedValue(undefined);
});

describe("AI 평가 횟수 예약(이용권별)", () => {
  it("무료 체험분을 먼저 예약한다", async () => {
    entitlementState.current = { mode: "trial", canUse: true, limit: 32, used: 4, remaining: 28, daysRemaining: 5, sources: [trial, planA, planB] };
    reserveAiUsage.mockResolvedValueOnce({ reserved: true, reservationId: 71 });
    await expect(caller().aiAutoFeedback.create(essay)).rejects.toThrow("stop-after-reservation");
    expect(reserveAiUsage).toHaveBeenCalledTimes(1);
    expect(reserveAiUsage).toHaveBeenCalledWith(expect.objectContaining({ userId: 10, actionType: "trial_essay_feedback", countedActionTypes: ["trial_essay_feedback"], limit: 2 }));
    // 이후 단계에서 실패하면 예약한 횟수는 돌려준다.
    expect(releaseAiUsage).toHaveBeenCalledWith(71);
  });

  it("먼저 예약하려던 묶음이 동시 요청으로 가득 차면 다음 묶음에서 예약한다", async () => {
    entitlementState.current = { mode: "plan", canUse: true, limit: 30, used: 3, remaining: 27, daysRemaining: 0, sources: [planA, planB] };
    reserveAiUsage.mockResolvedValueOnce({ reserved: false, reservationId: 0 }).mockResolvedValueOnce({ reserved: true, reservationId: 88 });
    await expect(caller().aiAutoFeedback.create(essay)).rejects.toThrow("stop-after-reservation");
    expect(reserveAiUsage).toHaveBeenCalledTimes(2);
    expect(reserveAiUsage.mock.calls[0][0]).toMatchObject({ actionType: "essay_feedback:2", countedActionTypes: ["essay_feedback:2"], limit: 10, since: start });
    expect(reserveAiUsage.mock.calls[1][0]).toMatchObject({ actionType: "essay_feedback:5", countedActionTypes: ["essay_feedback:5"], limit: 20, since: start });
    expect(releaseAiUsage).toHaveBeenCalledWith(88);
  });

  it("모든 묶음이 가득 차 있으면 횟수를 모두 사용했다고 안내하고 AI를 호출하지 않는다", async () => {
    entitlementState.current = { mode: "plan", canUse: true, limit: 30, used: 29, remaining: 1, daysRemaining: 0, sources: [planA, planB] };
    reserveAiUsage.mockResolvedValue({ reserved: false, reservationId: 0 });
    await expect(caller().aiAutoFeedback.create(essay)).rejects.toMatchObject({ code: "FORBIDDEN", message: expect.stringContaining("횟수를 모두 사용") });
    expect(reserveAiUsage).toHaveBeenCalledTimes(2);
  });

  it("예전 요금제(starter) 이용권은 이전 기록('essay_feedback')도 함께 센다", async () => {
    const legacy = { kind: "plan" as const, subscriptionId: 4, planKey: "starter", limit: 5, used: 1, remaining: 4, periodStart: start };
    entitlementState.current = { mode: "plan", canUse: true, limit: 5, used: 1, remaining: 4, daysRemaining: 0, sources: [legacy] };
    reserveAiUsage.mockResolvedValueOnce({ reserved: true, reservationId: 12 });
    await expect(caller().aiAutoFeedback.create(essay)).rejects.toThrow("stop-after-reservation");
    expect(reserveAiUsage).toHaveBeenCalledWith(expect.objectContaining({ actionType: "essay_feedback:4", countedActionTypes: ["essay_feedback", "essay_feedback:4"] }));
  });

  it("무료 체험은 레슨 1 첫 제출이 아니어도 이용할 수 있다(정책에 그런 제한이 없다)", async () => {
    entitlementState.current = { mode: "trial", canUse: true, limit: 2, used: 0, remaining: 2, daysRemaining: 5, sources: [{ ...trial, used: 0, remaining: 2 }] };
    reserveAiUsage.mockResolvedValueOnce({ reserved: true, reservationId: 3 });
    await expect(caller().aiAutoFeedback.create({ ...essay, lessonNumber: 3 })).rejects.toThrow("stop-after-reservation");
    expect(reserveAiUsage).toHaveBeenCalled();
  });

  it("이용할 수 없는 상태(canUse=false)에서는 예약하지 않는다", async () => {
    entitlementState.current = { mode: "none", canUse: false, limit: 0, used: 0, remaining: 0, daysRemaining: 0, reason: "7일 무료 체험이 끝났습니다. 이용권을 선택하면 AI 평가·첨삭을 계속 이용할 수 있습니다." };
    await expect(caller().aiAutoFeedback.create(essay)).rejects.toMatchObject({ code: "FORBIDDEN", message: expect.stringContaining("이용권") });
    expect(reserveAiUsage).not.toHaveBeenCalled();
  });
});
