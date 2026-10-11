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
    expect(html).toContain("AI 평가·첨삭 총 3회");
    for (const price of ["14,900원", "24,900원", "39,900원"]) expect(html).toContain(price);
    for (const name of ["학습형", "AI 기본형", "AI 집중형", "AI 추가권"]) expect(html).toContain(name);
    expect(html).toContain("가격·환불정책");
    // 판매를 종료한 예전 요금제는 더 이상 보이지 않는다.
    expect(html).not.toContain("스타터");
    // 교사 첨삭지도 가격권 3종과 신청 자격 안내
    expect(html).toContain('data-testid="teacher-feedback-pricing"');
    for (const item of ["교사 첨삭지도권", "첨삭지도권 1회분", "첨삭지도권 3회분", "첨삭지도권 5회분", "6,900원", "19,900원", "31,900원"]) expect(html).toContain(item);
    expect(html).toContain("이용권 결제자만 구매·신청할 수 있습니다.");
    // 건별(핵심·일반·종합) 상품은 더 이상 판매하지 않는다.
    for (const removed of ["교사 핵심 첨삭지도", "교사 종합 첨삭지도", "3,900원/건"]) expect(html).not.toContain(removed);
    // 신청 기능이 열려 있으므로 '준비 중' 표시는 없다.
    expect(html).not.toContain("신청 기능 준비 중");
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

  it("바로가기 링크가 가리키는 제목이 모두 있고, 이용권 카드는 4종만 보여 준다", () => {
    const html = renderToStaticMarkup(<Pricing />);
    for (const id of ["trial-title", "price-guide-title", "teacher-pass-title", "privacy-title"]) {
      expect(html).toContain(`href="#${id}"`);
      expect(html).toContain(`id="${id}"`);
    }
    expect(html).toContain("유료 이용 시작");
    expect((html.match(/이용권 시작하기/g) ?? []).length).toBe(4);
    // 한 개의 h1만 있고, 교사 첨삭지도권 제목은 h2이다.
    expect((html.match(/<h1/g) ?? []).length).toBe(1);
    expect(html).toMatch(/<h2 id="teacher-pass-title"/);
  });
});
