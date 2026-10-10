// AI 논술 평가 이용 자격 조회(이용권·체험·한도). 라우터의 AI 평가 입구가 모두 이 함수를 거친다.
import { countAiUsage, getCurrentSubscription } from "../billingDb";
import { resolveStudentFunding } from "../institutionDb";
import { ambiguousInstitutionEntitlement, evaluateAiEntitlement, evaluateInstitutionEntitlement, type AiEntitlement } from "./entitlements";

// 사용 기록의 actionType. 체험 평가와 이용권 평가를 구분해 센다.
export const AI_ACTION_TRIAL = "trial_essay_feedback";
export const AI_ACTION_PLAN = "essay_feedback";

type EntitlementUser = { id: number; role: string; tag?: string | null; teacherStatus?: string | null; createdAt: Date | string };

export async function getAiEntitlement(user: EntitlementUser): Promise<AiEntitlement> {
  // 관리자·교사·학부모는 사용 기록을 조회할 필요가 없다.
  if (user.role !== "user" || user.tag === "학부모") {
    return evaluateAiEntitlement({ user, subscription: null, usedInPlanPeriod: 0, usedInTrial: 0 });
  }
  // 기관 계약이 비용을 부담하는 학생은 개인 이용권·체험보다 계약이 우선한다.
  const funding = await resolveStudentFunding(user.id);
  if (funding.kind === "ambiguous") return ambiguousInstitutionEntitlement();
  if (funding.kind === "contract") return evaluateInstitutionEntitlement(funding.contract);

  const subscription = await getCurrentSubscription(user.id);
  const [usedInPlanPeriod, usedInTrial] = await Promise.all([
    subscription ? countAiUsage(user.id, [AI_ACTION_PLAN], subscription.currentPeriodStart) : Promise.resolve(0),
    countAiUsage(user.id, [AI_ACTION_TRIAL]),
  ]);
  return evaluateAiEntitlement({ user, subscription, usedInPlanPeriod, usedInTrial });
}
