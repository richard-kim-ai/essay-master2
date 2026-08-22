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

  it("renders the visitor CTAs as focusable anchors without a nested button", () => {
    const html = renderToStaticMarkup(<Home />);

    expect(html).toContain('href="/curriculum"');
    expect(html).toContain('href="/login"');
    expect(html).toContain("focus-visible:ring-");
    expect(html).not.toMatch(/<a[^>]*>\s*<button/i);
  });

  it("uses the relevant authenticated destination for the primary CTA", () => {
    mockUseAuth.mockReturnValue({
      user: { role: "admin" },
      isAuthenticated: true,
    } as ReturnType<typeof useAuth>);

    const html = renderToStaticMarkup(<Home />);

    expect(html).toContain('href="/admin"');
    expect(html).toContain("운영 현황 보기");
    expect(html).not.toContain("로그인 / 회원가입");
  });

  it("moves focus through the visitor CTA sequence with Tab and keeps link cards focusable", async () => {
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root: Root = createRoot(container);

    await act(async () => {
      root.render(<Home />);
    });

    const accountLink = container.querySelector<HTMLAnchorElement>('a[href="/login"]:not([data-slot="button"])');
    const primaryCta = container.querySelector<HTMLAnchorElement>('a[data-home-cta="primary"][href="/curriculum"]');
    const secondaryCta = container.querySelector<HTMLAnchorElement>('a[data-home-cta="secondary"][href="/login"]');
    const exploreCoursesLink = Array.from(container.querySelectorAll<HTMLAnchorElement>('a[href="/curriculum"]')).find(
      (link) => !link.hasAttribute("data-slot") && link.textContent?.includes("전체 과정 보기"),
    );
    const learningCardLinks = ["/quiz", "/paragraph-reordering", "/summary-practice", "/topic-wizard"].map((href) =>
      container.querySelector<HTMLAnchorElement>(`a[href="${href}"]`),
    );

    if (!accountLink || !primaryCta || !secondaryCta || !exploreCoursesLink || learningCardLinks.some((link) => !link)) {
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
      accountLink,
      primaryCta,
      secondaryCta,
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
