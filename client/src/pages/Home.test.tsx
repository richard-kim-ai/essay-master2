// @vitest-environment jsdom
import React from "react";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { renderToStaticMarkup } from "react-dom/server";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/_core/hooks/useAuth", () => ({
  useAuth: vi.fn(),
}));

vi.mock("@/components/Navigation", () => ({
  default: () => <nav aria-label="주요 메뉴" />,
}));

vi.mock("@/components/OfflineStatus", () => ({
  default: () => null,
}));

vi.mock("@/components/InstallPrompt", () => ({
  default: () => null,
}));

vi.mock("wouter", () => ({
  Link: ({ href, children, ...props }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...props}>{children}</a>
  ),
}));

import { useAuth } from "@/_core/hooks/useAuth";
import Home from "./Home";

const mockUseAuth = vi.mocked(useAuth);

describe("Home CTA accessibility", () => {
  beforeEach(() => {
    (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    mockUseAuth.mockReturnValue({
      user: null,
      isAuthenticated: false,
    } as ReturnType<typeof useAuth>);
  });

  it("renders visitor CTA paths without a nested button or unverified metrics", () => {
    const html = renderToStaticMarkup(<Home />);

    expect(html).toContain('href="/curriculum"');
    expect(html).toContain('href="/login?trial=1"');
    expect(html).toContain("논술 마스터와 함께");
    expect(html).toContain("글쓰기 실력 UP");
    expect(html).toContain("AI 실시간 첨삭");
    expect(html).toContain("전문 교사 피드백");
    expect(html).toContain("맞춤형 학습 경로");
    expect(html).toContain("진도 추적 대시보드");
    expect(html).toContain("지금 시작하기");
    expect(html).toContain("focus-visible:ring-");
    expect(html).not.toMatch(/<a[^>]*>\s*<button/i);
    expect(html).not.toContain("10,000+");
    expect(html).not.toContain("4.9/5");
    expect(html).not.toContain("95%");
  });

  it("uses the relevant authenticated destination for the primary CTA", () => {
    mockUseAuth.mockReturnValue({
      user: { role: "admin" },
      isAuthenticated: true,
    } as ReturnType<typeof useAuth>);

    const html = renderToStaticMarkup(<Home />);

    expect(html).toContain('href="/admin"');
    expect(html).toContain("지금 시작하기");
    expect(html).not.toContain("로그인 / 회원가입");
  });

  it("moves focus through the visitor CTA sequence with Tab and keeps link cards focusable", async () => {
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root: Root = createRoot(container);

    await act(async () => {
      root.render(<Home />);
    });

    const primaryCta = container.querySelector<HTMLAnchorElement>('a[data-home-cta="primary"][href="/login?trial=1"]');
    const courseFinderCta = container.querySelector<HTMLAnchorElement>('a[data-home-cta="course-finder"][href="/sample"]');
    const exploreCoursesLink = Array.from(container.querySelectorAll<HTMLAnchorElement>('a[href="/curriculum"]')).find(
      (link) => !link.hasAttribute("data-slot") && link.textContent?.includes("전체 과정 보기"),
    );
    const learningCardLinks = ["/quiz", "/paragraph-reordering", "/summary-practice", "/topic-wizard"].map((href) =>
      container.querySelector<HTMLAnchorElement>(`a[href="${href}"]`),
    );

    if (!primaryCta || !courseFinderCta || !exploreCoursesLink || learningCardLinks.some((link) => !link)) {
      throw new Error("메인 페이지의 키보드 탐색 대상 링크를 찾을 수 없습니다.");
    }

    expect(primaryCta?.className).toContain("focus-visible:ring-");
    learningCardLinks.forEach((link) => {
      expect(link?.className).toContain("focus-visible:ring-");
      expect(link?.tabIndex).toBe(0);
      expect(link?.querySelector("button")).toBeNull();
    });

    const user = userEvent.setup();
    const expectedFocusSequence = [
      primaryCta,
      courseFinderCta,
      exploreCoursesLink,
      ...learningCardLinks,
    ];

    for (const expectedLink of expectedFocusSequence) {
      await user.tab();
      expect(document.activeElement).toBe(expectedLink);
    }

    await act(async () => root.unmount());
    container.remove();
  });
});
