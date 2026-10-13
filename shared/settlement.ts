// 교사 첨삭 활동 정산 규칙(순수 계산). 서버의 정산 산출과 교사·관리자 화면이 함께 쓴다.

export const SETTLEMENT_ACTIVITIES = [
  { type: "essay_feedback", label: "논술 첨삭", description: "교사가 등록·승인한 논술 첨삭(AI 초안을 승인한 건 포함)", defaultUnitKrw: 3000 },
  { type: "assignment_review", label: "반 과제 채점", description: "교사가 만든 반 과제의 제출물 채점", defaultUnitKrw: 2000 },
  { type: "workbook_feedback", label: "워크북 서술형 첨삭", description: "담당 학생의 워크북 서술형 답안 첨삭", defaultUnitKrw: 1000 },
] as const;

export type ActivityType = (typeof SETTLEMENT_ACTIVITIES)[number]["type"];
export type ActivityCounts = Record<ActivityType, number>;
export type ActivityRates = Record<ActivityType, number>;

// 사업소득 원천징수(소득세 3% + 지방소득세 0.3%)의 기본값. 관리자가 설정에서 바꿀 수 있다.
export const DEFAULT_WITHHOLDING_PCT = 3.3;

export type SettlementItem = {
  type: ActivityType;
  label: string;
  count: number;
  unitAmountKrw: number;
  amountKrw: number;
};

export type SettlementTotals = {
  items: SettlementItem[];
  grossKrw: number;
  withholdingPct: number;
  withholdingKrw: number;
  netKrw: number;
};

export function emptyCounts(): ActivityCounts {
  return { essay_feedback: 0, assignment_review: 0, workbook_feedback: 0 };
}

export function defaultRates(): ActivityRates {
  return Object.fromEntries(SETTLEMENT_ACTIVITIES.map((activity) => [activity.type, activity.defaultUnitKrw])) as ActivityRates;
}

/** 저장된 단가에 빠진 항목은 기본 단가로 채운다. */
export function resolveRates(stored: Partial<Record<string, number>>): ActivityRates {
  const rates = defaultRates();
  for (const activity of SETTLEMENT_ACTIVITIES) {
    const value = stored[activity.type];
    if (typeof value === "number" && Number.isFinite(value) && value >= 0) rates[activity.type] = Math.round(value);
  }
  return rates;
}

export function computeSettlement(counts: Partial<ActivityCounts>, rates: ActivityRates, withholdingPct: number = DEFAULT_WITHHOLDING_PCT): SettlementTotals {
  const items: SettlementItem[] = SETTLEMENT_ACTIVITIES.map((activity) => {
    const count = Math.max(0, Math.floor(counts[activity.type] ?? 0));
    const unitAmountKrw = rates[activity.type];
    return { type: activity.type, label: activity.label, count, unitAmountKrw, amountKrw: count * unitAmountKrw };
  });
  const grossKrw = items.reduce((sum, item) => sum + item.amountKrw, 0);
  const pct = Number.isFinite(withholdingPct) ? Math.min(100, Math.max(0, withholdingPct)) : DEFAULT_WITHHOLDING_PCT;
  // 원 단위 미만은 버린다(간이 계산: 실제 신고는 세무 기준에 따른다).
  const withholdingKrw = Math.floor((grossKrw * pct) / 100);
  return { items, grossKrw, withholdingPct: pct, withholdingKrw, netKrw: grossKrw - withholdingKrw };
}

export function isValidMonth(value: string): boolean {
  return /^\d{4}-(0[1-9]|1[0-2])$/.test(value);
}

/** 'YYYY-MM' 한 달의 시작(포함)과 끝(제외). 한국 시간(KST) 기준으로 자른다. */
export function monthRange(month: string): { start: Date; end: Date } {
  if (!isValidMonth(month)) throw new Error("정산 월은 YYYY-MM 형식이어야 합니다.");
  const [year, monthNumber] = month.split("-").map(Number);
  const nextYear = monthNumber === 12 ? year + 1 : year;
  const nextMonth = monthNumber === 12 ? 1 : monthNumber + 1;
  const pad = (value: number) => String(value).padStart(2, "0");
  return {
    start: new Date(`${year}-${pad(monthNumber)}-01T00:00:00+09:00`),
    end: new Date(`${nextYear}-${pad(nextMonth)}-01T00:00:00+09:00`),
  };
}

export function currentMonthKst(now: Date = new Date()): string {
  const kst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  return `${kst.getUTCFullYear()}-${String(kst.getUTCMonth() + 1).padStart(2, "0")}`;
}
