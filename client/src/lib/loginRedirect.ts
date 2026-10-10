// 로그인 화면(/login)으로 보내고, 로그인 뒤 원래 보던 화면으로 돌려보내기 위한 공용 규칙.

export const DEFAULT_AFTER_LOGIN_PATH = "/dashboard";

// 로그인 화면으로 보내지 않는 공개·인증 화면. 이미 이 화면들에 있으면 다시 로그인 화면으로 보내지 않는다.
const NO_REDIRECT_PREFIXES = ["/login", "/signup", "/teacher-signup", "/verify-email", "/forgot-password", "/reset-password", "/guardian-consent"];

/**
 * 로그인 뒤 돌아갈 경로를 검증한다. 같은 사이트 안의 경로(/로 시작, //나 \ 로 시작하지 않음)만 허용해
 * 로그인 화면이 다른 사이트로 사용자를 보내는 통로(오픈 리다이렉트)가 되지 않게 한다.
 */
export function sanitizeNextPath(raw: string | null | undefined, fallback: string = DEFAULT_AFTER_LOGIN_PATH): string {
  if (!raw) return fallback;
  let value = raw.trim();
  try {
    value = decodeURIComponent(value);
  } catch {
    return fallback;
  }
  if (!value.startsWith("/") || value.startsWith("//") || value.includes("\\")) return fallback;
  if (/[\u0000-\u001f]/.test(value)) return fallback;
  // 로그인·가입 화면 자체로 돌아가면 의미가 없다.
  if (NO_REDIRECT_PREFIXES.some((prefix) => value === prefix || value.startsWith(`${prefix}?`) || value.startsWith(`${prefix}/`))) return fallback;
  return value;
}

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
