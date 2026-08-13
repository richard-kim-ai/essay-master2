import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { adminProcedure, publicProcedure, protectedProcedure, router } from "./_core/trpc";
import * as db from "./db";
import { z } from "zod";
import { nanoid } from "nanoid";
import { evaluateEssay } from "./aiFeedback";
import { decryptSecret, encryptSecret } from "./security";
import { removeSubscription, saveSubscription, sendPushToUser } from "./push";
import { sdk } from "./_core/sdk";
import { TRPCError } from "@trpc/server";
import {
  createVerificationToken,
  hashPassword,
  hashVerificationToken,
  sendPasswordResetEmail,
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

    requestPasswordReset: publicProcedure
      .input(z.object({ email: z.string().trim().email().transform((value) => value.toLowerCase()), origin: z.string().url() }))
      .mutation(async ({ input }) => {
        const user = await db.getUserByEmail(input.email);
        if (user?.email && user.passwordHash) {
          const token = createVerificationToken();
          await db.updatePasswordResetToken(user.id, hashVerificationToken(token), new Date(Date.now() + 60 * 60 * 1000));
          await sendPasswordResetEmail({
            to: user.email,
            name: user.name || "학습자",
            resetUrl: `${input.origin}/reset-password?token=${encodeURIComponent(token)}`,
          });
        }
        return { success: true } as const;
      }),

    resetPassword: publicProcedure
      .input(z.object({ token: z.string().min(32), password: z.string().min(8).max(128) }))
      .mutation(async ({ input }) => {
        const user = await db.getUserByPasswordResetTokenHash(hashVerificationToken(input.token));
        if (!user || !user.passwordResetTokenExpiresAt || user.passwordResetTokenExpiresAt.getTime() < Date.now()) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "재설정 링크가 만료되었거나 유효하지 않습니다." });
        }
        await db.resetUserPassword(user.id, hashPassword(input.password));
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

  social: router({
    providers: publicProcedure.query(async () => {
      const configs = await db.listSocialProviderConfigs();
      const byProvider = new Map(configs.map((config) => [config.provider, config]));
      return (["google", "kakao", "naver"] as const).map((provider) => {
        const config = byProvider.get(provider);
        return { provider, enabled: Boolean(config?.enabled && config.clientId && config.clientSecretEncrypted) };
      });
    }),

    settings: adminProcedure.query(async () => {
      const configs = await db.listSocialProviderConfigs();
      const byProvider = new Map(configs.map((config) => [config.provider, config]));
      return (["google", "kakao", "naver"] as const).map((provider) => {
        const config = byProvider.get(provider);
        return { provider, clientId: config?.clientId ?? "", enabled: Boolean(config?.enabled), hasSecret: Boolean(config?.clientSecretEncrypted) };
      });
    }),

    updateSettings: adminProcedure
      .input(z.object({
        provider: z.enum(["google", "kakao", "naver"]),
        clientId: z.string().trim().max(512).default(""),
        clientSecret: z.string().max(4096).optional(),
        clearSecret: z.boolean().default(false),
        enabled: z.boolean(),
      }))
      .mutation(async ({ ctx, input }) => {
        const existing = await db.getSocialProviderConfig(input.provider);
        const encryptedSecret = input.clearSecret
          ? null
          : input.clientSecret
            ? encryptSecret(input.clientSecret)
            : existing?.clientSecretEncrypted ?? null;
        await db.upsertSocialProviderConfig({
          provider: input.provider,
          clientId: input.clientId || null,
          clientSecretEncrypted: encryptedSecret,
          enabled: input.enabled ? 1 : 0,
          updatedBy: ctx.user.id,
        });
        return { success: true } as const;
      }),
  }),

  push: router({
    config: publicProcedure.query(async () => {
      const publicConfig = await db.getAppSecretConfig("vapidPublicKey");
      const privateConfig = await db.getAppSecretConfig("vapidPrivateKey");
      const subjectConfig = await db.getAppSecretConfig("vapidSubject");
      if (!publicConfig?.encryptedValue || !privateConfig?.encryptedValue || !subjectConfig?.encryptedValue) return { enabled: false, publicKey: "" };
      try {
        return { enabled: true, publicKey: decryptSecret(publicConfig.encryptedValue) };
      } catch {
        return { enabled: false, publicKey: "" };
      }
    }),

    settings: adminProcedure.query(async () => {
      const [publicConfig, privateConfig, subjectConfig] = await Promise.all([db.getAppSecretConfig("vapidPublicKey"), db.getAppSecretConfig("vapidPrivateKey"), db.getAppSecretConfig("vapidSubject")]);
      return { publicKey: publicConfig?.encryptedValue ? decryptSecret(publicConfig.encryptedValue) : "", hasPrivateKey: Boolean(privateConfig?.encryptedValue), hasSubject: Boolean(subjectConfig?.encryptedValue) };
    }),

    updateSettings: adminProcedure
      .input(z.object({ publicKey: z.string().max(4096).default(""), privateKey: z.string().max(4096).optional(), subject: z.string().max(512).optional(), clearPrivateKey: z.boolean().default(false), clearSubject: z.boolean().default(false) }))
      .mutation(async ({ ctx, input }) => {
        const existingPrivate = await db.getAppSecretConfig("vapidPrivateKey");
        const existingSubject = await db.getAppSecretConfig("vapidSubject");
        const privateValue = input.clearPrivateKey ? null : input.privateKey ? encryptSecret(input.privateKey) : existingPrivate?.encryptedValue ?? null;
        const subjectValue = input.clearSubject ? null : input.subject ? encryptSecret(input.subject) : existingSubject?.encryptedValue ?? null;
        await db.upsertAppSecretConfig("vapidPublicKey", input.publicKey ? encryptSecret(input.publicKey) : null, ctx.user.id);
        await db.upsertAppSecretConfig("vapidPrivateKey", privateValue, ctx.user.id);
        await db.upsertAppSecretConfig("vapidSubject", subjectValue, ctx.user.id);
        return { success: true } as const;
      }),
  }),

  notifications: router({
    subscribe: protectedProcedure
      .input(z.object({ endpoint: z.string().url(), keys: z.object({ p256dh: z.string().min(1), auth: z.string().min(1) }) }))
      .mutation(async ({ ctx, input }) => {
        await saveSubscription(ctx.user.id, input, ctx.req.headers["user-agent"]?.toString());
        return { success: true } as const;
      }),

    unsubscribe: protectedProcedure
      .input(z.object({ endpoint: z.string().url() }))
      .mutation(async ({ ctx, input }) => {
        await removeSubscription(ctx.user.id, input.endpoint);
        return { success: true } as const;
      }),

    test: protectedProcedure.mutation(async ({ ctx }) => sendPushToUser(ctx.user.id, { title: "논술 마스터 알림", body: "푸시 알림 설정이 정상적으로 연결되었습니다.", url: "/dashboard", tag: "push-test" })),
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
          score: input.score ?? 0,
          completed: input.completed ? 1 : 0,
          completedAt: input.completedAt ?? null,
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
          feedback: input.feedback ?? undefined,
          economyScore: input.economyScore ?? undefined,
          clarityScore: input.clarityScore ?? undefined,
          accuracyScore: input.accuracyScore ?? undefined,
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
      .mutation(async ({ ctx, input }) => {
        const feedback = await db.createTeacherFeedback({
          essayId: input.essayId,
          teacherId: ctx.user.id,
          overallComment: input.overallComment,
          overallScore: input.overallScore,
          structureScore: input.structureScore,
          logicScore: input.logicScore,
          expressionScore: input.expressionScore,
        });
        const essay = await db.getEssaySubmissionById(input.essayId);
        if (essay) void sendPushToUser(essay.userId, { title: "새로운 첨삭 피드백이 도착했어요", body: `${essay.title}에 선생님 피드백이 등록되었습니다.`, url: `/teacher-feedback?essayId=${essay.id}`, tag: `feedback-${essay.id}` });
        return feedback;
      }),

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

    getTodayQuota: protectedProcedure.query(async ({ ctx }) => {
        const count = await db.getTodayAIUsageCount(ctx.user.id);
        const limit = 5; // 일일 무료 공용 크레딧 제한
        return { used: count, limit, remaining: Math.max(0, limit - count) };
      }),

    getWeeklyUsage: protectedProcedure.query(async ({ ctx }) => {
        const logs = await db.getWeeklyAIUsageLogs(ctx.user.id);
        // 최근 7일간 일자별 그룹화
        const daysMap: Record<string, number> = {};
        for (let i = 6; i >= 0; i--) {
          const d = new Date();
          d.setDate(d.getDate() - i);
          const key = d.toISOString().split("T")[0];
          daysMap[key] = 0;
        }

        logs.forEach((log) => {
          const key = new Date(log.createdAt).toISOString().split("T")[0];
          if (daysMap[key] !== undefined) {
            daysMap[key] += 1;
          }
        });

        return Object.entries(daysMap).map(([date, count]) => ({
          date: date.slice(5), // MM-DD
          count,
        }));
      }),

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
        // 일일 쿼터 확인 (관리자는 무제한, 일반 학생은 일 5회 제한)
        if (ctx.user.role !== "admin") {
          const usageCount = await db.getTodayAIUsageCount(ctx.user.id);
          if (usageCount >= 5) {
            throw new TRPCError({
              code: "FORBIDDEN",
              message: "일일 AI 자동 첨삭 횟수(5회)를 모두 소모했습니다. 내일 다시 이용해주세요.",
            });
          }
        }

        // AI 피드백 생성
        const feedback = await evaluateEssay(
          input.essayContent,
          input.courseType
        );

        // 사용량 기록
        await db.logAIUsage(ctx.user.id, "essay_feedback", 3000);

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

  admin: router({
    getAnalytics: protectedProcedure.query(async ({ ctx }) => {
      if (ctx.user.role !== "admin") {
        throw new TRPCError({ code: "FORBIDDEN", message: "관리자 권한이 필요합니다." });
      }
      const usersStats = await db.getAllUsersStats();
      const progressStats = await db.getAllProgressStats();
      const aiStats = await db.getAllAIUsageStats();

      return {
        users: usersStats,
        progress: progressStats,
        ai: aiStats,
      };
    }),
    getStudentDetail: protectedProcedure
      .input(z.object({ studentId: z.number() }))
      .query(async ({ ctx, input }) => {
        if (ctx.user.role !== "admin") {
          throw new TRPCError({ code: "FORBIDDEN", message: "관리자 권한이 필요합니다." });
        }
        return await db.getStudentDetailStats(input.studentId);
      }),
    updateStudentNotes: protectedProcedure
      .input(z.object({ studentId: z.number(), adminNotes: z.string() }))
      .mutation(async ({ ctx, input }) => {
        if (ctx.user.role !== "admin") {
          throw new TRPCError({ code: "FORBIDDEN", message: "관리자 권한이 필요합니다." });
        }
        return await db.updateStudentAdminNotes(input.studentId, input.adminNotes);
      }),
  }),
});

export type AppRouter = typeof appRouter;
