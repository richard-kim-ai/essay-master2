import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { GuardianConsentFields, EMPTY_GUARDIAN } from "@/components/GuardianConsentFields";

const state = vi.hoisted(() => ({ search: "", data: undefined as unknown, isLoading: false }));

vi.mock("wouter", () => ({
  useSearch: () => state.search,
}));

vi.mock("@/lib/trpc", () => ({
  trpc: {
    guardian: {
      getConsent: { useQuery: () => ({ data: state.data, isLoading: state.isLoading, refetch: vi.fn() }) },
      confirm: { useMutation: () => ({ mutate: vi.fn(), isPending: false }) },
    },
  },
}));

import GuardianConsent from "./GuardianConsent";

const VALID_TOKEN = "a".repeat(40);

const pendingConsent = {
  state: "pending",
  childNameMasked: "홍*동",
  childBirthYear: "2015",
  relation: "부",
  title: "만 14세 미만 아동 개인정보 수집·이용 및 법정대리인 동의서",
  intro: "동의 안내 문구",
  sections: [{ title: "1. 수집하는 개인정보 항목", items: ["아동 정보: 이름, 이메일"] }],
  labels: {
    agreeCollection: "(필수) 아동의 개인정보 수집 및 이용에 동의합니다.",
    agreeGuardian: "(필수) 본인은 위 아동의 법정대리인임을 확인하며, 동의합니다.",
  },
};

describe("GuardianConsent page", () => {
  beforeEach(() => {
    state.search = `token=${VALID_TOKEN}`;
    state.data = pendingConsent;
    state.isLoading = false;
  });

  it("동의 대기 상태에서는 동의서 문구와 필수 동의 항목, 성명 입력을 보여주고 아동 이름은 가려서 보여준다", () => {
    const html = renderToStaticMarkup(<GuardianConsent />);
    expect(html).toContain("법정대리인 동의서");
    expect(html).toContain("1. 수집하는 개인정보 항목");
    expect(html).toContain("(필수) 본인은 위 아동의 법정대리인임을 확인하며, 동의합니다.");
    expect(html).toContain("홍*동");
    expect(html).not.toContain("홍길동");
    expect(html).toContain("동의합니다");
  });

  it("토큰이 없으면 유효하지 않은 링크 안내를 보여준다", () => {
    state.search = "";
    expect(renderToStaticMarkup(<GuardianConsent />)).toContain("유효하지 않은 동의 링크입니다.");
  });

  it("만료·완료 상태를 각각 안내한다", () => {
    state.data = { state: "expired" };
    expect(renderToStaticMarkup(<GuardianConsent />)).toContain("동의 링크가 만료되었습니다.");

    state.data = { state: "approved" };
    expect(renderToStaticMarkup(<GuardianConsent />)).toContain("법정대리인 동의가 완료되었습니다.");
  });
});

describe("GuardianConsentFields", () => {
  it("보호자 성명·관계·이메일 입력과 동의 안내를 보여준다", () => {
    const html = renderToStaticMarkup(<GuardianConsentFields value={EMPTY_GUARDIAN} onChange={() => undefined} />);
    expect(html).toContain("보호자 성명");
    expect(html).toContain("보호자 이메일");
    expect(html).toContain("그 밖의 법정대리인");
    expect(html).toContain("보호자가 동의하기 전에는 서비스를 이용할 수 없습니다");
  });
});
