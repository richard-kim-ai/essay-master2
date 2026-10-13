// @vitest-environment jsdom
import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  user: null as any,
  parentComments: [] as any[],
  rate: vi.fn(),
  addComment: vi.fn(async (..._args: unknown[]) => ({})),
  myRating: null as null | { rating: number; review: string | null; updatedAt: Date },
  toastError: vi.fn(),
  toastSuccess: vi.fn(),
  toastInfo: vi.fn(),
}));

vi.mock("@/_core/hooks/useAuth", () => ({ useAuth: () => ({ user: mocks.user, isAuthenticated: true }) }));
vi.mock("@/components/LoginRequired", () => ({ default: () => <div>로그인이 필요합니다</div> }));
vi.mock("wouter", () => ({ useRoute: () => [true, { essayId: "5" }], Link: ({ href, children }: any) => <a href={href}>{children}</a> }));
vi.mock("sonner", () => ({ toast: { error: mocks.toastError, success: mocks.toastSuccess, info: mocks.toastInfo } }));
vi.mock("@/lib/trpc", () => {
  const query = (data: unknown) => ({ useQuery: () => ({ data, refetch: vi.fn(), isLoading: false }) });
  const mutation = (fn?: (...args: any[]) => unknown) => ({ useMutation: () => ({ mutateAsync: fn ?? vi.fn(async () => ({})), mutate: fn ?? vi.fn(), isPending: false }) });
  const invalidate = { invalidate: vi.fn() };
  return {
    trpc: {
      useUtils: () => ({ teacherFeedback: { myRating: invalidate }, teacherOperations: { feedbackTemplates: invalidate } }),
      essaySubmission: { getById: query({ id: 5, userId: 21, title: "교육과 기술", content: "기술은 교육을 바꾼다.", status: "reviewed" }) },
      teacherFeedback: {
        getByEssay: query({ id: 40, essayId: 5, teacherId: 9, overallComment: "논리가 좋습니다.", overallScore: 88, structureScore: 80, logicScore: 90, expressionScore: 70 }),
        getComments: query([{ id: 1, comment: "근거를 보강하세요", commentType: "other" }]),
        create: mutation(),
        update: mutation(),
        addComment: { useMutation: () => ({ mutateAsync: (...args: unknown[]) => mocks.addComment(...args), isPending: false }) },
        myRating: { useQuery: () => ({ data: mocks.myRating, isLoading: false }) },
        rate: { useMutation: () => ({ mutate: mocks.rate, isPending: false }) },
      },
      parent: { commentsForEssay: { useQuery: () => ({ data: mocks.parentComments }) } },
      teacherOperations: { feedbackTemplates: query([]), saveFeedbackTemplate: mutation(), deleteFeedbackTemplate: mutation() },
      teacherAi: { draftsForEssay: query([]), revisionsForDraft: query([]), generateDraft: mutation(), saveDraftRevision: mutation(), approveDraft: mutation() },
    },
  };
});

import TeacherFeedback from "./TeacherFeedback";

let container: HTMLDivElement;
let root: Root;
const render = async () => act(async () => root.render(<TeacherFeedback />));
const button = (label: string) => Array.from(container.querySelectorAll<HTMLButtonElement>("button")).find((item) => item.textContent?.includes(label));
const typeInto = async (element: HTMLTextAreaElement, value: string) =>
  act(async () => {
    Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value")!.set!.call(element, value);
    element.dispatchEvent(new Event("input", { bubbles: true }));
  });

beforeEach(() => {
  (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
  vi.clearAllMocks();
  mocks.myRating = null;
  mocks.parentComments = [];
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});
afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
});

describe("첨삭 결과 보기: 학부모 코멘트 연동", () => {
  const parentComment = { id: "3", parentName: "홍서방", comment: "근거를 하나 더 써 보자", essayId: 5, essayTitle: "교육과 기술", createdAt: new Date("2026-10-12T09:00:00Z"), legacy: false };

  it("학생이 보는 첨삭 결과에 이 글에 달린 학부모 코멘트가 교사 코멘트와 함께 보인다", async () => {
    mocks.user = { id: 21, role: "user" };
    mocks.parentComments = [parentComment];
    await render();
    const parent = container.querySelector('[data-testid="essay-parent-comments"]');
    expect(parent).toBeTruthy();
    expect(parent!.textContent).toContain("근거를 하나 더 써 보자");
    expect(parent!.textContent).toContain("홍서방");
    // 교사 코멘트도 그대로 보인다
    expect(container.textContent).toContain("근거를 보강하세요");
  });

  it("교사에게도 같은 글의 학부모 코멘트가 보인다", async () => {
    mocks.user = { id: 9, role: "teacher", teacherStatus: "approved" };
    mocks.parentComments = [parentComment];
    await render();
    expect(container.querySelector('[data-testid="essay-parent-comments"]')!.textContent).toContain("근거를 하나 더 써 보자");
  });

  it("학부모 코멘트가 없으면 영역 자체를 보이지 않는다", async () => {
    mocks.user = { id: 21, role: "user" };
    mocks.parentComments = [];
    await render();
    expect(container.querySelector('[data-testid="essay-parent-comments"]')).toBeNull();
  });
});

describe("첨삭 결과 보기: 학생", () => {
  beforeEach(() => { mocks.user = { id: 21, role: "user" }; });

  it("읽기 전용 결과와 코멘트 목록만 보이고, 코멘트 입력·첨삭 작성 폼(오류의 원인)은 나오지 않는다", async () => {
    await render();
    const text = container.textContent ?? "";
    expect(container.querySelector('[data-testid="student-feedback-readonly"]')).toBeTruthy();
    expect(text).toContain("선생님 첨삭 결과");
    expect(text).toContain("88점");
    expect(text).toContain("논리가 좋습니다.");
    expect(text).toContain("근거를 보강하세요");
    expect(container.querySelector('textarea[placeholder="새 코멘트를 입력하세요..."]')).toBeNull();
    expect(button("코멘트 추가")).toBeUndefined();
    expect(button("첨삭 저장")).toBeUndefined();
    expect(text).not.toContain("작성자 번호");
  });

  it("코멘트 위에 별점·후기 영역이 있고, 별을 고르고 후기를 쓰면 평가를 저장한다(첨삭 id와 함께)", async () => {
    await render();
    expect(container.querySelector('[data-testid="teacher-rating-widget"]')).toBeTruthy();
    // 별점 영역이 코멘트 카드보다 앞에 있다.
    const html = container.innerHTML;
    expect(html.indexOf('data-testid="teacher-rating-widget"')).toBeLessThan(html.indexOf("근거를 보강하세요"));
    expect(button("평가 남기기")!.disabled).toBe(true);

    await act(async () => (container.querySelector('button[aria-label="4점"]') as HTMLButtonElement).click());
    expect(container.querySelector('[data-testid="rating-label"]')!.textContent).toContain("4점 · 좋아요");
    await typeInto(container.querySelector('textarea[aria-label="후기"]') as HTMLTextAreaElement, "  꼼꼼했어요  ");
    await act(async () => button("평가 남기기")!.click());
    expect(mocks.rate).toHaveBeenCalledWith({ feedbackId: 40, rating: 4, review: "꼼꼼했어요" });
  });

  it("이미 남긴 평가는 불러와서 보여 주고 '평가 수정하기'로 고칠 수 있다", async () => {
    mocks.myRating = { rating: 5, review: "최고였어요", updatedAt: new Date() };
    await render();
    expect(container.querySelector('button[aria-label="5점"]')!.getAttribute("aria-checked")).toBe("true");
    expect((container.querySelector('textarea[aria-label="후기"]') as HTMLTextAreaElement).value).toBe("최고였어요");
    expect(button("평가 수정하기")).toBeTruthy();
  });
});

describe("첨삭 결과 보기: 교사·관리자", () => {
  beforeEach(() => { mocks.user = { id: 9, role: "teacher", teacherStatus: "approved" }; });

  it("첨삭 작성 폼과 코멘트 입력이 있고, 학생용 별점 영역은 없다", async () => {
    await render();
    expect(button("첨삭 저장")).toBeTruthy();
    expect(container.querySelector('textarea[placeholder="새 코멘트를 입력하세요..."]')).toBeTruthy();
    expect(container.querySelector('[data-testid="teacher-rating-widget"]')).toBeNull();
    expect(container.querySelector('[data-testid="student-feedback-readonly"]')).toBeNull();
  });

  it("코멘트를 추가할 수 있고, 서버가 거절하면 실제 오류 사유를 보여 준다", async () => {
    await render();
    const textarea = container.querySelector('textarea[placeholder="새 코멘트를 입력하세요..."]') as HTMLTextAreaElement;
    await typeInto(textarea, "문장을 줄여 보세요");
    await act(async () => button("코멘트 추가")!.click());
    expect(mocks.addComment).toHaveBeenCalledWith(expect.objectContaining({ feedbackId: 40, comment: "문장을 줄여 보세요" }));

    mocks.addComment.mockRejectedValueOnce(new Error("배정된 학생의 제출물만 처리할 수 있습니다."));
    await typeInto(textarea, "또 다른 코멘트");
    await act(async () => button("코멘트 추가")!.click());
    expect(mocks.toastError).toHaveBeenCalledWith("배정된 학생의 제출물만 처리할 수 있습니다.");
  });
});
