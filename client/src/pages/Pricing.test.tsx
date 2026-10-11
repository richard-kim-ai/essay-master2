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
    expect(html).toContain("이용권 요금 안내");
    expect(html).toContain("최소 수집");
    expect(html).toContain("AI 전송 안내");
    expect(html).toContain('href="mailto:ceo@ufinsu.com"');
    // 내부 검토용 표현과 외부 서비스 참고 링크는 공개 화면에 두지 않는다.
    for (const internal of ["검토안", "원가", "Grammarly", "grammarly", "출시 전 필수 확인", "법률 자문", "공개 요금 비교 기준"]) {
      expect(html).not.toContain(internal);
    }
    expect(html).not.toContain("SOC 2 Type I");
    expect(html).not.toContain("개인정보 보호법 완전 준수");
  });
});
