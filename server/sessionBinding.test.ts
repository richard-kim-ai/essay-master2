import { describe, expect, it } from "vitest";
import { passwordVersion, sessionMatchesPassword } from "./_core/sessionBinding";

const SECRET = "test-cookie-secret";

describe("세션과 비밀번호 연결", () => {
  it("비밀번호 해시가 같으면 같은 버전이고, 바뀌면 다른 버전이다", () => {
    expect(passwordVersion("salt:hash-a", SECRET)).toBe(passwordVersion("salt:hash-a", SECRET));
    expect(passwordVersion("salt:hash-a", SECRET)).not.toBe(passwordVersion("salt:hash-b", SECRET));
    expect(passwordVersion("salt:hash-a", SECRET)).not.toBe(passwordVersion("salt:hash-a", "other-secret"));
  });

  it("버전에 비밀번호 해시 원문이 드러나지 않는다", () => {
    expect(passwordVersion("salt:hash-a", SECRET)).not.toContain("hash-a");
  });

  it("비밀번호가 없는 계정(소셜 전용)은 버전이 없고 세션이 항상 유효하다", () => {
    expect(passwordVersion(null, SECRET)).toBeUndefined();
    expect(sessionMatchesPassword(undefined, null, SECRET)).toBe(true);
    expect(sessionMatchesPassword("anything", "", SECRET)).toBe(true);
  });

  it("발급 당시 비밀번호와 지금 비밀번호가 같을 때만 세션을 허용한다", () => {
    const issued = passwordVersion("salt:old-hash", SECRET);
    expect(sessionMatchesPassword(issued, "salt:old-hash", SECRET)).toBe(true);
    // 비밀번호 재설정·변경 후에는 이전 세션이 거절된다.
    expect(sessionMatchesPassword(issued, "salt:new-hash", SECRET)).toBe(false);
  });

  it("비밀번호가 있는 계정인데 세션에 버전이 없거나 형식이 다르면 거절한다", () => {
    expect(sessionMatchesPassword(undefined, "salt:hash", SECRET)).toBe(false);
    expect(sessionMatchesPassword(123, "salt:hash", SECRET)).toBe(false);
    expect(sessionMatchesPassword("short", "salt:hash", SECRET)).toBe(false);
  });
});
