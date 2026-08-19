import { describe, expect, it } from "vitest";
import { decryptSecret, encryptSecret } from "./security";
import { readFileSync } from "node:fs";

const swPath = new URL("../client/public/sw.js", import.meta.url);

describe("관리자 비공개 설정 보안", () => {
  it("암호화한 값을 다시 복호화할 수 있다", () => {
    const original = "secret-value-123";
    expect(decryptSecret(encryptSecret(original))).toBe(original);
  });

  it("같은 API 키도 매번 다른 암호문으로 저장하며 평문을 포함하지 않는다", () => {
    const original = "evaluation-provider-test-key";
    const first = encryptSecret(original);
    const second = encryptSecret(original);
    expect(first).not.toContain(original);
    expect(second).not.toContain(original);
    expect(first).not.toBe(second);
    expect(first.split(".")).toHaveLength(3);
  });

  it("잘못된 암호문을 거부한다", () => {
    expect(() => decryptSecret("invalid-value")).toThrow();
  });
});

describe("PWA Web Push 서비스 워커", () => {
  it("push와 notificationclick 이벤트를 포함한다", () => {
    const source = readFileSync(swPath, "utf8");
    expect(source).toContain('self.addEventListener("push"');
    expect(source).toContain('self.addEventListener("notificationclick"');
  });
});
