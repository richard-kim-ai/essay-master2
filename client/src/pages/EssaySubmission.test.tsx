import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({ user: null as null | { role: string } }));

vi.mock("@/_core/hooks/useAuth", () => ({ useAuth: () => ({ user: state.user }) }));
vi.mock("@/components/EssayWorkspace", () => ({ default: () => <div data-testid="student-workspace">학생용 글쓰기 작업공간</div> }));
vi.mock("@/components/StudentEssayReviewList", () => ({ default: ({ scope }: { scope: string }) => <div data-testid="review-list">학생 제출 글 목록({scope})</div> }));

import EssaySubmission from "./EssaySubmission";

beforeEach(() => {
  state.user = null;
});

describe("글 제출 화면(/essay-submission)의 역할별 표시", () => {
  it("교사는 학생용 작업공간이 아니라 '첨삭 관리 센터'와 담당 학생 제출 글 목록을 본다", () => {
    state.user = { role: "teacher" };
    const html = renderToStaticMarkup(<EssaySubmission />);
    expect(html).toContain('data-testid="teacher-essay-center"');
    expect(html).toContain("교사용 · 첨삭 지도");
    expect(html).toContain("첨삭 관리 센터");
    expect(html).toContain("학생이 제출한 글을 불러와 확인하고");
    expect(html).toContain("학생 제출 글 목록(teacher)");
    expect(html).not.toContain("학생용 글쓰기 작업공간");
    // 학생용 문구(새 글 작성)가 교사 화면에 없다.
    expect(html).not.toContain("새 글 작성");
  });

  it("관리자는 전체 학생 글 목록을 본다", () => {
    state.user = { role: "admin" };
    const html = renderToStaticMarkup(<EssaySubmission />);
    expect(html).toContain("관리자용 · 첨삭 지도");
    expect(html).toContain("학생 제출 글 목록(admin)");
    expect(html).not.toContain("학생용 글쓰기 작업공간");
  });

  it("학생과 방문자는 기존 글쓰기·첨삭 요청 작업공간을 그대로 본다", () => {
    state.user = { role: "user" };
    expect(renderToStaticMarkup(<EssaySubmission />)).toContain("학생용 글쓰기 작업공간");
    state.user = null;
    expect(renderToStaticMarkup(<EssaySubmission />)).toContain("학생용 글쓰기 작업공간");
  });
});
