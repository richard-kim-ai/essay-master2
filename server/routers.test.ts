import { describe, it, expect, beforeEach, vi } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

function createMockContext(overrides?: Partial<TrpcContext>): TrpcContext {
  return {
    user: {
      id: 1,
      openId: "test-user",
      email: "test@example.com",
      name: "Test User",
      loginMethod: "manus",
      role: "user",
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSignedIn: new Date(),
    },
    req: {
      protocol: "https",
      headers: {},
    } as any,
    res: {
      clearCookie: vi.fn(),
    } as any,
    ...overrides,
  };
}

describe("appRouter", () => {
  describe("auth", () => {
    it("should return current user with me query", async () => {
      const ctx = createMockContext();
      const caller = appRouter.createCaller(ctx);

      const result = await caller.auth.me();

      expect(result).toEqual(ctx.user);
    });

    it("should clear cookie on logout", async () => {
      const ctx = createMockContext();
      const caller = appRouter.createCaller(ctx);

      const result = await caller.auth.logout();

      expect(result).toEqual({ success: true });
      expect(ctx.res.clearCookie).toHaveBeenCalled();
    });
  });

  describe("curriculum", () => {
    it("should get curriculum by type", async () => {
      const ctx = createMockContext();
      const caller = appRouter.createCaller(ctx);

      const result = await caller.curriculum.getByType("elementary");

      expect(Array.isArray(result)).toBe(true);
    });

    it("이론 콘텐츠는 문제은행과 분리된 과정·레벨 기준 목록으로 조회한다", async () => {
      const caller = appRouter.createCaller(createMockContext());
      const result = await caller.curriculum.getTheoryContent({ courseType: "middle_high", lessonLevel: 2 });
      expect(result.length).toBeGreaterThan(0);
      expect(result.every((item) => item.courseType === "middle_high" && item.lessonLevel === 2)).toBe(true);
      expect(result.every((item) => "contentData" in item && !("toolType" in item))).toBe(true);
    });
  });

  describe("difficulty operation preset", () => {
    it("일반 사용자는 전체 과정의 난이도 운영 프리셋을 변경할 수 없다", async () => {
      const caller = appRouter.createCaller(createMockContext());
      await expect(caller.admin.saveDifficultyOperationPreset({ mode: "advanced" })).rejects.toMatchObject({ code: "FORBIDDEN" });
    });
  });

  describe("progress", () => {
    it("should upsert user progress", async () => {
      const ctx = createMockContext();
      const caller = appRouter.createCaller(ctx);

      const result = await caller.progress.upsert({
        curriculumId: 1,
        score: 85,
        completed: 50,
      });

      expect(result).toBeDefined();
    });

    it("should get user progress", async () => {
      const ctx = createMockContext();
      const caller = appRouter.createCaller(ctx);

      const result = await caller.progress.getByUser();

      expect(Array.isArray(result)).toBe(true);
    });
  });

  describe("teacherOperations", () => {
    it("승인되지 않은 일반 사용자의 관리 범위 조회를 차단한다", async () => {
      const caller = appRouter.createCaller(createMockContext());
      await expect(caller.teacherOperations.managedStudents()).rejects.toMatchObject({ code: "FORBIDDEN" });
    });

    it("승인된 교사는 자신에게 부여된 관리 범위 목록을 조회할 수 있다", async () => {
      const caller = appRouter.createCaller(createMockContext({
        user: {
          ...createMockContext().user!,
          role: "teacher",
          teacherStatus: "approved",
        } as any,
      }));
      const result = await caller.teacherOperations.managedStudents();
      expect(Array.isArray(result)).toBe(true);
    });

    it("일반 사용자의 담당 반 출결·진도 대시보드 조회를 차단한다", async () => {
      const caller = appRouter.createCaller(createMockContext());
      await expect(caller.teacherOperations.classDashboard({ attendanceDate: "2026-08-18" })).rejects.toMatchObject({ code: "FORBIDDEN" });
    });

    it("일반 사용자의 상용구·월간 통계·마감 알림 작업을 차단한다", async () => {
      const caller = appRouter.createCaller(createMockContext());
      await expect(caller.teacherOperations.feedbackTemplates()).rejects.toMatchObject({ code: "FORBIDDEN" });
      await expect(caller.teacherOperations.monthlyAssignmentStats({ month: "2026-08" })).rejects.toMatchObject({ code: "FORBIDDEN" });
      await expect(caller.teacherOperations.assignmentNotificationStats()).rejects.toMatchObject({ code: "FORBIDDEN" });
      await expect(caller.teacherOperations.assignmentReminderHistory()).rejects.toMatchObject({ code: "FORBIDDEN" });
      await expect(caller.teacherOperations.classAssignmentSubmissions()).rejects.toMatchObject({ code: "FORBIDDEN" });
      await expect(caller.teacherOperations.approvedWritingExamples()).rejects.toMatchObject({ code: "FORBIDDEN" });
      await expect(caller.teacherOperations.publishWritingExample({ sourceSubmissionId: 1, courseType: "elementary", title: "익명 예시", topic: "주장과 근거", anonymizedContent: "학생의 식별 정보를 제거한 충분한 길이의 익명화 예시문입니다. 근거를 두 가지 이상 제시합니다.", confirmAnonymized: true })).rejects.toMatchObject({ code: "FORBIDDEN" });
      await expect(caller.teacherOperations.reviewClassAssignmentSubmission({ submissionId: 1, score: 80, teacherComment: "구체적인 근거를 더 보강해보세요." })).rejects.toMatchObject({ code: "FORBIDDEN" });
      await expect(caller.teacherOperations.classAssignmentAiFeedback({ submissionId: 1 })).rejects.toMatchObject({ code: "FORBIDDEN" });
      await expect(caller.teacherOperations.generateClassAssignmentAiFeedback({ submissionId: 1 })).rejects.toMatchObject({ code: "FORBIDDEN" });
      await expect(caller.teacherOperations.notifyUpcomingAssignmentStudents({ hoursAhead: 72 })).rejects.toMatchObject({ code: "FORBIDDEN" });
    });
  });

  describe("student class assignments", () => {
    it("교사·관리자 계정은 학생 배정 과제를 조회하거나 제출할 수 없다", async () => {
      const teacherCaller = appRouter.createCaller(createMockContext({
        user: { ...createMockContext().user!, role: "teacher", teacherStatus: "approved" } as any,
      }));
      await expect(teacherCaller.student.myAssignments()).rejects.toMatchObject({ code: "FORBIDDEN" });
      await expect(teacherCaller.student.submitAssignment({ assignmentId: 1, content: "과제 답안 제출을 위한 충분한 길이의 예시 문장입니다." })).rejects.toMatchObject({ code: "FORBIDDEN" });
      await expect(teacherCaller.learningResources.myLessonGuideHistory()).rejects.toMatchObject({ code: "FORBIDDEN" });
      await expect(teacherCaller.learningResources.publishedWritingExamples()).rejects.toMatchObject({ code: "FORBIDDEN" });
    });

    it("학습자는 자기 AI 레슨 가이드 이력과 가입 과정의 승인 예시문을 조회할 수 있다", async () => {
      const caller = appRouter.createCaller(createMockContext());
      await expect(caller.learningResources.myLessonGuideHistory()).resolves.toEqual(expect.any(Array));
      await expect(caller.learningResources.publishedWritingExamples()).resolves.toEqual(expect.any(Array));
    });

    it("관리자 점검 계정은 다른 과정의 퀴즈 오답을 저장하지 않고 정상 종료한다", async () => {
      const adminCaller = appRouter.createCaller(createMockContext({
        user: { ...createMockContext().user!, role: "admin", tag: "일반" } as any,
      }));
      await expect(adminCaller.questionBank.recordMistake({
        questionBankId: 90001,
        courseType: "elementary",
        toolType: "quiz",
        userAnswer: "관리자 점검 답안",
        score: 0,
        aiFeedback: "관리자 점검용 피드백입니다.",
      })).resolves.toMatchObject({ skipped: true });
    });

    it("학습자는 가입하지 않은 과정의 학습 도구 오답을 저장할 수 없다", async () => {
      const caller = appRouter.createCaller(createMockContext({
        user: { ...createMockContext().user!, role: "user", tag: "초등" } as any,
      }));
      await expect(caller.questionBank.recordMistake({
        questionBankId: 90001,
        courseType: "general_adult",
        toolType: "quiz",
        userAnswer: "학습자 답안",
        score: 0,
        aiFeedback: "과정 제한 검증용 피드백입니다.",
      })).rejects.toMatchObject({ code: "FORBIDDEN" });
    });
  });

  describe("parent assignment access", () => {
    it("연결되지 않은 학생의 과제·채점 정보를 학부모 계정으로 조회할 수 없다", async () => {
      const caller = appRouter.createCaller(createMockContext());
      await expect(caller.parent.studentDetail({ studentId: 999999 })).rejects.toMatchObject({ code: "FORBIDDEN" });
    });
  });

  describe("academic approval administration", () => {
    it("일반 사용자의 교사 권한 부여 목록 조회를 차단한다", async () => {
      const caller = appRouter.createCaller(createMockContext());
      await expect(caller.admin.getTeacherPermissionGrants()).rejects.toMatchObject({ code: "FORBIDDEN" });
    });

    it("일반 사용자의 별도 관리자 계정 생성과 반·그룹 조회를 차단한다", async () => {
      const caller = appRouter.createCaller(createMockContext());
      await expect(caller.admin.createAdminAccount({ name: "운영 관리자", email: "admin@example.com", password: "temporary-pass-123" })).rejects.toMatchObject({ code: "FORBIDDEN" });
      await expect(caller.admin.getLearningGroups()).rejects.toMatchObject({ code: "FORBIDDEN" });
    });

    it("기존 계정을 관리자 역할로 변경하는 입력을 허용하지 않는다", async () => {
      const caller = appRouter.createCaller(createMockContext({ user: { ...createMockContext().user!, role: "admin" } as any }));
      await expect(caller.admin.updateUserRole({ userId: 2, newRole: "admin" as any })).rejects.toMatchObject({ code: "BAD_REQUEST" });
    });

    it("일반 사용자의 관리자 감사 로그 조회를 차단한다", async () => {
      const caller = appRouter.createCaller(createMockContext());
      await expect(caller.admin.getAuditLogs({ limit: 20 })).rejects.toMatchObject({ code: "FORBIDDEN" });
    });
  });

  describe("quiz", () => {
    it.skip("should create quiz answer", async () => {
      const ctx = createMockContext();
      const caller = appRouter.createCaller(ctx);

      const result = await caller.quiz.create({
        quizId: 1,
        userAnswer: "test answer",
        isCorrect: 1,
        feedback: "Good answer",
        economyScore: "85",
        clarityScore: "90",
        accuracyScore: "88",
      });

      expect(result).toBeDefined();
    });
  });

  describe("certificate", () => {
    it("학습자 계정만 자신의 수료 기준을 조회하고 수료증을 신청할 수 있다", async () => {
      const learnerCaller = appRouter.createCaller(createMockContext());
      const eligibility = await learnerCaller.certificate.eligibility();
      expect(eligibility).toHaveProperty("completionRate");
      expect(eligibility).toHaveProperty("levelEligibility");

      const teacherCaller = appRouter.createCaller(createMockContext({
        user: { ...createMockContext().user!, role: "teacher", teacherStatus: "approved" } as any,
      }));
      await expect(teacherCaller.certificate.issue({ courseType: "elementary", level: 1, certificateType: "level_certificate" })).rejects.toMatchObject({ code: "FORBIDDEN" });

      const adminCaller = appRouter.createCaller(createMockContext({
        user: { ...createMockContext().user!, role: "admin", teacherStatus: "approved" } as any,
      }));
      await expect(adminCaller.certificate.issue({ courseType: "elementary", level: 1, certificateType: "level_certificate" })).rejects.toMatchObject({ code: "FORBIDDEN" });
    });

    it.skip("should create certificate", async () => {
      const ctx = createMockContext();
      const caller = appRouter.createCaller(ctx);

      const result = await caller.certificate.create({
        courseType: "elementary",
        level: 1,
        certificateType: "level_certificate",
      });

      expect(result).toBeDefined();
      expect(result.shareToken).toBeDefined();
    });

    it("should get user certificates", async () => {
      const ctx = createMockContext();
      const caller = appRouter.createCaller(ctx);

      const result = await caller.certificate.getUserCertificates();

      expect(Array.isArray(result)).toBe(true);
    });
  });

  describe("badges", () => {
    it("교사 계정은 학습 뱃지를 임의로 수여할 수 없다", async () => {
      const caller = appRouter.createCaller(createMockContext({
        user: { ...createMockContext().user!, role: "teacher", teacherStatus: "approved" } as any,
      }));
      await expect(caller.badges.award({ courseType: "elementary", badgeType: "summary", badgeName: "초등 요약왕 뱃지" })).rejects.toMatchObject({ code: "FORBIDDEN" });
    });

    it("수행 기록이 없는 학습자는 요약 뱃지를 임의로 수여할 수 없다", async () => {
      const caller = appRouter.createCaller(createMockContext({
        user: { ...createMockContext().user!, role: "user", tag: "초등" } as any,
      }));
      await expect(caller.badges.award({ courseType: "elementary", badgeType: "summary", badgeName: "초등 요약 전문가 뱃지" })).rejects.toMatchObject({ code: "FORBIDDEN" });
    });

    it("검증 근거가 정의되지 않은 임의 뱃지 유형을 차단한다", async () => {
      const caller = appRouter.createCaller(createMockContext({
        user: { ...createMockContext().user!, role: "user", tag: "초등" } as any,
      }));
      await expect(caller.badges.award({ courseType: "elementary", badgeType: "topic_wizard", badgeName: "임의 수여 뱃지" })).rejects.toMatchObject({ code: "BAD_REQUEST" });
    });
  });

  describe("essaySubmission", () => {
    it.skip("should create essay", async () => {
      const ctx = createMockContext();
      const caller = appRouter.createCaller(ctx);

      const result = await caller.essaySubmission.create({
        title: "Test Essay",
        content: "Test content",
        courseType: "elementary",
        level: 1,
        status: "draft",
      });

      expect(result).toBeDefined();
    });

    it.skip("should get user essays", async () => {
      const ctx = createMockContext();
      const caller = appRouter.createCaller(ctx);

      const result = await caller.essaySubmission.getByUser();

      expect(Array.isArray(result)).toBe(true);
    });
  });

  describe("teacherFeedback", () => {
    it.skip("should create feedback", async () => {
      const ctx = createMockContext();
      const caller = appRouter.createCaller(ctx);

      const result = await caller.teacherFeedback.create({
        essayId: 1,
        score: 85,
        feedback: "Good work!",
      });

      expect(result).toBeDefined();
    });

    it.skip("should get feedback by essay", async () => {
      const ctx = createMockContext();
      const caller = appRouter.createCaller(ctx);

      const result = await caller.teacherFeedback.getByEssay({
        essayId: 1,
      });

      expect(result).toBeDefined();
    });
  });

  describe("aiAutoFeedback", () => {
    it.skip("should create AI feedback", async () => {
      const ctx = createMockContext();
      const caller = appRouter.createCaller(ctx);

      const result = await caller.aiAutoFeedback.create({
        essayTitle: "Test Essay",
        essayContent: "Test essay content",
        courseType: "elementary",
        level: 1,
      });

      expect(result).toBeDefined();
    }, { timeout: 30000 });

    it.skip("should get user AI feedback", async () => {
      const ctx = createMockContext();
      const caller = appRouter.createCaller(ctx);

      const result = await caller.aiAutoFeedback.getByUser();

      expect(Array.isArray(result)).toBe(true);
    });
  });
});
