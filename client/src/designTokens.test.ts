import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

// 화면 색 기준: 브랜드 색은 인디고, 중립색은 slate로 통일한다.
// 의미 색(성공 emerald, 경고 amber, 오류 rose)과 보조 강조(cyan·teal·orange)는 허용한다.
const SRC = fileURLToPath(new URL(".", import.meta.url));
const PREFIX = "(?:(?:bg|text|from|via|to|ring|shadow|fill|stroke|divide|outline|decoration|accent|placeholder|caret)|border(?:-[trblxyse])?|ring-offset)";
const OFF_BRAND = new RegExp(`\\b${PREFIX}-(blue|violet|purple|fuchsia|gray)-\\d{2,3}\\b`, "g");

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return name === "ui" ? [] : sourceFiles(path);
    const isSource = /\.(ts|tsx)$/.test(name) && !/\.test\.(ts|tsx)$/.test(name);
    return isSource && name !== "ComponentShowcase.tsx" ? [path] : [];
  });
}

describe("design tokens", () => {
  it("화면 코드에 브랜드 색 외의 파랑·보라 계열과 gray 중립색을 쓰지 않는다(인디고·slate로 통일)", () => {
    const offenders: string[] = [];
    for (const file of sourceFiles(SRC)) {
      const matches = readFileSync(file, "utf8").match(OFF_BRAND);
      if (matches) offenders.push(`${file.replace(SRC, "")}: ${[...new Set(matches)].slice(0, 3).join(", ")}`);
    }
    expect(offenders).toEqual([]);
  });

  it("로그인·가입 계열 화면의 주 버튼은 인디고 기준 색을 쓴다(초록·파랑 버튼을 쓰지 않는다)", () => {
    const AUTH = ["Login", "Signup", "TeacherSignup", "VerifyEmail", "ForgotPassword", "ResetPassword", "GuardianConsent", "NotFound"];
    for (const name of AUTH) {
      const source = readFileSync(join(SRC, "pages", `${name}.tsx`), "utf8");
      expect(source, `${name}의 주 버튼 색`).not.toMatch(/\bbg-(emerald|green|blue)-[5-9]00\b/);
    }
  });
});
