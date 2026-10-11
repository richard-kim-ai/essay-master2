// AI 논술 평가 이용 자격 조회(이용권·체험·한도). 라우터의 AI 평가 입구가 모두 이 함수를 거친다.
import { countAiUsage, listActiveSubscriptions, listAwaitingStartSubscriptions } from "../billingDb";
import { resolveStudentFunding } from "../institutionDb";
import { ambiguousInstitutionEntitlement, evaluateAiEntitlement, evaluateInstitutionEntitlement, type AiEntitlement } from "./entitlements";

// 사용 기록의 actionType. 체험 평가와 이용권 평가를 구분해 센다.
// 이용권마다 따로 세기 위해 유료 이용권 평가는 'essay_feedback:<이용권 id>'로 기록한다.
export const AI_ACTION_TRIAL = "trial_essay_feedback";
export const AI_ACTION_PLAN = "essay_feedback";

export function planActionType(subscriptionId: number) {
  return `${AI_ACTION_PLAN}:${subscriptionId}`;
}

/**
 * 이용권 하나가 사용한 AI 횟수를 셀 때 포함할 행동 유형.
 * 이용권별 기록 도입 전(결제 연동 전 임시 결제로 만든 starter/growth)의 'essay_feedback' 기록도 해당 이용권 것으로 센다.
 */
export function planActionTypes(subscription: { id: number; planKey: string }) {
  const legacy = subscription.planKey === "starter" || subscription.planKey === "growth";
  return legacy ? [AI_ACTION_PLAN, planActionType(subscription.id)] : [planActionType(subscription.id)];
}

type EntitlementUser = { id: number; role: string; tag?: string | null; teacherStatus?: string | null; createdAt: Date | string };

export async function getAiEntitlement(user: EntitlementUser): Promise<AiEntitlement> {
  // 관리자·교사·학부모는 사용 기록을 조회할 필요가 없다.
  if (user.role !== "user" || user.tag === "학부모") {
    return evaluateAiEntitlement({ user, subscriptions: [], usedInTrial: 0 });
  }
  // 기관 계약이 비용을 부담하는 학생은 개인 이용권·체험보다 계약이 우선한다.
  const funding = await resolveStudentFunding(user.id);
  if (funding.kind === "ambiguous") return ambiguousInstitutionEntitlement();
  if (funding.kind === "contract") return evaluateInstitutionEntitlement(funding.contract);

  const [subscriptions, awaiting, usedInTrial] = await Promise.all([
    listActiveSubscriptions(user.id),
    listAwaitingStartSubscriptions(user.id),
    countAiUsage(user.id, [AI_ACTION_TRIAL]),
  ]);
  const withUsage = await Promise.all(
    subscriptions.map(async (subscription) => ({
      id: subscription.id,
      status: subscription.status,
      planKey: subscription.planKey,
      currentPeriodStart: subscription.currentPeriodStart,
      currentPeriodEnd: subscription.currentPeriodEnd,
      aiEvaluationsLimit: subscription.aiEvaluationsLimit,
      used: await countAiUsage(user.id, planActionTypes(subscription), subscription.currentPeriodStart),
    })),
  );
  return evaluateAiEntitlement({ user, subscriptions: withUsage, awaitingStartCount: awaiting.length, usedInTrial });
}
