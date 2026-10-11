import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({ rows: [] as any[] }));

vi.mock("@/_core/hooks/useAuth", () => ({ useAuth: () => ({ isAuthenticated: true }) }));
vi.mock("@/components/LoginRequired", () => ({ default: () => <div>로그인이 필요합니다</div> }));
vi.mock("wouter", () => ({
  Link: ({ href, children }: any) => <a href={href}>{children}</a>,
  useParams: () => ({ id: "9" }),
}));
vi.mock("@/lib/trpc", () => ({ trpc: { aiAutoFeedback: { getByUser: { useQuery: () => ({ data: state.rows, isLoading: false }) } } } }));

import AIFeedbackCompare from "./AIFeedbackCompare";

const row = (overrides: Record<string, unknown> = {}) => ({
  id: 9,
  essayTitle: "교육과 기술",
  essayContent: "기술은 교육을 매우 바꾼다. 하지만 격차도 있다.",
  revisedEssay: "기술은 교육을 크게 바꾼다. 하지만 격차도 있다.",
  overallScore: 80,
  overallComment: "좋습니다.",
  suggestions: "[]",
  strengths: "[]",
  weaknesses: "[]",
  createdAt: new Date("2026-10-11T01:00:00Z"),
  ...overrides,
});

beforeEach(() => {
  state.rows = [row()];
});

describe("AI 첨삭 비교(변경점 표시)", () => {
  it("원문에는 고쳐진 표현을 빨간 취소선과 번호로, 첨삭 답안에는 새 표현을 초록 밑줄과 번호로 표시한다", () => {
    const html = renderToStaticMarkup(<AIFeedbackCompare />);
    const original = html.slice(html.indexOf('data-testid="diff-original"'), html.indexOf('data-testid="diff-revised"'));
    const revised = html.slice(html.indexOf('data-testid="diff-revised"'), html.indexOf('data-testid="diff-changes"'));
    expect(original).toContain("line-through");
    expect(original).toMatch(/매우<sup[^>]*>1<\/sup>/);
    expect(original).not.toContain("크게");
    expect(revised).toContain("border-emerald-500");
    expect(revised).toMatch(/크게<sup[^>]*>1<\/sup>/);
    expect(revised).not.toContain("매우");
  });

  it("요약(수정 곳 수·추가/삭제 단어)과 범례, 체크할 수 있는 수정 내역 목록을 보여 준다", () => {
    const html = renderToStaticMarkup(<AIFeedbackCompare />);
    expect(html).toContain("수정 1곳");
    expect(html).toContain("추가 1단어");
    expect(html).toContain("삭제 1단어");
    expect(html).toContain("삭제·바뀐 원문");
    expect(html).toContain("추가·바뀐 표현");
    expect(html).toContain('data-testid="diff-changes"');
    expect(html).toContain("수정 내역 (0/1 확인)");
    expect(html).toContain('type="checkbox"');
    expect(html).toContain("모두 확인");
    expect(html).toContain("바꿈");
  });

  it("수정 답안이 없거나 원문과 같으면 변경 없음을 알리고 수정 내역은 보여 주지 않는다", () => {
    state.rows = [row({ revisedEssay: null })];
    const html = renderToStaticMarkup(<AIFeedbackCompare />);
    expect(html).toContain("원문을 고치지 않았거나 수정 답안이 원문과 같습니다");
    expect(html).not.toContain('data-testid="diff-changes"');
  });
});
