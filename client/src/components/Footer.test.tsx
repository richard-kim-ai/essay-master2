import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("wouter", () => ({
  Link: ({ href, children, ...props }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...props}>{children}</a>
  ),
}));

import Footer from "./Footer";

describe("Footer", () => {
  it("모든 화면에서 약관·개인정보처리방침·문의 메일·저작권을 보여준다", () => {
    for (const variant of ["default", "compact"] as const) {
      const html = renderToStaticMarkup(<Footer variant={variant} />);
      expect(html).toContain("이용약관");
      expect(html).toContain("개인정보처리방침");
      expect(html).toContain('href="mailto:ceo@ufinsu.com"');
      expect(html).toContain(`© ${new Date().getFullYear()} 논술 마스터`);
    }
  });

  it("일반 푸터에는 주요 화면 바로가기가 있고 인증 화면용 푸터에는 없다", () => {
    const full = renderToStaticMarkup(<Footer />);
    expect(full).toContain('href="/curriculum"');
    expect(full).toContain('href="/pricing"');
    expect(full).toContain('href="/sample"');

    const compact = renderToStaticMarkup(<Footer variant="compact" />);
    expect(compact).not.toContain('href="/curriculum"');
  });

  it("사업자 정보가 비어 있으면 해당 문구를 표시하지 않는다(추후 입력 예정)", () => {
    const html = renderToStaticMarkup(<Footer />);
    expect(html).not.toContain("사업자등록번호");
    expect(html).not.toContain("통신판매업");
  });
});
