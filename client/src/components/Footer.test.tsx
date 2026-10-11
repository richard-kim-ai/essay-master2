import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("wouter", () => ({
  Link: ({ href, children, ...props }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...props}>{children}</a>
  ),
}));

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import Footer, { FOOTER_MENU } from "./Footer";
import { COPYRIGHT_INFO } from "@/lib/contact";

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

  it("푸터 메뉴는 헤더 메뉴와 같은 명칭·순서이고, 교사 회원가입 진입점이 있다", () => {
    const nav = readFileSync(fileURLToPath(new URL("./Navigation.tsx", import.meta.url)), "utf8");
    const headerLabels = Array.from(nav.matchAll(/\{ label: "([^"]+)", href: "(\/[^"]*)"/g)).map((match) => match[1]);
    // 헤더: 커리큘럼 → 추천 아카이브 → 요금정책 → (학습 도구) 6개 도구
    const footerLabels = FOOTER_MENU.flatMap((group) => group.links.map((link) => link.label));
    const expectedOrder = ["커리큘럼", "추천 아카이브", "요금정책", "AI 문장 교정", "단락 재구성", "요약 연습", "오답 노트", "주제 설정", "주제문 점검"];
    expect(headerLabels.slice(0, expectedOrder.length)).toEqual(expectedOrder);
    expect(footerLabels.slice(0, expectedOrder.length)).toEqual(expectedOrder);

    const html = renderToStaticMarkup(<Footer />);
    expect(html).toContain('href="/teacher-signup"');
    expect(html).toContain("교사 회원가입");
    expect(html).toContain('href="/signup"');
  });

  it("저작권 등록 정보(저작물명·저자·번호·확인 링크)를 보여주고, 번호가 비면 숨긴다", () => {
    for (const variant of ["default", "compact"] as const) {
      const html = renderToStaticMarkup(<Footer variant={variant} />);
      expect(html).toContain("『논술의 기초』");
      expect(html).toContain("저작권등록번호 C-2026-044488");
      expect(html).toContain('aria-label="저작권등록번호 복사"');
      expect(html).toContain(`href="${COPYRIGHT_INFO.verifyUrl}"`);
      expect(html).toContain('rel="noopener noreferrer"');
    }

    const saved = COPYRIGHT_INFO.registrationNumber;
    COPYRIGHT_INFO.registrationNumber = undefined;
    try {
      expect(renderToStaticMarkup(<Footer />)).not.toContain("저작권등록번호");
    } finally {
      COPYRIGHT_INFO.registrationNumber = saved;
    }
  });

  it("사업자 정보가 비어 있으면 해당 문구를 표시하지 않는다(추후 입력 예정)", () => {
    const html = renderToStaticMarkup(<Footer />);
    expect(html).not.toContain("사업자등록번호");
    expect(html).not.toContain("통신판매업");
  });
});
