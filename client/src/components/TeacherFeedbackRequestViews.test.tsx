import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  mine: [] as any[],
  queue: [] as any[],
  admin: [] as any[],
  loading: false,
}));

vi.mock("wouter", () => ({
  Link: ({ href, children }: { href: string; children: React.ReactNode }) => <a href={href}>{children}</a>,
  useLocation: () => ["/", vi.fn()],
}));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock("@/lib/trpc", () => {
  const mutation = () => ({ useMutation: () => ({ mutate: vi.fn(), isPending: false }) });
  return {
    trpc: {
      useUtils: () => ({ teacherFeedbackRequest: { mine: { invalidate: vi.fn() }, queue: { invalidate: vi.fn() } }, billing: { myOrders: { invalidate: vi.fn() } } }),
      teacherFeedbackRequest: {
        mine: { useQuery: () => ({ data: state.mine, isLoading: state.loading }) },
        queue: { useQuery: () => ({ data: state.queue, isLoading: state.loading }) },
        adminList: { useQuery: () => ({ data: state.admin, isLoading: state.loading }) },
        cancel: mutation(),
        requestRework: mutation(),
        start: mutation(),
      },
    },
  };
});

import MyTeacherFeedbackRequests from "./MyTeacherFeedbackRequests";
import TeacherFeedbackQueue from "./TeacherFeedbackQueue";
import AdminTeacherFeedbackRequests from "./AdminTeacherFeedbackRequests";

const due = new Date("2026-10-19T14:59:59Z");
const row = (overrides: Record<string, unknown> = {}) => ({
  id: 31,
  essayId: 5,
  essayTitle: "교육과 기술",
  studentName: "김학생",
  studentEmail: "s@example.com",
  productKey: "tf_core",
  priceKrw: 3900,
  status: "paid",
  orderId: 7,
  dueAt: due,
  reworkCount: 0,
  reworkNote: null,
  scopeLabel: "논리·표현",
  overdue: false,
  createdAt: new Date("2026-10-14T01:00:00Z"),
  ...overrides,
});

beforeEach(() => {
  state.mine = [];
  state.queue = [];
  state.admin = [];
  state.loading = false;
});

describe("내 교사 첨삭 신청(학생)", () => {
  it("신청이 없으면 아무것도 그리지 않는다", () => {
    expect(renderToStaticMarkup(<MyTeacherFeedbackRequests />)).toBe("");
  });

  it("진행 중인 신청은 상태·완료 예정일·선택 항목과 전액 환불 취소 버튼을 보여 준다", () => {
    state.mine = [row()];
    const html = renderToStaticMarkup(<MyTeacherFeedbackRequests />);
    expect(html).toContain("교육과 기술");
    expect(html).toContain("결제 완료 · 교사 대기");
    expect(html).toContain("교사 핵심 첨삭지도");
    expect(html).toContain("3,900원");
    expect(html).toContain("논리·표현");
    expect(html).toContain("완료 예정일");
    expect(html).toContain("2026년 10월 19일");
    expect(html).toContain("신청 취소(전액 환불)");
    expect(html).not.toContain("완료 예정일이 지났습니다");
  });

  it("완료 예정일이 지난 신청은 전액 환불 또는 계속 기다리기 선택을 안내한다", () => {
    state.mine = [row({ overdue: true })];
    const html = renderToStaticMarkup(<MyTeacherFeedbackRequests />);
    expect(html).toContain("완료 예정일이 지났습니다");
    expect(html).toContain("전액 환불받기");
  });

  it("전달 완료된 신청은 결과 보기와 보완 요청을 보여 주고 취소 버튼은 없다", () => {
    state.mine = [row({ status: "delivered" })];
    const html = renderToStaticMarkup(<MyTeacherFeedbackRequests />);
    expect(html).toContain("전달 완료");
    expect(html).toContain('href="/teacher-feedback/5"');
    expect(html).toContain("보완 요청");
    expect(html).not.toContain("신청 취소");
    expect(html).not.toContain("전액 환불받기");
    // 전달된 신청에는 완료 예정일 안내를 더 하지 않는다.
    expect(html).not.toContain("까지");
  });

  it("취소·환불된 신청에는 어떤 작업 버튼도 없다", () => {
    state.mine = [row({ status: "refunded" })];
    const html = renderToStaticMarkup(<MyTeacherFeedbackRequests />);
    expect(html).toContain("환불 완료");
    expect(html).not.toContain("신청 취소");
    expect(html).not.toContain("보완 요청");
  });
});

describe("교사 첨삭 신청 대기열(교사)", () => {
  it("대기 건이 없으면 안내 문구를 보여 준다", () => {
    expect(renderToStaticMarkup(<TeacherFeedbackQueue />)).toContain("대기 중인 첨삭 신청이 없습니다");
  });

  it("글·학생·선택 항목·완료 예정일을 보여 주고, 교사 지급과 연결되는 금액은 보여 주지 않는다", () => {
    state.queue = [row({ priceKrw: 3900 })];
    const html = renderToStaticMarkup(<TeacherFeedbackQueue />);
    expect(html).toContain("첨삭 신청 대기열 (1건)");
    expect(html).toContain("교육과 기술");
    expect(html).toContain("김학생");
    expect(html).toContain("선택 항목: 논리·표현");
    expect(html).toContain("2026년 10월 19일");
    expect(html).toContain("첨삭하기");
    expect(html).not.toContain("3,900원");
  });

  it("지연 건과 보완 요청을 눈에 띄게 표시한다", () => {
    state.queue = [row({ overdue: true, status: "in_progress", reworkCount: 1, reworkNote: "근거 피드백 보완" })];
    const html = renderToStaticMarkup(<TeacherFeedbackQueue />);
    expect(html).toContain("기한 경과");
    expect(html).toContain("작업 중");
    expect(html).toContain("이어서 첨삭하기");
    expect(html).toContain("학생이 보완을 요청했습니다: 근거 피드백 보완");
  });
});

describe("교사 첨삭 신청 목록(관리자)", () => {
  it("학생·글·상품·금액·상태·완료 예정일과 지연 건 수를 보여 준다", () => {
    state.admin = [row({ overdue: true }), row({ id: 32, status: "delivered", productKey: "tf_comprehensive", priceKrw: 9900 })];
    const html = renderToStaticMarkup(<AdminTeacherFeedbackRequests />);
    expect(html).toContain("2건 · 완료 예정일 경과 1건");
    expect(html).toContain("김학생");
    expect(html).toContain("s@example.com");
    expect(html).toContain("교사 종합 첨삭지도");
    expect(html).toContain("9,900원");
    expect(html).toContain("기한 경과");
    expect(html).toContain("#7");
  });

  it("신청이 없으면 빈 상태를 보여 준다", () => {
    expect(renderToStaticMarkup(<AdminTeacherFeedbackRequests />)).toContain("교사 첨삭 신청이 없습니다");
  });
});
