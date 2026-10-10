// 로그인 화면(/login)으로 보내고, 로그인 뒤 원래 보던 화면으로 돌려보내기 위한 공용 규칙.

import { DEFAULT_AFTER_LOGIN_PATH, NO_REDIRECT_PREFIXES, sanitizeNextPath } from "@shared/nextPath";

// 로그인 뒤 돌아갈 경로 검증 규칙은 소셜 로그인(서버)과 함께 쓰므로 shared/nextPath.ts에 있다.
export { DEFAULT_AFTER_LOGIN_PATH, sanitizeNextPath };

export function buildLoginHref(next?: string | null): string {
  const safe = sanitizeNextPath(next, "");
  return safe ? `/login?next=${encodeURIComponent(safe)}` : "/login";
}

export function isNoRedirectPath(pathname: string): boolean {
  return NO_REDIRECT_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

/** 인증이 필요한 요청이 실패했을 때 현재 화면을 기억해 이메일 로그인 화면으로 보낸다. */
export function redirectToLogin() {
  if (typeof window === "undefined") return;
  if (isNoRedirectPath(window.location.pathname)) return;
  window.location.assign(buildLoginHref(`${window.location.pathname}${window.location.search}`));
}
