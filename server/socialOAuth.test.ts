import { describe, expect, it, vi } from "vitest";

// socialOAuth.ts가 불러오는 서버 모듈(DB·세션)은 state 인코딩 검증과 무관하므로 대체한다.
vi.mock("./_core/sdk", () => ({ sdk: {} }));
vi.mock("./db", () => ({}));
vi.mock("./security", () => ({ decryptSecret: (value: string) => value }));

import { decodeState, encodeState } from "./socialOAuth";

describe("소셜 로그인 state 쿠키", () => {
  it("로그인 뒤 돌아갈 같은 사이트 경로(next)를 그대로 보존한다", () => {
    const decoded = decodeState(encodeState({ state: "abc", origin: "https://example.com", next: "/quiz?course=elementary" }));
    expect(decoded).toEqual({ state: "abc", origin: "https://example.com", next: "/quiz?course=elementary" });
  });

  it("next가 없으면 빈 값으로 돌려 첫 화면(/)으로 가게 한다(기존 동작)", () => {
    const decoded = decodeState(encodeState({ state: "abc", origin: "https://example.com" }));
    expect(decoded?.next).toBe("");
  });

  it.each(["https://evil.example/", "//evil.example", "/\\evil.example", "/login", "/signup?next=/x", "javascript:alert(1)"])(
    "조작된 next(%s)는 버리고 첫 화면으로 보낸다",
    (next) => {
      const decoded = decodeState(encodeState({ state: "abc", origin: "https://example.com", next }));
      expect(decoded?.next).toBe("");
    },
  );

  it("state나 origin이 없거나 깨진 쿠키는 거부한다", () => {
    expect(decodeState(encodeState({ state: "", origin: "https://example.com" }))).toBeNull();
    expect(decodeState("not-base64-json")).toBeNull();
  });
});
