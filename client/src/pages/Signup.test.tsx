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

vi.mock("@/components/PolicyConsentChecklist", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/components/PolicyConsentChecklist")>()),
  PolicyConsentChecklist: () => <div data-testid="consents" />,
}));

vi.mock("@/lib/trpc", () => ({
  trpc: {
    social: { providers: { useQuery: () => ({ data: [] }) } },
    policy: { forSignup: { useQuery: () => ({ data: [], isLoading: false }) } },
    auth: {
      signup: { useMutation: () => ({ mutate: vi.fn(), isPending: false }) },
    },
  },
}));

import Signup from "./Signup";

import { validateGuardianInfo, EMPTY_GUARDIAN_INFO } from "@/components/GuardianInfoDialog";
import { hasReadToEnd } from "@/components/PolicyConsentChecklist";

describe("Signup birth date and guardian input", () => {
  beforeEach(() => {
    routerState.search = "";
  });

  it("초등 과정(기본 선택)에서는 보호자 정보를 팝업으로 입력하도록 안내하고, 입력란은 펼쳐 두지 않는다", () => {
    const html = renderToStaticMarkup(<Signup />);
    expect(html).toContain('aria-label="보호자 정보"');
    expect(html).toContain("보호자 정보 입력");
    expect(html).toContain("초등 과정은 보호자(법정대리인)의 동의가 필요합니다");
    expect(html).not.toContain('name="birthDate"');
    expect(html).not.toContain('aria-label="법정대리인 정보"');
  });

  it("초등이 아닌 과정으로 들어오면 보호자 영역을 보여주지 않는다", () => {
    routerState.search = "trial=1&course=middle_high";
    const html = renderToStaticMarkup(<Signup />);
    expect(html).not.toContain('aria-label="보호자 정보"');
  });

  it("가입 화면에는 교사 선택이 없고 가입 후 마이페이지에서 고르도록 안내한다", () => {
    const html = renderToStaticMarkup(<Signup />);
    expect(html).not.toContain("추천 교사 선택");
    expect(html).toContain("담당 교사는 가입 후 마이페이지에서 선택할 수 있습니다");
  });
});

describe("보호자 정보 검증", () => {
  const filled = { birthDate: "2016-05-01", guardian: { name: "김보호", relation: "모" as const, email: "parent@example.com" } };

  it("빠진 항목은 안내 문구를 돌려주고, 모두 맞으면 null이다", () => {
    expect(validateGuardianInfo(EMPTY_GUARDIAN_INFO, "kid@example.com")).toContain("생년월일");
    expect(validateGuardianInfo({ ...filled, birthDate: "2016-13-45" }, "kid@example.com")).toContain("정확히");
    expect(validateGuardianInfo({ ...filled, guardian: { ...filled.guardian, name: "김" } }, "kid@example.com")).toContain("성명");
    expect(validateGuardianInfo({ ...filled, guardian: { ...filled.guardian, email: "" } }, "kid@example.com")).toContain("이메일");
    expect(validateGuardianInfo(filled, "kid@example.com")).toBeNull();
  });

  it("보호자 이메일이 학생 이메일과 같으면 거절한다(대소문자 무시)", () => {
    expect(validateGuardianInfo(filled, "PARENT@example.com")).toContain("달라야");
  });
});

describe("동의 문서 읽음 판정", () => {
  it("맨 아래까지 스크롤했거나 스크롤 없이 전부 보이면 읽은 것으로 본다", () => {
    expect(hasReadToEnd({ scrollTop: 0, clientHeight: 200, scrollHeight: 200 })).toBe(true);
    expect(hasReadToEnd({ scrollTop: 395, clientHeight: 200, scrollHeight: 600 })).toBe(true);
    expect(hasReadToEnd({ scrollTop: 100, clientHeight: 200, scrollHeight: 600 })).toBe(false);
  });
});
