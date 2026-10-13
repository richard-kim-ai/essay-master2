// 교사 첨삭 신청과 첨삭지도권(횟수권)의 순수 규칙. 서버와 화면이 함께 쓴다.
// 상품·가격은 shared/plans.ts의 TEACHER_FEEDBACK_PASSES, 환불 기준은 '가격 및 환불정책' 7·8조를 따른다.

export type TeacherFeedbackRequestStatus = "paid" | "in_progress" | "delivered" | "cancelled" | "refunded";

/** 아직 결과가 전달되지 않은 상태(교사가 작업할 수 있고, 학생은 취소해 첨삭지도권 횟수를 돌려받을 수 있다). */
export const OPEN_REQUEST_STATUSES = ["paid", "in_progress"] as const satisfies readonly TeacherFeedbackRequestStatus[];

export function isOpenRequestStatus(status: string): status is (typeof OPEN_REQUEST_STATUSES)[number] {
  return (OPEN_REQUEST_STATUSES as readonly string[]).includes(status);
}

/** 완료 예정일: 신청한 날부터 이 영업일 수 안에 교사가 결과를 전달하기로 약속한다. */
export const FEEDBACK_DUE_BUSINESS_DAYS = 3;

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

// ===== 교사 첨삭지도권(횟수권) =====

export type PassSnapshot = {
  status: string;
  sessions: number;
  sessionsUsed: number;
  expiresAt: Date | string;
  priceKrw: number;
};

/** 남은 횟수(0 이상). */
export function passRemaining(pass: Pick<PassSnapshot, "sessions" | "sessionsUsed">) {
  return Math.max(0, pass.sessions - pass.sessionsUsed);
}

/** 지금 신청에 쓸 수 있는 권: 환불되지 않았고, 유효기간 안이며, 남은 횟수가 있다. */
export function isPassUsable(pass: PassSnapshot, now = new Date()) {
  return pass.status === "active" && new Date(pass.expiresAt).getTime() > now.getTime() && passRemaining(pass) > 0;
}

/** 신청에 쓸 권을 고른다: 먼저 만료되는 권부터(만료가 같으면 먼저 산 권부터 — id 순). 쓸 수 있는 권이 없으면 undefined. */
export function pickPassToUse<T extends PassSnapshot & { id: number }>(passes: readonly T[], now = new Date()): T | undefined {
  return passes
    .filter((pass) => isPassUsable(pass, now))
    .sort((a, b) => new Date(a.expiresAt).getTime() - new Date(b.expiresAt).getTime() || a.id - b.id)[0];
}

/** 쓸 수 있는 권들의 남은 횟수 합계. */
export function totalRemainingSessions(passes: readonly PassSnapshot[], now = new Date()) {
  return passes.filter((pass) => isPassUsable(pass, now)).reduce((sum, pass) => sum + passRemaining(pass), 0);
}

/**
 * 미사용 횟수에 대한 환불액(정책 7조의 횟수권 환불식): 결제금액 × 미사용 횟수 ÷ 총 횟수.
 * 원 미만은 이용자에게 유리하게 올림하되 결제금액을 넘지 않는다.
 */
export function unusedPassRefundKrw(pass: Pick<PassSnapshot, "sessions" | "sessionsUsed" | "priceKrw">) {
  if (pass.sessions <= 0) return 0;
  const raw = (pass.priceKrw * passRemaining(pass)) / pass.sessions;
  return Math.min(pass.priceKrw, Math.ceil(raw));
}
