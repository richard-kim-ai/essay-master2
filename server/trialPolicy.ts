export const TRIAL_DURATION_DAYS = 7;
// 정책: 무료 AI 제공량은 샘플 테스트 1회 + 추가 체험 2회 = 총 3회. 샘플은 가입 전 사용이라 계정 체험은 2회다.
export const TRIAL_AI_EVALUATION_LIMIT = 2;
export const TRIAL_AI_EVALUATION_LESSON = 1;
export const TRIAL_AI_EVALUATION_SOURCE = "lesson_one_essay";

export function isEligibleTrialEvaluation(input: { lessonNumber?: number; submissionSource?: string }) {
  return input.lessonNumber === TRIAL_AI_EVALUATION_LESSON && input.submissionSource === TRIAL_AI_EVALUATION_SOURCE;
}

export function getTrialAccess(createdAt: Date | string, now = new Date()) {
  const startedAt = new Date(createdAt);
  if (Number.isNaN(startedAt.getTime())) {
    return { isActive: false, daysRemaining: 0, endsAt: null as Date | null };
  }
  const endsAt = new Date(startedAt.getTime() + TRIAL_DURATION_DAYS * 24 * 60 * 60 * 1000);
  const remainingMs = endsAt.getTime() - now.getTime();
  return {
    isActive: remainingMs > 0,
    daysRemaining: Math.max(0, Math.ceil(remainingMs / (24 * 60 * 60 * 1000))),
    endsAt,
  };
}
