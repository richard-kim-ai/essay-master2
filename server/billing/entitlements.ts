// AI 논술 평가를 누가 몇 번 쓸 수 있는지 정하는 규칙(순수 계산).
// 차감 순서: 무료 체험분 먼저 → 유료 이용권은 먼저 만료되는 것부터(만료가 같으면 먼저 구매한 것부터). 이용권은 여러 개를 겹쳐 가질 수 있다.
// 관리자·교사는 학습자용 한도 대상이 아니다.

import { TRIAL_AI_EVALUATION_LIMIT, getTrialAccess } from "../trialPolicy";
import { budgetOverage, budgetRemaining, contractAvailability, contractEnforcesLimit, type ContractPolicy, type ContractWindow } from "../../shared/institution";

export type SubscriptionSnapshot = {
  status: "active" | "cancelled" | "expired";
  planKey: string;
  currentPeriodStart: Date;
  currentPeriodEnd: Date;
  aiEvaluationsLimit: number;
};

/** AI 횟수를 차감할 수 있는 한 묶음(무료 체험 또는 유료 이용권 1개). */
export type AiSource = {
  kind: "trial" | "plan";
  /** kind가 plan일 때 이용권 id(사용 기록의 행동 유형에 이 값이 들어간다) */
  subscriptionId?: number;
  planKey?: string;
  limit: number;
  used: number;
  remaining: number;
  periodStart?: Date;
  periodEnd?: Date;
};

export type AiEntitlement = {
  mode: "unlimited" | "plan" | "trial" | "institution" | "none";
  canUse: boolean;
  limit: number;
  used: number;
  remaining: number;
  /** 체험 남은 일수(체험일 때만 의미 있음) */
  daysRemaining: number;
  planKey?: string;
  /** 기관 계약이 비용을 부담할 때(mode = institution) */
  contractId?: number;
  contractName?: string;
  /** 기간제 기관 계약: 계약 기간 동안 횟수 제한 없이 이용한다(used만 기록). */
  periodOnly?: boolean;
  /** 경고 후 계속 계약에서 예산을 넘겨 쓴 횟수 */
  overage?: number;
  periodStart?: Date;
  periodEnd?: Date;
  /** 이용할 수 없을 때 사용자에게 보여줄 이유 */
  reason?: string;
  /** 차감 순서대로 정렬한, 남은 횟수가 있는 묶음들(mode가 trial/plan일 때) */
  sources?: AiSource[];
  /** 결제는 했지만 아직 '유료 이용 시작'을 누르지 않은 이용권 수 */
  awaitingStartCount?: number;
};

/** 취소한 이용권도 이미 결제한 기간이 끝날 때까지는 유효하다. */
export function isSubscriptionInEffect(subscription: SubscriptionSnapshot | null | undefined, now = new Date()) {
  if (!subscription) return false;
  if (subscription.status === "expired") return false;
  return subscription.currentPeriodEnd.getTime() > now.getTime();
}

export type PlanSubscriptionInput = SubscriptionSnapshot & { id: number; /** 이 이용권으로 이미 쓴 AI 횟수 */ used: number };

export function evaluateAiEntitlement(input: {
  user: { role: string; tag?: string | null; teacherStatus?: string | null; createdAt: Date | string };
  /** 지금 이용 중인 이용권들(시작 대기 제외) */
  subscriptions: PlanSubscriptionInput[];
  /** 결제는 끝났지만 시작 전인 이용권 수 */
  awaitingStartCount?: number;
  /** 체험 중 쓴 AI 평가 횟수 */
  usedInTrial: number;
  now?: Date;
}): AiEntitlement {
  const now = input.now ?? new Date();
  const { user } = input;
  const awaitingStartCount = input.awaitingStartCount ?? 0;

  if (user.role === "admin") {
    return { mode: "unlimited", canUse: true, limit: 0, used: 0, remaining: 0, daysRemaining: 0 };
  }
  // 교사는 관리자 승인 뒤에만 한도 없이 쓴다(가입만 하고 승인 전인 교사는 쓸 수 없다).
  if (user.role === "teacher") {
    if (user.teacherStatus === "approved") return { mode: "unlimited", canUse: true, limit: 0, used: 0, remaining: 0, daysRemaining: 0 };
    return { mode: "none", canUse: false, limit: 0, used: 0, remaining: 0, daysRemaining: 0, reason: "교사 계정은 관리자 승인 후에 AI 논술 평가를 이용할 수 있습니다." };
  }
  if (user.tag === "학부모") {
    return { mode: "none", canUse: false, limit: 0, used: 0, remaining: 0, daysRemaining: 0, reason: "학부모 계정은 AI 논술 평가를 이용할 수 없습니다. 자녀 계정에서 이용해 주세요." };
  }

  // 유료 이용권: AI 횟수가 있는 것만, 먼저 만료되는 순서(같으면 먼저 구매한 순서)로 차감한다.
  const planSources: AiSource[] = input.subscriptions
    .filter((subscription) => isSubscriptionInEffect(subscription, now) && subscription.aiEvaluationsLimit > 0)
    .sort((a, b) => a.currentPeriodEnd.getTime() - b.currentPeriodEnd.getTime() || a.id - b.id)
    .map((subscription) => {
      const used = Math.max(0, subscription.used);
      return {
        kind: "plan" as const,
        subscriptionId: subscription.id,
        planKey: subscription.planKey,
        limit: subscription.aiEvaluationsLimit,
        used,
        remaining: Math.max(0, subscription.aiEvaluationsLimit - used),
        periodStart: subscription.currentPeriodStart,
        periodEnd: subscription.currentPeriodEnd,
      };
    });

  const trial = getTrialAccess(user.createdAt, now);
  const trialUsed = Math.max(0, input.usedInTrial);
  const trialSource: AiSource | null = trial.isActive
    ? { kind: "trial", limit: TRIAL_AI_EVALUATION_LIMIT, used: trialUsed, remaining: Math.max(0, TRIAL_AI_EVALUATION_LIMIT - trialUsed) }
    : null;

  // 무료 체험분을 먼저, 그다음 유료 이용권.
  const ordered = [...(trialSource ? [trialSource] : []), ...planSources];
  const usable = ordered.filter((source) => source.remaining > 0);
  const limit = ordered.reduce((sum, source) => sum + source.limit, 0);
  const used = ordered.reduce((sum, source) => sum + source.used, 0);
  const remaining = usable.reduce((sum, source) => sum + source.remaining, 0);

  if (usable.length > 0) {
    const first = usable[0];
    return {
      mode: first.kind === "trial" ? "trial" : "plan",
      canUse: true,
      limit,
      used,
      remaining,
      daysRemaining: trial.isActive ? trial.daysRemaining : 0,
      planKey: first.planKey,
      periodStart: first.periodStart,
      periodEnd: first.periodEnd,
      sources: usable,
      awaitingStartCount,
    };
  }

  const awaitingNote = awaitingStartCount > 0 ? " 결제한 이용권이 '시작 대기' 상태입니다. 결제 화면에서 '유료 이용 시작'을 눌러 주세요." : "";
  if (planSources.length > 0) {
    return {
      mode: "plan",
      canUse: false,
      limit,
      used,
      remaining: 0,
      daysRemaining: 0,
      planKey: planSources[0].planKey,
      periodEnd: planSources[planSources.length - 1].periodEnd,
      awaitingStartCount,
      reason: `이용 중인 이용권의 AI 평가·첨삭 횟수를 모두 사용했습니다. AI 추가권을 구매하면 계속 이용할 수 있습니다.${awaitingNote}`,
    };
  }
  if (trialSource) {
    return {
      mode: "trial",
      canUse: false,
      limit,
      used,
      remaining: 0,
      daysRemaining: trial.daysRemaining,
      awaitingStartCount,
      reason: `7일 무료 체험의 AI 평가·첨삭 ${TRIAL_AI_EVALUATION_LIMIT}회를 모두 사용했습니다. 이용권을 선택하면 계속 이용할 수 있습니다.${awaitingNote}`,
    };
  }
  return {
    mode: "none",
    canUse: false,
    limit: 0,
    used: 0,
    remaining: 0,
    daysRemaining: 0,
    awaitingStartCount,
    reason: `7일 무료 체험이 끝났습니다. 이용권을 선택하면 AI 평가·첨삭을 계속 이용할 수 있습니다.${awaitingNote}`,
  };
}

/**
 * 기관 계약이 학생의 AI 평가 비용을 부담할 때의 이용 자격. 계약이 있으면 개인 이용권·체험보다 우선하고,
 * 계약이 끝났거나 예산이 소진돼도 개인 이용권으로 넘어가지 않는다(기관 담당자에게 문의하도록 안내한다).
 */
export function evaluateInstitutionEntitlement(contract: ContractWindow & Partial<ContractPolicy> & { id: number; name: string; aiLimit: number; aiUsed: number }, now: Date = new Date()): AiEntitlement {
  const availability = contractAvailability(contract, now);
  const remaining = budgetRemaining(contract.aiLimit, contract.aiUsed);
  const policy: ContractPolicy = { usageMode: contract.usageMode ?? "quota", overageAction: contract.overageAction ?? "block" };
  const enforced = contractEnforcesLimit(policy);
  const canUse = availability.usable && (!enforced || remaining > 0);
  const overage = budgetOverage(contract.aiLimit, contract.aiUsed);
  return {
    mode: "institution",
    canUse,
    limit: contract.aiLimit,
    used: enforced ? Math.min(contract.aiUsed, contract.aiLimit) : contract.aiUsed,
    remaining,
    daysRemaining: 0,
    periodOnly: policy.usageMode === "period",
    overage: policy.usageMode === "quota" && overage > 0 ? overage : 0,
    contractId: contract.id,
    contractName: contract.name,
    periodStart: new Date(contract.periodStart),
    periodEnd: new Date(contract.periodEnd),
    reason: canUse ? undefined : !availability.usable ? `${availability.reason} 기관 담당자에게 문의해 주세요.` : "기관 계약의 AI 첨삭 예산을 모두 사용했습니다. 기관 담당자에게 문의해 주세요.",
  };
}

export function ambiguousInstitutionEntitlement(): AiEntitlement {
  return {
    mode: "institution",
    canUse: false,
    limit: 0,
    used: 0,
    remaining: 0,
    daysRemaining: 0,
    reason: "여러 기관 계약에 속해 있어 이용 계약을 정할 수 없습니다. 기관 담당자에게 문의해 주세요.",
  };
}
