import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({ data: [] as unknown[], isLoading: false, error: null as null | { message: string } }));

vi.mock("wouter", () => ({
  Link: ({ href, children, ...props }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...props}>{children}</a>
  ),
}));

vi.mock("@/lib/trpc", () => ({
  trpc: {
    useUtils: () => ({ guardian: { adminList: { invalidate: vi.fn() } } }),
    guardian: {
      adminList: { useQuery: () => ({ data: state.data, isLoading: state.isLoading, error: state.error }) },
      adminResend: { useMutation: () => ({ mutate: vi.fn(), isPending: false }) },
      adminWithdraw: { useMutation: () => ({ mutate: vi.fn(), isPending: false }) },
    },
  },
}));

import AdminGuardianConsents from "./AdminGuardianConsents";

const baseRow = {
  childId: 7,
  childName: "홍길동",
  childEmail: "child@example.com",
  childBirthDate: "2015-05-12",
  guardianName: "홍부모",
  guardianRelation: "부",
  guardianEmail: "parent@example.com",
  consentVersion: "2026-10-v1",
  consentMethod: "email_confirmation",
  requestedAt: new Date("2026-10-11T01:00:00Z"),
  updatedAt: new Date("2026-10-11T02:00:00Z"),
};

describe("AdminGuardianConsents page", () => {
  beforeEach(() => {
    state.data = [];
    state.isLoading = false;
    state.error = null;
  });

  it("기록이 없으면 안내 문구를 보여준다", () => {
    expect(renderToStaticMarkup(<AdminGuardianConsents />)).toContain("아직 동의 기록이 없습니다.");
  });

  it("상태별로 가능한 처리 버튼만 보여준다", () => {
    state.data = [
      { ...baseRow, id: 1, status: "pending", approvedAt: null },
      { ...baseRow, id: 2, status: "approved", approvedAt: new Date("2026-10-11T01:30:00Z") },
      { ...baseRow, id: 3, status: "withdrawn", approvedAt: new Date("2026-10-11T01:30:00Z") },
    ];
    const html = renderToStaticMarkup(<AdminGuardianConsents />);

    expect(html).toContain("동의 대기");
    expect(html).toContain("동의 완료");
    expect(html).toContain("철회");
    // 동의 대기 1건만 재발송, 철회가 아닌 2건(대기·완료)만 철회 버튼
    expect(html.match(/메일 재발송/g)?.length).toBe(1);
    expect(html.match(/동의 철회/g)?.length).toBe(2);
    expect(html).toContain("email_confirmation");
    expect(html).toContain("2026-10-v1");
  });

  it("권한이 없으면 오류 메시지를 보여준다", () => {
    state.error = { message: "관리자 권한이 필요합니다." };
    expect(renderToStaticMarkup(<AdminGuardianConsents />)).toContain("관리자 권한이 필요합니다.");
  });
});
