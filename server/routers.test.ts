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
