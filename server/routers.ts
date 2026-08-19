import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { storagePut } from "./storage";
import { systemRouter } from "./_core/systemRouter";
import { adminProcedure, publicProcedure, protectedProcedure, router } from "./_core/trpc";
import * as db from "./db";
import { z } from "zod";
import { nanoid } from "nanoid";
import { evaluateEssay } from "./aiFeedback";
import { evaluateWriting } from "./writingEvaluationEngine";
import { evaluateWritingWithConfiguredModel } from "./configuredWritingEvaluation";
import { buildSimulationSamplesFromStudentData, simulateEvaluationLearning } from "./writingEvaluationSimulation";
import { generateWritingCorrection } from "./writingCorrectionEngine";
import { getActiveCorrectionModel, getEvaluationModelProfiles, saveEvaluationModelProfiles, type EvaluationModelProfile } from "./evaluationModelRegistry";
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

const questionGenerationInput = z.object({
  course: z.string().optional(),
  tool_type: z.string().optional(),
  courseType: z.string().optional(),
  toolType: z.string().optional(),
  theory_category: z.string().default("AUTO"),
  difficulty: z.union([z.literal("AUTO"), z.coerce.number().int().min(1).max(5)]).default("AUTO"),
  count: z.number().int().min(1).max(20).optional(),
  question_count: z.number().int().min(1).max(20).optional(),
  topic: z.string().trim().min(1).default("AUTO"),
});

const writingEvaluationMetadataInput = z.object({
  task_id: z.string().optional(),
  curriculum_code: z.string().min(1),
  theory_category: z.string().min(1),
  education_level: z.enum(["elementary", "middle_high", "high_univ", "general_adult"]),
  difficulty: z.number().int().min(1).max(5),
  writing_type: z.enum(["ARGUMENTATIVE", "EXPLANATORY", "REFLECTIVE", "SUMMARY", "CREATIVE"]),
  assessment_mode: z.enum(["FREE_WRITING", "ARGUMENTATIVE", "DBQ", "ANALYTICAL", "IB_PERSONAL_SOCIETY", "IB_SCIENCE"]).optional(),
  rubric_profile: z.string().optional(),
  subject: z.string().optional(),
});

const writingEvaluationTaskInput = z.object({
  prompt: z.string().min(1),
  constraints: z.object({
    min_chars: z.number().int().min(0).optional(),
    max_chars: z.number().int().min(1).optional(),
    required_elements: z.array(z.string()).optional(),
    required_source_ids: z.array(z.string()).optional(),
    citation_required: z.boolean().optional(),
    minimum_source_count: z.number().int().min(0).optional(),
  }).optional(),
  assessment_mode: z.enum(["FREE_WRITING", "ARGUMENTATIVE", "DBQ", "ANALYTICAL", "IB_PERSONAL_SOCIETY", "IB_SCIENCE"]).optional(),
  source_documents: z.array(z.object({
    source_id: z.string().min(1),
    title: z.string().optional(),
    content: z.string().min(1),
    author_or_origin: z.string().optional(),
    perspective: z.string().optional(),
  })).optional(),
});

const writingEvaluationInput = z.object({
  metadata: writingEvaluationMetadataInput,
  task: writingEvaluationTaskInput,
  submission: z.object({
    learner_id: z.string().min(1),
    essay_text: z.string().min(1),
    source_citations: z.array(z.object({ source_id: z.string().min(1), excerpt: z.string().optional() })).optional(),
  }),
  essay_submission_id: z.number().int().positive().optional(),
});

const writingEvaluationSimulationInput = z.object({
  metadata: writingEvaluationMetadataInput.omit({ task_id: true }),
  task: writingEvaluationTaskInput,
  samples: z.array(z.object({
    sample_id: z.string().min(1),
    learner_id: z.string().min(1),
    essay_text: z.string().min(1),
    previous_score: z.number().nullable().optional(),
    human_score: z.number().min(0).max(100).nullable().optional(),
    score_source: z.enum(["human", "ai", "unknown"]).optional(),
    source: z.enum(["essay_submission", "ai_auto_feedback", "manual"]).optional(),
  })).min(1),
});

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

    teacherSignup: publicProcedure
      .input(
        z.object({
          name: z.string().trim().min(2).max(80),
          email: z.string().trim().email().transform((value) => value.toLowerCase()),
          password: z.string().min(8).max(128),
          teacherLevel: z.number().int().min(1).max(3).default(1),
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
          openId: `teacher_${nanoid(40)}`,
          name: input.name,
          email: input.email,
          loginMethod: "email",
          passwordHash: hashPassword(input.password),
          verificationTokenHash: tokenHash,
          verificationTokenExpiresAt: expiresAt,
          role: "teacher",
          teacherLevel: input.teacherLevel,
        });

        if (!user) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "교사회원 가입에 실패했습니다." });
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
        let user = await db.getUserByEmail(input.email);
        
        // 만약 샘플 계정으로 로그인 시도 시 DB에 없으면 자동 생성 후 로그인 처리
        if (!user && input.email.endsWith("@sample.com")) {
          const sampleRole = input.email.startsWith("teacher") ? "teacher" : input.email.startsWith("admin") ? "admin" : "user";
          const sampleName = sampleRole === "admin" ? "총괄 관리자(샘플)" : sampleRole === "teacher" ? "김선생(샘플교사)" : "이학생(샘플학생)";
          user = await db.createEmailUser({
            openId: `sample_${nanoid(20)}`,
            name: sampleName,
            email: input.email,
            loginMethod: "email",
            passwordHash: hashPassword(input.password),
            role: sampleRole,
            teacherLevel: sampleRole === "teacher" ? 2 : 1,
            teacherStatus: sampleRole === "teacher" ? "approved" : "approved",
          });
          if (user) {
            await db.markEmailVerified(user.id);
            user = await db.getUserByEmail(input.email);
          }
        }

        if (!user?.passwordHash || !verifyPassword(input.password, user.passwordHash)) {
          throw new TRPCError({ code: "UNAUTHORIZED", message: "이메일 또는 비밀번호를 확인해주세요." });
        }
        if (!user.emailVerifiedAt) {
          await db.markEmailVerified(user.id);
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

    updateProfile: protectedProcedure
      .input(z.object({
        name: z.string().trim().min(1).max(50).optional(),
        avatarUrl: z.string().url().or(z.string().min(1)).optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        await db.updateUserProfile(ctx.user.id, {
          name: input.name,
          avatarUrl: input.avatarUrl,
        });
        return { success: true } as const;
      }),

    uploadAvatarBase64: protectedProcedure
      .input(z.object({
        imageBase64: z.string().min(1),
        fileName: z.string().default("avatar.png"),
      }))
      .mutation(async ({ ctx, input }) => {
        const matches = input.imageBase64.match(/^data:(.+?);base64,(.+)$/);
        let buffer: Buffer;
        let contentType = "image/png";
        if (matches) {
          contentType = matches[1];
          buffer = Buffer.from(matches[2], "base64");
        } else {
          buffer = Buffer.from(input.imageBase64, "base64");
        }
        const ext = contentType.includes("jpeg") || contentType.includes("jpg") ? "jpg" : "png";
        const key = `avatars/user_${ctx.user.id}_${Date.now()}.${ext}`;
        const { url } = await storagePut(key, buffer, contentType);
        await db.updateUserProfile(ctx.user.id, { avatarUrl: url });
        return { success: true, url } as const;
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
      .input(z.enum(["elementary", "middle_high", "high_univ", "general_adult"]))
      .query(({ input }) => db.getCurriculumByType(input)),

    getDynamicByType: protectedProcedure
      .input(z.enum(["elementary", "middle_high", "high_univ", "general_adult"]))
      .query(({ input }) => db.getDynamicCurriculumByType(input)),

    getById: protectedProcedure
      .input(z.number())
      .query(({ input }) => db.getCurriculumById(input)),

    getTheoryContent: protectedProcedure
      .input(z.object({
        courseType: z.enum(["elementary", "middle_high", "high_univ", "general_adult"]),
        lessonLevel: z.number().int().min(1).max(5).optional(),
        theoryCategory: z.string().optional(),
      }))
      .query(({ input }) => db.getLessonTheoryContentList(input)),
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
          courseType: z.enum(["elementary", "middle_high", "high_univ", "general_adult"]),
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
          courseType: z.enum(["elementary", "middle_high", "high_univ", "general_adult"]),
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
          revisedEssay: feedback.revisedEssay,
          suggestions: JSON.stringify(feedback.suggestions),
          strengths: JSON.stringify(feedback.strengths),
          weaknesses: JSON.stringify(feedback.weaknesses),
        });
      }),
  }),

  writingEvaluationEngine: router({
    evaluate: protectedProcedure
      .input(writingEvaluationInput)
      .mutation(async ({ input }) => {
        const result = await evaluateWritingWithConfiguredModel(input);
        return { ...result, evaluation_model_id: result.modelId, evaluation_fallback: result.fallback };
      }),

    evaluateAndCorrect: protectedProcedure
      .input(writingEvaluationInput)
      .mutation(async ({ ctx, input }) => {
        if (input.essay_submission_id) {
          const essay = await db.getEssaySubmissionById(input.essay_submission_id);
          if (!essay || essay.userId !== ctx.user.id) throw new TRPCError({ code: "FORBIDDEN", message: "본인 글만 평가 기록에 연결할 수 있습니다." });
        }
        if (ctx.user.role !== "admin" && (await db.getTodayAIUsageCount(ctx.user.id)) >= 5) {
          throw new TRPCError({ code: "FORBIDDEN", message: "일일 AI 첨삭 횟수를 모두 사용했습니다." });
        }
        const configuredEvaluation = await evaluateWritingWithConfiguredModel(input);
        const evaluation = configuredEvaluation.evaluation;
        const correctionModel = await getActiveCorrectionModel();
        const correction = await generateWritingCorrection(input, evaluation, { model: correctionModel.model || undefined });
        const record = await db.createWritingEvaluationRecord({
          userId: ctx.user.id,
          essaySubmissionId: input.essay_submission_id,
          metadataJson: JSON.stringify({ ...input.metadata, evaluation_model_id: configuredEvaluation.modelId, evaluation_fallback: configuredEvaluation.fallback, correction_model_id: correctionModel.id }),
          taskJson: JSON.stringify(input.task),
          originalText: input.submission.essay_text,
          revisedText: correction.revised_text,
          evaluationJson: JSON.stringify(evaluation),
          correctionJson: JSON.stringify(correction),
          decision: evaluation.decision,
          totalScore: evaluation.total_score,
        });
        await db.logAIUsage(ctx.user.id, "writing_evaluation_v1", 0);
        return { evaluation, correction, evaluation_model_id: configuredEvaluation.modelId, correction_model_id: correctionModel.id, record_id: record?.insertId ?? null };
      }),

    history: protectedProcedure.query(({ ctx }) => db.getWritingEvaluationRecordsByUser(ctx.user.id)),

    getById: protectedProcedure
      .input(z.number().int().positive())
      .query(({ ctx, input }) => db.getWritingEvaluationRecordByIdForUser(input, ctx.user.id)),

    reevaluate: protectedProcedure
      .input(z.object({
        record_id: z.number().int().positive(),
        revised_text: z.string().trim().min(1),
      }))
      .mutation(async ({ ctx, input }) => {
        const parent = await db.getWritingEvaluationRecordByIdForUser(input.record_id, ctx.user.id);
        if (!parent) throw new TRPCError({ code: "NOT_FOUND", message: "평가 기록을 찾을 수 없습니다." });
        if (ctx.user.role !== "admin" && (await db.getTodayAIUsageCount(ctx.user.id)) >= 5) {
          throw new TRPCError({ code: "FORBIDDEN", message: "일일 AI 첨삭 횟수를 모두 사용했습니다." });
        }

        const request = {
          metadata: JSON.parse(parent.metadataJson),
          task: JSON.parse(parent.taskJson),
          submission: {
            learner_id: String(ctx.user.id),
            essay_text: input.revised_text,
          },
        };
        const configuredEvaluation = await evaluateWritingWithConfiguredModel(request);
        const evaluation = configuredEvaluation.evaluation;
        const correctionModel = await getActiveCorrectionModel();
        const correction = await generateWritingCorrection(request, evaluation, { model: correctionModel.model || undefined });
        const record = await db.createWritingEvaluationRecord({
          userId: ctx.user.id,
          essaySubmissionId: parent.essaySubmissionId ?? undefined,
          parentRecordId: parent.id,
          metadataJson: JSON.stringify({ ...request.metadata, evaluation_model_id: configuredEvaluation.modelId, evaluation_fallback: configuredEvaluation.fallback, correction_model_id: correctionModel.id }),
          taskJson: JSON.stringify(request.task),
          originalText: input.revised_text,
          revisedText: correction.revised_text,
          evaluationJson: JSON.stringify(evaluation),
          correctionJson: JSON.stringify(correction),
          decision: evaluation.decision,
          totalScore: evaluation.total_score,
        });
        await db.logAIUsage(ctx.user.id, "writing_evaluation_v1_reevaluate", 0);
        return { evaluation, correction, evaluation_model_id: configuredEvaluation.modelId, correction_model_id: correctionModel.id, record_id: record?.insertId ?? null, parent_record_id: parent.id };
      }),

    simulate: protectedProcedure
      .input(writingEvaluationSimulationInput)
      .mutation(({ input }) => simulateEvaluationLearning(input)),

    simulateMyEssays: protectedProcedure
      .input(
        z.object({
          metadata: writingEvaluationMetadataInput.omit({ task_id: true }),
          task: writingEvaluationTaskInput,
          limit: z.number().int().min(1).max(50).default(20),
        })
      )
      .mutation(async ({ ctx, input }) => {
        const essaySubmissions = await db.getEssaySubmissionsByUser(ctx.user.id);
        const aiFeedbacks = await db.getAIAutoFeedbackByUser(ctx.user.id);
        const samples = buildSimulationSamplesFromStudentData({
          essaySubmissions: essaySubmissions.slice(0, input.limit),
          aiFeedbacks: aiFeedbacks.slice(0, input.limit),
        }).slice(0, input.limit);

        if (samples.length === 0) {
          return {
            engine_version: "1.1",
            sample_count: 0,
            scored_count: 0,
            average_score: 0,
            decision_counts: {},
            recurring_error_patterns: [],
            next_learning_distribution: [],
            calibration_candidates: [],
            evaluations: [],
          };
        }

        return simulateEvaluationLearning({
          metadata: input.metadata,
          task: input.task,
          samples,
        });
      }),
  }),

  badges: router({
    getByUser: protectedProcedure.query(async ({ ctx }) => {
      return await db.getUserBadges(ctx.user.id);
    }),
    award: protectedProcedure
      .input(z.object({ courseType: z.string(), badgeType: z.string(), badgeName: z.string() }))
      .mutation(async ({ ctx, input }) => {
        return await db.awardBadge(ctx.user.id, input.courseType, input.badgeType, input.badgeName);
      }),
  }),

  questionBank: router({
    list: protectedProcedure
      .input(z.object({ courseType: z.string().optional(), toolType: z.string().optional() }))
      .query(async ({ input }) => {
        await db.seedQuestionBankIfNeeded();
        return await db.getQuestionBankList(input.courseType, input.toolType);
      }),
    random: protectedProcedure
      .input(z.object({ courseType: z.string(), toolType: z.string(), limit: z.number().default(10) }))
      .query(async ({ input }) => {
        await db.seedQuestionBankIfNeeded();
        return await db.getRandomQuestions(input.courseType, input.toolType, input.limit);
      }),
    create: protectedProcedure
      .input(z.object({
        courseType: z.enum(["elementary", "middle_high", "high_univ", "general_adult"]),
        toolType: z.string(),
        title: z.string(),
        contentData: z.string(),
        difficulty: z.enum(["easy", "medium", "hard"]).optional(),
        isActive: z.number().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        if (ctx.user.role !== "admin") throw new TRPCError({ code: "FORBIDDEN" });
        await db.assertQuestionBankItemQuality(input);
        return await db.createQuestionBankItem(input);
      }),
    update: protectedProcedure
      .input(z.object({
        id: z.number(),
        courseType: z.enum(["elementary", "middle_high", "high_univ", "general_adult"]).optional(),
        toolType: z.string().optional(),
        title: z.string().optional(),
        contentData: z.string().optional(),
        difficulty: z.enum(["easy", "medium", "hard"]).optional(),
        isActive: z.number().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        if (ctx.user.role !== "admin") throw new TRPCError({ code: "FORBIDDEN" });
        const { id, ...data } = input;
        return await db.updateQuestionBankItem(id, data);
      }),
    delete: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ ctx, input }) => {
        if (ctx.user.role !== "admin") throw new TRPCError({ code: "FORBIDDEN" });
        return await db.deleteQuestionBankItem(input.id);
      }),
    bulkCreate: protectedProcedure
      .input(z.object({
        items: z.array(z.object({
          courseType: z.enum(["elementary", "middle_high", "high_univ", "general_adult"]),
          toolType: z.string(),
          title: z.string(),
          contentData: z.string(),
          difficulty: z.enum(["easy", "medium", "hard"]).optional(),
          isActive: z.number().optional(),
        }))
      }))
      .mutation(async ({ ctx, input }) => {
        if (ctx.user.role !== "admin") throw new TRPCError({ code: "FORBIDDEN" });
        for (const item of input.items) {
          await db.assertQuestionBankItemQuality(item);
          await db.createQuestionBankItem(item);
        }
        return { success: true, count: input.items.length };
      }),
    stats: protectedProcedure.query(async ({ ctx }) => {
      if (ctx.user.role !== "admin") throw new TRPCError({ code: "FORBIDDEN" });
      return await db.getQuestionBankStats();
    }),
    applyAiDifficulty: protectedProcedure
      .input(z.object({ id: z.number(), difficulty: z.enum(["easy", "medium", "hard"]) }))
      .mutation(async ({ ctx, input }) => {
        if (ctx.user.role !== "admin") throw new TRPCError({ code: "FORBIDDEN" });
        return await db.updateQuestionBankItem(input.id, { difficulty: input.difficulty });
      }),
    trendStats: protectedProcedure
      .input(z.object({ period: z.enum(["week", "month"]).default("week") }))
      .query(async ({ ctx, input }) => {
        if (ctx.user.role !== "admin") throw new TRPCError({ code: "FORBIDDEN" });
        return await db.getQuestionBankTrendStats(input.period);
      }),
    aiInsight: protectedProcedure
      .input(z.object({ questionId: z.number() }))
      .query(async ({ ctx, input }) => {
        if (ctx.user.role !== "admin") throw new TRPCError({ code: "FORBIDDEN" });
        return await db.getQuestionBankAiInsight(input.questionId);
      }),
    submitFeedback: protectedProcedure
      .input(z.object({
        questionId: z.number(),
        isHelpful: z.number(),
        reportType: z.string().optional(),
        comment: z.string().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        return await db.submitQuestionFeedback({
          userId: ctx.user.id,
          questionId: input.questionId,
          isHelpful: input.isHelpful,
          reportType: input.reportType,
          comment: input.comment,
        });
      }),
    feedbackSummary: protectedProcedure
      .input(z.object({ questionId: z.number() }))
      .query(async ({ ctx, input }) => {
        return await db.getQuestionFeedbacksSummary(input.questionId);
      }),
    toggleBookmark: protectedProcedure
      .input(z.object({ questionId: z.number() }))
      .mutation(async ({ ctx, input }) => {
        return await db.toggleQuestionBookmark(ctx.user.id, input.questionId);
      }),
    getBookmarks: protectedProcedure.query(async ({ ctx }) => {
      return await db.getUserBookmarks(ctx.user.id);
    }),
    allFeedbacks: protectedProcedure.query(async ({ ctx }) => {
      if (ctx.user.role !== "admin") throw new TRPCError({ code: "FORBIDDEN" });
      return await db.getAllQuestionFeedbacks();
    }),
    updateFeedback: protectedProcedure
      .input(z.object({ feedbackId: z.number(), adminReply: z.string().optional(), status: z.string().optional() }))
      .mutation(async ({ ctx, input }) => {
        if (ctx.user.role !== "admin") throw new TRPCError({ code: "FORBIDDEN" });
        return await db.updateQuestionFeedbackAdmin(input.feedbackId, { adminReply: input.adminReply, status: input.status });
      }),
    deleteFeedback: protectedProcedure
      .input(z.object({ feedbackId: z.number() }))
      .mutation(async ({ ctx, input }) => {
        if (ctx.user.role !== "admin") throw new TRPCError({ code: "FORBIDDEN" });
        return await db.deleteQuestionFeedback(input.feedbackId);
      }),
    gradeEssay: protectedProcedure
      .input(z.object({ questionId: z.number(), userAnswer: z.string() }))
      .mutation(async ({ ctx, input }) => {
        return await db.gradeEssayWithAi(input.questionId, input.userAnswer);
      }),
    curriculumDifficultyStats: protectedProcedure.query(async ({ ctx }) => {
      if (ctx.user.role !== "admin") throw new TRPCError({ code: "FORBIDDEN" });
      return await db.getCurriculumDifficultyStats();
    }),
    generateAiQuestions: protectedProcedure
      .input(questionGenerationInput)
      .mutation(async ({ ctx, input }) => {
        if (ctx.user.role !== "admin") throw new TRPCError({ code: "FORBIDDEN" });
        return await db.previewGeneratedQuestionBankItems({
          course: input.course ?? input.courseType ?? "MIDDLE_HIGH",
          tool_type: input.tool_type ?? input.toolType ?? "SUMMARY",
          theory_category: input.theory_category,
          difficulty: input.difficulty,
          question_count: input.question_count ?? input.count ?? 3,
          topic: input.topic,
        });
      }),
    previewAiQuestions: protectedProcedure
      .input(questionGenerationInput)
      .mutation(async ({ ctx, input }) => {
        if (ctx.user.role !== "admin") throw new TRPCError({ code: "FORBIDDEN" });
        return await db.previewGeneratedQuestionBankItems({
          course: input.course ?? input.courseType ?? "MIDDLE_HIGH",
          tool_type: input.tool_type ?? input.toolType ?? "SUMMARY",
          theory_category: input.theory_category,
          difficulty: input.difficulty,
          question_count: input.question_count ?? input.count ?? 3,
          topic: input.topic,
        });
      }),
    promoteUser: protectedProcedure
      .input(z.object({ userId: z.number(), targetLevel: z.number() }))
      .mutation(async ({ ctx, input }) => {
        if (ctx.user.role !== "admin" && ctx.user.role !== "teacher") throw new TRPCError({ code: "FORBIDDEN" });
        return await db.promoteUserLevel(input.userId, input.targetLevel);
      }),
    similarQuestions: protectedProcedure
      .input(z.object({ questionId: z.number() }))
      .query(async ({ ctx, input }) => {
        return await db.getSimilarQuestions(input.questionId);
      }),
  }),

  admin: router({
    getEvaluationModels: adminProcedure.query(async () => getEvaluationModelProfiles()),
    updateEvaluationModels: adminProcedure
      .input(z.object({
        profiles: z.array(z.object({
          id: z.string().trim().min(1).max(80), name: z.string().trim().min(1).max(120),
          provider: z.enum(["rule", "openai", "openai_compatible", "vllm", "kobert", "lora", "custom"]),
          purpose: z.enum(["evaluation", "correction", "both"]), model: z.string().max(255), endpoint: z.string().max(1000),
          enabled: z.boolean(), priority: z.number().int().min(1).max(999), notes: z.string().max(1000), managed: z.boolean(),
        })).min(1),
      }))
      .mutation(async ({ ctx, input }) => saveEvaluationModelProfiles(input.profiles as EvaluationModelProfile[], ctx.user.id)),
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
    updateBatchTag: protectedProcedure
      .input(z.object({ studentIds: z.array(z.number()), tag: z.string() }))
      .mutation(async ({ ctx, input }) => {
        if (ctx.user.role !== "admin") {
          throw new TRPCError({ code: "FORBIDDEN", message: "관리자 권한이 필요합니다." });
        }
        return await db.updateUsersTag(input.studentIds, input.tag);
      }),
    updateTeacherStatus: protectedProcedure
      .input(z.object({ userId: z.number(), teacherStatus: z.enum(["pending", "approved", "rejected"]) }))
      .mutation(async ({ ctx, input }) => {
        if (ctx.user.role !== "admin") {
          throw new TRPCError({ code: "FORBIDDEN", message: "관리자 권한이 필요합니다." });
        }
        await db.updateTeacherStatus(input.userId, input.teacherStatus);
        return { success: true } as const;
      }),
    getAllCertificatesAdmin: protectedProcedure
      .query(async ({ ctx }) => {
        if (ctx.user.role !== "admin") {
          throw new TRPCError({ code: "FORBIDDEN", message: "관리자 권한이 필요합니다." });
        }
        return await db.adminGetAllCertificates();
      }),
    issueCertificateAdmin: protectedProcedure
      .input(z.object({
        userId: z.number(),
        courseType: z.enum(["elementary", "middle_high", "high_univ", "general_adult"]),
        level: z.number().optional(),
        certificateType: z.enum(["level_certificate", "graduation_certificate"]),
        issueReason: z.string().trim().max(500).optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        if (ctx.user.role !== "admin") {
          throw new TRPCError({ code: "FORBIDDEN", message: "관리자 권한이 필요합니다." });
        }
        const shareToken = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
        return await db.adminIssueCertificate({
          userId: input.userId,
          courseType: input.courseType,
          level: input.level,
          certificateType: input.certificateType,
          shareToken,
          issuedBy: ctx.user.id,
          issueReason: input.issueReason,
        });
      }),
    revokeCertificateAdmin: protectedProcedure
      .input(z.object({ certificateId: z.number(), reason: z.string().trim().min(2).max(500) }))
      .mutation(async ({ ctx, input }) => {
        if (ctx.user.role !== "admin") {
          throw new TRPCError({ code: "FORBIDDEN", message: "관리자 권한이 필요합니다." });
        }
        return await db.adminRevokeCertificate(input.certificateId, ctx.user.id, input.reason);
      }),
    deleteCertificateAdmin: protectedProcedure
      .input(z.object({ certificateId: z.number() }))
      .mutation(async ({ ctx, input }) => {
        if (ctx.user.role !== "admin") {
          throw new TRPCError({ code: "FORBIDDEN", message: "관리자 권한이 필요합니다." });
        }
        return await db.adminDeleteCertificate(input.certificateId);
      }),
    resetAllCertificates: protectedProcedure
      .mutation(async ({ ctx }) => {
        if (ctx.user.role !== "admin") {
          throw new TRPCError({ code: "FORBIDDEN", message: "관리자 권한이 필요합니다." });
        }
        return await db.adminResetAllCertificates();
      }),
    getCurriculumCategoriesAdmin: protectedProcedure
      .query(async ({ ctx }) => {
        if (ctx.user.role !== "admin") {
          throw new TRPCError({ code: "FORBIDDEN", message: "관리자 권한이 필요합니다." });
        }
        return await db.adminGetCurriculumCategories();
      }),
    createCurriculumCategoryAdmin: protectedProcedure
      .input(z.object({
        courseType: z.enum(["elementary", "middle_high", "high_univ", "general_adult"]),
        level: z.number().int().min(1).max(20),
        title: z.string().trim().min(2).max(255),
        description: z.string().trim().min(5).max(2000),
        topics: z.array(z.string().trim().min(1).max(255)).max(20),
        aiSummary: z.string().max(500).optional(),
        isActive: z.number().int().min(0).max(1).optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        if (ctx.user.role !== "admin") {
          throw new TRPCError({ code: "FORBIDDEN", message: "관리자 권한이 필요합니다." });
        }
        return await db.adminCreateCurriculumCategory(input);
      }),
    updateCurriculumCategoryAdmin: protectedProcedure
      .input(z.object({
        id: z.number(),
        courseType: z.enum(["elementary", "middle_high", "high_univ", "general_adult"]),
        level: z.number().int().min(1).max(20),
        title: z.string().trim().min(2).max(255),
        description: z.string().trim().min(5).max(2000),
        topics: z.array(z.string().trim().min(1).max(255)).max(20),
        aiSummary: z.string().max(500).optional(),
        isActive: z.number().int().min(0).max(1).optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        if (ctx.user.role !== "admin") {
          throw new TRPCError({ code: "FORBIDDEN", message: "관리자 권한이 필요합니다." });
        }
        return await db.adminUpdateCurriculumCategory(input);
      }),
    toggleCurriculumActiveAdmin: protectedProcedure
      .input(z.object({ id: z.number(), isActive: z.number().int().min(0).max(1) }))
      .mutation(async ({ ctx, input }) => {
        if (ctx.user.role !== "admin") {
          throw new TRPCError({ code: "FORBIDDEN", message: "관리자 권한이 필요합니다." });
        }
        return await db.adminToggleCurriculumActive(input.id, input.isActive);
      }),
    batchToggleCurriculumActiveAdmin: protectedProcedure
      .input(z.object({ ids: z.array(z.number()), isActive: z.number().int().min(0).max(1) }))
      .mutation(async ({ ctx, input }) => {
        if (ctx.user.role !== "admin") {
          throw new TRPCError({ code: "FORBIDDEN", message: "관리자 권한이 필요합니다." });
        }
        return await db.adminBatchToggleCurriculumActive(input.ids, input.isActive);
      }),
    duplicateCurriculumAdmin: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ ctx, input }) => {
        if (ctx.user.role !== "admin") {
          throw new TRPCError({ code: "FORBIDDEN", message: "관리자 권한이 필요합니다." });
        }
        return await db.adminDuplicateCurriculumCategory(input.id);
      }),
    deleteCurriculumCategoryAdmin: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ ctx, input }) => {
        if (ctx.user.role !== "admin") {
          throw new TRPCError({ code: "FORBIDDEN", message: "관리자 권한이 필요합니다." });
        }
        return await db.adminDeleteCurriculumCategory(input.id);
      }),
    reorderCurriculumCategoriesAdmin: protectedProcedure
      .input(z.object({ orderedIds: z.array(z.number()) }))
      .mutation(async ({ ctx, input }) => {
        if (ctx.user.role !== "admin") {
          throw new TRPCError({ code: "FORBIDDEN", message: "관리자 권한이 필요합니다." });
        }
        return await db.adminReorderCurriculumCategories(input.orderedIds);
      }),
    seedDefaultCurriculumSamples: protectedProcedure
      .input(z.object({ courseType: z.enum(["elementary", "middle_high", "high_univ", "general_adult"]).optional() }))
      .mutation(async ({ ctx, input }) => {
        if (ctx.user.role !== "admin") {
          throw new TRPCError({ code: "FORBIDDEN", message: "관리자 권한이 필요합니다." });
        }
        if (input.courseType) {
          return await db.seedSamplesForSpecificCourse(input.courseType);
        } else {
          await db.seedHighUnivAndGeneralAdultCategories();
          return { success: true, count: 6 };
        }
      }),
    getOperationsStats: protectedProcedure
      .query(async ({ ctx }) => {
        if (ctx.user.role !== "admin") {
          throw new TRPCError({ code: "FORBIDDEN", message: "관리자 권한이 필요합니다." });
        }
        return await db.getAdminOperationsDashboardStats();
      }),
    getSiteSettingAdmin: publicProcedure
      .input(z.object({ settingKey: z.string() }))
      .query(async ({ input }) => {
        return await db.getSiteSetting(input.settingKey);
      }),
    saveSiteSettingAdmin: protectedProcedure
      .input(z.object({ settingKey: z.string(), content: z.string() }))
      .mutation(async ({ ctx, input }) => {
        if (ctx.user.role !== "admin") {
          throw new TRPCError({ code: "FORBIDDEN", message: "관리자 권한이 필요합니다." });
        }
        return await db.saveSiteSetting(input.settingKey, input.content, ctx.user.id);
      }),
    getAllUsersMasterAdmin: protectedProcedure
      .query(async ({ ctx }) => {
        if (ctx.user.role !== "admin") {
          throw new TRPCError({ code: "FORBIDDEN", message: "관리자 권한이 필요합니다." });
        }
        const stats = await db.getAllUsersStats();
        return stats?.users ?? [];
      }),
    updateUserRole: protectedProcedure
      .input(z.object({ userId: z.number(), newRole: z.enum(["user", "teacher", "admin"]) }))
      .mutation(async ({ ctx, input }) => {
        if (ctx.user.role !== "admin") {
          throw new TRPCError({ code: "FORBIDDEN", message: "관리자 권한이 필요합니다." });
        }
        await db.updateUserRole(input.userId, input.newRole);
        return true;
      }),
    approveTeacher: protectedProcedure
      .input(z.object({ userId: z.number(), teacherLevel: z.number().optional() }))
      .mutation(async ({ ctx, input }) => {
        if (ctx.user.role !== "admin") {
          throw new TRPCError({ code: "FORBIDDEN", message: "관리자 권한이 필요합니다." });
        }
        await db.updateTeacherStatus(input.userId, "approved", input.teacherLevel);
        return true;
      }),
  }),
  parent: router({
    linkedStudents: protectedProcedure.query(async ({ ctx }) => {
      return await db.getLinkedStudentsForParent(ctx.user.id);
    }),
    linkStudent: protectedProcedure
      .input(z.object({ studentEmail: z.string().email() }))
      .mutation(async ({ ctx, input }) => {
        return await db.linkParentAndStudent(ctx.user.id, input.studentEmail);
      }),
    studentDetail: protectedProcedure
      .input(z.object({ studentId: z.number() }))
      .query(async ({ ctx, input }) => {
        // 부모가 링크된 학생인지 검증하거나 관리자/교사인 경우 허용
        const linked = await db.getLinkedStudentsForParent(ctx.user.id);
        const isAuthorized = ctx.user.role === "admin" || ctx.user.role === "teacher" || linked.some(s => s.id === input.studentId);
        if (!isAuthorized) {
          throw new TRPCError({ code: "FORBIDDEN", message: "해당 학생의 학습 정보에 접근할 권한이 없습니다." });
        }
        return await db.getStudentDetailStats(input.studentId);
      }),
    addComment: protectedProcedure
      .input(z.object({ studentId: z.number(), comment: z.string().min(1).max(1000) }))
      .mutation(async ({ ctx, input }) => {
        const linked = await db.getLinkedStudentsForParent(ctx.user.id);
        const isAuthorized = ctx.user.role === "admin" || linked.some(s => s.id === input.studentId);
        if (!isAuthorized) {
          throw new TRPCError({ code: "FORBIDDEN", message: "해당 학생에게 코멘트를 남길 권한이 없습니다." });
        }
        const studentUser = await db.getUserById(input.studentId);
        if (!studentUser) throw new TRPCError({ code: "NOT_FOUND", message: "학생을 찾을 수 없습니다." });
        const existingNotes = studentUser.adminNotes || "";
        const newMemo = `[학부모 코멘트(${ctx.user.name || "학부모"})] ${input.comment.trim()} (${new Date().toLocaleString()})`;
        const updatedNotes = existingNotes ? `${existingNotes}\n${newMemo}` : newMemo;
        await db.updateStudentAdminNotes(input.studentId, updatedNotes);
        return true;
      }),
  }),
});

export type AppRouter = typeof appRouter;
