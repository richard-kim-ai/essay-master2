import { describe, expect, it } from "vitest";
import { buildLoginHref, isNoRedirectPath, sanitizeNextPath } from "./loginRedirect";

describe("sanitizeNextPath", () => {
  it("같은 사이트의 경로는 그대로 돌려준다", () => {
    expect(sanitizeNextPath("/workbook/elementary/1")).toBe("/workbook/elementary/1");
    expect(sanitizeNextPath("/quiz?level=2")).toBe("/quiz?level=2");
    expect(sanitizeNextPath(encodeURIComponent("/mypage?tab=records"))).toBe("/mypage?tab=records");
  });

  it("다른 사이트로 보내는 값은 기본 경로로 바꾼다", () => {
    expect(sanitizeNextPath("https://evil.example.com")).toBe("/dashboard");
    expect(sanitizeNextPath("//evil.example.com/path")).toBe("/dashboard");
    expect(sanitizeNextPath("/\\evil.example.com")).toBe("/dashboard");
    expect(sanitizeNextPath("javascript:alert(1)")).toBe("/dashboard");
    expect(sanitizeNextPath("evil.example.com")).toBe("/dashboard");
  });

  it("비어 있거나 잘못 인코딩된 값, 제어 문자는 기본 경로로 바꾼다", () => {
    expect(sanitizeNextPath(null)).toBe("/dashboard");
    expect(sanitizeNextPath("")).toBe("/dashboard");
    expect(sanitizeNextPath("%E0%A4%A")).toBe("/dashboard");
    expect(sanitizeNextPath("/path%0d%0aSet-Cookie:x")).toBe("/dashboard");
  });

  it("로그인·가입 화면으로 되돌아가는 값은 기본 경로로 바꾼다", () => {
    expect(sanitizeNextPath("/login")).toBe("/dashboard");
    expect(sanitizeNextPath("/login?next=/quiz")).toBe("/dashboard");
    expect(sanitizeNextPath("/signup")).toBe("/dashboard");
    expect(sanitizeNextPath("/guardian-consent?token=abc")).toBe("/dashboard");
  });

  it("기본 경로를 지정할 수 있다", () => {
    expect(sanitizeNextPath("//x", "/")).toBe("/");
  });
});

describe("buildLoginHref", () => {
  it("돌아올 경로를 인코딩해 붙이고, 유효하지 않으면 붙이지 않는다", () => {
    expect(buildLoginHref("/workbook/elementary/1")).toBe("/login?next=%2Fworkbook%2Felementary%2F1");
    expect(buildLoginHref("https://evil.example.com")).toBe("/login");
    expect(buildLoginHref(undefined)).toBe("/login");
    expect(buildLoginHref("/login")).toBe("/login");
  });
});

describe("isNoRedirectPath", () => {
  it("로그인·가입 계열 화면에서는 로그인 화면으로 다시 보내지 않는다", () => {
    expect(isNoRedirectPath("/login")).toBe(true);
    expect(isNoRedirectPath("/verify-email")).toBe(true);
    expect(isNoRedirectPath("/guardian-consent")).toBe(true);
    expect(isNoRedirectPath("/quiz")).toBe(false);
    expect(isNoRedirectPath("/")).toBe(false);
  });
});
