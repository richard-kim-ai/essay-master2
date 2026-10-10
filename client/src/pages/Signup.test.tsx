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

const NOTICE = "만 14세 미만 어린이는 보호자 동의가 필요합니다";

describe("Signup guardian notice", () => {
  beforeEach(() => {
    routerState.search = "";
  });

  it("초등 과정(기본 선택)에서는 만 14세 미만 보호자 동의 안내를 보여준다", () => {
    const html = renderToStaticMarkup(<Signup />);
    expect(html).toContain(NOTICE);
    expect(html).toContain("학부모 회원으로 가입해 자녀 계정을 연결");
  });

  it("초등이 아닌 과정으로 들어오면 보호자 동의 안내를 보여주지 않는다", () => {
    routerState.search = "trial=1&course=middle_high";
    const html = renderToStaticMarkup(<Signup />);
    expect(html).not.toContain(NOTICE);
  });
});
