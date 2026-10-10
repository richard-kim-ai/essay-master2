import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("./db", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./db")>();
  return {
    ...actual,
    getUserByEmail: vi.fn(),
    updatePasswordResetToken: vi.fn(),
    updateVerificationToken: vi.fn(),
    getUserByPasswordResetTokenHash: vi.fn(),
    resetUserPassword: vi.fn(),
    getLatestGuardianConsentStatusForUser: vi.fn(),
  };
});
vi.mock("./email", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./email")>();
  return { ...actual, sendPasswordResetEmail: vi.fn(), sendVerificationEmail: vi.fn() };
});

import * as db from "./db";
import * as email from "./email";
import { appRouter } from "./routers";
import { configuredPublicOrigin, publicBaseUrl } from "./publicUrl";
import { consumeRateLimit, resetRateLimits } from "./rateLimit";
import type { TrpcContext } from "./_core/context";

function anonymousCaller(ip = "203.0.113.5", host = "essay.example.com") {
  const ctx = {
    user: null,
    req: { protocol: "https", headers: { host, "x-forwarded-for": ip }, socket: { remoteAddress: ip } } as any,
    res: { cookie: vi.fn(), clearCookie: vi.fn() } as any,
  } as unknown as TrpcContext;
  return appRouter.createCaller(ctx);
}

beforeEach(() => {
  vi.clearAllMocks();
  resetRateLimits();
  delete process.env.PUBLIC_BASE_URL;
});

describe("메일 링크 주소(publicUrl)", () => {
  it("서버에 설정한 주소(PUBLIC_BASE_URL)를 우선한다", () => {
    expect(publicBaseUrl({ protocol: "https", headers: { host: "evil.example" } }, "https://essay.example.com/path")).toBe("https://essay.example.com");
  });

  it("https가 아니거나 형식이 잘못된 설정은 무시하고 요청 주소를 쓴다", () => {
    expect(configuredPublicOrigin("http://essay.example.com")).toBeNull();
    expect(configuredPublicOrigin("not a url")).toBeNull();
    expect(publicBaseUrl({ protocol: "https", headers: { host: "essay.example.com" } }, "http://insecure.example")).toBe("https://essay.example.com");
  });
});

describe("시도 제한(rateLimit)", () => {
  const rule = { windowMs: 1000, max: 2 };

  it("한도까지만 허용하고 초과하면 기다릴 시간을 알려 준다", () => {
    expect(consumeRateLimit("t", "k", rule, 0).allowed).toBe(true);
    expect(consumeRateLimit("t", "k", rule, 100).allowed).toBe(true);
    const blocked = consumeRateLimit("t", "k", rule, 200);
    expect(blocked.allowed).toBe(false);
    expect(blocked.retryAfterSec).toBeGreaterThan(0);
  });

  it("시간 창이 지나면 다시 허용하고, 키마다 따로 센다", () => {
    consumeRateLimit("t", "a", rule, 0);
    consumeRateLimit("t", "a", rule, 10);
    expect(consumeRateLimit("t", "a", rule, 20).allowed).toBe(false);
    expect(consumeRateLimit("t", "b", rule, 20).allowed).toBe(true);
    expect(consumeRateLimit("t", "a", rule, 1500).allowed).toBe(true);
  });
});

describe("비밀번호 재설정·이메일 인증 흐름", () => {
  const user = { id: 1, email: "student@example.com", name: "학생", passwordHash: "salt:hash", emailVerifiedAt: null };

  it("재설정 링크는 서버가 정한 주소로 만들고, 요청자가 보낸 origin은 쓰지 않는다", async () => {
    process.env.PUBLIC_BASE_URL = "https://essay.example.com";
    vi.mocked(db.getUserByEmail).mockResolvedValue(user as any);
    await anonymousCaller().auth.requestPasswordReset({ email: "student@example.com", origin: "https://attacker.example" });

    const mail = vi.mocked(email.sendPasswordResetEmail).mock.calls[0][0];
    expect(mail.resetUrl.startsWith("https://essay.example.com/reset-password?token=")).toBe(true);
    expect(mail.resetUrl).not.toContain("attacker.example");
  });

  it("재설정 토큰은 만료 시각(약 1시간)과 함께 저장한다", async () => {
    vi.mocked(db.getUserByEmail).mockResolvedValue(user as any);
    const before = Date.now();
    await anonymousCaller().auth.requestPasswordReset({ email: "student@example.com" });
    const [, , expiresAt] = vi.mocked(db.updatePasswordResetToken).mock.calls[0];
    expect(expiresAt).toBeInstanceOf(Date);
    expect(expiresAt.getTime() - before).toBeGreaterThan(59 * 60 * 1000);
    expect(expiresAt.getTime() - before).toBeLessThan(61 * 60 * 1000);
  });

  it("인증 메일을 다시 보낼 때도 새 만료 시각을 저장한다", async () => {
    vi.mocked(db.getUserByEmail).mockResolvedValue(user as any);
    await anonymousCaller().auth.resendVerification({ email: "student@example.com" });
    const [, , expiresAt] = vi.mocked(db.updateVerificationToken).mock.calls[0];
    expect(expiresAt).toBeInstanceOf(Date);
    expect(expiresAt.getTime()).toBeGreaterThan(Date.now());
  });

  it("같은 이메일로 메일 요청을 반복하면 제한한다", async () => {
    vi.mocked(db.getUserByEmail).mockResolvedValue(undefined);
    const caller = anonymousCaller();
    for (let i = 0; i < 3; i += 1) await caller.auth.requestPasswordReset({ email: "x@example.com" });
    await expect(caller.auth.requestPasswordReset({ email: "x@example.com" })).rejects.toMatchObject({ code: "TOO_MANY_REQUESTS" });
  });

  it("올바른 토큰으로 비밀번호를 바꾸면 재설정 함수가 호출되고, 만료된 토큰은 거절한다", async () => {
    vi.mocked(db.getUserByPasswordResetTokenHash).mockResolvedValue({ id: 1, passwordResetTokenExpiresAt: new Date(Date.now() + 60_000) } as any);
    await anonymousCaller().auth.resetPassword({ token: "a".repeat(64), password: "new-password-1" });
    expect(db.resetUserPassword).toHaveBeenCalledWith(1, expect.stringContaining(":"));

    vi.mocked(db.getUserByPasswordResetTokenHash).mockResolvedValue({ id: 1, passwordResetTokenExpiresAt: new Date(Date.now() - 1000) } as any);
    await expect(anonymousCaller().auth.resetPassword({ token: "a".repeat(64), password: "new-password-1" })).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });
});

describe("로그인 시도 제한", () => {
  it("같은 이메일로 비밀번호를 계속 틀리면 일정 횟수 뒤 잠시 막는다", async () => {
    vi.mocked(db.getUserByEmail).mockResolvedValue({ id: 1, email: "a@example.com", passwordHash: "salt:abcd" } as any);
    const caller = anonymousCaller();
    for (let i = 0; i < 8; i += 1) {
      await expect(caller.auth.loginWithEmail({ email: "a@example.com", password: "wrong" })).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    }
    await expect(caller.auth.loginWithEmail({ email: "a@example.com", password: "wrong" })).rejects.toMatchObject({ code: "TOO_MANY_REQUESTS" });
  });
});
