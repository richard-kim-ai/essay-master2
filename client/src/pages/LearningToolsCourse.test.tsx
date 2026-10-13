// @vitest-environment jsdom
import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { beforeEach, afterEach, describe, it, expect, vi } from "vitest";
import { COURSE_OPTIONS } from "@shared/course";
const state = vi.hoisted(() => ({
  user: { id: 100, role: "user", tag: "초등" } as any,
  loading: false,
  queries: [] as any[],
  deferred: null as Promise<any> | null,
  grade: vi.fn(),
  mistake: vi.fn(),
  submit: vi.fn(),
  award: vi.fn(),
}));
vi.mock("@/_core/hooks/useAuth", () => ({
  useAuth: () => ({ ...state, isAuthenticated: !!state.user }),
}));
const rowCache: Record<string, any[]> = {};
function rows(tool: string) {
  if (!rowCache[tool])
    rowCache[tool] = COURSE_OPTIONS.flatMap((c, i) =>
      Array.from({ length: 10 }, (_, n) => ({
        id: 1 + i * 100 + n,
        courseType: c.value,
        toolType: tool,
        difficulty: "medium",
        title: `${c.label} 전용 ${tool} ${n + 1}`,
        contentData: JSON.stringify({
          prompt: `${c.label} 제시문`,
          sentence: "반복 표현을 줄이세요.",
          options: ["보기 하나", "보기 둘"],
          answer: "보기 하나",
          explanation: "근거를 연결합니다.",
          paragraphs: [
            { id: "a", content: "문제 제기", correctOrder: 1 },
            { id: "b", content: "근거 설명", correctOrder: 2 },
            { id: "c", content: "결론", correctOrder: 3 },
          ],
        }),
      }))
    );
  return rowCache[tool];
}
vi.mock("@/lib/trpc", () => ({
  trpc: {
    useUtils: () => ({
      badges: { getByUser: { invalidate: vi.fn() } },
      questionBank: { reorderingPractice: { invalidate: vi.fn() } },
    }),
    questionBank: {
      random: {
        useQuery: (input: any, opts: any) => {
          state.queries.push({ input, opts });
          return { data: rows(input.toolType), isLoading: false };
        },
      },
      reorderingPractice: {
        useQuery: (input: any, opts: any) => {
          state.queries.push({ input, opts });
          return { data: rows("reordering"), isLoading: false, isError: false };
        },
      },
      gradeEssay: {
        useMutation: () => ({ mutateAsync: state.grade, isPending: false }),
      },
      recordMistake: {
        useMutation: () => ({ mutateAsync: state.mistake, isPending: false }),
      },
      reorderingSubmit: {
        useMutation: () => ({ mutateAsync: state.submit, isPending: false }),
      },
    },
    quiz: {
      submitAnswer: {
        useMutation: () => ({ mutateAsync: state.submit, isPending: false }),
      },
      getDetailedSentenceFeedback: {
        useMutation: () => ({ mutate: vi.fn(), isPending: false }),
      },
    },
    badges: {
      award: {
        useMutation: () => ({ mutateAsync: state.award, isPending: false }),
      },
    },
  },
}));
vi.mock("@/components/PreviewGate", () => ({
  default: ({ children }: any) => <div>{children}</div>,
}));
vi.mock("@/components/BadgeCelebrationModal", () => ({ default: () => null }));
vi.mock("@/components/QuestionFeedbackBox", () => ({ default: () => null }));
vi.mock("sonner", () => ({
  toast: { error: vi.fn(), success: vi.fn(), info: vi.fn() },
}));
import Quiz from "./QuizPage";
import Summary from "./SummaryPractice";
import Reordering from "./ParagraphReordering";
import { saveAdminPreviewCourse } from "@/lib/adminPreviewCourse";
let el: HTMLDivElement;
let root: ReturnType<typeof createRoot>;
let mounted = true;
async function render(Page: React.ComponentType) {
  await act(async () => {
    root.render(<Page />);
  });
}
function button(text: string) {
  return Array.from(el.querySelectorAll("button")).find(b =>
    b.textContent?.includes(text)
  )!;
}
async function click(text: string) {
  await act(async () => button(text).click());
}
async function input(text: string) {
  const box = el.querySelector("textarea")!;
  await act(async () => {
    Object.getOwnPropertyDescriptor(
      HTMLTextAreaElement.prototype,
      "value"
    )!.set!.call(box, text);
    box.dispatchEvent(new Event("input", { bubbles: true }));
  });
}
beforeEach(() => {
  (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
  state.user = { id: 100, role: "user", tag: "초등" };
  state.loading = false;
  state.queries = [];
  state.grade.mockReset();
  state.submit.mockReset();
  state.mistake.mockReset();
  state.award.mockReset();
  state.grade.mockResolvedValue({
    overallScore: 55,
    feedback: "현재 과정 평가",
    strengths: [],
    improvements: [],
  });
  state.mistake.mockResolvedValue({ stored: true });
  localStorage.clear();
  el = document.createElement("div");
  document.body.appendChild(el);
  root = createRoot(el);
  mounted = true;
});
afterEach(async () => {
  if (mounted) await act(async () => root.unmount());
  el.remove();
});
describe("세 학습도구 과정 일관성", () => {
  for (const [name, Page] of [
    ["문장", Quiz],
    ["요약", Summary],
    ["단락", Reordering],
  ] as const) {
    it.each(COURSE_OPTIONS)(
      `${name}: $label 학생은 자기 과정만 표시·요청한다`,
      async c => {
        state.user.tag = c.label;
        await render(Page);
        const enabled = state.queries.filter(q => q.opts.enabled);
        expect(enabled.length).toBeGreaterThan(0);
        expect(enabled.every(q => q.input.courseType === c.value)).toBe(true);
        expect(el.textContent).toContain(c.label);
        for (const other of COURSE_OPTIONS.filter(o => o.value !== c.value)) {
          expect(el.textContent).not.toContain(`${other.label} 전용`);
          expect(
            Array.from(el.querySelectorAll("button")).some(
              b => b.textContent === other.label
            )
          ).toBe(false);
        }
      }
    );
    it(`${name}: 미선택·학부모·인증로딩 때 문항 요청을 활성화하지 않는다`, async () => {
      for (const tag of ["과정 미선택", "학부모"]) {
        state.user.tag = tag;
        state.queries = [];
        await render(Page);
        expect(state.queries.every(q => !q.opts.enabled)).toBe(true);
      }
      state.loading = true;
      state.queries = [];
      await render(Page);
      expect(state.queries.every(q => !q.opts.enabled)).toBe(true);
      expect(state.grade).not.toHaveBeenCalled();
      expect(state.submit).not.toHaveBeenCalled();
    });
    it(`${name}: 관리자 탐색은 계정별 공통 과정으로 시작하고 학생 기록은 쓰지 않는다`, async () => {
      state.user = { id: 7, role: "admin", tag: "일반" };
      saveAdminPreviewCourse("high_univ", 7);
      await render(Page);
      expect(
        state.queries
          .filter(q => q.opts.enabled)
          .every(q => q.input.courseType === "high_univ")
      ).toBe(true);
      expect(el.textContent).toContain("고등/대입");
      expect(state.mistake).not.toHaveBeenCalled();
      expect(state.award).not.toHaveBeenCalled();
    });
  }
  it("같은 과정 A→B 전환 도중 도착한 요약 결과를 B의 오답으로 저장하지 않는다", async () => {
    let resolve!: (v: any) => void;
    state.grade.mockReturnValue(new Promise(r => (resolve = r)));
    await render(Summary);
    await input("핵심 주장과 근거를 함께 간결하게 요약한 문장입니다.");
    await click("요약 제출 및 분석");
    expect(state.grade).toHaveBeenCalledTimes(1);
    state.user = { id: 202, role: "user", tag: "초등" };
    await render(Summary);
    await act(async () =>
      resolve({
        overallScore: 50,
        feedback: "A 이전 평가",
        strengths: [],
        improvements: [],
      })
    );
    expect(el.textContent).not.toContain("A 이전 평가");
    expect(state.mistake).not.toHaveBeenCalled();
  });
  it("페이지가 사라진 뒤의 AI 응답도 후속 오답·뱃지 저장을 만들지 않는다", async () => {
    let resolve!: (v: any) => void;
    state.grade.mockReturnValue(new Promise(r => (resolve = r)));
    await render(Summary);
    await input("학습 내용의 쟁점과 핵심 근거를 두 문장으로 요약합니다.");
    await click("요약 제출 및 분석");
    await act(async () => root.unmount());
    mounted = false;
    await act(async () =>
      resolve({
        overallScore: 90,
        feedback: "이전 평가",
        strengths: [],
        improvements: [],
      })
    );
    expect(state.mistake).not.toHaveBeenCalled();
    expect(state.award).not.toHaveBeenCalled();
  });
});
