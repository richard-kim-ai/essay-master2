// AI 논술 평가를 누가 몇 번 쓸 수 있는지 정하는 규칙(순수 계산).
// 우선순위: 이용권(기간 안) > 7일 무료 체험 > 이용 불가(이용권 필요).
// 관리자·교사는 학습자용 한도 대상이 아니다.

import { TRIAL_AI_EVALUATION_LIMIT, getTrialAccess } from "../trialPolicy";

export type SubscriptionSnapshot = {
  status: "active" | "cancelled" | "expired";
  planKey: string;
  currentPeriodStart: Date;
  currentPeriodEnd: Date;
  aiEvaluationsLimit: number;
};

export type AiEntitlement = {
  mode: "unlimited" | "plan" | "trial" | "none";
  canUse: boolean;
  limit: number;
  used: number;
  remaining: number;
  /** 체험 남은 일수(체험일 때만 의미 있음) */
  daysRemaining: number;
  planKey?: string;
  periodStart?: Date;
  periodEnd?: Date;
  /** 이용할 수 없을 때 사용자에게 보여줄 이유 */
  reason?: string;
};

/** 취소한 이용권도 이미 결제한 기간이 끝날 때까지는 유효하다. */
export function isSubscriptionInEffect(subscription: SubscriptionSnapshot | null | undefined, now = new Date()) {
  if (!subscription) return false;
  if (subscription.status === "expired") return false;
  return subscription.currentPeriodEnd.getTime() > now.getTime();
}

export function evaluateAiEntitlement(input: {
  user: { role: string; tag?: string | null; createdAt: Date | string };
  subscription: SubscriptionSnapshot | null | undefined;
  /** 이용권 기간 안에서 쓴 AI 평가 횟수 */
  usedInPlanPeriod: number;
  /** 체험 중 쓴 AI 평가 횟수 */
  usedInTrial: number;
  now?: Date;
}): AiEntitlement {
  const now = input.now ?? new Date();
  const { user, subscription } = input;

  if (user.role === "admin" || user.role === "teacher") {
    return { mode: "unlimited", canUse: true, limit: 0, used: 0, remaining: 0, daysRemaining: 0 };
  }
  if (user.tag === "학부모") {
    return { mode: "none", canUse: false, limit: 0, used: 0, remaining: 0, daysRemaining: 0, reason: "학부모 계정은 AI 논술 평가를 이용할 수 없습니다. 자녀 계정에서 이용해 주세요." };
  }

  if (subscription && isSubscriptionInEffect(subscription, now)) {
    const used = Math.max(0, input.usedInPlanPeriod);
    const remaining = Math.max(0, subscription.aiEvaluationsLimit - used);
    return {
      mode: "plan",
      canUse: remaining > 0,
      limit: subscription.aiEvaluationsLimit,
      used,
      remaining,
      daysRemaining: 0,
      planKey: subscription.planKey,
      periodStart: subscription.currentPeriodStart,
      periodEnd: subscription.currentPeriodEnd,
      reason: remaining > 0 ? undefined : "이번 이용 기간의 AI 평가 횟수를 모두 사용했습니다. 다음 결제일 이후 다시 이용하거나 더 큰 이용권을 선택해 주세요.",
    };
  }

  const trial = getTrialAccess(user.createdAt, now);
  if (trial.isActive) {
    const used = Math.max(0, input.usedInTrial);
    const remaining = Math.max(0, TRIAL_AI_EVALUATION_LIMIT - used);
    return {
      mode: "trial",
      canUse: remaining > 0,
      limit: TRIAL_AI_EVALUATION_LIMIT,
      used,
      remaining,
      daysRemaining: trial.daysRemaining,
      reason: remaining > 0 ? undefined : "7일 무료 체험의 AI 논술 평가 1회를 사용했습니다. 이용권을 선택하면 계속 이용할 수 있습니다.",
    };
  }

  return {
    mode: "none",
    canUse: false,
    limit: 0,
    used: 0,
    remaining: 0,
    daysRemaining: 0,
    reason: "7일 무료 체험이 끝났습니다. 이용권을 선택하면 AI 논술 평가를 계속 이용할 수 있습니다.",
  };
}
