// @vitest-environment jsdom
import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({
  auth: { user: null as any, loading: false }, list: vi.fn(), stats: vi.fn(), bookmarks: vi.fn(), similar: vi.fn(), navigate: vi.fn(),
}));
vi.mock("@/_core/hooks/useAuth", () => ({ useAuth: () => mocks.auth }));
vi.mock("@/components/DashboardLayout", () => ({ default: ({ children }: any) => <main>{children}</main> }));
vi.mock("wouter", () => ({ useLocation: () => ["/essay-archive", mocks.navigate] }));
vi.mock("@/lib/trpc", () => ({ trpc: { questionBank: {
  list: { useQuery: mocks.list }, publicStats: { useQuery: mocks.stats },
  getBookmarks: { useQuery: mocks.bookmarks }, similarQuestions: { useQuery: mocks.similar },
  toggleBookmark: { useMutation: () => ({ mutateAsync: vi.fn() }) },
} } }));
import EssayArchive from "./EssayArchive";
import { COURSE_OPTIONS } from "@shared/course";
let container: HTMLDivElement;
let root: Root;
const courseButtons = () => Array.from(container.querySelectorAll<HTMLButtonElement>("button[aria-pressed]"));
async function render() { await act(async () => root.render(<EssayArchive />)); }

beforeEach(() => {
  (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
  vi.clearAllMocks(); mocks.auth = { user: { id: 55, role: "user", tag: "중고등" }, loading: false };
  mocks.list.mockReturnValue({ data: [], isLoading: false });
  mocks.stats.mockReturnValue({ data: [] });
  mocks.bookmarks.mockReturnValue({ data: [], refetch: vi.fn() });
  mocks.similar.mockReturnValue({ data: [] });
  container = document.createElement("div"); document.body.appendChild(container); root = createRoot(container);
});
afterEach(async () => { await act(async () => root.unmount()); container.remove(); });

describe("아카이브 과정 선택 권한", () => {
  it.each(COURSE_OPTIONS)("$label 학생은 자기 과정만 선택되고 다른 과정은 잠긴다", async ({ value, label }) => {
    mocks.auth.user.tag = label;
    await render();
    expect(mocks.list.mock.lastCall).toEqual([{ courseType: value, toolType: undefined }, { enabled: true }]);
    const buttons = courseButtons();
    expect(buttons).toHaveLength(4);
    expect(buttons.filter(b => !b.disabled)).toHaveLength(1);
    expect(buttons.find(b => !b.disabled)?.getAttribute("aria-pressed")).toBe("true");
    for (const button of buttons.filter(b => b.disabled)) {
      expect(button.textContent).toContain("이용 불가");
      await act(async () => button.click());
    }
    expect(mocks.list.mock.calls.every(([input]) => input.courseType === value)).toBe(true);
  });
  it("인증 로딩 중에는 서버 요청·과정 선택을 하지 않고 학생이 확정되면 자기 과정으로 요청한다", async () => {
    mocks.auth = { user: null, loading: true };
    await render();
    expect(mocks.list.mock.lastCall?.[1].enabled).toBe(false);
    expect(courseButtons().every(b => b.disabled)).toBe(true);
    expect(container.querySelector('[role="status"]')).not.toBeNull();
    mocks.auth = { user: { id: 55, role: "user", tag: "고등/대입" }, loading: false };
    await render();
    expect(mocks.list.mock.lastCall?.[0].courseType).toBe("high_univ");
    expect(mocks.list.mock.calls.filter(([, opts]) => opts.enabled).every(([input]) => input.courseType === "high_univ")).toBe(true);
  });
  it("과정 변경 시 기존 선택 상태보다 가입 과정이 우선한다", async () => {
    await render();
    mocks.auth.user = { id: 66, role: "user", tag: "일반/직장인" };
    await render();
    expect(mocks.list.mock.lastCall?.[0].courseType).toBe("general_adult");
    expect(courseButtons()[3].disabled).toBe(false);
    expect(courseButtons()[1].disabled).toBe(true);
  });
  it.each(["admin", "teacher"])("%s의 전체 과정 탐색은 유지한다", async role => {
    mocks.auth.user.role = role;
    await render();
    expect(courseButtons().every(b => !b.disabled)).toBe(true);
    await act(async () => courseButtons()[2].click());
    expect(mocks.list.mock.lastCall?.[0].courseType).toBe("high_univ");
  });
  it("캐시 등에 다른 과정 문항이 남아도 학생 화면에 표시하지 않는다", async () => {
    mocks.list.mockReturnValue({ data: [
      { id: 1, courseType: "middle_high", title: "내 과정 문항", toolType: "quiz", contentData: "{}" },
      { id: 2, courseType: "elementary", title: "다른 과정 문항", toolType: "quiz", contentData: "{}" },
    ], isLoading: false });
    await render();
    expect(container.textContent).toContain("내 과정 문항");
    expect(container.textContent).not.toContain("다른 과정 문항");
  });
  it("비로그인 샘플에는 학생 과정 제한을 적용하거나 실제 문항 API를 요청하지 않는다", async () => {
    mocks.auth.user = null;
    await render();
    expect(courseButtons().every(b => !b.disabled)).toBe(true);
    expect(mocks.list.mock.lastCall?.[1].enabled).toBe(false);
    expect(mocks.similar.mock.lastCall?.[1].enabled).toBe(false);
  });
});
