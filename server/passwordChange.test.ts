import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("./db", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./db")>();
  return { ...actual, resetUserPassword: vi.fn(async () => undefined) };
});
vi.mock("./_core/sdk", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./_core/sdk")>();
  return { ...actual, sdk: { ...actual.sdk, createSessionToken: vi.fn(async () => "new-session-token") } };
});

import * as db from "./db";
import { sdk } from "./_core/sdk";
import { hashPassword, verifyPasswordAsync } from "./email";
import { appRouter } from "./routers";
import { resetRateLimits } from "./rateLimit";
import type { TrpcContext } from "./_core/context";

const CURRENT = "current-password-1";

function callerFor(overrides: Record<string, unknown> = {}) {
  const res = { cookie: vi.fn(), clearCookie: vi.fn() } as any;
  const user = { id: 11, openId: "local_u11", name: "학생", email: "s@example.com", role: "user", passwordHash: hashPassword(CURRENT), ...overrides };
  const ctx = {
    user,
    req: { protocol: "https", headers: { host: "essay.example.com" }, socket: { remoteAddress: "203.0.113.9" } } as any,
    res,
  } as unknown as TrpcContext;
  return { caller: appRouter.createCaller(ctx), res };
}

beforeEach(() => {
  vi.clearAllMocks();
  resetRateLimits();
});

describe("프로필의 비밀번호 변경(auth.changePassword)", () => {
  it("현재 비밀번호가 맞으면 새 비밀번호의 해시를 저장하고, 지금 기기에는 새 세션 쿠키를 발급한다", async () => {
    const { caller, res } = callerFor();
    await expect(caller.auth.changePassword({ currentPassword: CURRENT, newPassword: "brand-new-pass-2" })).resolves.toEqual({ success: true });

    expect(db.resetUserPassword).toHaveBeenCalledTimes(1);
    const [userId, savedHash] = (db.resetUserPassword as any).mock.calls[0];
    expect(userId).toBe(11);
    expect(savedHash).not.toContain("brand-new-pass-2");
    expect(await verifyPasswordAsync("brand-new-pass-2", savedHash)).toBe(true);
    expect(await verifyPasswordAsync(CURRENT, savedHash)).toBe(false);

    expect(sdk.createSessionToken).toHaveBeenCalledWith("local_u11", expect.objectContaining({ name: "학생" }));
    expect(res.cookie).toHaveBeenCalledWith(expect.any(String), "new-session-token", expect.objectContaining({ maxAge: expect.any(Number) }));
  });

  it("현재 비밀번호가 틀리면 아무것도 바꾸지 않는다", async () => {
    const { caller, res } = callerFor();
    await expect(caller.auth.changePassword({ currentPassword: "wrong-password", newPassword: "brand-new-pass-2" })).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    expect(db.resetUserPassword).not.toHaveBeenCalled();
    expect(res.cookie).not.toHaveBeenCalled();
  });

  it("새 비밀번호가 현재와 같거나 8자 미만이면 거절한다", async () => {
    const { caller } = callerFor();
    await expect(caller.auth.changePassword({ currentPassword: CURRENT, newPassword: CURRENT })).rejects.toMatchObject({ code: "BAD_REQUEST" });
    await expect(caller.auth.changePassword({ currentPassword: CURRENT, newPassword: "short" })).rejects.toThrow();
    expect(db.resetUserPassword).not.toHaveBeenCalled();
  });

  it("비밀번호가 없는 계정(소셜 로그인 등)은 변경할 수 없다", async () => {
    const { caller } = callerFor({ passwordHash: null });
    await expect(caller.auth.changePassword({ currentPassword: CURRENT, newPassword: "brand-new-pass-2" })).rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect(db.resetUserPassword).not.toHaveBeenCalled();
  });

  it("틀린 현재 비밀번호를 반복해서 시도하면 횟수 제한에 걸린다", async () => {
    const { caller } = callerFor();
    for (let attempt = 0; attempt < 5; attempt += 1) {
      await expect(caller.auth.changePassword({ currentPassword: "wrong-password", newPassword: "brand-new-pass-2" })).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    }
    // 6번째는 올바른 비밀번호여도 막는다.
    await expect(caller.auth.changePassword({ currentPassword: CURRENT, newPassword: "brand-new-pass-2" })).rejects.toMatchObject({ code: "TOO_MANY_REQUESTS" });
    expect(db.resetUserPassword).not.toHaveBeenCalled();
  });

  it("로그인하지 않으면 쓸 수 없다", async () => {
    const ctx = { user: null, req: { protocol: "https", headers: {}, socket: {} } as any, res: { cookie: vi.fn() } as any } as unknown as TrpcContext;
    await expect(appRouter.createCaller(ctx).auth.changePassword({ currentPassword: CURRENT, newPassword: "brand-new-pass-2" })).rejects.toMatchObject({ code: "UNAUTHORIZED" });
  });
});

describe("auth.me의 hasPassword", () => {
  it("비밀번호 계정이면 hasPassword만 알려 주고 해시는 내려주지 않는다", async () => {
    const { caller } = callerFor();
    const me = (await caller.auth.me()) as Record<string, unknown>;
    expect(me.hasPassword).toBe(true);
    expect(me).not.toHaveProperty("passwordHash");
  });

  it("비밀번호가 없는 계정은 hasPassword가 false이다", async () => {
    const { caller } = callerFor({ passwordHash: null });
    expect(((await caller.auth.me()) as Record<string, unknown>).hasPassword).toBe(false);
  });
});
