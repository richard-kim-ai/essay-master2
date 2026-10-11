import { beforeEach, describe, expect, it, vi } from "vitest";

// 로그인으로 발급한 세션 쿠키가 다음 요청에서 로그인 상태로 인정되는지(발급 → 검증) 확인한다.
const userRow = vi.hoisted(() => ({ current: null as Record<string, unknown> | null }));
const upsertUser = vi.hoisted(() => vi.fn());

vi.mock("./db", () => ({
  getUserByOpenId: vi.fn(async () => userRow.current),
  upsertUser,
}));

async function loadSdk() {
  vi.resetModules();
  vi.stubEnv("JWT_SECRET", "login-session-test-secret");
  vi.stubEnv("VITE_APP_ID", "test-app");
  return (await import("./_core/sdk")).sdk;
}

async function cookieFor(token: string) {
  const { COOKIE_NAME } = await import("@shared/const");
  return { headers: { cookie: `${COOKIE_NAME}=${token}` } } as any;
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("이메일 로그인 → 세션 쿠키 → 로그인 상태", () => {
  it("비밀번호 계정: 발급한 쿠키로 같은 사용자가 인식된다", async () => {
    const sdk = await loadSdk();
    userRow.current = { id: 7, openId: "local_abc", name: "학생", role: "user", passwordHash: "salt:hash-1", lastSignedIn: new Date() };
    const token = await sdk.createSessionToken("local_abc", { name: "학생", expiresInMs: 60_000 });
    const user = await sdk.authenticateRequest(await cookieFor(token));
    expect(user.id).toBe(7);
  });

  it("비밀번호를 바꾼 뒤에는 이전 쿠키가 거절된다", async () => {
    const sdk = await loadSdk();
    userRow.current = { id: 7, openId: "local_abc", name: "학생", role: "user", passwordHash: "salt:hash-1", lastSignedIn: new Date() };
    const token = await sdk.createSessionToken("local_abc", { name: "학생", expiresInMs: 60_000 });
    userRow.current = { ...userRow.current, passwordHash: "salt:hash-2" };
    await expect(sdk.authenticateRequest(await cookieFor(token))).rejects.toThrow();
  });

  it("이름이 비어 있는 세션(이름 없는 계정)도 서명이 유효하면 로그인 상태로 인정한다", async () => {
    const sdk = await loadSdk();
    const { ENV } = await import("./_core/env");
    userRow.current = { id: 3, openId: "manus_owner", name: null, role: "admin", passwordHash: null, lastSignedIn: new Date() };
    const token = await sdk.signSession({ openId: "manus_owner", appId: ENV.appId, name: "" });
    const user = await sdk.authenticateRequest(await cookieFor(token));
    expect(user.id).toBe(3);
  });

  it("openId·appId가 없는 세션은 여전히 거절한다", async () => {
    const sdk = await loadSdk();
    userRow.current = { id: 3, openId: "manus_owner", name: null, role: "admin", passwordHash: null, lastSignedIn: new Date() };
    const token = await sdk.signSession({ openId: "manus_owner", appId: "", name: "누구" });
    await expect(sdk.authenticateRequest(await cookieFor(token))).rejects.toThrow();
  });

  it("접속 시각은 5분 안에는 다시 쓰지 않는다", async () => {
    const sdk = await loadSdk();
    userRow.current = { id: 7, openId: "local_abc", name: "학생", role: "user", passwordHash: "salt:hash-1", lastSignedIn: new Date() };
    const token = await sdk.createSessionToken("local_abc", { name: "학생", expiresInMs: 60_000 });
    await sdk.authenticateRequest(await cookieFor(token));
    expect(upsertUser).not.toHaveBeenCalled();

    userRow.current = { ...userRow.current, lastSignedIn: new Date(Date.now() - 10 * 60 * 1000) };
    await sdk.authenticateRequest(await cookieFor(token));
    expect(upsertUser).toHaveBeenCalledTimes(1);
  });
});
