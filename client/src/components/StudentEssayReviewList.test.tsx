import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({ rows: [] as any[], loading: false, fetching: false, refetch: (() => undefined) as () => void, error: null as null | { message: string }, lastInput: null as any }));

vi.mock("wouter", () => ({ Link: ({ href, children }: any) => <a href={href}>{children}</a> }));
vi.mock("@/lib/trpc", () => ({
  trpc: {
    essaySubmission: {
      reviewList: {
        useQuery: (input: unknown) => {
          state.lastInput = input;
          return { data: state.loading || state.error ? undefined : state.rows, isLoading: state.loading, error: state.error, isFetching: state.fetching, dataUpdatedAt: state.rows.length ? new Date("2026-10-12T05:30:00Z").getTime() : 0, refetch: state.refetch };
        },
      },
    },
  },
}));

import StudentEssayReviewList from "./StudentEssayReviewList";

const row = (overrides: Record<string, unknown> = {}) => ({
  essayId: 5,
  title: "교육과 기술",
  status: "submitted",
  submittedAt: new Date("2026-10-10T01:00:00Z"),
  updatedAt: new Date("2026-10-10T01:00:00Z"),
  aiFeedbackId: null,
  studentId: 21,
  studentName: "김학생",
  studentEmail: "s@example.com",
  preview: "기술은 교육을 바꾼다.",
  hasTeacherFeedback: false,
  teacherFeedbackScore: null,
  requestStatus: null,
  requestDueAt: null,
  ...overrides,
});

beforeEach(() => {
  state.rows = [];
  state.loading = false;
  state.fetching = false;
  state.error = null;
});

describe("학생 제출 글 목록(교사·관리자)", () => {
  it("기본은 첨삭 대기 글을 조회하고, 글마다 학생·제출일·미리보기와 첨삭하기 링크를 보여 준다", () => {
    state.rows = [row()];
    const html = renderToStaticMarkup(<StudentEssayReviewList scope="teacher" />);
    expect(state.lastInput).toEqual({ status: "submitted", search: undefined });
    expect(html).toContain("학생 제출 글 (1편)");
    expect(html).toContain("내가 담당하는 학생이 제출한 글입니다.");
    expect(html).toContain("교육과 기술");
    expect(html).toContain("김학생");
    expect(html).toContain("s@example.com");
    expect(html).toContain("기술은 교육을 바꾼다.");
    expect(html).toContain("첨삭 대기");
    expect(html).toContain('href="/teacher-feedback/5"');
    expect(html).toContain("첨삭하기");
  });

  it("관리자는 전체 학생 글이라고 안내한다", () => {
    state.rows = [row()];
    expect(renderToStaticMarkup(<StudentEssayReviewList scope="admin" />)).toContain("모든 학생이 제출한 글입니다.");
  });

  it("첨삭이 끝난 글은 점수와 '첨삭 보기·수정'을, 진행 중 신청은 상태·완료 예정일·기한 경과를 보여 준다", () => {
    state.rows = [
      row({ essayId: 6, title: "환경", hasTeacherFeedback: true, teacherFeedbackScore: 88, requestStatus: "delivered" }),
      row({ essayId: 7, title: "오래된 신청", requestStatus: "in_progress", requestDueAt: new Date("2020-01-01T00:00:00Z") }),
    ];
    const html = renderToStaticMarkup(<StudentEssayReviewList scope="teacher" />);
    expect(html).toContain("첨삭 완료 · 88점");
    expect(html).toContain("전달 완료");
    expect(html).toContain("첨삭 보기·수정");
    expect(html).toContain("작업 중");
    expect(html).toContain("기한 경과");
    expect(html).toContain("완료 예정 2020년 1월 1일");
  });

  it("목록이 비면 안내하고, 오류 메시지는 그대로 보여 준다", () => {
    expect(renderToStaticMarkup(<StudentEssayReviewList scope="teacher" />)).toContain("첨삭을 기다리는 글이 없습니다.");
    state.error = { message: "승인된 교사 또는 관리자만 학생 글 목록을 볼 수 있습니다." };
    expect(renderToStaticMarkup(<StudentEssayReviewList scope="teacher" />)).toContain("승인된 교사 또는 관리자만");
  });
});

describe("학생 글 불러오기(새로고침)", () => {
  it("'목록 불러오기' 버튼과 마지막으로 불러온 시각을 보여 주고, 불러오는 동안은 버튼을 막는다", () => {
    state.rows = [row()];
    const html = renderToStaticMarkup(<StudentEssayReviewList scope="teacher" />);
    expect(html).toContain("목록 불러오기");
    expect(html).toContain('data-testid="review-list-updated"');
    expect(html).toContain("마지막으로 불러온 시각");
    state.fetching = true;
    const loading = renderToStaticMarkup(<StudentEssayReviewList scope="teacher" />);
    expect(loading).toContain("불러오는 중");
    expect(loading).toMatch(/<button[^>]*disabled[^>]*>[^]*불러오는 중/);
  });
});

describe("접근 경로(입구)", () => {
  const read = async (relative: string) => (await import("node:fs")).readFileSync(new URL(relative, import.meta.url), "utf8");

  it("교사 마이페이지 탭, 관리자 화면 라우트·대시보드 카드·이동 바 경로에서 들어갈 수 있다", async () => {
    expect(await read("../pages/TeacherMyPage.tsx")).toContain('<StudentEssayReviewList scope="teacher" />');
    expect(await read("../App.tsx")).toMatch(/<Route path="\/admin\/student-essays">\{\(\) => <Layout><AdminStudentEssays \/><\/Layout>\}<\/Route>/);
    expect(await read("../pages/AdminStudentEssays.tsx")).toContain('scope="admin"');
    expect(await read("../pages/AdminDashboard.tsx")).toContain('href="/admin/student-essays"');
    expect(await read("../lib/pageTrail.ts")).toContain('"/admin/student-essays"');
  });
});
