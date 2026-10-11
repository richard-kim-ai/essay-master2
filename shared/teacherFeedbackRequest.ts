// 교사 첨삭 신청(건별 결제)의 순수 규칙. 서버와 화면이 함께 쓴다.
// 상품·가격은 shared/plans.ts의 TEACHER_FEEDBACK_PRODUCTS, 환불 기준은 '가격 및 환불정책' 7·8조를 따른다.

import type { TeacherFeedbackKey } from "./plans";

export type TeacherFeedbackRequestStatus = "paid" | "in_progress" | "delivered" | "cancelled" | "refunded";

/** 아직 결과가 전달되지 않은 상태(교사가 작업할 수 있고, 학생은 전액 환불로 취소할 수 있다). */
export const OPEN_REQUEST_STATUSES = ["paid", "in_progress"] as const satisfies readonly TeacherFeedbackRequestStatus[];

export function isOpenRequestStatus(status: string): status is (typeof OPEN_REQUEST_STATUSES)[number] {
  return (OPEN_REQUEST_STATUSES as readonly string[]).includes(status);
}

/** 완료 예정일: 결제(신청)한 날부터 이 영업일 수 안에 교사가 결과를 전달하기로 약속한다. */
export const FEEDBACK_DUE_BUSINESS_DAYS = 3;

/** 핵심 첨삭에서 고를 수 있는 평가항목. 핵심 첨삭은 이 중 1~2개를 고른다. */
export const FEEDBACK_ITEMS = [
  { key: "logic", label: "논리" },
  { key: "structure", label: "구성" },
  { key: "evidence", label: "근거" },
  { key: "expression", label: "표현" },
] as const;

export type FeedbackItemKey = (typeof FEEDBACK_ITEMS)[number]["key"];
export const CORE_ITEM_MIN = 1;
export const CORE_ITEM_MAX = 2;

const KST_OFFSET_MS = 9 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * 한국 시간 기준으로 영업일(월~금)을 더해 그날 23:59:59(KST)를 돌려준다.
 * 토·일요일은 세지 않는다. 공휴일은 반영하지 않는다(필요하면 관리자가 예정일을 조정).
 */
export function addBusinessDays(from: Date, businessDays: number): Date {
  const kst = new Date(from.getTime() + KST_OFFSET_MS);
  let remaining = Math.max(0, Math.floor(businessDays));
  while (remaining > 0) {
    kst.setTime(kst.getTime() + DAY_MS);
    const weekday = kst.getUTCDay(); // 0 일, 6 토
    if (weekday !== 0 && weekday !== 6) remaining -= 1;
  }
  kst.setUTCHours(23, 59, 59, 0);
  return new Date(kst.getTime() - KST_OFFSET_MS);
}

export function computeDueAt(paidAt: Date): Date {
  return addBusinessDays(paidAt, FEEDBACK_DUE_BUSINESS_DAYS);
}

export function isRequestOverdue(request: { status: string; dueAt: Date | string }, now = new Date()) {
  return isOpenRequestStatus(request.status) && new Date(request.dueAt).getTime() < now.getTime();
}

export type ScopeValidation = { ok: true; items: FeedbackItemKey[] } | { ok: false; error: string };

/** 신청 범위 검증: 핵심 첨삭은 평가항목을 1~2개 고르고, 일반·종합은 항목 선택이 없다. */
export function validateRequestScope(productKey: TeacherFeedbackKey, items: readonly string[] | undefined): ScopeValidation {
  if (productKey !== "tf_core") {
    if (items && items.length > 0) return { ok: false, error: "항목 선택은 핵심 첨삭지도에서만 할 수 있습니다." };
    return { ok: true, items: [] };
  }
  const valid = new Set<string>(FEEDBACK_ITEMS.map((item) => item.key));
  const unique = Array.from(new Set(items ?? []));
  if (unique.some((item) => !valid.has(item))) return { ok: false, error: "알 수 없는 평가항목입니다." };
  if (unique.length < CORE_ITEM_MIN || unique.length > CORE_ITEM_MAX) return { ok: false, error: `핵심 첨삭지도는 평가항목을 ${CORE_ITEM_MIN}~${CORE_ITEM_MAX}개 선택해 주세요.` };
  return { ok: true, items: unique as FeedbackItemKey[] };
}

export function describeScope(productKey: TeacherFeedbackKey, items: readonly string[]) {
  if (productKey !== "tf_core") return null;
  return items.map((key) => FEEDBACK_ITEMS.find((item) => item.key === key)?.label ?? key).join("·");
}
