import { describe, expect, it } from "vitest";

describe("email delivery configuration", () => {
  it.skipIf(!process.env.RESEND_API_KEY)(
    "recognizes the configured Resend key without requiring domain-management permission",
    async () => {
      const apiKey = process.env.RESEND_API_KEY;
      expect(Boolean(apiKey), "RESEND_API_KEY must be configured").toBe(true);
      const response = await fetch("https://api.resend.com/domains", {
        headers: { Authorization: `Bearer ${apiKey}` },
        signal: AbortSignal.timeout(12_000),
      });
      const payload = await response.json();
      // 도메인 조회는 full-access 키만 허용한다. 발송 전용 키의 restricted_api_key는 키 만료가 아니다.
      // 이 검사는 실제 메일 발송·발신 도메인 인증·수신 성공을 검증하지 않는다.
      const recognized = response.status === 200 ||
        (response.status === 401 && payload.name === "restricted_api_key");
      expect(recognized, "Resend did not recognize the configured API key").toBe(true);
    },
    15_000,
  );

  it.skipIf(!process.env.RESEND_API_KEY && !process.env.EMAIL_FROM)(
    "requires an email sender rather than an API key in EMAIL_FROM",
    () => {
      const from = process.env.EMAIL_FROM?.trim() ?? "";
      const match = from.match(/^(?:[^<>\r\n]+\s*<)?([^\s<>@]+@[^\s<>@]+\.[^\s<>@]+)>?$/);
      const valid = Boolean(match) && !/^re_/.test(from) && !/[\r\n]/.test(from) && from !== process.env.RESEND_API_KEY;
      // 비교 실패 메시지에 원문 발신자(잘못 입력한 비밀키일 수 있음)를 절대 출력하지 않는다.
      expect(valid, "EMAIL_FROM must be a sender address on a Resend-verified domain, not an API key").toBe(true);
    },
  );
});
