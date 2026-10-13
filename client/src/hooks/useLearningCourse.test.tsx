// @vitest-environment jsdom
import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import {
  COURSE_OPTIONS,
  getCourseTag,
  parseCourseTypeFromUserTag,
} from "@shared/course";
const auth = vi.hoisted(() => ({ user: null as any, loading: false }));
vi.mock("@/_core/hooks/useAuth", () => ({ useAuth: () => auth }));
import { LearningCourseProvider, useLearningCourse } from "./useLearningCourse";
import { saveAdminPreviewCourse } from "@/lib/adminPreviewCourse";
let el: HTMLDivElement;
let root: ReturnType<typeof createRoot>;
let qc: QueryClient;
let current: ReturnType<typeof useLearningCourse>;
let generation = 0;
function Probe() {
  current = useLearningCourse();
  const [local] = React.useState(() => ++generation);
  return (
    <div data-generation={local}>
      {current.scopeKey}
      <span>{current.courseLabel}</span>
    </div>
  );
}
const render = async () =>
  act(async () => {
    root.render(
      <QueryClientProvider client={qc}>
        <LearningCourseProvider>
          <Probe />
        </LearningCourseProvider>
      </QueryClientProvider>
    );
    await Promise.resolve();
  });
beforeEach(() => {
  (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
  auth.user = null;
  auth.loading = false;
  localStorage.clear();
  qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  el = document.createElement("div");
  document.body.appendChild(el);
  root = createRoot(el);
  generation = 0;
});
afterEach(async () => {
  await act(async () => root.unmount());
  qc.clear();
  el.remove();
});
describe("단일 학습 과정과 신원 경계", () => {
  it.each(COURSE_OPTIONS)(
    "$label 학생의 모든 화면은 가입 과정으로 고정된다",
    async ({ value }) => {
      auth.user = { id: 101, role: "user", tag: getCourseTag(value) };
      saveAdminPreviewCourse("elementary", 101);
      await render();
      expect(current.courseType).toBe(value);
      expect(current.canPersist).toBe(true);
      expect(current.canSelectCourse).toBe(false);
      await act(async () =>
        current.setCourseType(
          value === "elementary" ? "high_univ" : "elementary"
        )
      );
      expect(current.courseType).toBe(value);
    }
  );
  it.each([
    undefined,
    null,
    "",
    "교사",
    "학부모",
    "관리자",
    "과정 미선택",
    "unknown",
    "__proto__",
  ])("누락/역할 태그 %s를 임의 과정으로 보정하지 않는다", tag => {
    expect(parseCourseTypeFromUserTag(tag)).toBeNull();
  });
  it("일반 레거시 태그는 기존 일반/직장인 과정을 유지한다", () =>
    expect(parseCourseTypeFromUserTag("일반")).toBe("general_adult"));
  it("과정 없는 학생은 학습 요청이 가능한 상태가 아니다", async () => {
    auth.user = { id: 102, role: "user", tag: "과정 미선택" };
    await render();
    expect(current).toMatchObject({
      courseType: null,
      canLearn: false,
      canPersist: false,
      needsSelection: true,
    });
  });
  it("학부모를 중고등 학생으로 오인하지 않는다", async () => {
    auth.user = { id: 103, role: "user", tag: "학부모" };
    await render();
    expect(current).toMatchObject({
      courseType: null,
      isStudent: false,
      canLearn: false,
      mode: "non-learner",
    });
  });
  it("관리자 탐색은 계정별로 보관되며 학습 기록은 저장할 수 없다", async () => {
    auth.user = { id: 1, role: "admin", tag: "일반" };
    await render();
    await act(async () => current.setCourseType("high_univ"));
    expect(current.courseType).toBe("high_univ");
    expect(current.canPersist).toBe(false);
    auth.user = { id: 2, role: "admin", tag: "일반" };
    await render();
    expect(current.courseType).toBe("elementary");
    auth.user = { id: 1, role: "admin", tag: "일반" };
    await render();
    expect(current.courseType).toBe("high_univ");
  });
  it("동일 과정의 A→B 계정 전환에도 이전 보호 쿼리·정답·화면 상태를 폐기한다", async () => {
    auth.user = { id: 101, role: "user", tag: "중고등" };
    await render();
    const before = el
      .querySelector("[data-generation]")!
      .getAttribute("data-generation");
    qc.setQueryData(
      [["questionBank", "random"], { input: { courseType: "middle_high" } }],
      [{ answer: "A 전용 정답" }]
    );
    qc.setQueryData([["auth", "me"]], auth.user);
    auth.user = { id: 202, role: "user", tag: "중고등" };
    await render();
    expect(
      qc.getQueryData([
        ["questionBank", "random"],
        { input: { courseType: "middle_high" } },
      ])
    ).toBeUndefined();
    expect(qc.getQueryData([["auth", "me"]])).toBeDefined();
    expect(
      el.querySelector("[data-generation]")!.getAttribute("data-generation")
    ).not.toBe(before);
    expect(current.scopeKey).toContain("202:");
  });
  it("역할·과정이 변경되면 화면 결과를 새 범위로 초기화한다", async () => {
    auth.user = { id: 1, role: "admin", tag: "일반" };
    await render();
    qc.setQueryData([["questionBank", "list"]], ["staff-answer"]);
    auth.user = { id: 1, role: "user", tag: "초등" };
    await render();
    expect(current.courseType).toBe("elementary");
    expect(current.canPersist).toBe(true);
    expect(qc.getQueryData([["questionBank", "list"]])).toBeUndefined();
  });
  it("인증 확인 중에는 이전 과정으로 API를 요청할 수 없다", async () => {
    auth.user = { id: 101, role: "user", tag: "고등/대입" };
    auth.loading = true;
    await render();
    expect(current.courseType).toBeNull();
    expect(current.canLearn).toBe(false);
  });
});
