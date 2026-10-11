import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const read = (relative: string) => readFileSync(new URL(relative, import.meta.url), "utf8");

const appSource = read("./App.tsx");

// App.tsx에서 Layout으로 감싼 라우트의 페이지 파일 목록(./pages/X 와 @/pages/X 두 가지 import 형태를 모두 처리)
function layoutWrappedPages(): string[] {
  const files = new Map<string, string>();
  // lazy import와 일반 import 두 가지 모두 처리
  for (const match of appSource.matchAll(/const (\w+) = lazy\(\(\) => import\("(?:\.\/|@\/)pages\/(\w+)"\)\)/g)) {
    files.set(match[1], match[2]);
  }
  for (const match of appSource.matchAll(/import (\w+) from "(?:\.\/|@\/)pages\/(\w+)"/g)) {
    files.set(match[1], match[2]);
  }
  const components = new Set<string>();
  for (const match of appSource.matchAll(/<Route path="[^"]*">\{\(\) => <Layout(?: variant="\w+")?><(\w+) \/>/g)) {
    components.add(match[1]);
  }
  return [...components].map((name) => files.get(name)).filter((file): file is string => Boolean(file));
}

const PUBLIC_PAGES = ["Home", "Pricing", "SampleExperience"];

const AUTH_PAGES = ["Login", "Signup", "TeacherSignup", "VerifyEmail", "ForgotPassword", "ResetPassword", "GuardianConsent", "NotFound"];

describe("layout consistency", () => {
  const pages = layoutWrappedPages();

  it("Layout으로 감싼 페이지를 모두 찾는다(공개 화면 3개 포함)", () => {
    expect(pages.length).toBeGreaterThanOrEqual(42);
    for (const file of PUBLIC_PAGES) expect(pages).toContain(file);
  });

  it("공개 화면(홈·요금 정책·샘플 체험)은 Layout의 공개용 변형으로 감싼다", () => {
    for (const route of ['path="/"', 'path="/pricing"', 'path="/sample"']) {
      expect(appSource, `${route}`).toMatch(new RegExp(`<Route ${route}>\\{\\(\\) => <Layout variant="public">`));
    }
  });

  it("Layout 안의 페이지는 헤더·푸터를 직접 넣지 않는다(Layout이 맡는다)", () => {
    const offenders = pages.filter((file) => /<Navigation\b|<Footer\b/.test(read(`./pages/${file}.tsx`)));
    expect(offenders).toEqual([]);
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

  it("Layout 안의 페이지는 PC 폭을 메뉴·푸터와 같은 max-w-7xl로 맞추고, 더 좁은 폭의 최상위 컨테이너를 쓰지 않는다", () => {
    const skip = new Set(["Home", "ComponentShowcase"]);
    const offenders = pages
      .filter((file) => !skip.has(file))
      .filter((file) => read(`./pages/${file}.tsx`).split("\n").some((line) => /\bmx-auto\b/.test(line) && /\bmax-w-[3-6]xl\b/.test(line) && !/\b(text-center|grid-cols|items-stretch)\b/.test(line) && !/<(p|ol|ul|h\d)\b/.test(line.trim())));
    expect(offenders).toEqual([]);
    expect(read("./components/Navigation.tsx")).toContain("max-w-7xl");
    expect(read("./components/Footer.tsx")).toContain("max-w-7xl");
  });

  it("Layout은 메뉴 바로 아래에 페이지 이동 바를 넣는다(이전으로 돌아가기·현재 위치)", () => {
    const layout = read("./components/Layout.tsx");
    expect(layout.indexOf("<Navigation")).toBeLessThan(layout.indexOf("<PageNavigator"));
    expect(layout.indexOf("<PageNavigator")).toBeLessThan(layout.indexOf("<main"));
    const navigator = read("./components/PageNavigator.tsx");
    expect(navigator).toContain("max-w-7xl");
    expect(navigator).toContain("window.history.back()");
    expect(navigator).toContain('aria-current={isCurrent ? "page" : undefined}');
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

describe("첨삭교사 계정의 메뉴", () => {
  const navigation = read("./components/Navigation.tsx");

  it("학습자용 메뉴(마이페이지 허브·학습 대시보드·내 글·첨삭 기록·오프라인 보관함·수료증)는 교사 계정에서 숨기고, PC·모바일 모두 같은 조건을 쓴다", () => {
    expect(navigation).toContain('const isTeacherAccount = user?.role === "teacher";');
    for (const href of ["/mypage", "/dashboard-detail", "/my-writings", "/offline-essays", "/certificate"]) {
      const matches = navigation.match(new RegExp(`\\{!isTeacherAccount && \\(\\s*<Link href="${href}">`, "g")) ?? [];
      expect(matches.length, `${href} 메뉴(PC·모바일 2곳)`).toBe(2);
    }
  });

  it("교사 전용 메뉴(교사 마이페이지·첨삭 정산)와 관리자 메뉴는 그대로 있다", () => {
    expect(navigation).toContain('<Link href="/teacher-mypage">');
    expect(navigation).toContain('<Link href="/teacher/settlement">');
    expect(navigation).toContain('<Link href="/admin">');
  });

  it("교사가 학습자 허브(/mypage)에 직접 들어오면 교사 마이페이지로 보낸다", () => {
    expect(read("./pages/MyPageHub.tsx")).toContain('setLocation("/teacher-mypage")');
  });
});
