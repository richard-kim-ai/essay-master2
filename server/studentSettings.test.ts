import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("./db", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./db")>();
  return {
    ...actual,
    getLatestGuardianConsentStatusForUser: vi.fn().mockResolvedValue(null),
    getApprovedTeachersForRecommendation: vi.fn(),
    setStudentOwnTeacher: vi.fn(),
    getUserById: vi.fn(),
    getDefaultAiTutor: vi.fn(),
    setAiLearningConsent: vi.fn(),
    getAiPersonalizationStatus: vi.fn(),
    createDataProcessingRequest: vi.fn(),
  };
});

const llm = vi.hoisted(() => ({ invokeLLM: vi.fn() }));
vi.mock("./_core/llm", () => llm);

import * as db from "./db";
import { appRouter } from "./routers";
import { evaluateWritingWithLLM } from "./writingEvaluationEngine";
import type { TrpcContext } from "./_core/context";

function callerFor(user: Record<string, unknown> | null) {
  const ctx = { user, req: { protocol: "https", headers: { host: "essay.example.com" }, socket: {} } as any, res: {} as any } as unknown as TrpcContext;
  return appRouter.createCaller(ctx);
}

const student = { id: 7, role: "user", tag: "중고등", teacherId: null, email: "s@example.com", name: "학생" };

beforeEach(() => {
  vi.clearAllMocks();
});

describe("학생의 담당 교사 선택(마이페이지)", () => {
  it("선택 가능한 목록에 없는 교사는 거절하고, 목록에 있으면 저장한다", async () => {
    vi.mocked(db.getApprovedTeachersForRecommendation).mockResolvedValue([{ id: 11, name: "김교사", email: "t@example.com", teacherLevel: 2, courseMatch: true }]);
    await expect(callerFor(student).auth.selectMyTeacher({ teacherId: 99 })).rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect(db.setStudentOwnTeacher).not.toHaveBeenCalled();

    await callerFor(student).auth.selectMyTeacher({ teacherId: 11 });
    expect(db.setStudentOwnTeacher).toHaveBeenCalledWith(7, 11);
  });

  it("null이면 AI 첨삭 봇(기본 담당)으로 되돌린다", async () => {
    await callerFor(student).auth.selectMyTeacher({ teacherId: null });
    expect(db.setStudentOwnTeacher).toHaveBeenCalledWith(7, null);
  });

  it("학생이 아닌 계정은 담당 교사를 선택할 수 없다", async () => {
    await expect(callerFor({ ...student, role: "teacher", teacherStatus: "approved" }).auth.selectMyTeacher({ teacherId: null })).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("목록 조회에는 교사 이메일이 포함되지 않는다", async () => {
    vi.mocked(db.getApprovedTeachersForRecommendation).mockResolvedValue([{ id: 11, name: "김교사", email: "t@example.com", teacherLevel: 2, courseMatch: true }]);
    vi.mocked(db.getDefaultAiTutor).mockResolvedValue({ id: 1 } as any);
    const result = await callerFor(student).auth.myTeacher();
    expect(result.currentTeacherName).toBe("AI 첨삭 전용 봇");
    expect(JSON.stringify(result)).not.toContain("t@example.com");
  });
});

describe("AI 개인 맞춤 첨삭 동의(마이페이지)", () => {
  it("동의를 켜면 동의 기록을 저장하고, 철회하면 철회 후 처리 요청 기록을 남긴다", async () => {
    vi.mocked(db.setAiLearningConsent).mockResolvedValueOnce({ consented: true });
    await callerFor(student).policy.setAiPersonalization({ enabled: true });
    expect(db.setAiLearningConsent).toHaveBeenLastCalledWith(7, true);
    expect(db.createDataProcessingRequest).not.toHaveBeenCalled();

    vi.mocked(db.setAiLearningConsent).mockResolvedValueOnce({ consented: false });
    await callerFor(student).policy.setAiPersonalization({ enabled: false });
    expect(db.setAiLearningConsent).toHaveBeenLastCalledWith(7, false);
    expect(db.createDataProcessingRequest).toHaveBeenCalledWith(7, "withdraw_ai_learning", expect.any(String));
  });

  it("학습자가 아닌 계정은 설정할 수 없다", async () => {
    await expect(callerFor({ ...student, role: "admin" }).policy.setAiPersonalization({ enabled: true })).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(db.setAiLearningConsent).not.toHaveBeenCalled();
  });
});

describe("평가 엔진의 개인 맞춤 지시문", () => {
  const base = { task: "기술 발전이 교육에 미치는 영향을 논하시오", submission: { essay_text: "기술 발전은 교육에 큰 영향을 준다. 첫째, 학습 자료 접근이 쉬워진다. 둘째, 개별 학습이 가능해진다. 따라서 교육 기술을 적극 활용해야 한다." } };

  async function systemPromptFor(metadata: Record<string, unknown>) {
    llm.invokeLLM.mockResolvedValueOnce({ choices: [{ message: { content: "{}" } }] });
    await evaluateWritingWithLLM({ ...base, metadata });
    return llm.invokeLLM.mock.calls[0][0].messages[0].content as string;
  }

  it("learner_history가 있을 때만 맞춤 지시문이 붙는다", async () => {
    expect(await systemPromptFor({ title: "교육과 기술" })).not.toContain("learner_history");
    llm.invokeLLM.mockClear();
    expect(await systemPromptFor({ title: "교육과 기술", learner_history: { recent_essay_count: 2 } })).toContain("learner_history");
  });
});
