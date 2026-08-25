import { describe, expect, it } from "vitest";
import { getTrialAccess, isEligibleTrialEvaluation, TRIAL_AI_EVALUATION_LIMIT } from "./trialPolicy";

describe("7일 무료 체험 정책", () => {
  const now = new Date("2026-08-25T00:00:00.000Z");

  it("가입 후 7일 이내에는 체험 활성·남은 일수를 반환한다", () => {
    expect(getTrialAccess("2026-08-21T00:00:00.000Z", now)).toMatchObject({ isActive: true, daysRemaining: 3 });
  });

  it("체험 종료 후에는 AI 평가 한도 정책을 적용하지 않는다", () => {
    expect(getTrialAccess("2026-08-17T00:00:00.000Z", now)).toMatchObject({ isActive: false, daysRemaining: 0 });
    expect(TRIAL_AI_EVALUATION_LIMIT).toBe(1);
  });

  it("AI 평가는 레슨 1의 첫 서술형 제출 표식이 있을 때만 체험 대상으로 인정한다", () => {
    expect(isEligibleTrialEvaluation({ lessonNumber: 1, submissionSource: "lesson_one_essay" })).toBe(true);
    expect(isEligibleTrialEvaluation({ lessonNumber: 2, submissionSource: "lesson_one_essay" })).toBe(false);
    expect(isEligibleTrialEvaluation({ lessonNumber: 1 })).toBe(false);
  });
});
