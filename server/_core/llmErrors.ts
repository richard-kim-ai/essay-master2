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

/** AI 서비스 인증(API 키) 오류이면 사용자용 안내 문구를, 아니면 null을 돌려준다. */
export function friendlyLlmErrorMessage(message: string | null | undefined): string | null {
  if (!message) return null;
  return AUTH_PATTERNS.some((pattern) => pattern.test(message)) ? LLM_AUTH_USER_MESSAGE : null;
}
