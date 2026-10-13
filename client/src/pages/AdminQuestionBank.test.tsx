// @vitest-environment jsdom
import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import {
  validateQuestionBankRequiredFields,
  questionBankIssueLabel,
} from "@/lib/questionBankReview";

const mocks = vi.hoisted(() => ({
  preview: vi.fn(),
  create: vi.fn(),
  bulk: vi.fn(),
  toast: vi.fn(),
}));
vi.mock("@/_core/hooks/useAuth", () => ({
  useAuth: () => ({ user: { id: 1, role: "admin" }, loading: false }),
}));
vi.mock("@/components/DashboardLayout", () => ({
  default: ({ children }: any) => <div>{children}</div>,
}));
vi.mock("wouter", () => ({
  Link: ({ children, href }: any) => <a href={href}>{children}</a>,
}));
vi.mock("sonner", () => ({
  toast: { error: mocks.toast, warning: mocks.toast, success: mocks.toast },
}));
vi.mock("@/components/ui/dialog", async importOriginal => ({
  ...(await importOriginal<typeof import("@/components/ui/dialog")>()),
  Dialog: ({ open, children }: any) => (open ? <div>{children}</div> : null),
  DialogContent: ({ children }: any) => <div>{children}</div>,
  DialogHeader: ({ children }: any) => <div>{children}</div>,
  DialogTitle: ({ children }: any) => <h2>{children}</h2>,
  DialogDescription: ({ children }: any) => <p>{children}</p>,
  DialogFooter: ({ children }: any) => <div>{children}</div>,
}));
vi.mock("@/lib/trpc", () => ({
  trpc: {
    useUtils: () => ({}),
    questionBank: new Proxy(
      {},
      {
        get: (_, name) => ({
          useQuery: () => ({ data: [], isLoading: false, refetch: vi.fn() }),
          useMutation: () => ({
            mutateAsync:
              name === "previewAiQuestions"
                ? mocks.preview
                : name === "create"
                  ? mocks.create
                  : name === "bulkCreate"
                    ? mocks.bulk
                    : vi.fn(),
            isPending: false,
          }),
        }),
      }
    ),
  },
}));
import AdminQuestionBank from "./AdminQuestionBank";

function candidate(complete: boolean) {
  return {
    title: "휴대전화 규칙 요약",
    courseType: "middle_high",
    toolType: "summary",
    difficulty: "medium",
    isActive: 1,
    contentData: JSON.stringify({
      question: "휴대전화 규칙의 쟁점을 요약하시오.",
      explanation: complete ? "편의와 학습권을 모두 요약한다." : "",
      learning_objective: "핵심 쟁점을 요약한다.",
      generation_origin: "ai_generated",
    }),
    qaStatus: "blocked",
    qaIssues: complete
      ? ["human_review_required"]
      : ["missing_explanation", "human_review_required"],
  };
}
let root: Root;
let container: HTMLDivElement;
async function click(label: string) {
  const button = Array.from(container.querySelectorAll("button")).find(
    node => node.textContent?.trim() === label
  );
  expect(button, label).toBeDefined();
  await act(async () => {
    button!.click();
  });
}
async function openPreview() {
  await click("AI 실전 문제 출제 (사전 검토)");
  await click("AI 문항 생성 및 사전 검토 시작");
}

describe("관리자 문제은행 필수 필드 및 승인 UI", () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
    container = document.createElement("div");
    document.body.append(container);
    root = createRoot(container);
    await act(async () => {
      root.render(<AdminQuestionBank />);
    });
  });
  afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
  });

  it("누락 필드를 구체적으로 안내하고 사람 검수만으로 불완전한 문항을 승인할 수 없다", async () => {
    mocks.preview.mockResolvedValue([candidate(false)]);
    await openPreview();
    expect(container.textContent).toContain("문항 해설을 입력해주세요.");
    await click("전체 수기검수 통과");
    const approve = Array.from(container.querySelectorAll("button")).find(
      node => node.textContent === "이 문항만 승인"
    );
    expect(approve!.disabled).toBe(true);
    await click("검토 완료 및 문제은행 최종 승인 반영");
    expect(mocks.bulk).not.toHaveBeenCalled();
    expect(mocks.create).not.toHaveBeenCalled();
  });

  it("필수 필드가 갖춰진 문항은 사람 검수 후 서버 승인 저장으로 전달한다", async () => {
    mocks.preview.mockResolvedValue([candidate(true)]);
    mocks.create.mockResolvedValue({ id: 101 });
    await openPreview();
    await click("전체 수기검수 통과");
    await click("이 문항만 승인");
    expect(mocks.create).toHaveBeenCalledOnce();
    expect(
      JSON.parse(mocks.create.mock.calls[0][0].contentData).human_review
        .overall_passed
    ).toBe(true);
  });

  it("코드를 노출하지 않고 한 문항씩 이전·다음으로 검토한다", async () => {
    mocks.preview.mockResolvedValue([
      candidate(true),
      { ...candidate(true), title: "두 번째 요약 문항" },
    ]);
    await openPreview();
    expect(
      container.querySelectorAll('[data-testid="question-reading-view"]')
    ).toHaveLength(1);
    expect(container.textContent).not.toContain('"learning_objective":');
    expect(container.textContent).not.toContain("본문 데이터 (JSON)");
    await click("다음 문항");
    expect(
      (
        container.querySelector(
          '[aria-label="문항 제목"]'
        ) as HTMLTextAreaElement
      ).value
    ).toBe("두 번째 요약 문항");
    await click("이전 문항");
    expect(
      (
        container.querySelector(
          '[aria-label="문항 제목"]'
        ) as HTMLTextAreaElement
      ).value
    ).toBe("휴대전화 규칙 요약");
  });

  it("검수 완료 뒤 해설을 수정하면 승인 버튼이 다시 잠기고 검수가 초기화된다", async () => {
    mocks.preview.mockResolvedValue([candidate(true)]);
    await openPreview();
    await click("전체 수기검수 통과");
    await click("문항 수정");
    const input = container.querySelector(
      '[aria-label="해설"]'
    ) as HTMLTextAreaElement;
    await act(async () => {
      Object.getOwnPropertyDescriptor(
        HTMLTextAreaElement.prototype,
        "value"
      )!.set!.call(input, "새로운 한국어 해설");
      input.dispatchEvent(new Event("input", { bubbles: true }));
    });
    expect(
      Array.from(container.querySelectorAll("button")).find(
        node => node.textContent === "이 문항만 승인"
      )!.disabled
    ).toBe(true);
    expect(
      container.querySelectorAll('input[type="checkbox"]:checked')
    ).toHaveLength(0);
  });

  it("저장 전 필수 필드 검증이 잘못된 JSON과 비어 있는 학습 목표를 차단한다", () => {
    expect(validateQuestionBankRequiredFields("{broken")).toEqual([
      "malformed_json",
    ]);
    const issues = validateQuestionBankRequiredFields(
      JSON.stringify({
        question: "문제",
        explanation: "해설",
        generation_origin: "ai_generated",
      })
    );
    expect(issues).toEqual(["missing_learning_objective"]);
    expect(questionBankIssueLabel(issues[0])).toBe(
      "문항 학습 목표를 입력해주세요."
    );
  });
});
