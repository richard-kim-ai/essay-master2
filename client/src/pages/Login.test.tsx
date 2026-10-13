import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({ providers: [] as Array<{ provider: string; enabled: boolean }> }));

vi.mock("wouter", () => ({
  Link: ({ href, children, ...props }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...props}>{children}</a>
  ),
  useLocation: () => ["/login", vi.fn()],
  useSearch: () => "",
}));

vi.mock("@/lib/trpc", () => ({
  trpc: {
    social: { providers: { useQuery: () => ({ data: state.providers }) } },
    useUtils: () => ({ invalidate: vi.fn() }),
    auth: { loginWithEmail: { useMutation: () => ({ mutate: vi.fn(), isPending: false }) } },
    guardian: { resendConsent: { useMutation: () => ({ mutate: vi.fn(), isPending: false }) } },
  },
}));

import Login from "./Login";

describe("Login page", () => {
  beforeEach(() => {
    state.providers = [];
  });

  it("원클릭 샘플 체험 모드와 공개된 샘플 계정 정보를 보여주지 않는다", () => {
    const html = renderToStaticMarkup(<Login />);
    expect(html).not.toContain("원클릭");
    expect(html).not.toContain("샘플 체험 모드");
    expect(html).not.toContain("sample1234");
    expect(html).not.toContain("@sample.com");
  });

  it("이메일 로그인 입력, 비밀번호 찾기, 학생·교사 회원가입 링크를 보여준다", () => {
    const html = renderToStaticMarkup(<Login />);
    expect(html).toContain("이메일 로그인");
    expect(html).toContain('href="/forgot-password"');
    expect(html).toContain('href="/signup"');
    expect(html).toContain('href="/teacher-signup"');
  });

  it("사용 가능한 소셜 로그인 제공자만 보여주고, 하나도 없으면 구분선과 안내 문구도 숨긴다", () => {
    expect(renderToStaticMarkup(<Login />)).not.toContain("또는");
    expect(renderToStaticMarkup(<Login />)).not.toContain("관리자 설정");

    state.providers = [
      { provider: "google", enabled: true },
      { provider: "kakao", enabled: false },
      { provider: "naver", enabled: false },
    ];
    const html = renderToStaticMarkup(<Login />);
    expect(html).toContain("Google");
    expect(html).not.toContain("카카오");
    expect(html).not.toContain("네이버");
    expect(html).toContain("또는");
  });

  it("로그인 화면의 색은 인디고 기준 색으로 통일한다(파랑·초록·보라 계열을 섞지 않는다)", () => {
    state.providers = [{ provider: "google", enabled: true }];
    const html = renderToStaticMarkup(<Login />);
    expect(html).toContain("bg-indigo-600");
    expect(html).not.toMatch(/(bg|text|border|from|to)-(blue|emerald|green|purple|violet|cyan)-\d/);
  });
});
