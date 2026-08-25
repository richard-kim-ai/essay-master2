import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/components/Navigation", () => ({
  default: () => <nav aria-label="주요 메뉴" />,
}));

vi.mock("wouter", () => ({
  Link: ({ href, children, ...props }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...props}>{children}</a>
  ),
}));

import Pricing from "./Pricing";

describe("Pricing policy page", () => {
  it("shows trial distinction, review pricing labels, and privacy safeguards without unsupported certifications", () => {
    const html = renderToStaticMarkup(<Pricing />);

    expect(html).toContain("7일 무료 체험");
    expect(html).toContain("레슨 1 첫 서술형 제출 AI 평가 1회");
    expect(html).toContain("9,900원");
    expect(html).toContain("24,900원");
    expect(html).toContain("검토안");
    expect(html).toContain("최소 수집");
    expect(html).toContain("AI 전송 고지");
    expect(html).toContain('href="https://www.grammarly.com/plans"');
    expect(html).not.toContain("SOC 2 Type I");
    expect(html).not.toContain("개인정보 보호법 완전 준수");
  });
});
