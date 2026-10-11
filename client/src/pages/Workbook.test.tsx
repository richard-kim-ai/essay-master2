import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("wouter", () => ({
  Link: ({ href, children }: { href: string; children: React.ReactNode }) => <a href={href}>{children}</a>,
  useRoute: () => [true, { courseType: "middle_high", level: "2" }],
}));

vi.mock("@/_core/hooks/useAuth", () => ({
  useAuth: () => ({ isAuthenticated: true }),
}));

vi.mock("@/lib/trpc", () => ({
  trpc: {
    useUtils: () => ({ theoryContent: { getMyProgress: { invalidate: vi.fn() } } }),
    progress: { upsert: { useMutation: () => ({ mutateAsync: vi.fn() }) } },
    curriculum: {
      getWorkbookLessonBundle: { useQuery: () => ({ data: { workbookQuestions: [], theoryContent: [] }, isLoading: false }) },
      getDynamicByType: { useQuery: () => ({ data: [], isLoading: false }) },
      submitWorkbookAnswer: { useMutation: () => ({ mutateAsync: vi.fn() }) },
    },
    theoryContent: { getMyProgress: { useQuery: () => ({ data: [] }) }, completeCheck: { useMutation: () => ({ mutate: vi.fn(), isPending: false }) } },
    questionBank: { lessonWritingGuide: { useMutation: () => ({ mutateAsync: vi.fn(), isPending: false }) } },
  },
}));

import Workbook from "./Workbook";

describe("워크북 AI 학습 가이드 동선", () => {
  beforeEach(() => {
    Object.defineProperty(globalThis, "window", {
      configurable: true,
      value: { location: { search: "?lesson=1" }, setTimeout: vi.fn() },
    });
  });

  it("개념 이해부터 글 작성까지 순서대로 표시하고, 도구를 내부 단일 앵커 링크로 연결한다", () => {
    const html = renderToStaticMarkup(<Workbook />);

    expect(html).toContain("공부하고 올리는 순서");
    expect(html).toMatch(/1\. 개념 이해[\s\S]*2\. 주제 설정[\s\S]*3\. 주제문 점검[\s\S]*4\. 글 작성/);
    expect(html).toContain('href="/topic-wizard?return_to=%2Fworkbook%2Fmiddle_high%2F2%3Flesson%3D1"');
    expect(html).toContain('href="/thesis-checklist?return_to=%2Fworkbook%2Fmiddle_high%2F2%3Flesson%3D1"');
    expect(html).toContain('href="/essay-submission"');
    [
      "/topic-wizard?return_to=%2Fworkbook%2Fmiddle_high%2F2%3Flesson%3D1",
      "/thesis-checklist?return_to=%2Fworkbook%2Fmiddle_high%2F2%3Flesson%3D1",
      "/essay-submission",
    ].forEach((href) => {
      const linkStart = html.indexOf(`<a href="${href}">`);
      expect(linkStart).toBeGreaterThanOrEqual(0);
      const linkEnd = html.indexOf("</a>", linkStart);
      expect(html.slice(linkStart, linkEnd)).not.toContain("<button");
    });
  });
});
