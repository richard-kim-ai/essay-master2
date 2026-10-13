import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  authenticated: true,
  essays: [] as any[],
  ai: [] as any[],
  loading: false,
}));

vi.mock("@/_core/hooks/useAuth", () => ({ useAuth: () => ({ isAuthenticated: state.authenticated }) }));
vi.mock("@/components/LoginRequired", () => ({ default: () => <div>로그인이 필요합니다</div> }));
vi.mock("wouter", () => ({ Link: ({ href, children, ...props }: any) => <a href={href} {...props}>{children}</a> }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock("@/lib/trpc", () => {
  const mutation = () => ({ useMutation: () => ({ mutate: vi.fn(), isPending: false }) });
  const invalidate = { invalidate: vi.fn() };
  return {
    trpc: {
      useUtils: () => ({ essaySubmission: { getByUser: invalidate, trashList: invalidate, workspace: invalidate } }),
      essaySubmission: {
        getByUser: { useQuery: () => ({ data: state.essays, isLoading: state.loading }) },
        trashList: { useQuery: () => ({ data: [], isLoading: false }) },
        trash: mutation(),
        restore: mutation(),
        purge: mutation(),
        emptyTrash: mutation(),
      },
      aiAutoFeedback: { getByUser: { useQuery: () => ({ data: state.ai, isLoading: state.loading }) } },
    },
  };
});

import MyWritings from "./MyWritings";

const essay = (overrides: Record<string, unknown> = {}) => ({
  id: 5,
  title: "교육과 기술",
  content: "기술은 교육을 바꾼다. ".repeat(30),
  status: "draft",
  aiFeedbackId: null,
  updatedAt: new Date("2026-10-10T01:00:00Z"),
  ...overrides,
});
const aiRow = (overrides: Record<string, unknown> = {}) => ({
  id: 9,
  essayTitle: "환경 보호의 필요성",
  courseType: "middle_high",
  overallScore: 82,
  overallComment: "주장과 근거의 연결이 좋습니다.",
  createdAt: new Date("2026-10-11T01:00:00Z"),
  ...overrides,
});

beforeEach(() => {
  state.authenticated = true;
  state.essays = [];
  state.ai = [];
  state.loading = false;
});

describe("내 글·첨삭 기록(/my-writings)", () => {
  it("로그인하지 않으면 로그인 안내를 보여 준다", () => {
    state.authenticated = false;
    expect(renderToStaticMarkup(<MyWritings />)).toContain("로그인이 필요합니다");
  });

  it("글이 없으면 글쓰기 시작 링크를 보여 주고, 탭에 개수를 표시한다", () => {
    const html = renderToStaticMarkup(<MyWritings />);
    expect(html).toContain("내 글·첨삭 기록");
    expect(html).toContain("내가 쓴 글 (0)");
    expect(html).toContain("AI 첨삭 내역 (0)");
    expect(html).toContain("휴지통 (0)");
    expect(html).toContain("아직 저장된 글이 없습니다");
    expect(html).toContain('href="/essay-submission"');
    expect(html).toContain('href="/offline-essays"');
  });

  it("작성 중인 글은 이어서 쓰기 링크만, 제출·첨삭된 글은 교사 첨삭 보기와 AI 첨삭 보기 링크도 보여 준다(최근 수정 순)", () => {
    state.essays = [
      essay({ id: 1, title: "오래된 글", updatedAt: new Date("2026-09-01T00:00:00Z") }),
      essay({ id: 2, title: "최근 글", status: "reviewed", aiFeedbackId: 9, updatedAt: new Date("2026-10-12T00:00:00Z") }),
    ];
    const html = renderToStaticMarkup(<MyWritings />);
    expect(html.indexOf("최근 글")).toBeLessThan(html.indexOf("오래된 글"));
    expect(html).toContain('href="/essay-submission?essay=1"');
    expect(html).toContain("이어서 쓰기");
    expect(html).toContain("첨삭 완료");
    expect(html).toContain('href="/teacher-feedback/2"');
    expect(html).toContain('href="/ai-feedback-compare/9"');
    expect(html).not.toContain('href="/teacher-feedback/1"');
    // 글마다 휴지통으로 옮기는 삭제 버튼이 있다.
    expect((html.match(/>\s*삭제<\/button>/g) ?? []).length).toBe(2);
    // 본문은 길게 잘라 미리보기만 보여 준다.
    expect(html).toContain("…");
  });

  it("AI 첨삭 내역 개수를 탭에 표시한다", () => {
    state.ai = [aiRow()];
    // 서버 렌더링은 첫 탭만 그리므로 탭 전환 없이 내역 개수와 탭 이름만 확인한다.
    const html = renderToStaticMarkup(<MyWritings />);
    expect(html).toContain("AI 첨삭 내역 (1)");
    expect(html).toContain('role="tab"');
  });
});

describe("접근 경로(입구)", () => {
  const read = async (relative: string) => (await import("node:fs")).readFileSync(new URL(relative, import.meta.url), "utf8");

  it("라우트·마이페이지·프로필 메뉴(PC·모바일)·AI 첨삭 화면에서 /my-writings로 들어갈 수 있다", async () => {
    expect(await read("../App.tsx")).toMatch(/<Route path="\/my-writings">\{\(\) => <Layout><MyWritings \/><\/Layout>\}<\/Route>/);
    expect(await read("./MyPageHub.tsx")).toContain('setLocation("/my-writings")');
    // 허브의 '논술 쓰기·첨삭' 구역에서 글쓰기·AI 자동 첨삭·내 글·첨삭 기록으로 바로 갈 수 있다.
    const hub = await read("./MyPageHub.tsx");
    expect(hub).toContain('data-testid="hub-writing-section"');
    for (const href of ["/essay-submission", "/ai-auto-feedback", "/my-writings"]) expect(hub).toContain(`href: "${href}"`);
    const navigation = await read("../components/Navigation.tsx");
    expect((navigation.match(/href="\/my-writings"/g) ?? []).length).toBe(2);
    expect(await read("./AIAutoFeedback.tsx")).toContain('href="/my-writings"');
    expect(await read("../lib/pageTrail.ts")).toContain('"/my-writings"');
  });
});
