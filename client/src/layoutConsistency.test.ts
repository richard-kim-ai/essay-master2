import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const read = (relative: string) => readFileSync(new URL(relative, import.meta.url), "utf8");

const appSource = read("./App.tsx");

// App.tsx에서 Layout으로 감싼 라우트의 페이지 파일 목록(./pages/X 와 @/pages/X 두 가지 import 형태를 모두 처리)
function layoutWrappedPages(): string[] {
  const lazy = new Map<string, string>();
  for (const match of appSource.matchAll(/const (\w+) = lazy\(\(\) => import\("(?:\.\/|@\/)pages\/(\w+)"\)\)/g)) {
    lazy.set(match[1], match[2]);
  }
  const components = new Set<string>();
  for (const match of appSource.matchAll(/<Route path="[^"]*">\{\(\) => <Layout><(\w+) \/>/g)) {
    components.add(match[1]);
  }
  return [...components].map((name) => lazy.get(name)).filter((file): file is string => Boolean(file));
}

const AUTH_PAGES = ["Login", "Signup", "TeacherSignup", "VerifyEmail", "ForgotPassword", "ResetPassword", "GuardianConsent", "NotFound"];

describe("layout consistency", () => {
  const pages = layoutWrappedPages();

  it("Layout으로 감싼 페이지를 모두 찾는다", () => {
    expect(pages.length).toBeGreaterThanOrEqual(39);
  });

  it("Layout 안의 페이지는 전체 높이(min-h-screen)를 다시 잡지 않는다(Layout이 높이를 맡는다)", () => {
    const offenders = pages.filter((file) => /\bmin-h-screen\b/.test(read(`./pages/${file}.tsx`)));
    expect(offenders).toEqual([]);
    expect(read("./components/DashboardLayout.tsx")).not.toMatch(/\bmin-h-screen\b/);
  });

  it("Layout 안의 페이지는 main 요소를 다시 만들지 않는다(주 영역은 Layout의 main 하나)", () => {
    const offenders = pages.filter((file) => /<main\b/.test(read(`./pages/${file}.tsx`)));
    expect(offenders).toEqual([]);
    expect(read("./components/DashboardLayout.tsx")).not.toMatch(/<main\b/);
  });

  it("Layout은 페이지 최상위 요소가 남은 높이를 채우도록 하고 푸터를 포함한다", () => {
    const layout = read("./components/Layout.tsx");
    expect(layout).toContain("[&>*]:flex-1");
    expect(layout).toContain("<Footer");
  });

  it("인증 계열 화면은 AuthLayout을 쓰고 배경·푸터를 직접 만들지 않는다", () => {
    for (const file of AUTH_PAGES) {
      const source = read(`./pages/${file}.tsx`);
      expect(source, `${file}은 AuthLayout을 사용해야 합니다`).toContain("<AuthLayout");
      expect(source, `${file}에 자체 푸터가 남아 있습니다`).not.toContain("<Footer");
      expect(source, `${file}에 자체 전체 높이 배경이 남아 있습니다`).not.toMatch(/\bmin-h-screen\b/);
    }
  });
});
