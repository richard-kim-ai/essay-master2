// @vitest-environment jsdom
import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import userEvent from "@testing-library/user-event";
const mock = vi.hoisted(() => ({
  auth: {
    user: { id: 101, role: "user", tag: "중고등" },
    loading: false,
  } as any,
  remote: [] as any[],
  sync: vi.fn(),
  teacher: vi.fn(),
  ai: vi.fn(),
  navigate: vi.fn(),
  refetch: vi.fn(),
  mutation: {} as any,
}));
vi.mock("@/_core/hooks/useAuth", () => ({ useAuth: () => mock.auth }));
// 교사 첨삭은 신청·결제 대화상자에서 진행한다. 이 테스트는 글 보관·동기화 흐름을 보므로 대화상자는 스텁으로 대체한다.
vi.mock("@/components/TeacherFeedbackRequestDialog", () => ({
  default: (props: { essayId: number | null; open: boolean; onRequested: (status: string) => Promise<void> | void }) =>
    props.open ? (
      <div data-testid="teacher-request-dialog" data-essay-id={String(props.essayId)}>
        <button onClick={() => void props.onRequested("submitted")}>신청 완료 처리</button>
      </div>
    ) : null,
  formatDueDate: (value: string) => String(value),
}));
vi.mock("@/components/MyTeacherFeedbackRequests", () => ({ default: () => null }));
vi.mock("wouter", () => ({
  useLocation: () => ["/offline-essays", mock.navigate],
  Link: ({ href, children }: any) => <a href={href}>{children}</a>,
}));
vi.mock("@/lib/trpc", () => ({
  trpc: {
    essaySubmission: {
      syncDraft: { useMutation: () => mock.mutation },
      requestTeacher: { useMutation: () => ({ mutateAsync: mock.teacher }) },
      trash: { useMutation: () => ({ mutateAsync: vi.fn() }) },
      workspace: {
        useQuery: () => ({ data: mock.remote, refetch: mock.refetch }),
      },
    },
    aiAutoFeedback: {
      create: { useMutation: () => ({ mutateAsync: mock.ai }) },
      getTodayQuota: {
        useQuery: () => ({
          data: { canUse: true, isTrial: false },
          refetch: async () => ({}),
        }),
      },
    },
  },
}));
import EssayWorkspace from "./EssayWorkspace";
import {
  essayStorageKey,
  newLocalEssay,
  writeEssays,
  readEssays,
} from "@/lib/essayStorage";
let root: Root;
let container: HTMLDivElement;
const button = (name: string) =>
  Array.from(container.querySelectorAll<HTMLButtonElement>("button")).find(
    b => b.textContent === name
  )!;
const settle = async () => {
  await act(async () => {
    await new Promise(r => setTimeout(r, 15));
  });
};
async function render() {
  await act(async () => root.render(<EssayWorkspace offline />));
  await settle();
}
beforeEach(() => {
  (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
  vi.clearAllMocks();
  localStorage.clear();
  Object.defineProperty(navigator, "onLine", {
    configurable: true,
    value: true,
  });
  mock.auth = {
    user: { id: 101, role: "user", tag: "중고등" },
    loading: false,
  };
  mock.remote = [];
  mock.refetch.mockImplementation(async () => ({ data: mock.remote }));
  mock.sync.mockImplementation(async (input: any) => {
    const row = {
      ...input,
      id: input.id || 7,
      userId: 101,
      syncRevision: input.id ? 1 : 0,
      status: "draft",
      updatedAt: new Date().toISOString(),
      createdAt: new Date().toISOString(),
    };
    mock.remote = [row];
    return row;
  });
  mock.mutation = { mutateAsync: mock.sync };
  mock.teacher.mockResolvedValue({ status: "submitted" });
  mock.ai.mockImplementation(async () => {
    const feedback = {
      id: 9,
      overallScore: 82,
      overallComment: "주장이 분명합니다. 근거를 추가해 보세요.",
      suggestions: ["사례의 출처를 확인하세요."],
      fallback_used: false,
    };
    mock.remote = mock.remote.map(r => ({
      ...r,
      aiFeedback: feedback,
      aiFeedbackId: 9,
    }));
    return feedback;
  });
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});
afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
});
const initial = (extra: any = {}) => ({
  ...newLocalEssay(
    101,
    "내 글",
    "학교 규칙은 학생과 교사가 함께 정해야 합니다. 각자의 근거를 듣고 합의해야 합니다."
  ),
  ...extra,
});
describe("오프라인 보관 · 온라인 첨삭 흐름", () => {
  it("기기에 저장한 새 글은 실제 서버 ID를 받으며 같은 글을 중복 업로드하지 않는다", async () => {
    writeEssays(101, [initial()]);
    await render();
    expect(mock.sync).toHaveBeenCalledTimes(1);
    expect(readEssays(101)[0].id).toBe(7);
    expect(readEssays(101)[0].isDirty).toBe(false);
    await act(async () => button("서버 동기화").click());
    await settle();
    expect(mock.sync).toHaveBeenCalledTimes(1);
  });
  it("오프라인에서는 본문을 기기에 저장하고 온라인 복귀하면 최신 저장 글을 업로드한다", async () => {
    Object.defineProperty(navigator, "onLine", {
      value: false,
      configurable: true,
    });
    writeEssays(101, [initial()]);
    await render();
    expect(mock.sync).not.toHaveBeenCalled();
    expect(button("AI 첨삭 요청").disabled).toBe(true);
    expect(button("담당 교사 첨삭 요청").disabled).toBe(true);
    const input =
      container.querySelector<HTMLTextAreaElement>("#essay-content")!;
    await act(async () => {
      await userEvent.setup().clear(input);
      await userEvent
        .setup()
        .type(
          input,
          "오프라인에서 새로 고친 본문입니다. 학생과 교사의 의견을 듣고 규칙을 정해야 합니다."
        );
    });
    await act(async () => button("기기에 저장").click());
    await settle();
    expect(readEssays(101)[0].content).toContain("오프라인에서 새로");
    expect(mock.sync).not.toHaveBeenCalled();
    Object.defineProperty(navigator, "onLine", {
      value: true,
      configurable: true,
    });
    await act(async () => window.dispatchEvent(new Event("online")));
    await settle();
    expect(mock.sync.mock.calls[0][0].content).toContain("오프라인에서 새로");
    expect(readEssays(101)[0].isDirty).toBe(false);
  });
  it("AI 요청은 저장된 원문과 서버 ID를 보내며 체험 레슨 표식을 위조하지 않는다", async () => {
    writeEssays(101, [initial()]);
    await render();
    await act(async () => button("AI 첨삭 요청").click());
    await settle();
    expect(mock.ai).toHaveBeenCalledWith(
      expect.objectContaining({
        essayId: 7,
        courseType: "middle_high",
        level: 1,
      })
    );
    expect(mock.ai.mock.calls[0][0]).not.toHaveProperty("submissionSource");
    expect(container.textContent).toContain("근거를 추가");
    expect(container.textContent).toContain("사례의 출처");
  });
  it("동기화 실패하면 기기 글을 유지하고 첨삭 요청을 보내지 않는다", async () => {
    mock.sync.mockRejectedValue(Error("네트워크 오류"));
    writeEssays(101, [initial()]);
    await render();
    await act(async () => button("AI 첨삭 요청").click());
    await settle();
    expect(mock.ai).not.toHaveBeenCalled();
    expect(readEssays(101)[0].isDirty).toBe(true);
    expect(readEssays(101)[0].content).toContain("학교 규칙");
  });
  it("교사 첨삭 요청은 서버 동기화 이후 신청 대화상자를 열고, 신청이 끝나면 원문을 잠근다", async () => {
    writeEssays(101, [initial()]);
    await render();
    // 신청(결제) 뒤 서버 응답에서도 제출 상태가 유지되는 상황
    await act(async () => button("담당 교사 첨삭 요청").click());
    await settle();
    // 요청 버튼이 곧바로 서버에 무료 요청을 보내지 않는다(신청·결제 대화상자에서 진행).
    expect(mock.teacher).not.toHaveBeenCalled();
    const dialog = container.querySelector('[data-testid="teacher-request-dialog"]');
    expect(dialog?.getAttribute("data-essay-id")).toBe("7");

    mock.remote = mock.remote.map(r => ({ ...r, status: "submitted", syncRevision: 1 }));
    await act(async () => button("신청 완료 처리").click());
    await settle();
    expect(container.querySelector('[data-testid="teacher-request-dialog"]')).toBeNull();
    expect(
      container.querySelector<HTMLTextAreaElement>("#essay-content")!.disabled
    ).toBe(true);
    expect(container.textContent).toContain("교사 첨삭 대기");
    expect(button("수정본 만들기")).toBeTruthy();
  });
  it("계정 전환 뒤 이전 계정 글을 새 계정으로 업로드하지 않는다", async () => {
    Object.defineProperty(navigator, "onLine", {
      value: false,
      configurable: true,
    });
    writeEssays(101, [initial()]);
    await render();
    mock.auth = {
      user: { id: 202, role: "user", tag: "고등/대입" },
      loading: false,
    };
    await render();
    expect(
      container.querySelector<HTMLInputElement>("#essay-title")
    ).toBeNull();
    expect(mock.sync).not.toHaveBeenCalled();
    expect(readEssays(202)).toEqual([]);
  });
  it("마지막 로그인한 계정의 글은 오프라인 재진입에서도 열리며 서버 요청은 보내지 않는다", async () => {
    Object.defineProperty(navigator, "onLine", {
      value: false,
      configurable: true,
    });
    localStorage.setItem(
      "essay_workspace_last_owner",
      JSON.stringify({ id: 101, role: "user", tag: "중고등" })
    );
    mock.auth = { user: null, loading: false };
    writeEssays(101, [initial()]);
    await render();
    expect(
      container.querySelector<HTMLInputElement>("#essay-title")!.value
    ).toBe("내 글");
    expect(mock.sync).not.toHaveBeenCalled();
    expect(button("AI 첨삭 요청").disabled).toBe(true);
  });
  it("기존 소유자 없는 공유 캐시는 확인 없이 서버로 올리지 않는다", async () => {
    localStorage.setItem(
      "essay_master_offline_essays",
      JSON.stringify([{ title: "기존 작성글", content: "기존 본문입니다." }])
    );
    await render();
    expect(mock.sync).not.toHaveBeenCalled();
    expect(container.textContent).toContain("기존 기기 글 확인");
  });
});
