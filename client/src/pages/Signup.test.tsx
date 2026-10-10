import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const routerState = vi.hoisted(() => ({ search: "" }));

vi.mock("wouter", () => ({
  Link: ({ href, children, ...props }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...props}>{children}</a>
  ),
  useLocation: () => ["/signup", vi.fn()],
  useSearch: () => routerState.search,
}));

vi.mock("@/components/PolicyConsentChecklist", () => ({
  PolicyConsentChecklist: () => <div data-testid="consents" />,
}));

vi.mock("@/lib/trpc", () => ({
  trpc: {
    social: { providers: { useQuery: () => ({ data: [] }) } },
    auth: {
      recommendedTeachers: { useQuery: () => ({ data: [] }) },
      signup: { useMutation: () => ({ mutate: vi.fn(), isPending: false }) },
    },
  },
}));

import Signup from "./Signup";

describe("Signup birth date and guardian input", () => {
  beforeEach(() => {
    routerState.search = "";
  });

  it("학생 가입에는 생년월일 입력란과 만 14세 미만 안내가 보인다", () => {
    const html = renderToStaticMarkup(<Signup />);
    expect(html).toContain('name="birthDate"');
    expect(html).toContain("만 14세 미만은 보호자(법정대리인)의 동의가 필요합니다");
  });

  it("생년월일을 입력하기 전에는 보호자 입력란을 보여주지 않는다", () => {
    const html = renderToStaticMarkup(<Signup />);
    expect(html).not.toContain('aria-label="법정대리인 정보"');
  });
});
