import { describe, expect, it } from "vitest";
import { getSessionCookieOptions } from "./_core/cookies";

const requestOf = (protocol: string, headers: Record<string, string> = {}) => ({ protocol, headers }) as any;

describe("세션 쿠키 속성", () => {
  it("https에서는 SameSite=None + Secure(운영 환경, 다른 사이트에서 열리는 경우 포함)", () => {
    expect(getSessionCookieOptions(requestOf("https"))).toMatchObject({ httpOnly: true, path: "/", sameSite: "none", secure: true });
  });

  it("프록시 뒤(x-forwarded-proto=https)에서도 SameSite=None + Secure", () => {
    expect(getSessionCookieOptions(requestOf("http", { "x-forwarded-proto": "https" }))).toMatchObject({ sameSite: "none", secure: true });
  });

  it("http://localhost에서는 SameSite=Lax + Secure 없음 — SameSite=None인데 Secure가 없으면 브라우저가 쿠키를 버려 로그인이 풀린다", () => {
    const options = getSessionCookieOptions(requestOf("http"));
    expect(options).toMatchObject({ httpOnly: true, path: "/", sameSite: "lax", secure: false });
  });
});
