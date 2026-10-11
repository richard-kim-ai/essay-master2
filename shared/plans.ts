// 이용권(상품) 정의. 요금 페이지·결제 화면·서버의 결제·이용 한도가 모두 이 값을 쓴다.
// 가격과 횟수를 바꿀 때는 이 파일 하나만 고친다. 값은 '가격 및 환불정책'(푸터 > 가격·환불정책)의 1·5조와 같아야 한다.

export type PlanKey = "study" | "ai_basic" | "ai_focus" | "ai_pass";

/** package: 결제 후 이용자가 '유료 이용 시작'을 눌러야 기간이 시작되는 30일 상품 / addon: 구매일부터 바로 기간이 시작되는 추가권 */
export type PlanKind = "package" | "addon";

export interface Plan {
  key: PlanKey;
  name: string;
  priceKrw: number;
  kind: PlanKind;
  /** 이용 기간(일). package는 유료 이용을 시작한 시각부터, addon은 구매일부터 센다. */
  periodDays: number;
  /** 기간 안에 쓸 수 있는 AI 평가·첨삭 횟수(학습형은 0) */
  aiEvaluations: number;
  /** 환불 계산에 쓰는 구성 금액(학습 접근권). 두 금액의 합은 가격과 같다. */
  studyAmountKrw: number;
  /** 환불 계산에 쓰는 구성 금액(AI 횟수권) */
  aiAmountKrw: number;
  description: string;
  features: readonly string[];
  featured?: boolean;
}

export const PLANS: readonly Plan[] = [
  {
    key: "study",
    name: "학습형",
    priceKrw: 14900,
    kind: "package",
    periodDays: 30,
    aiEvaluations: 0,
    studyAmountKrw: 14900,
    aiAmountKrw: 0,
    description: "문제은행과 해설로 꾸준히 학습하는 학습자",
    features: ["문제은행·해설·자동 학습 커리큘럼·진도관리", "30일 이용", "AI 평가·첨삭은 포함되지 않습니다"],
  },
  {
    key: "ai_basic",
    name: "AI 기본형",
    priceKrw: 24900,
    kind: "package",
    periodDays: 30,
    aiEvaluations: 10,
    studyAmountKrw: 12450,
    aiAmountKrw: 12450,
    description: "학습과 AI 첨삭을 함께 이용하는 학습자",
    features: ["학습형 서비스 포함", "AI 평가·첨삭 10회", "30일 이용"],
    featured: true,
  },
  {
    key: "ai_focus",
    name: "AI 집중형",
    priceKrw: 39900,
    kind: "package",
    periodDays: 30,
    aiEvaluations: 20,
    studyAmountKrw: 13300,
    aiAmountKrw: 26600,
    description: "AI 첨삭을 집중적으로 활용하는 학습자",
    features: ["학습형 서비스 포함", "AI 평가·첨삭 20회", "30일 이용"],
  },
  {
    key: "ai_pass",
    name: "AI 추가권",
    priceKrw: 14900,
    kind: "addon",
    periodDays: 90,
    aiEvaluations: 10,
    studyAmountKrw: 0,
    aiAmountKrw: 14900,
    description: "학습형 없이 내가 쓴 글의 AI 평가·첨삭만 더 받고 싶은 학습자",
    features: ["AI 평가·첨삭 10회", "구매일부터 90일 이용", "여러 장 구매할 수 있습니다"],
  },
] as const;

// ===== 교사 첨삭지도(건별 결제) =====
// 이용권과 별개로, 이용권 결제자가 앱 안에서 건별로 추가 결제해 신청하는 상품이다(가격 및 환불정책 1·4조).
// 값은 정책의 가격표와 같아야 한다.
export type TeacherFeedbackKey = "tf_core" | "tf_standard" | "tf_comprehensive";

export interface TeacherFeedbackProduct {
  key: TeacherFeedbackKey;
  name: string;
  priceKrw: number;
  description: string;
}

export const TEACHER_FEEDBACK_PRODUCTS: readonly TeacherFeedbackProduct[] = [
  { key: "tf_core", name: "교사 핵심 첨삭지도", priceKrw: 3900, description: "선택한 평가항목에 대한 핵심 피드백" },
  { key: "tf_standard", name: "교사 일반 첨삭지도", priceKrw: 6900, description: "논리·구성·근거에 대한 피드백" },
  { key: "tf_comprehensive", name: "교사 종합 첨삭지도", priceKrw: 9900, description: "전체 평가와 문장 수정 제안을 포함한 종합 피드백" },
] as const;

export function getTeacherFeedbackProduct(key: string): TeacherFeedbackProduct | undefined {
  return TEACHER_FEEDBACK_PRODUCTS.find((product) => product.key === key);
}

/** 교사 첨삭을 신청할 수 있는 사람(요금 페이지 등 외부 안내용 문구). */
export const TEACHER_FEEDBACK_ELIGIBILITY_NOTICE = "이용권 결제자만 신청할 수 있습니다.";

/** 교사 첨삭 신청·결제 기능을 열면 true로 바꾼다. false인 동안 요금 페이지에는 '신청 기능 준비 중'으로 표시한다. */
export const TEACHER_FEEDBACK_PURCHASE_OPEN = true;

/** 예전 요금제(결제 연동 전 임시 결제로 만든 기록). 새로 판매하지 않고, 이름만 알아볼 수 있게 남긴다. */
const LEGACY_PLAN_NAMES: Record<string, string> = { starter: "스타터(종료)", growth: "성장(종료)" };

/** 판매 중인 상품만 찾는다(결제에 쓴다). */
export function getPlan(key: string): Plan | undefined {
  return PLANS.find((plan) => plan.key === key);
}

/** 판매 중이 아닌 예전 상품 이름까지 포함해 표시용 이름을 돌려준다. */
export function getPlanName(key: string): string {
  return getPlan(key)?.name ?? TEACHER_FEEDBACK_PRODUCTS.find((product) => product.key === key)?.name ?? LEGACY_PLAN_NAMES[key] ?? key;
}

export function formatKrw(amount: number): string {
  return `${Math.round(amount).toLocaleString("ko-KR")}원`;
}
