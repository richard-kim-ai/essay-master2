// 학부모 계정(role=user, tag=학부모)은 학습자가 아니다. 학습 도구·내 글·수료증·결제 같은 학습자 전용 화면을 쓰지 않고,
// 학부모 포털에서 연결된 자녀의 학습 현황을 보고 코멘트를 남긴다. 메뉴와 주소 접근이 같은 규칙을 쓰도록 여기서만 정한다.

export type AccountLike = { role?: string | null; tag?: string | null } | null | undefined;

export const PARENT_HOME = "/parent-portal";

export function isParentAccount(user: AccountLike): boolean {
  return user?.role === "user" && user?.tag === "학부모";
}

// 학습자 전용 화면의 주소(접두어). 학부모가 직접 주소로 들어와도 포털로 보낸다.
export const PARENT_BLOCKED_PREFIXES = [
  "/mypage",
  "/dashboard",
  "/dashboard-detail",
  "/my-writings",
  "/my-assignments",
  "/offline-essays",
  "/essay-submission",
  "/ai-auto-feedback",
  "/ai-feedback-compare",
  "/ai-guide-history",
  "/teacher-feedback",
  "/certificate",
  "/checkout",
  "/workbook",
  "/curriculum",
  "/quiz",
  "/paragraph-reordering",
  "/summary-practice",
  "/mistake-notebook",
  "/topic-wizard",
  "/thesis-checklist",
  "/writing-examples",
];

/** 학부모 계정이 열 수 없는 학습자 전용 주소인지. 쿼리·해시는 무시한다. */
export function isBlockedForParent(path: string): boolean {
  const clean = path.split("?")[0].split("#")[0].replace(/\/+$/, "") || "/";
  return PARENT_BLOCKED_PREFIXES.some((prefix) => clean === prefix || clean.startsWith(`${prefix}/`));
}
