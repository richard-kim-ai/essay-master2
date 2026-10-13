// @vitest-environment jsdom
import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  mutate: vi.fn(),
  refresh: vi.fn(async () => undefined),
  logout: vi.fn(async () => undefined),
  onSuccess: undefined as
    | undefined
    | ((result: {
        courseType: string;
        requiresGuardianConsent: boolean;
        guardianEmailSent: boolean;
      }) => Promise<void>),
}));

vi.mock("@/_core/hooks/useAuth", () => ({
  useAuth: () => ({
    user: {
      id: 17,
      role: "user",
      tag: "과정 미선택",
      email: "student@example.com",
    },
    refresh: state.refresh,
    logout: state.logout,
  }),
}));

vi.mock("@/lib/trpc", () => ({
  trpc: {
    auth: {
      chooseLearningCourse: {
        useMutation: (options: { onSuccess: typeof state.onSuccess }) => {
          state.onSuccess = options.onSuccess;
          return { mutate: state.mutate, isPending: false, error: null };
        },
      },
    },
  },
}));

import { CourseEnrollment } from "./CourseEnrollment";

describe("CourseEnrollment", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(async () => {
    state.mutate.mockReset();
    state.refresh.mockClear();
    state.logout.mockClear();
    state.onSuccess = undefined;
    (
      globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }
    ).IS_REACT_ACT_ENVIRONMENT = true;
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    await act(async () => root.render(<CourseEnrollment />));
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
  });

  async function selectCourse(value: string) {
    const select =
      container.querySelector<HTMLSelectElement>("#learning-course")!;
    const user = userEvent.setup();
    await act(async () => {
      await user.selectOptions(select, value);
    });
  }

  async function change(selector: string, value: string) {
    const input = container.querySelector<HTMLInputElement | HTMLSelectElement>(
      selector
    )!;
    const user = userEvent.setup();
    await act(async () => {
      await user.clear(input);
      await user.type(input, value);
    });
  }

  async function submit() {
    const form = container.querySelector("form")!;
    await act(async () =>
      form.dispatchEvent(
        new Event("submit", { bubbles: true, cancelable: true })
      )
    );
  }

  it("starts with an explicit unselected placeholder and exposes all four courses", () => {
    const select =
      container.querySelector<HTMLSelectElement>("#learning-course")!;
    expect(select.value).toBe("");
    expect(select.options[0]?.textContent).toBe("과정을 선택해 주세요");
    expect(Array.from(select.options).map(option => option.value)).toEqual([
      "",
      "elementary",
      "middle_high",
      "high_univ",
      "general_adult",
    ]);
    expect(
      container.querySelector('[aria-label="법정대리인 정보"]')
    ).toBeNull();
  });

  it("does not submit until the learner explicitly chooses a course", async () => {
    await submit();
    expect(state.mutate).not.toHaveBeenCalled();
    expect(container.querySelector('[role="alert"]')?.textContent).toContain(
      "과정을 선택"
    );
  });

  it("shows elementary birth-date and guardian guidance only after choosing elementary", async () => {
    await selectCourse("elementary");
    expect(
      container.querySelector<HTMLInputElement>("#elementary-birth-date")
    ).not.toBeNull();
    expect(
      container.querySelector('[aria-label="법정대리인 정보"]')?.textContent
    ).toContain("보호자(법정대리인)의 동의");

    await selectCourse("middle_high");
    expect(container.querySelector("#elementary-birth-date")).toBeNull();
    expect(
      container.querySelector('[aria-label="법정대리인 정보"]')
    ).toBeNull();
  });

  it("submits the required elementary guardian payload without using the student email", async () => {
    await selectCourse("elementary");
    await change("#elementary-birth-date", "2016-05-01");
    await change('input[placeholder="보호자 성명"]', "김보호");
    await change(
      'input[placeholder="guardian@email.com"]',
      "guardian@example.com"
    );
    await submit();

    expect(state.mutate).toHaveBeenCalledWith({
      courseType: "elementary",
      birthDate: "2016-05-01",
      guardian: {
        name: "김보호",
        email: "guardian@example.com",
        relation: "부",
      },
    });
  });

  it("refreshes authenticated user data after a non-elementary assignment", async () => {
    await state.onSuccess!({
      courseType: "middle_high",
      requiresGuardianConsent: false,
      guardianEmailSent: false,
    });
    expect(state.refresh).toHaveBeenCalledOnce();
    expect(state.logout).not.toHaveBeenCalled();
  });
});
