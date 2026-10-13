import { createHmac, timingSafeEqual } from "node:crypto";

// 로그인 세션을 계정의 현재 비밀번호에 묶는다. 세션 토큰에 비밀번호 해시의 HMAC 지문을 넣어 두고,
// 요청마다 현재 해시의 지문과 비교하므로 비밀번호를 바꾸거나 재설정하면 이전에 발급된 세션이 모두 무효가 된다.
// (소셜 로그인 전용 계정처럼 비밀번호가 없는 계정은 묶지 않는다.)
export function passwordVersion(passwordHash: string | null | undefined, secret: string): string | undefined {
  if (!passwordHash) return undefined;
  return createHmac("sha256", secret).update(passwordHash).digest("hex").slice(0, 24);
}

export function sessionMatchesPassword(sessionVersion: unknown, passwordHash: string | null | undefined, secret: string): boolean {
  const expected = passwordVersion(passwordHash, secret);
  if (!expected) return true;
  if (typeof sessionVersion !== "string" || sessionVersion.length !== expected.length) return false;
  return timingSafeEqual(Buffer.from(sessionVersion), Buffer.from(expected));
}
