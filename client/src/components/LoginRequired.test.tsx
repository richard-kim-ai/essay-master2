import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const router = vi.hoisted(() => ({ location: "/workbook/elementary/1", search: "" }));

vi.mock("wouter", () => ({
  Link: ({ href, children, ...props }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...props}>{children}</a>
  ),
  useLocation: () => [router.location, vi.fn()],
  useSearch: () => router.search,
}));

import LoginRequired from "./LoginRequired";

describe("LoginRequired", () => {
  beforeEach(() => {
    router.location = "/workbook/elementary/1";
    router.search = "";
  });

  it("로그인·회원가입·샘플 체험으로 이어지는 링크를 보여준다", () => {
    const html = renderToStaticMarkup(<LoginRequired />);
    expect(html).toContain("로그인이 필요합니다");
    expect(html).toContain('href="/signup?trial=1"');
    expect(html).toContain('href="/sample"');
  });

  it("로그인 뒤 지금 보던 화면으로 돌아오도록 현재 경로를 넘긴다", () => {
    router.search = "tab=notes";
    const html = renderToStaticMarkup(<LoginRequired />);
    expect(html).toContain(`href="/login?next=${encodeURIComponent("/workbook/elementary/1?tab=notes")}"`);
  });

  it("안내 문구를 바꿀 수 있다", () => {
    expect(renderToStaticMarkup(<LoginRequired message="학부모 계정으로 로그인해 주세요." />)).toContain("학부모 계정으로 로그인해 주세요.");
  });
});
