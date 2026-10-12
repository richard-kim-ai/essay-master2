// AI(LLM) 서비스 호출 오류를 사용자에게 보여 줄 안내 문구로 바꾼다.
// 서비스가 돌려준 원문(키 오류 JSON 등)은 화면에 내보내지 않고 서버 로그에만 남긴다.

const AUTH_PATTERNS = [
  /LLM (?:invoke|models?) failed[^\n]*\b(?:401|403)\b/i,
  /List LLM models failed[^\n]*\b(?:401|403)\b/i,
  /issue with your API key/i,
  /Incorrect API key/i,
  /(?:OPENAI|BUILT_IN_FORGE)_API_KEY is not configured/i,
];

export const LLM_AUTH_USER_MESSAGE = "AI 서비스 연결 설정에 문제가 있어 지금은 AI 기능을 사용할 수 없습니다. 잠시 후 다시 시도하거나 관리자에게 문의해 주세요.";

export const LLM_TEMPORARY_USER_MESSAGE = "AI 서비스가 일시적으로 응답하지 않았습니다. 잠시 후 다시 시도해 주세요.";

// 공급자 원문이나 내부 오류 코드(LLM_EMPTY_RESPONSE 등)로 보이는 문구.
const RAW_PROVIDER_PATTERNS = [/^LLM[ _]/i, /\bLLM (?:invoke|models?) failed\b/i, /fetch failed|ECONN|ETIMEDOUT|ENOTFOUND|aborted/i, /^[A-Z0-9_]{6,}(?:\s*\(.*\))?$/, /^\s*[{\[]/];

/**
 * 사용자 화면·API 응답에 내보낼 "AI 모델을 쓰지 못한 사유". 공급자 원문(JSON·키 오류)과 내부 오류 코드는 안내 문구로 바꾸고,
 * 이미 사람이 읽을 수 있는 문구는 그대로 둔다. 원문은 DB의 평가 기록과 서버 로그에만 남는다.
 */
export function userFacingProviderReason(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const auth = friendlyLlmErrorMessage(raw);
  if (auth) return auth;
  if (RAW_PROVIDER_PATTERNS.some((pattern) => pattern.test(raw.trim()))) return LLM_TEMPORARY_USER_MESSAGE;
  return raw.slice(0, 200);
}

/** AI 서비스 인증(API 키) 오류이면 사용자용 안내 문구를, 아니면 null을 돌려준다. */
export function friendlyLlmErrorMessage(message: string | null | undefined): string | null {
  if (!message) return null;
  return AUTH_PATTERNS.some((pattern) => pattern.test(message)) ? LLM_AUTH_USER_MESSAGE : null;
}
