import { describe, expect, it } from "vitest";
import { normalizeLoginEmail, planLoginSetup, validateLoginPassword } from "./loginSetup";

const manusOnlyAdmin = { id: 1, email: "admin@example.com", passwordHash: null, emailVerifiedAt: null, loginMethod: null, role: "admin" };

describe("이메일 로그인 설정 계획", () => {
  it("Manus로만 만든 계정(비밀번호·이메일 인증 없음)은 비밀번호 설정과 인증 처리가 필요하다", () => {
    expect(planLoginSetup(manusOnlyAdmin, { makeAdmin: false })).toEqual({
      action: "update",
      hadPassword: false,
      verifyEmail: true,
      promoteToAdmin: false,
      setLoginMethod: true,
    });
  });

  it("이미 비밀번호·인증이 있는 계정은 비밀번호만 바꾼다", () => {
    const plan = planLoginSetup({ ...manusOnlyAdmin, passwordHash: "salt:hash", emailVerifiedAt: new Date(), loginMethod: "email" }, { makeAdmin: false });
    expect(plan).toMatchObject({ action: "update", hadPassword: true, verifyEmail: false, setLoginMethod: false });
  });

  it("관리자 승격은 요청했고 관리자가 아닐 때만 한다", () => {
    expect(planLoginSetup({ ...manusOnlyAdmin, role: "user" }, { makeAdmin: true })).toMatchObject({ promoteToAdmin: true });
    expect(planLoginSetup({ ...manusOnlyAdmin, role: "user" }, { makeAdmin: false })).toMatchObject({ promoteToAdmin: false });
    expect(planLoginSetup(manusOnlyAdmin, { makeAdmin: true })).toMatchObject({ promoteToAdmin: false });
  });

  it("계정이 없으면 관리자를 새로 만들고, 이름이 없으면 이름이 필요하다고 알린다", () => {
    expect(planLoginSetup(undefined, { makeAdmin: false })).toEqual({ action: "create_admin", needsName: true });
    expect(planLoginSetup(undefined, { makeAdmin: false, name: "관리자" })).toEqual({ action: "create_admin", needsName: false });
  });
});

describe("입력 정리", () => {
  it("이메일은 앞뒤 공백을 지우고 소문자로 맞춘다(로그인이 소문자로 조회하므로)", () => {
    expect(normalizeLoginEmail("  Admin@Example.COM ")).toBe("admin@example.com");
  });

  it("비밀번호는 10자 이상 128자 이하만 받는다", () => {
    expect(validateLoginPassword("short")).toContain("10자");
    expect(validateLoginPassword("x".repeat(129))).toContain("128자");
    expect(validateLoginPassword("long-enough-password")).toBeNull();
  });
});
