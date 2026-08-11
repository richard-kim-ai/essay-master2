import { describe, expect, it } from "vitest";
import {
  createVerificationToken,
  hashPassword,
  hashVerificationToken,
  verifyPassword,
} from "./email";

describe("email authentication helpers", () => {
  it("hashes and verifies passwords without storing plaintext", () => {
    const password = "correct-horse-battery-staple";
    const hash = hashPassword(password);

    expect(hash).not.toContain(password);
    expect(verifyPassword(password, hash)).toBe(true);
    expect(verifyPassword("wrong-password", hash)).toBe(false);
  });

  it("creates deterministic hashes for verification tokens", () => {
    const token = createVerificationToken();
    expect(token).toHaveLength(64);
    expect(hashVerificationToken(token)).toBe(hashVerificationToken(token));
    expect(hashVerificationToken(token)).not.toBe(hashVerificationToken(`${token}x`));
  });
});
