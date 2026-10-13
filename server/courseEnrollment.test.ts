import { beforeEach, describe, expect, it, vi } from "vitest";
import { GUARDIAN_CONSENT_VERSION } from "@shared/guardian";

const state = vi.hoisted(() => ({
  current: undefined as Record<string, unknown> | undefined,
  latestConsent: null as {
    status: "pending" | "approved" | "withdrawn";
  } | null,
  selectCalls: [] as unknown[][],
  sent: [] as Array<Record<string, unknown>>,
  clearCalls: [] as number[],
  emailFailure: null as Error | null,
}));

vi.mock("./db", () => ({
  getUserById: vi.fn(async () => state.current),
  getLatestGuardianConsentForUser: vi.fn(async () => state.latestConsent),
  selectUserCourse: vi.fn(async (...args: unknown[]) => {
    state.selectCalls.push(args);
    return { id: args[0], tag: "초등" };
  }),
}));

vi.mock("./email", () => ({
  createVerificationToken: vi.fn(() => "a".repeat(64)),
  hashVerificationToken: vi.fn((token: string) => `hash:${token}`),
  sendGuardianConsentEmail: vi.fn(async (message: Record<string, unknown>) => {
    state.sent.push(message);
    if (state.emailFailure) throw state.emailFailure;
  }),
}));

vi.mock("./_core/trpc", () => ({
  clearGuardianStatusCache: vi.fn((userId: number) =>
    state.clearCalls.push(userId)
  ),
}));

import { chooseLearningCourse } from "./courseEnrollment";

const learner = {
  id: 17,
  role: "user",
  tag: "과정 미선택",
  name: "김학생",
  email: "student@example.com",
};

const elementaryInput = {
  courseType: "elementary" as const,
  birthDate: "2016-05-01",
  guardian: {
    name: "김보호",
    email: "guardian@example.com",
    relation: "모" as const,
  },
};

function resetState() {
  state.current = { ...learner };
  state.latestConsent = null;
  state.selectCalls = [];
  state.sent = [];
  state.clearCalls = [];
  state.emailFailure = null;
}

describe("chooseLearningCourse", () => {
  beforeEach(resetState);

  it("rejects non-learner accounts without attempting an enrollment", async () => {
    await expect(
      chooseLearningCourse(
        { ...learner, role: "teacher", tag: "첨삭교사" },
        { courseType: "middle_high" },
        "https://essay.example"
      )
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(state.selectCalls).toHaveLength(0);
  });

  it("uses a fresh database user as the authority and rejects a stale concurrent choice", async () => {
    state.current = { ...learner, tag: "중고등" };

    await expect(
      chooseLearningCourse(
        learner,
        { courseType: "general_adult" },
        "https://essay.example"
      )
    ).rejects.toMatchObject({ code: "CONFLICT" });
    expect(state.selectCalls).toHaveLength(0);
  });

  it("assigns a non-elementary course through the conditional transactional selector", async () => {
    await expect(
      chooseLearningCourse(
        learner,
        { courseType: "high_univ" },
        "https://essay.example"
      )
    ).resolves.toEqual({
      courseType: "high_univ",
      requiresGuardianConsent: false,
      guardianEmailSent: false,
    });

    expect(state.selectCalls).toEqual([[17, "high_univ"]]);
    expect(state.clearCalls).toEqual([17]);
    expect(state.sent).toHaveLength(0);
  });

  it("requires a real birth date, guardian details, and a guardian email different from the student", async () => {
    await expect(
      chooseLearningCourse(
        learner,
        { courseType: "elementary" },
        "https://essay.example"
      )
    ).rejects.toMatchObject({
      code: "BAD_REQUEST",
      message: expect.stringContaining("생년월일"),
    });
    await expect(
      chooseLearningCourse(
        learner,
        { ...elementaryInput, birthDate: "2016-02-31" },
        "https://essay.example"
      )
    ).rejects.toMatchObject({
      code: "BAD_REQUEST",
      message: expect.stringContaining("정확히"),
    });
    await expect(
      chooseLearningCourse(
        learner,
        {
          ...elementaryInput,
          guardian: {
            ...elementaryInput.guardian,
            email: "STUDENT@example.com",
          },
        },
        "https://essay.example"
      )
    ).rejects.toMatchObject({
      code: "BAD_REQUEST",
      message: expect.stringContaining("달라야"),
    });

    expect(state.selectCalls).toHaveLength(0);
  });

  it("stores a pending guardian record transactionally before sending the consent email", async () => {
    await expect(
      chooseLearningCourse(learner, elementaryInput, "https://essay.example/")
    ).resolves.toEqual({
      courseType: "elementary",
      requiresGuardianConsent: true,
      guardianEmailSent: true,
    });

    expect(state.selectCalls).toHaveLength(1);
    const [, courseType, consent] = state.selectCalls[0] as [
      number,
      string,
      Record<string, unknown>,
    ];
    expect(courseType).toBe("elementary");
    expect(consent).toMatchObject({
      userId: 17,
      childBirthDate: "2016-05-01",
      guardianName: "김보호",
      guardianRelation: "모",
      guardianEmail: "guardian@example.com",
      tokenHash: `hash:${"a".repeat(64)}`,
      consentVersion: GUARDIAN_CONSENT_VERSION,
    });
    expect(consent.tokenExpiresAt).toBeInstanceOf(Date);
    expect(state.sent).toEqual([
      expect.objectContaining({
        to: "guardian@example.com",
        guardianName: "김보호",
        childName: "김학생",
        consentUrl: `https://essay.example/guardian-consent?token=${"a".repeat(64)}`,
      }),
    ]);
    expect(state.clearCalls).toEqual([17]);
  });

  it("retains the saved pending request when mail delivery fails and reports that it was not sent", async () => {
    state.emailFailure = new Error("mail provider unavailable");

    await expect(
      chooseLearningCourse(learner, elementaryInput, "https://essay.example")
    ).resolves.toEqual({
      courseType: "elementary",
      requiresGuardianConsent: true,
      guardianEmailSent: false,
    });

    // The selector was called before mail delivery. Its transactional contract
    // creates the pending record before it changes the course tag.
    expect(state.selectCalls).toHaveLength(1);
    expect(state.sent).toHaveLength(1);
  });

  it("preserves an existing approved record and does not create or mail another request", async () => {
    state.latestConsent = { status: "approved" };

    await expect(
      chooseLearningCourse(learner, elementaryInput, "https://essay.example")
    ).resolves.toEqual({
      courseType: "elementary",
      requiresGuardianConsent: false,
      guardianEmailSent: false,
    });

    expect(state.selectCalls).toEqual([[17, "elementary", undefined]]);
    expect(state.sent).toHaveLength(0);
  });

  it("does not duplicate a pending guardian record or email an unstored token", async () => {
    state.latestConsent = { status: "pending" };

    await expect(
      chooseLearningCourse(learner, elementaryInput, "https://essay.example")
    ).resolves.toEqual({
      courseType: "elementary",
      requiresGuardianConsent: true,
      guardianEmailSent: false,
    });

    expect(state.selectCalls).toEqual([[17, "elementary", undefined]]);
    expect(state.sent).toHaveLength(0);
  });
});
