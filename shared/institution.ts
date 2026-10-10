// 기관 계약·정산 제외 규칙(순수 계산). 서버(장부·예산 차감)와 화면(라벨·남은 횟수)이 함께 쓴다.

export type BudgetType = "human" | "ai" | "management";

// 예산 단위 "토큰"은 LLM 토큰이나 금액이 아니라 서비스 이용 횟수다.
export const BUDGET_TYPES: ReadonlyArray<{ type: BudgetType; label: string; unit: string; description: string }> = [
  { type: "human", label: "첨삭", unit: "건", description: "교사의 논술 첨삭·반 과제 채점·워크북 서술형 첨삭 1건" },
  { type: "ai", label: "AI 첨삭", unit: "회", description: "AI 논술 평가·AI 첨삭 초안 1회(성공한 것만)" },
  { type: "management", label: "관리", unit: "건", description: "출결 기록·반 공지·반 과제 생성 1건" },
];

export type AutomaticExclusion = "none" | "institution_contract" | "institution_member" | "teacher_member";

export const AUTOMATIC_EXCLUSION_LABELS: Record<AutomaticExclusion, string> = {
  none: "개별 정산 대상",
  institution_contract: "기관 계약 반 (자동 제외)",
  institution_member: "기관 소속 학생 (자동 제외)",
  teacher_member: "기관 소속 교사 (자동 제외)",
};

/**
 * 활동이 처음 완료된 시점에 개별 정산 대상인지 정한다. 적용되는 첫 사유가 표시되는 사유이고, 우선순위는 다음과 같다.
 *  1) 기관 계약이 비용을 부담하는 반에서 한 활동  2) 기관 소속 학생에 대한 활동  3) 기관 소속 교사의 활동
 * 수동 제외(교사가 직접 제외)는 여기에 포함되지 않으며, 자동 제외를 되돌리는 방법은 없다.
 */
export function decideAutomaticExclusion(input: { classContractId: number | null; studentInInstitution: boolean; teacherInInstitution: boolean }): AutomaticExclusion {
  if (input.classContractId) return "institution_contract";
  if (input.studentInInstitution) return "institution_member";
  if (input.teacherInInstitution) return "teacher_member";
  return "none";
}

export function isSettlementExcluded(row: { automaticExclusion: AutomaticExclusion; manualExcluded: number | boolean }): boolean {
  return row.automaticExclusion !== "none" || Boolean(row.manualExcluded);
}

export function exclusionLabel(row: { automaticExclusion: AutomaticExclusion; manualExcluded: number | boolean }): string {
  if (row.automaticExclusion !== "none") return AUTOMATIC_EXCLUSION_LABELS[row.automaticExclusion];
  return row.manualExcluded ? "교사가 정산에서 제외" : AUTOMATIC_EXCLUSION_LABELS.none;
}

export type ContractWindow = { status: "draft" | "active" | "suspended" | "closed"; periodStart: Date | string; periodEnd: Date | string };

/** 계약이 지금 새 이용을 받을 수 있는지(활성 상태이고 기간 안, 끝 시각은 포함하지 않는다). */
export function contractAvailability(contract: ContractWindow, now: Date = new Date()): { usable: boolean; reason?: string } {
  if (contract.status === "draft") return { usable: false, reason: "계약이 아직 활성화되지 않았습니다." };
  if (contract.status === "suspended") return { usable: false, reason: "계약이 일시 중지되었습니다." };
  if (contract.status === "closed") return { usable: false, reason: "계약이 종료되었습니다." };
  const start = new Date(contract.periodStart).getTime();
  const end = new Date(contract.periodEnd).getTime();
  if (now.getTime() < start) return { usable: false, reason: "계약 기간이 아직 시작되지 않았습니다." };
  if (now.getTime() >= end) return { usable: false, reason: "계약 기간이 끝났습니다. 갱신이 필요합니다." };
  return { usable: true };
}

export function budgetRemaining(limit: number, used: number): number {
  return Math.max(0, limit - used);
}

export const BUDGET_COLUMNS: Record<BudgetType, { limit: "humanLimit" | "aiLimit" | "managementLimit"; used: "humanUsed" | "aiUsed" | "managementUsed" }> = {
  human: { limit: "humanLimit", used: "humanUsed" },
  ai: { limit: "aiLimit", used: "aiUsed" },
  management: { limit: "managementLimit", used: "managementUsed" },
};

export const MAX_BUDGET_UNITS = 2_000_000_000;
