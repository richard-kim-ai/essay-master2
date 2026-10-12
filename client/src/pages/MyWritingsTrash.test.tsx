// @vitest-environment jsdom
import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  trash: vi.fn(),
  restore: vi.fn(),
  purge: vi.fn(),
  empty: vi.fn(),
  essays: [] as any[],
  trashed: [] as any[],
}));

vi.mock("@/_core/hooks/useAuth", () => ({ useAuth: () => ({ isAuthenticated: true }) }));
vi.mock("@/components/LoginRequired", () => ({ default: () => <div>로그인이 필요합니다</div> }));
vi.mock("wouter", () => ({ Link: ({ href, children }: any) => <a href={href}>{children}</a> }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock("@/lib/trpc", () => {
  const invalidate = { invalidate: vi.fn() };
  return {
    trpc: {
      useUtils: () => ({ essaySubmission: { getByUser: invalidate, trashList: invalidate, workspace: invalidate } }),
      essaySubmission: {
        getByUser: { useQuery: () => ({ data: mocks.essays, isLoading: false }) },
        trashList: { useQuery: () => ({ data: mocks.trashed, isLoading: false }) },
        trash: { useMutation: () => ({ mutate: mocks.trash, isPending: false }) },
        restore: { useMutation: () => ({ mutate: mocks.restore, isPending: false }) },
        purge: { useMutation: () => ({ mutate: mocks.purge, isPending: false }) },
        emptyTrash: { useMutation: () => ({ mutate: mocks.empty, isPending: false }) },
      },
      aiAutoFeedback: { getByUser: { useQuery: () => ({ data: [], isLoading: false }) } },
    },
  };
});

import MyWritings from "./MyWritings";

let container: HTMLDivElement;
let root: Root;
const buttons = (label: string) => Array.from(container.querySelectorAll<HTMLButtonElement>("button")).filter((button) => button.textContent?.replace(/\s+/g, " ").trim().includes(label));
const render = async () => act(async () => root.render(<MyWritings />));

beforeEach(() => {
  (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
  vi.clearAllMocks();
  mocks.essays = [{ id: 5, title: "내 글", content: "본문", status: "draft", aiFeedbackId: null, updatedAt: new Date("2026-10-10T00:00:00Z") }];
  mocks.trashed = [{ id: 8, title: "지운 글", status: "draft", preview: "지운 본문", deletedAt: new Date("2026-10-11T00:00:00Z"), updatedAt: new Date("2026-10-10T00:00:00Z") }];
  window.history.pushState({}, "", "/my-writings");
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});
afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
  vi.restoreAllMocks();
});

describe("글 삭제·휴지통 화면", () => {
  it("삭제를 확인하면 글을 휴지통으로 옮기고, 취소하면 아무것도 하지 않는다", async () => {
    await render();
    const confirm = vi.spyOn(window, "confirm");
    confirm.mockReturnValueOnce(false);
    await act(async () => buttons("삭제")[0].click());
    expect(mocks.trash).not.toHaveBeenCalled();
    confirm.mockReturnValueOnce(true);
    await act(async () => buttons("삭제")[0].click());
    expect(mocks.trash).toHaveBeenCalledWith({ essayId: 5 });
  });

  it("?tab=trash로 들어오면 휴지통 탭이 열려 지운 글과 복원·영구 삭제·비우기 버튼을 보여 준다", async () => {
    window.history.pushState({}, "", "/my-writings?tab=trash");
    await render();
    const html = container.innerHTML;
    expect(html).toContain('data-testid="essay-trash"');
    expect(html).toContain("지운 글");
    expect(html).toContain("지운 본문");
    expect(html).toContain("휴지통 (1)");
    expect(buttons("복원")).toHaveLength(1);
    expect(buttons("영구 삭제")).toHaveLength(1);
    expect(buttons("휴지통 비우기")).toHaveLength(1);
  });

  it("복원은 바로, 영구 삭제와 비우기는 확인 뒤에만 실행한다", async () => {
    window.history.pushState({}, "", "/my-writings?tab=trash");
    await render();
    await act(async () => buttons("복원")[0].click());
    expect(mocks.restore).toHaveBeenCalledWith({ essayId: 8 });

    const confirm = vi.spyOn(window, "confirm").mockReturnValue(false);
    await act(async () => buttons("영구 삭제")[0].click());
    await act(async () => buttons("휴지통 비우기")[0].click());
    expect(mocks.purge).not.toHaveBeenCalled();
    expect(mocks.empty).not.toHaveBeenCalled();

    confirm.mockReturnValue(true);
    await act(async () => buttons("영구 삭제")[0].click());
    await act(async () => buttons("휴지통 비우기")[0].click());
    expect(mocks.purge).toHaveBeenCalledWith({ essayId: 8 });
    expect(mocks.empty).toHaveBeenCalledTimes(1);
  });

  it("휴지통이 비어 있으면 안내하고 비우기 버튼을 막는다", async () => {
    mocks.trashed = [];
    window.history.pushState({}, "", "/my-writings?tab=trash");
    await render();
    expect(container.textContent).toContain("휴지통이 비어 있습니다.");
    expect(buttons("휴지통 비우기")[0].disabled).toBe(true);
  });
});

describe("글쓰기 화면의 삭제·휴지통 입구", () => {
  it("선택한 글을 삭제하고 휴지통(/my-writings?tab=trash)으로 가는 버튼이 있다", async () => {
    const source = (await import("node:fs")).readFileSync((await import("node:path")).join(process.cwd(), "client/src/components/EssayWorkspace.tsx"), "utf8");
    expect(source).toContain("trpc.essaySubmission.trash.useMutation()");
    expect(source).toContain("removeEssay");
    expect(source).toContain('href="/my-writings?tab=trash"');
    // 서버에 있는 글은 휴지통으로, 기기에만 있는 글은 되돌릴 수 없다고 먼저 알린다.
    expect(source).toContain("휴지통으로 옮길까요");
    expect(source).toContain("되돌릴 수 없습니다");
  });
});
