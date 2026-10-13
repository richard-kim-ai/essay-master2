// @vitest-environment jsdom
import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ detail: null as any, myComments: [] as any[], addComment: vi.fn() }));

vi.mock("wouter", () => ({ Link: ({ href, children }: any) => <a href={href}>{children}</a> }));
vi.mock("sonner", () => ({ toast: { error: vi.fn(), success: vi.fn() } }));
vi.mock("@/lib/trpc", () => {
  const q = (data: unknown) => ({ useQuery: () => ({ data, refetch: vi.fn(), isLoading: false }) });
  return {
    trpc: {
      useUtils: () => ({}),
      parent: {
        linkedStudents: { useQuery: () => ({ data: [{ id: 28, name: "홍길동", tag: "고등/대입", courseLabel: "고등/대입", email: "x@example.com" }], isLoading: false, refetch: vi.fn() }) },
        linkRequests: q([]),
        linkStudent: { useMutation: () => ({ mutate: vi.fn(), isPending: false }) },
        studentDetail: { useQuery: () => ({ data: mocks.detail, refetch: vi.fn() }) },
        addComment: { useMutation: () => ({ mutate: mocks.addComment, isPending: false }) },
        myComments: { useQuery: () => ({ data: mocks.myComments }) },
      },
      billing: { studentBilling: { useQuery: () => ({ data: { studentName: "홍길동", subscriptions: [], awaitingStart: [], entitlement: { mode: "trial", used: 1, limit: 2, remaining: 1 }, passRemaining: 3 }, isLoading: false }) } },
    },
  };
});

import ParentPortal from "./ParentPortal";
import ParentComments from "@/components/ParentComments";

const date = new Date("2026-10-12T09:00:00Z");
const detail = (over: Record<string, unknown> = {}) => ({
  student: { id: 28, name: "홍길동", courseType: "high_univ", courseLabel: "고등/대입", createdAt: date, lastSignedIn: date },
  learning: { completedCount: 3, startedCount: 4, lastCompletedAt: date, averageScore: 82, recent: [{ level: 2, score: 90, completedAt: date }] },
  essays: [
    { id: 1, title: "교육과 기술", content: "기술은 교육을 바꾼다.", status: "reviewed", submittedAt: date, updatedAt: date, teacherScore: 77, teacherComment: "논리가 좋습니다.", teacherReviewedAt: date },
    { id: 2, title: "환경 보호", content: "환경은 소중하다.", status: "submitted", submittedAt: date, updatedAt: date, teacherScore: null, teacherComment: null, teacherReviewedAt: null },
  ],
  aiFeedbacks: [{ id: 5, title: "AI 첨삭 글", createdAt: date, overallScore: 64, basicCheckOnly: false }, { id: 6, title: "기본 점검 글", createdAt: date, overallScore: null, basicCheckOnly: true }],
  certificates: [],
  classAssignments: [],
  analytics: { skills: [{ key: "structure", label: "구조력", value: 56, samples: 3, source: "ai" }, { key: "summary", label: "요약", value: null, samples: 0, source: "tool" }], weekly: [], totals: {} },
  weekly: { solvedThisWeek: 4, solvedLastWeek: 1, solvedDiff: 3, accuracyRate: 75, accuracyDiffPercent: null, completedModules: 1, activeDays: 2 },
  comments: [{ id: "9", parentName: "홍서방", comment: "힘내라", essayId: 1, essayTitle: "교육과 기술", createdAt: date, legacy: false }, { id: "legacy-0", parentName: "홍서방", comment: "예전 코멘트", essayId: null, essayTitle: null, createdAt: date, legacy: true }],
  ...over,
});

let container: HTMLDivElement;
let root: Root;
beforeEach(() => {
  (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  mocks.detail = detail();
  mocks.myComments = [];
});
afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

const render = (node: React.ReactNode) => act(() => root.render(node));
// Radix 탭은 마우스 누름으로 전환된다.
const openTab = (label: string) => {
  const tab = Array.from(container.querySelectorAll('[role="tab"]')).find((el) => el.textContent === label) as HTMLElement;
  act(() => { tab.dispatchEvent(new MouseEvent("mousedown", { bubbles: true, button: 0 })); });
};

describe("학부모 포털 — 자녀의 실제 학습 현황", () => {
  it("자녀의 학습 과정과 완료 단원·제출 글·AI 첨삭 수를 보여 준다", () => {
    render(<ParentPortal />);
    expect(container.querySelector('[data-testid="child-course"]')?.textContent).toBe("고등/대입");
    const overview = container.querySelector('[data-testid="parent-overview"]')!.textContent!;
    expect(overview).toContain("3개");
    expect(overview).toContain("2건");
  });

  it("제출한 글의 제목·본문·교사 점수와 총평을 보여 준다", () => {
    render(<ParentPortal />);
    openTab("글·첨삭");
    const essays = container.querySelector('[data-testid="parent-essays"]')!.textContent!;
    for (const text of ["교육과 기술", "기술은 교육을 바꾼다.", "선생님 점수 77점", "논리가 좋습니다.", "첨삭 완료", "제출 완료"]) expect(essays).toContain(text);
  });

  it("임의 값(85점·'과정 ID #')을 만들어 내지 않는다", () => {
    render(<ParentPortal />);
    const text = container.textContent!;
    expect(text).not.toContain("85점");
    expect(text).not.toContain("과정 ID #");
  });

  it("기록이 없는 능력은 '측정 전', 기본 점검으로 대체된 AI 첨삭은 점수 대신 '기본 점검'으로 표시한다", () => {
    render(<ParentPortal />);
    expect(container.querySelector('[data-testid="parent-growth"]')!.textContent).toContain("측정 전");
    openTab("글·첨삭");
    const ai = container.querySelector('[data-testid="parent-ai-feedbacks"]')!.textContent!;
    expect(ai).toContain("64점");
    expect(ai).toContain("기본 점검");
  });

  it("제출한 글이 없으면 안내를 보이고, 코멘트가 없으면 빈 상태를 보인다", () => {
    mocks.detail = detail({ essays: [], comments: [] });
    render(<ParentPortal />);
    openTab("글·첨삭");
    expect(container.querySelector('[data-testid="no-essays"]')).not.toBeNull();
    expect(container.querySelector('[data-testid="no-comments"]')).not.toBeNull();
  });

  it("과정을 아직 고르지 않은 자녀는 과정 미선택 안내를 보인다", () => {
    mocks.detail = detail({ student: { id: 28, name: "홍길동", courseType: null, courseLabel: null, createdAt: date, lastSignedIn: date } });
    render(<ParentPortal />);
    expect(container.querySelector('[data-testid="child-course"]')!.textContent).toContain("과정을 선택하지 않았습니다");
  });
});

describe("학부모 포털 — 코멘트는 글과 연결해서만 보낸다", () => {
  it("제출한 글마다 코멘트 입력이 있고, 그 글에 남긴 코멘트만 그 글 아래에 보인다", () => {
    render(<ParentPortal />);
    openTab("글·첨삭");
    const first = container.querySelector('[data-testid="essay-comment-box-1"]')!;
    const second = container.querySelector('[data-testid="essay-comment-box-2"]')!;
    expect(first.textContent).toContain("힘내라");
    expect(first.textContent).not.toContain("예전 코멘트");
    expect(second.textContent).toContain("이 글에 남긴 코멘트 (0)");
    expect(first.querySelector("textarea")).not.toBeNull();
  });

  it("글 없이 보내는 코멘트 입력은 없다 — 제출한 글이 없으면 입력 자체가 나오지 않는다", () => {
    mocks.detail = detail({ essays: [] });
    render(<ParentPortal />);
    openTab("글·첨삭");
    expect(container.querySelector("textarea")).toBeNull();
    expect(container.querySelector('[data-testid="no-essays"]')).not.toBeNull();
  });

  it("글에 코멘트를 보내면 자녀 id·글 id·내용을 함께 서버로 보낸다", () => {
    render(<ParentPortal />);
    openTab("글·첨삭");
    const box = container.querySelector('[data-testid="essay-comment-box-2"]')!;
    const textarea = box.querySelector("textarea")!;
    act(() => {
      const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value")!.set!;
      setter.call(textarea, "  환경 글 잘 읽었어  ");
      textarea.dispatchEvent(new Event("input", { bubbles: true }));
    });
    act(() => { box.querySelector("form")!.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true })); });
    expect(mocks.addComment).toHaveBeenCalledTimes(1);
    expect(mocks.addComment.mock.calls[0][0]).toEqual({ studentId: 28, essayId: 2, comment: "환경 글 잘 읽었어" });
  });

  it("보낸 코멘트 목록은 어느 글에 대한 것인지 보여 주고, 글과 연결되지 않은 옛 코멘트는 그렇게 표시한다", () => {
    render(<ParentPortal />);
    openTab("글·첨삭");
    const text = container.textContent!;
    expect(text).toContain("「교육과 기술」");
    expect(text).toContain("글과 연결되지 않은 이전 코멘트");
  });
});

describe("학부모 포털 — 자녀 이용권", () => {
  it("이용권·구매 탭에서 자녀의 이용권 상태를 보고 구매 화면(자녀 지정)으로 이동할 수 있다", () => {
    render(<ParentPortal />);
    openTab("이용권·구매");
    const tab = container.querySelector('[data-testid="parent-billing-tab"]')!;
    expect(tab.textContent).toContain("교사 첨삭지도권 남은 횟수");
    expect(tab.querySelector('[data-testid="child-pass-remaining"]')!.textContent).toBe("3회");
    expect(tab.querySelector('a[href="/checkout?student=28"]')).not.toBeNull();
  });
});

describe("학생 화면 — 학부모 코멘트", () => {
  it("학부모가 남긴 코멘트를 학생이 읽을 수 있다", () => {
    mocks.myComments = [{ id: "9", parentName: "홍서방", comment: "힘내라 짜샤...", createdAt: date, legacy: true }];
    render(<ParentComments />);
    const text = container.querySelector('[data-testid="parent-comments"]')!.textContent!;
    expect(text).toContain("힘내라 짜샤...");
    expect(text).toContain("홍서방");
    expect(text).toContain("총 1건");
  });

  it("코멘트가 없으면 아무것도 표시하지 않는다", () => {
    render(<ParentComments />);
    expect(container.querySelector('[data-testid="parent-comments"]')).toBeNull();
  });
});
