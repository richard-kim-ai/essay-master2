import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, protectedProcedure, router } from "./_core/trpc";
import * as db from "./db";
import { z } from "zod";
import { nanoid } from "nanoid";
import { evaluateEssay } from "./aiFeedback";
import { sdk } from "./_core/sdk";
import { TRPCError } from "@trpc/server";
import {
  createVerificationToken,
  hashPassword,
  hashVerificationToken,
  sendVerificationEmail,
  verifyPassword,
} from "./email";

const EMAIL_VERIFICATION_TTL_MS = 24 * 60 * 60 * 1000;
const SESSION_TTL_MS = 365 * 24 * 60 * 60 * 1000;

function requestOrigin(req: { protocol: string; headers: Record<string, unknown> }) {
  const forwardedProto = req.headers["x-forwarded-proto"];
  const protocol = (Array.isArray(forwardedProto) ? forwardedProto[0] : forwardedProto?.toString().split(",")[0])?.trim() || req.protocol || "https";
  const host = req.headers.host?.toString() || "localhost:3000";
  return `${protocol}://${host}`;
}

async function sendUserVerificationEmail(
  req: { protocol: string; headers: Record<string, unknown> },
  user: { id: number; email: string | null; name: string | null },
  token: string,
) {
  if (!user.email) throw new Error("Email address is required");
  await sendVerificationEmail({
    to: user.email,
    name: user.name || "학습자",
    verificationUrl: `${requestOrigin(req)}/verify-email?token=${encodeURIComponent(token)}`,
  });
}

export const appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query(({ ctx }) => {
      if (!ctx.user) return null;
      const {
        passwordHash: _passwordHash,
        verificationTokenHash: _verificationTokenHash,
        verificationTokenExpiresAt: _verificationTokenExpiresAt,
        ...safeUser
      } = ctx.user;
      return safeUser;
    }),

    signup: publicProcedure
      .input(
        z.object({
          name: z.string().trim().min(2).max(80),
          email: z.string().trim().email().transform((value) => value.toLowerCase()),
          password: z.string().min(8).max(128),
        }),
      )
      .mutation(async ({ ctx, input }) => {
        const existing = await db.getUserByEmail(input.email);
        const token = createVerificationToken();
        const tokenHash = hashVerificationToken(token);
        const expiresAt = new Date(Date.now() + EMAIL_VERIFICATION_TTL_MS);

        if (existing) {
          if (existing.emailVerifiedAt) {
            throw new TRPCError({ code: "CONFLICT", message: "이미 가입된 이메일입니다." });
          }

          await db.updateVerificationToken(existing.id, tokenHash, expiresAt);
          await sendUserVerificationEmail(ctx.req, existing, token);
          return { requiresVerification: true } as const;
        }

        const user = await db.createEmailUser({
          openId: `email_${nanoid(40)}`,
          name: input.name,
          email: input.email,
          loginMethod: "email",
          passwordHash: hashPassword(input.password),
          verificationTokenHash: tokenHash,
          verificationTokenExpiresAt: expiresAt,
        });

        if (!user) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "회원가입에 실패했습니다." });
        await sendUserVerificationEmail(ctx.req, user, token);
        return { requiresVerification: true } as const;
      }),

    verifyEmail: publicProcedure
      .input(z.object({ token: z.string().min(32) }))
      .mutation(async ({ input }) => {
        const user = await db.getUserByVerificationTokenHash(hashVerificationToken(input.token));
        if (!user || !user.verificationTokenExpiresAt || user.verificationTokenExpiresAt.getTime() < Date.now()) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "인증 링크가 만료되었거나 유효하지 않습니다." });
        }

        await db.markEmailVerified(user.id);
        return { success: true } as const;
      }),

    resendVerification: publicProcedure
      .input(z.object({ email: z.string().trim().email().transform((value) => value.toLowerCase()) }))
      .mutation(async ({ ctx, input }) => {
        const user = await db.getUserByEmail(input.email);
        if (user && !user.emailVerifiedAt) {
          const token = createVerificationToken();
          await db.updateVerificationToken(
            user.id,
            hashVerificationToken(token),
            new Date(Date.now() + EMAIL_VERIFICATION_TTL_MS),
          );
          await sendUserVerificationEmail(ctx.req, user, token);
        }
        return { success: true } as const;
      }),

    loginWithEmail: publicProcedure
      .input(z.object({ email: z.string().trim().email().transform((value) => value.toLowerCase()), password: z.string().min(1) }))
      .mutation(async ({ ctx, input }) => {
        const user = await db.getUserByEmail(input.email);
        if (!user?.passwordHash || !verifyPassword(input.password, user.passwordHash)) {
          throw new TRPCError({ code: "UNAUTHORIZED", message: "이메일 또는 비밀번호를 확인해주세요." });
        }
        if (!user.emailVerifiedAt) {
          throw new TRPCError({ code: "PRECONDITION_FAILED", message: "EMAIL_NOT_VERIFIED" });
        }

        const sessionToken = await sdk.createSessionToken(user.openId, {
          name: user.name || input.email,
          expiresInMs: SESSION_TTL_MS,
        });
        const cookieOptions = getSessionCookieOptions(ctx.req);
        ctx.res.cookie(COOKIE_NAME, sessionToken, { ...cookieOptions, maxAge: SESSION_TTL_MS });
        await db.updateUserLastSignedIn(user.id);
        return { success: true } as const;
      }),

    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return {
        success: true,
      } as const;
    }),
  }),

  // ========== Curriculum Routes ==========
  curriculum: router({
    getByType: protectedProcedure
      .input(z.enum(["elementary", "middle_high"]))
      .query(({ input }) => db.getCurriculumByType(input)),

    getById: protectedProcedure
      .input(z.number())
      .query(({ input }) => db.getCurriculumById(input)),
  }),

  // ========== Progress Routes ==========
  progress: router({
    getByUser: protectedProcedure.query(({ ctx }) =>
      db.getProgressByUser(ctx.user.id)
    ),

    getByUserAndCurriculum: protectedProcedure
      .input(z.number())
      .query(({ ctx, input }) =>
        db.getProgressByUserAndCurriculum(ctx.user.id, input)
      ),

    upsert: protectedProcedure
      .input(
        z.object({
          curriculumId: z.number(),
          score: z.number(),
          completed: z.number(),
          completedAt: z.date().optional(),
        })
      )
      .mutation(({ ctx, input }) =>
        db.upsertProgress({
          userId: ctx.user.id,
          curriculumId: input.curriculumId,
          score: input.score,
          completed: input.completed,
          completedAt: input.completedAt,
        })
      ),
  }),

  // ========== Quiz Routes ==========
  quiz: router({
    submitAnswer: protectedProcedure
      .input(
        z.object({
          quizId: z.number(),
          userAnswer: z.string(),
          isCorrect: z.number(),
          feedback: z.string().optional(),
          economyScore: z.string().optional(),
          clarityScore: z.string().optional(),
          accuracyScore: z.string().optional(),
        })
      )
      .mutation(({ ctx, input }) =>
        db.saveQuizAnswer({
          userId: ctx.user.id,
          quizId: input.quizId,
          userAnswer: input.userAnswer,
          isCorrect: input.isCorrect,
          feedback: input.feedback,
          economyScore: input.economyScore,
          clarityScore: input.clarityScore,
          accuracyScore: input.accuracyScore,
        })
      ),

    getByUser: protectedProcedure.query(({ ctx }) =>
      db.getQuizAnswersByUser(ctx.user.id)
    ),
  }),

  // ========== Certificate Routes ==========
  certificate: router({
    getUserCertificates: protectedProcedure.query(({ ctx }) =>
      db.getCertificatesByUser(ctx.user.id)
    ),

    getByShareToken: publicProcedure
      .input(z.string())
      .query(({ input }) => db.getCertificateByShareToken(input)),

    issue: protectedProcedure
      .input(
        z.object({
          courseType: z.enum(["elementary", "middle_high"]),
          level: z.number().optional(),
          certificateType: z.enum([
            "level_certificate",
            "graduation_certificate",
          ]),
          pdfUrl: z.string().optional(),
        })
      )
      .mutation(({ ctx, input }) =>
        db.issueCertificate({
          userId: ctx.user.id,
          courseType: input.courseType,
          level: input.level,
          certificateType: input.certificateType,
          shareToken: nanoid(),
          pdfUrl: input.pdfUrl,
        })
      ),
  }),

  // ========== Essay Submission Routes ==========
  essaySubmission: router({
    getByUser: protectedProcedure.query(({ ctx }) =>
      db.getEssaySubmissionsByUser(ctx.user.id)
    ),

    getById: protectedProcedure
      .input(z.number())
      .query(({ input }) => db.getEssaySubmissionById(input)),

    create: protectedProcedure
      .input(
        z.object({
          curriculumId: z.number().optional(),
          title: z.string(),
          content: z.string(),
          status: z.enum(["draft", "submitted", "reviewed"]).optional(),
        })
      )
      .mutation(({ ctx, input }) =>
        db.createEssaySubmission({
          userId: ctx.user.id,
          curriculumId: input.curriculumId,
          title: input.title,
          content: input.content,
          status: input.status,
        })
      ),

    update: protectedProcedure
      .input(
        z.object({
          id: z.number(),
          title: z.string().optional(),
          content: z.string().optional(),
          status: z.enum(["draft", "submitted", "reviewed"]).optional(),
          submittedAt: z.date().optional(),
        })
      )
      .mutation(({ input }) =>
        db.updateEssaySubmission(input.id, {
          title: input.title,
          content: input.content,
          status: input.status,
          submittedAt: input.submittedAt,
        })
      ),
  }),

  // ========== Teacher Feedback Routes ==========
  teacherFeedback: router({
    getByEssay: publicProcedure
      .input(z.number())
      .query(({ input }) => db.getTeacherFeedbackByEssay(input)),

    create: protectedProcedure
      .input(
        z.object({
          essayId: z.number(),
          overallComment: z.string().optional(),
          overallScore: z.number().optional(),
          structureScore: z.number().optional(),
          logicScore: z.number().optional(),
          expressionScore: z.number().optional(),
        })
      )
      .mutation(({ ctx, input }) =>
        db.createTeacherFeedback({
          essayId: input.essayId,
          teacherId: ctx.user.id,
          overallComment: input.overallComment,
          overallScore: input.overallScore,
          structureScore: input.structureScore,
          logicScore: input.logicScore,
          expressionScore: input.expressionScore,
        })
      ),

    update: protectedProcedure
      .input(
        z.object({
          id: z.number(),
          overallComment: z.string().optional(),
          overallScore: z.number().optional(),
          structureScore: z.number().optional(),
          logicScore: z.number().optional(),
          expressionScore: z.number().optional(),
        })
      )
      .mutation(({ input }) =>
        db.updateTeacherFeedback(input.id, {
          overallComment: input.overallComment,
          overallScore: input.overallScore,
          structureScore: input.structureScore,
          logicScore: input.logicScore,
          expressionScore: input.expressionScore,
        })
      ),

    getComments: publicProcedure
      .input(z.number())
      .query(({ input }) => db.getFeedbackCommentsByFeedback(input)),

    addComment: protectedProcedure
      .input(
        z.object({
          feedbackId: z.number(),
          lineNumber: z.number(),
          startIndex: z.number(),
          endIndex: z.number(),
          comment: z.string(),
          commentType: z.enum([
            "grammar",
            "logic",
            "expression",
            "structure",
            "other",
          ]),
        })
      )
      .mutation(({ input }) => db.createFeedbackComment(input)),
  }),

  // ========== AI Auto Feedback Routes ==========
  aiAutoFeedback: router({
    getByUser: protectedProcedure.query(({ ctx }) =>
      db.getAIAutoFeedbackByUser(ctx.user.id)
    ),

    create: protectedProcedure
      .input(
        z.object({
          essayTitle: z.string(),
          essayContent: z.string(),
          courseType: z.enum(["elementary", "middle_high"]),
          level: z.number(),
        })
      )
      .mutation(async ({ ctx, input }) => {
        // AI 피드백 생성
        const feedback = await evaluateEssay(
          input.essayContent,
          input.courseType
        );

        // 데이터베이스에 저장
        return await db.createAIAutoFeedback({
          userId: ctx.user.id,
          essayTitle: input.essayTitle,
          essayContent: input.essayContent,
          courseType: input.courseType,
          level: input.level,
          overallComment: feedback.overallComment,
          structureScore: feedback.structureScore,
          logicScore: feedback.logicScore,
          expressionScore: feedback.expressionScore,
          overallScore: feedback.overallScore,
          suggestions: JSON.stringify(feedback.suggestions),
          strengths: JSON.stringify(feedback.strengths),
          weaknesses: JSON.stringify(feedback.weaknesses),
        });
      }),
  }),
});

export type AppRouter = typeof appRouter;
