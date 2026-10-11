import { beforeEach, describe, expect, it, vi } from "vitest";

// Keep the module's non-DB helpers real, but replace every persistence boundary reached
// by this suite.  This makes an authorization regression incapable of making a real
// write even when a route is accidentally allowed through its guard.
vi.mock("./db", async importOriginal => ({
  ...(await importOriginal<typeof import("./db")>()),
  getLatestGuardianConsentStatusForUser: vi.fn(),
  getCurriculumByType: vi.fn(),
  getDynamicCurriculumByType: vi.fn(),
  getLessonTheoryContentList: vi.fn(),
  getCurriculumById: vi.fn(),
  submitCurriculumWorkbookAnswer: vi.fn(),
  completeTheoryCheck: vi.fn(),
  getQuestionBankItemById: vi.fn(),
  recordLearningToolMistake: vi.fn(),
  generateTopicWizardGuide: vi.fn(),
  generateLessonWritingGuide: vi.fn(),
  generateDifficultyLearningGuide: vi.fn(),
  analyzeThesisStatement: vi.fn(),
  saveAiLessonGuideHistory: vi.fn(),
  submitQuestionFeedback: vi.fn(),
  getQuestionFeedbacksSummary: vi.fn(),
  getUserById: vi.fn(),
  updateUsersTag: vi.fn(),
  hasAiLearningConsent: vi.fn(),
  buildLearnerHistoryContext: vi.fn(),
  getDifficultyOperationPreset: vi.fn(),
  createAIAutoFeedback: vi.fn(),
  createWritingEvaluationRecord: vi.fn(),
  createEvaluationModelOperation: vi.fn(),
  createEvaluationReviewQueueItem: vi.fn(),
  linkEssayAiFeedback: vi.fn(),
  logAIUsage: vi.fn(),
  getEssaySubmissionById: vi.fn(),
}));

// The rejected standalone-AI cases must not reach this expensive boundary.
vi.mock("./writingEvaluationEngine", async importOriginal => ({
  ...(await importOriginal<typeof import("./writingEvaluationEngine")>()),
  evaluateWritingWithLLM: vi.fn(),
}));

import * as db from "./db";
import { evaluateWritingWithLLM } from "./writingEvaluationEngine";
import { clearGuardianStatusCache } from "./_core/trpc";
import type { TrpcContext } from "./_core/context";
import { appRouter } from "./routers";
import { COURSE_OPTIONS, type CourseType } from "../shared/course";

const COURSE_TYPES = COURSE_OPTIONS.map(({ value }) => value);
const WRITE_BOUNDARIES = [
  "submitCurriculumWorkbookAnswer",
  "completeTheoryCheck",
  "recordLearningToolMistake",
  "generateTopicWizardGuide",
  "generateLessonWritingGuide",
  "analyzeThesisStatement",
  "saveAiLessonGuideHistory",
  "submitQuestionFeedback",
  "createAIAutoFeedback",
  "createWritingEvaluationRecord",
  "createEvaluationModelOperation",
  "createEvaluationReviewQueueItem",
  "linkEssayAiFeedback",
  "logAIUsage",
  "updateUsersTag",
] as const;

function caller(
  user: Partial<NonNullable<TrpcContext["user"]>> &
    Pick<NonNullable<TrpcContext["user"]>, "id" | "role">
) {
  return appRouter.createCaller({
    user: {
      openId: `course-consistency-${user.id}`,
      tag: "중고등",
      teacherStatus: "approved",
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
      updatedAt: new Date("2026-01-01T00:00:00.000Z"),
      ...user,
    },
    req: { protocol: "https", headers: {} },
    res: {},
  } as unknown as TrpcContext);
}

function learner(course: CourseType, id = 101) {
  return caller({
    id,
    role: "user",
    tag: COURSE_OPTIONS.find(option => option.value === course)!.label,
  });
}

function question(overrides: Record<string, unknown> = {}) {
  return {
    id: 71,
    courseType: "middle_high",
    toolType: "quiz",
    isActive: 1,
    title: "주장과 근거",
    difficulty: "easy",
    contentData: JSON.stringify({
      prompt: "근거를 고르세요.",
      answer: "비공개",
    }),
    ...overrides,
  };
}

const validAiInput = {
  essayTitle: "가입 과정 확인용 논술",
  essayContent:
    "과정이 다른 경우 AI 평가 경계에서 즉시 거절되어야 하는 충분히 긴 글입니다.",
  level: 1,
};
const mistakeInput = {
  questionBankId: 71,
  courseType: "middle_high" as const,
  toolType: "quiz" as const,
  userAnswer: "학습자의 답안입니다.",
  score: 40,
  aiFeedback: "과정 일치 검증을 위한 피드백입니다.",
};

function expectNoWritesOrLlm() {
  for (const name of WRITE_BOUNDARIES) {
    expect(vi.mocked(db[name])).not.toHaveBeenCalled();
  }
  expect(evaluateWritingWithLLM).not.toHaveBeenCalled();
}

beforeEach(() => {
  vi.clearAllMocks();
  clearGuardianStatusCache();
  vi.mocked(db.getLatestGuardianConsentStatusForUser).mockResolvedValue(
    "approved" as never
  );
  vi.mocked(db.getCurriculumByType).mockResolvedValue([
    { id: 1, courseType: "middle_high" },
  ] as never);
  vi.mocked(db.getDynamicCurriculumByType).mockResolvedValue([
    { id: 2, courseType: "middle_high" },
  ] as never);
  vi.mocked(db.getLessonTheoryContentList).mockResolvedValue([
    { id: 3, courseType: "middle_high" },
  ] as never);
  vi.mocked(db.getCurriculumById).mockResolvedValue({
    id: 4,
    courseType: "middle_high",
  } as never);
  vi.mocked(db.submitCurriculumWorkbookAnswer).mockResolvedValue({
    isCorrect: true,
  } as never);
  vi.mocked(db.completeTheoryCheck).mockResolvedValue({
    completed: true,
  } as never);
  vi.mocked(db.getQuestionBankItemById).mockResolvedValue(question() as never);
  vi.mocked(db.recordLearningToolMistake).mockResolvedValue({
    stored: true,
  } as never);
  vi.mocked(db.generateTopicWizardGuide).mockResolvedValue({
    guide: "guide",
  } as never);
  vi.mocked(db.generateLessonWritingGuide).mockResolvedValue({
    guide: "lesson",
  } as never);
  vi.mocked(db.generateDifficultyLearningGuide).mockResolvedValue({
    guide: "difficulty",
  } as never);
  vi.mocked(db.analyzeThesisStatement).mockResolvedValue({
    guide: "thesis",
  } as never);
  vi.mocked(db.saveAiLessonGuideHistory).mockResolvedValue({ id: 91 } as never);
  vi.mocked(db.submitQuestionFeedback).mockResolvedValue({ id: 81 } as never);
  vi.mocked(db.getQuestionFeedbacksSummary).mockResolvedValue({
    total: 1,
    reports: [{ comment: "internal" }],
  } as never);
  vi.mocked(db.getUserById).mockResolvedValue({
    id: 700,
    role: "user",
    tag: "중고등",
  } as never);
  vi.mocked(db.updateUsersTag).mockResolvedValue({ success: true } as never);
});

describe("가입 과정 일관성 경계", () => {
  it.each(
    COURSE_OPTIONS.flatMap(({ value: enrolled, label }) =>
      COURSE_TYPES.filter(requested => requested !== enrolled).map(
        requested => ({ enrolled, label, requested })
      )
    )
  )(
    "$label 학습자는 $requested 과정의 조회·AI 가이드·essayId 없는 AI 평가를 모두 경계에서 거절한다",
    async ({ enrolled, requested }) => {
      const api = learner(enrolled);

      await expect(api.curriculum.getByType(requested)).rejects.toMatchObject({
        code: "FORBIDDEN",
      });
      await expect(
        api.curriculum.getDynamicByType(requested)
      ).rejects.toMatchObject({ code: "FORBIDDEN" });
      await expect(
        api.curriculum.getTheoryContent({ courseType: requested })
      ).rejects.toMatchObject({ code: "FORBIDDEN" });
      await expect(
        api.questionBank.topicWizardGuide({
          step: 1,
          courseType: requested,
          category: "논증",
        })
      ).rejects.toMatchObject({ code: "FORBIDDEN" });
      await expect(
        api.questionBank.lessonWritingGuide({
          courseType: requested,
          level: 1,
          lessonIndex: 0,
          lessonTitle: "논증 연습",
          lessonContent: "충분한 레슨 내용입니다.",
          lessonExample: "충분한 예시 문장입니다.",
        })
      ).rejects.toMatchObject({ code: "FORBIDDEN" });
      await expect(
        api.questionBank.analyzeThesis({
          courseType: requested,
          thesis:
            "충분한 길이의 주제문을 입력하여 다른 과정 차단을 확인합니다.",
        })
      ).rejects.toMatchObject({ code: "FORBIDDEN" });
      await expect(
        api.aiAutoFeedback.create({ ...validAiInput, courseType: requested })
      ).rejects.toMatchObject({ code: "FORBIDDEN" });

      expect(db.getCurriculumByType).not.toHaveBeenCalled();
      expect(db.getDynamicCurriculumByType).not.toHaveBeenCalled();
      expect(db.getLessonTheoryContentList).not.toHaveBeenCalled();
      expect(db.generateTopicWizardGuide).not.toHaveBeenCalled();
      expect(db.generateLessonWritingGuide).not.toHaveBeenCalled();
      expect(db.analyzeThesisStatement).not.toHaveBeenCalled();
      expectNoWritesOrLlm();
    }
  );

  it.each(COURSE_OPTIONS)(
    "$label 학습자의 실제 자기 과정 조회는 그대로 DB에 전달한다",
    async ({ value, label }) => {
      const api = learner(value);

      await api.curriculum.getByType(value);
      await api.curriculum.getDynamicByType(value);
      await api.curriculum.getTheoryContent({
        courseType: value,
        lessonLevel: 2,
        theoryCategory: "논증",
      });

      expect(db.getCurriculumByType).toHaveBeenCalledWith(value);
      expect(db.getDynamicCurriculumByType).toHaveBeenCalledWith(value);
      expect(db.getLessonTheoryContentList).toHaveBeenCalledWith({
        courseType: value,
        lessonLevel: 2,
        theoryCategory: "논증",
      });
      expectNoWritesOrLlm();
    }
  );

  it("ID로 우회한 커리큘럼은 실제 행의 과정을 확인한 뒤 거절하고 자기 과정 행은 반환한다", async () => {
    vi.mocked(db.getCurriculumById).mockResolvedValueOnce({
      id: 901,
      courseType: "elementary",
    } as never);
    await expect(
      learner("middle_high").curriculum.getById(901)
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(db.getCurriculumById).toHaveBeenCalledWith(901);

    vi.mocked(db.getCurriculumById).mockResolvedValueOnce({
      id: 902,
      courseType: "middle_high",
    } as never);
    await expect(
      learner("middle_high").curriculum.getById(902)
    ).resolves.toMatchObject({ id: 902 });
    expectNoWritesOrLlm();
  });

  it("워크북·이론 완료 쓰기는 서버가 확정한 expectedCourse를 DB에 전달한다", async () => {
    const api = learner("high_univ", 313);
    await api.curriculum.submitWorkbookAnswer({
      questionId: 44,
      userAnswer: "서술형 답안",
    });
    await api.theoryContent.completeCheck({ theoryContentId: 55 });

    expect(db.submitCurriculumWorkbookAnswer).toHaveBeenCalledWith(
      313,
      44,
      "서술형 답안",
      "high_univ"
    );
    expect(db.completeTheoryCheck).toHaveBeenCalledWith(313, 55, "high_univ");
  });

  it("정상 문항 메타데이터와 가입 과정이 모두 일치할 때만 학습 도구 오답을 저장한다", async () => {
    await learner("middle_high", 314).questionBank.recordMistake(mistakeInput);
    expect(db.getQuestionBankItemById).toHaveBeenCalledWith(71);
    expect(db.recordLearningToolMistake).toHaveBeenCalledWith({
      userId: 314,
      ...mistakeInput,
      courseType: "middle_high",
    });
  });

  it.each([
    ["다른 과정 메타데이터", question({ courseType: "elementary" })],
    ["비활성 문항", question({ isActive: 0 })],
    ["도구 종류 불일치", question({ toolType: "reordering" })],
  ])(
    "recordMistake는 %s를 입력 과정으로 위장해도 저장하지 않는다",
    async (_label, item) => {
      vi.mocked(db.getQuestionBankItemById).mockResolvedValue(item as never);
      await expect(
        learner("middle_high").questionBank.recordMistake(mistakeInput)
      ).rejects.toMatchObject({ code: "FORBIDDEN" });
      expect(db.recordLearningToolMistake).not.toHaveBeenCalled();
    }
  );

  it.each([
    [
      "submitFeedback",
      (api: ReturnType<typeof learner>) =>
        api.questionBank.submitFeedback({
          questionId: 71,
          isHelpful: 1,
          comment: "다른 과정 문항입니다.",
        }),
    ],
    [
      "feedbackSummary",
      (api: ReturnType<typeof learner>) =>
        api.questionBank.feedbackSummary({ questionId: 71 }),
    ],
  ])(
    "질문 피드백 %s도 ID의 실제 과정 확인 없이 진행되지 않는다",
    async (_name, invoke) => {
      vi.mocked(db.getQuestionBankItemById).mockResolvedValue(
        question({ courseType: "elementary" }) as never
      );
      await expect(invoke(learner("middle_high"))).rejects.toMatchObject({
        code: "FORBIDDEN",
      });
      expect(db.submitQuestionFeedback).not.toHaveBeenCalled();
      expect(db.getQuestionFeedbacksSummary).not.toHaveBeenCalled();
    }
  );

  it("질문 피드백은 자기 과정의 활성 문항 ID만 DB로 전달한다", async () => {
    await learner("middle_high", 315).questionBank.submitFeedback({
      questionId: 71,
      isHelpful: 1,
      comment: "도움이 됩니다.",
    });
    await learner("middle_high", 315).questionBank.feedbackSummary({
      questionId: 71,
    });
    expect(db.submitQuestionFeedback).toHaveBeenCalledWith({
      userId: 315,
      questionId: 71,
      isHelpful: 1,
      reportType: undefined,
      comment: "도움이 됩니다.",
    });
    expect(db.getQuestionFeedbacksSummary).toHaveBeenCalledWith(71);
  });

  it("과정 없는 태그, 학부모, 비로그인 및 잘못된 과정 입력은 DB 작업 전에 차단한다", async () => {
    const noCourse = caller({ id: 401, role: "user", tag: "과정 미선택" });
    const nullCourse = caller({ id: 403, role: "user", tag: null });
    const parent = caller({ id: 402, role: "user", tag: "학부모" });
    const anonymous = appRouter.createCaller({
      user: null,
      req: { protocol: "https", headers: {} },
      res: {},
    } as unknown as TrpcContext);

    await expect(
      noCourse.curriculum.getByType("middle_high")
    ).rejects.toMatchObject({ code: "PRECONDITION_FAILED" });
    await expect(
      noCourse.questionBank.analyzeThesis({
        courseType: "middle_high",
        thesis: "충분한 길이의 주제문을 입력하여 과정 검증을 확인합니다.",
      })
    ).rejects.toMatchObject({ code: "PRECONDITION_FAILED" });
    await expect(
      nullCourse.questionBank.difficultyLearningGuide()
    ).rejects.toMatchObject({ code: "PRECONDITION_FAILED" });
    await expect(
      parent.curriculum.getByType("middle_high")
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(
      parent.questionBank.lessonWritingGuide({
        courseType: "middle_high",
        level: 1,
        lessonIndex: 0,
        lessonTitle: "논증 연습",
        lessonContent: "충분한 레슨 내용입니다.",
        lessonExample: "충분한 예시 문장입니다.",
      })
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(
      anonymous.curriculum.getByType("middle_high")
    ).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    await expect(
      (
        learner("middle_high").curriculum.getByType as (
          value: unknown
        ) => Promise<unknown>
      )("not-a-course")
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });

    expect(db.getCurriculumByType).not.toHaveBeenCalled();
    expect(db.analyzeThesisStatement).not.toHaveBeenCalled();
    expect(db.generateLessonWritingGuide).not.toHaveBeenCalled();
    expect(db.generateDifficultyLearningGuide).not.toHaveBeenCalled();
    expectNoWritesOrLlm();
  });

  it.each([
    ["admin", { id: 501, role: "admin", tag: "학부모" }],
    [
      "approved teacher",
      { id: 502, role: "teacher", tag: "학부모", teacherStatus: "approved" },
    ],
  ] as const)(
    "%s는 명시한 과정의 검수 조회는 가능하지만 학습자 쓰기는 남기지 않는다",
    async (_name, user) => {
      const api = caller(user);
      await api.curriculum.getByType("general_adult");
      await api.curriculum.getDynamicByType("general_adult");
      await api.curriculum.getTheoryContent({ courseType: "general_adult" });
      await expect(
        api.questionBank.recordMistake({
          ...mistakeInput,
          courseType: "general_adult",
        })
      ).resolves.toMatchObject({ skipped: true });

      expect(db.getCurriculumByType).toHaveBeenCalledWith("general_adult");
      expect(db.getDynamicCurriculumByType).toHaveBeenCalledWith(
        "general_adult"
      );
      expect(db.getLessonTheoryContentList).toHaveBeenCalledWith({
        courseType: "general_adult",
      });
      expect(db.recordLearningToolMistake).not.toHaveBeenCalled();
      expectNoWritesOrLlm();
    }
  );

  it("관리자 과정 태그 변경은 학습자 대상만 허용하고 축약 태그를 정규 태그로 저장한다", async () => {
    const admin = caller({ id: 601, role: "admin", tag: "일반" });
    vi.mocked(db.getUserById).mockResolvedValueOnce({
      id: 701,
      role: "teacher",
      tag: "중고등",
    } as never);
    await expect(
      admin.admin.updateBatchTag({ studentIds: [701], tag: "초등" })
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(db.updateUsersTag).not.toHaveBeenCalled();

    vi.mocked(db.getUserById).mockResolvedValueOnce({
      id: 702,
      role: "user",
      tag: "중고등",
    } as never);
    await admin.admin.updateBatchTag({ studentIds: [702], tag: "일반" });
    expect(db.updateUsersTag).toHaveBeenCalledWith([702], "일반/직장인");
  });
});
