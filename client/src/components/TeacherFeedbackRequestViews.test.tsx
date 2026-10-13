import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  mine: [] as any[],
  queue: [] as any[],
  admin: [] as any[],
  adminPasses: [] as any[],
  passes: { passes: [] as any[], totalRemaining: 0, canBuy: true, buyReasons: [] as string[] },
  loading: false,
  queueEnabled: undefined as boolean | undefined,
}));

vi.mock("wouter", () => ({
  Link: ({ href, children }: { href: string; children: React.ReactNode }) => <a href={href}>{children}</a>,
  useLocation: () => ["/", vi.fn()],
}));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock("@/lib/trpc", () => {
  const mutation = () => ({ useMutation: () => ({ mutate: vi.fn(), isPending: false }) });
  const invalidate = { invalidate: vi.fn() };
  return {
    trpc: {
      useUtils: () => ({ teacherFeedbackRequest: { mine: invalidate, queue: invalidate, passes: invalidate, quote: invalidate }, billing: { myOrders: invalidate } }),
      billing: { plans: { useQuery: () => ({ data: { isTest: true } }) } },
      teacherFeedbackRequest: {
        mine: { useQuery: () => ({ data: state.mine, isLoading: state.loading }) },
        queue: { useQuery: (_input: unknown, options?: { enabled?: boolean }) => { state.queueEnabled = options?.enabled; return { data: state.queue, isLoading: state.loading }; } },
        adminList: { useQuery: () => ({ data: state.admin, isLoading: state.loading }) },
        adminPasses: { useQuery: () => ({ data: state.adminPasses, isLoading: state.loading }) },
        passes: { useQuery: () => ({ data: state.passes, isLoading: state.loading }) },
        purchasePass: mutation(),
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
import TeacherFeedbackPassPurchase from "./TeacherFeedbackPassPurchase";

const due = new Date("2026-10-19T14:59:59Z");
const row = (overrides: Record<string, unknown> = {}) => ({
  id: 31,
  essayId: 5,
  essayTitle: "교육과 기술",
  studentName: "김학생",
  studentEmail: "s@example.com",
  passId: 4,
  status: "paid",
  dueAt: due,
  reworkCount: 0,
  reworkNote: null,
  overdue: false,
  createdAt: new Date("2026-10-14T01:00:00Z"),
  ...overrides,
});
const pass = (overrides: Record<string, unknown> = {}) => ({
  id: 4,
  userId: 10,
  userName: "김학생",
  userEmail: "s@example.com",
  productKey: "tf_pass_3",
  sessions: 3,
  sessionsUsed: 1,
  remaining: 2,
  priceKrw: 19900,
  orderId: 7,
  status: "active",
  expired: false,
  usable: true,
  unusedRefundKrw: 13267,
  expiresAt: new Date("2026-12-01T00:00:00Z"),
  createdAt: new Date("2026-10-14T01:00:00Z"),
  ...overrides,
});

beforeEach(() => {
  state.mine = [];
  state.queue = [];
  state.admin = [];
  state.adminPasses = [];
  state.passes = { passes: [], totalRemaining: 0, canBuy: true, buyReasons: [] };
  state.loading = false;
  state.queueEnabled = undefined;
});

describe("교사 첨삭지도권 구매·보유(학생)", () => {
  it("1·3·5회분 3종과 가격, 1회당 금액, 구매일부터 90일을 보여 주고 이용권 결제자만 가능하다고 표기한다", () => {
    const html = renderToStaticMarkup(<TeacherFeedbackPassPurchase />);
    expect(html).toContain("교사 첨삭지도권");
    expect(html).toContain("이용권 결제자만 구매·신청할 수 있습니다.");
    for (const text of ["1회분", "3회분", "5회분", "6,900원", "19,900원", "31,900원", "구매일부터 90일"]) expect(html).toContain(text);
    expect(html).toContain("1회 약 6,633원");
    expect(html).toContain("첨삭지도권 구매");
    expect(html).toContain("임시(테스트) 결제");
  });

  it("남은 횟수와 가장 먼저 만료되는 권의 유효기간을 보여 준다", () => {
    state.passes = { passes: [pass({ expiresAt: new Date("2026-12-01T00:00:00Z") }), pass({ id: 5, expiresAt: new Date("2026-11-10T00:00:00Z") })], totalRemaining: 4, canBuy: true, buyReasons: [] };
    const html = renderToStaticMarkup(<TeacherFeedbackPassPurchase />);
    expect(html).toContain("남은 첨삭 횟수 <strong>4회</strong>");
    expect(html).toContain("2026. 11. 10.");
  });

  it("이용권이 없으면 구매 버튼을 막고 이유와 이용권 결제 링크를 보여 준다", () => {
    state.passes = { passes: [], totalRemaining: 0, canBuy: false, buyReasons: ["이용권 결제자만 구매·신청할 수 있습니다. 이용권을 결제하고 이용 중이어야 합니다."] };
    const html = renderToStaticMarkup(<TeacherFeedbackPassPurchase />);
    expect(html).toContain("이용권 결제하러 가기");
    expect(html).toContain('href="/checkout"');
    expect(html).toMatch(/<button[^>]*disabled[^>]*>첨삭지도권 구매<\/button>/);
  });
});

describe("내 교사 첨삭 신청(학생)", () => {
  it("신청이 없으면 아무것도 그리지 않는다", () => {
    expect(renderToStaticMarkup(<MyTeacherFeedbackRequests />)).toBe("");
  });

  it("진행 중인 신청은 상태·완료 예정일과 횟수 복원 취소 버튼을 보여 준다(금액은 보여 주지 않는다)", () => {
    state.mine = [row()];
    const html = renderToStaticMarkup(<MyTeacherFeedbackRequests />);
    expect(html).toContain("교육과 기술");
    expect(html).toContain("신청 완료 · 교사 대기");
    expect(html).toContain("교사 첨삭지도권 1회 사용");
    expect(html).toContain("완료 예정일");
    expect(html).toContain("2026년 10월 19일");
    expect(html).toContain("신청 취소(횟수 복원)");
    expect(html).not.toContain("완료 예정일이 지났습니다");
    // 결제 금액(숫자+원)은 보여 주지 않는다.
    expect(html).not.toMatch(/\d원/);
  });

  it("완료 예정일이 지난 신청은 횟수를 돌려받거나 계속 기다리기 선택을 안내한다", () => {
    state.mine = [row({ overdue: true })];
    const html = renderToStaticMarkup(<MyTeacherFeedbackRequests />);
    expect(html).toContain("완료 예정일이 지났습니다");
    expect(html).toContain("첨삭지도권 1회를 돌려받거나");
    expect(html).toContain("취소하고 횟수 돌려받기");
  });

  it("전달 완료된 신청은 결과 보기와 보완 요청을 보여 주고 취소 버튼은 없다", () => {
    state.mine = [row({ status: "delivered" })];
    const html = renderToStaticMarkup(<MyTeacherFeedbackRequests />);
    expect(html).toContain("전달 완료");
    expect(html).toContain('href="/teacher-feedback/5"');
    expect(html).toContain("보완 요청");
    expect(html).not.toContain("신청 취소");
    expect(html).not.toContain("돌려받기");
    // 전달된 신청에는 완료 예정일 안내를 더 하지 않는다.
    expect(html).not.toContain("까지");
  });

  it("취소·환불된 신청에는 어떤 작업 버튼도 없다", () => {
    state.mine = [row({ status: "cancelled" })];
    const html = renderToStaticMarkup(<MyTeacherFeedbackRequests />);
    expect(html).toContain("취소");
    expect(html).not.toContain("신청 취소");
    expect(html).not.toContain("보완 요청");
  });
});

describe("교사 첨삭 신청 대기열(교사)", () => {
  it("대기 건이 없으면 안내 문구를 보여 준다", () => {
    expect(renderToStaticMarkup(<TeacherFeedbackQueue enabled />)).toContain("대기 중인 첨삭 신청이 없습니다");
    expect(state.queueEnabled).toBe(true);
  });

  it("승인되지 않은 역할에서는 교사 전용 API를 호출하지 않는다", () => {
    expect(renderToStaticMarkup(<TeacherFeedbackQueue enabled={false} />)).toBe("");
    expect(state.queueEnabled).toBe(false);
  });

  it("글·학생·완료 예정일을 보여 주고, 교사 지급과 연결되는 금액은 보여 주지 않는다", () => {
    state.queue = [row()];
    const html = renderToStaticMarkup(<TeacherFeedbackQueue enabled />);
    expect(html).toContain("첨삭 신청 대기열 (1건)");
    expect(html).toContain("교육과 기술");
    expect(html).toContain("김학생");
    expect(html).toContain("2026년 10월 19일");
    expect(html).toContain("첨삭하기");
    expect(html).not.toMatch(/\d원/);
  });

  it("지연 건과 보완 요청을 눈에 띄게 표시한다", () => {
    state.queue = [row({ overdue: true, status: "in_progress", reworkCount: 1, reworkNote: "근거 피드백 보완" })];
    const html = renderToStaticMarkup(<TeacherFeedbackQueue enabled />);
    expect(html).toContain("기한 경과");
    expect(html).toContain("작업 중");
    expect(html).toContain("이어서 첨삭하기");
    expect(html).toContain("학생이 보완을 요청했습니다: 근거 피드백 보완");
  });
});

describe("교사 첨삭 신청·첨삭지도권 목록(관리자)", () => {
  it("신청 목록은 학생·글·상태·완료 예정일·사용한 권과 지연 건 수를 보여 준다", () => {
    state.admin = [row({ overdue: true }), row({ id: 32, status: "delivered", passId: 5 })];
    const html = renderToStaticMarkup(<AdminTeacherFeedbackRequests />);
    expect(html).toContain("2건 · 완료 예정일 경과 1건");
    expect(html).toContain("김학생");
    expect(html).toContain("s@example.com");
    expect(html).toContain("기한 경과");
    expect(html).toContain("권 #4");
    expect(html).toContain("권 #5");
  });

  it("판매된 첨삭지도권은 금액·사용 횟수·유효기간·미사용 환불 예상액을 보여 준다", () => {
    state.adminPasses = [pass(), pass({ id: 6, status: "refunded", unusedRefundKrw: 0, productKey: "tf_pass_5", sessions: 5, sessionsUsed: 0, priceKrw: 31900 }), pass({ id: 7, expired: true })];
    const html = renderToStaticMarkup(<AdminTeacherFeedbackRequests />);
    expect(html).toContain("판매된 교사 첨삭지도권");
    expect(html).toContain("교사 첨삭지도권 3회분");
    expect(html).toContain("19,900원");
    expect(html).toContain("1 / 3회");
    expect(html).toContain("13,267원");
    expect(html).toContain("교사 첨삭지도권 5회분");
    expect(html).toContain("환불");
    expect(html).toContain("만료");
    expect(html).toContain("#7");
  });

  it("신청과 권이 없으면 빈 상태를 보여 준다", () => {
    const html = renderToStaticMarkup(<AdminTeacherFeedbackRequests />);
    expect(html).toContain("교사 첨삭 신청이 없습니다");
    expect(html).toContain("판매된 교사 첨삭지도권이 없습니다");
  });
});
