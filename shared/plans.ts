// 이용권(요금제) 정의. 요금 페이지·결제 화면·서버의 결제·이용 한도가 모두 이 값을 쓴다.
// 가격과 횟수를 바꿀 때는 이 파일 하나만 고친다.

export type PlanKey = "starter" | "growth";

export interface Plan {
  key: PlanKey;
  name: string;
  priceKrw: number;
  /** 이용 기간(일). 결제일부터 이 기간 동안 이용권이 유효하다. */
  periodDays: number;
  /** 기간 안에 쓸 수 있는 AI 논술 평가 횟수 */
  monthlyAiEvaluations: number;
  description: string;
  features: readonly string[];
  featured?: boolean;
}

export const PLANS: readonly Plan[] = [
  {
    key: "starter",
    name: "스타터",
    priceKrw: 9900,
    periodDays: 30,
    monthlyAiEvaluations: 5,
    description: "개인 학습을 꾸준히 이어가는 학습자",
    features: ["전체 커리큘럼 이용", "AI 평가 월 5회", "기본 학습 리포트"],
  },
  {
    key: "growth",
    name: "성장",
    priceKrw: 24900,
    periodDays: 30,
    monthlyAiEvaluations: 20,
    description: "첨삭과 분석을 집중적으로 활용하는 학습자",
    features: ["스타터의 모든 기능", "AI 평가 월 20회", "상세 취약점 분석"],
    featured: true,
  },
] as const;

export function getPlan(key: string): Plan | undefined {
  return PLANS.find((plan) => plan.key === key);
}

export function formatKrw(amount: number): string {
  return `${Math.round(amount).toLocaleString("ko-KR")}원`;
}
