export const TRIAL_DURATION_DAYS = 7;
// 정책: 무료 AI는 가입 전 샘플 체험(방문당 1회, routers.ts SAMPLE_AI_SESSION_LIMIT)과 가입 후 계정 체험 2회로 각각 별도 계산한다(서로 차감하지 않는다).
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
