import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { storagePut } from "./storage";
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
import { getCourseTag, getCourseTypeFromUserTag } from "@shared/course";

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

const signupConsentSchema = z.object({
  policyKey: z.string().min(1).max(80),
  policyVersion: z.string().min(1).max(32),
  accepted: z.boolean(),
});

function consentTypeForPolicy(policyKey: string): "required_service" | "optional_ai_learning" | "teacher_ai_style" | "guardian_authorization" {
  if (policyKey === "ai_learning_consent") return "optional_ai_learning";
  if (policyKey === "teacher_ai_code") return "teacher_ai_style";
  return "required_service";
}

async function validateSignupConsents(
  role: "student" | "parent" | "teacher",
  consents: Array<z.infer<typeof signupConsentSchema>>,
) {
  const documents = await db.getActivePolicyDocuments(role);
  const consentMap = new Map(consents.map((consent) => [consent.policyKey, consent]));
  for (const document of documents.filter((document) => document.isRequired === 1)) {
    const consent = consentMap.get(document.policyKey);
    if (!consent?.accepted || consent.policyVersion !== document.version) {
      throw new TRPCError({ code: "BAD_REQUEST", message: `필수 동의 문서(${document.title})를 확인하고 동의해주세요.` });
    }
  }
  return documents
    .filter((document) => {
      const consent = consentMap.get(document.policyKey);
      return Boolean(consent?.accepted && consent.policyVersion === document.version);
    })
    .map((document) => ({
      policyKey: document.policyKey,
      policyVersion: document.version,
      consentType: consentTypeForPolicy(document.policyKey),
      accepted: true,
    }));
}

async function assertTeacherEssayAccess(user: { id: number; role: string; teacherStatus?: string | null }, essayId: number) {
  const essay = await db.getEssaySubmissionById(essayId);
  if (!essay) throw new TRPCError({ code: "NOT_FOUND", message: "논술 제출물을 찾을 수 없습니다." });
  if (user.role === "admin") return essay;
  if (user.role !== "teacher" || user.teacherStatus !== "approved") throw new TRPCError({ code: "FORBIDDEN", message: "승인된 첨삭교사 권한이 필요합니다." });
  const student = await db.getUserById(essay.userId);
  if (!student || student.teacherId !== user.id) throw new TRPCError({ code: "FORBIDDEN", message: "배정된 학생의 제출물만 처리할 수 있습니다." });
  return essay;
}

export const appRouter = router({
  system: systemRouter,
  policy: router({
    forSignup: publicProcedure
      .input(z.object({ accountType: z.enum(["student", "parent", "teacher"]) }))
      .query(async ({ input }) => db.getActivePolicyDocuments(input.accountType)),
    myConsents: protectedProcedure.query(async ({ ctx }) => db.getUserPolicyConsents(ctx.user.id)),
    requestDataAction: protectedProcedure
      .input(z.object({ requestType: z.enum(["access", "correction", "withdraw_ai_learning", "delete_learning_data"]), requestNote: z.string().max(2000).optional() }))
      .mutation(async ({ ctx, input }) => db.createDataProcessingRequest(ctx.user.id, input.requestType, input.requestNote)),
  }),
  teacherAi: router({
    myProfile: protectedProcedure.query(async ({ ctx }) => db.getTeacherAiProfile(ctx.user.id)),
    saveMyProfile: protectedProcedure
      .input(z.object({
        displayName: z.string().min(2).max(100),
        tone: z.enum(["encouraging", "balanced", "direct"]),
        feedbackFocus: z.string().min(2).max(160),
        styleInstruction: z.string().max(4000).optional(),
        forbiddenPhrases: z.array(z.string().max(120)).max(30).optional(),
        rubricWeights: z.record(z.string(), z.number().min(0).max(100)).optional(),
        isEnabled: z.boolean(),
      }))
      .mutation(async ({ ctx, input }) => {
        if (ctx.user.role !== "teacher" && ctx.user.role !== "admin") throw new TRPCError({ code: "FORBIDDEN" });
        return db.upsertTeacherAiProfile({ teacherId: ctx.user.id, ...input });
      }),
    myStyleExamples: protectedProcedure.query(async ({ ctx }) => db.listTeacherAiStyleExamples(ctx.user.id)),
    createStyleExample: protectedProcedure
      .input(z.object({ sourceFeedbackId: z.number().optional(), purpose: z.enum(["style_reference", "quality_evaluation", "training_candidate"]), sourceText: z.string().min(20).max(12000), approvedFeedback: z.string().min(20).max(12000), tags: z.string().max(255).optional() }))
      .mutation(async ({ ctx, input }) => {
        if (ctx.user.role !== "teacher" && ctx.user.role !== "admin") throw new TRPCError({ code: "FORBIDDEN" });
        return db.createTeacherAiStyleExample({ teacherId: ctx.user.id, ...input });
      }),
    updateStyleExampleStatus: protectedProcedure
      .input(z.object({ exampleId: z.number(), status: z.enum(["draft", "teacher_approved", "admin_approved", "rejected", "withdrawn"]) }))
      .mutation(async ({ ctx, input }) => {
        if (ctx.user.role !== "teacher" && ctx.user.role !== "admin") throw new TRPCError({ code: "FORBIDDEN" });
        return db.updateTeacherAiStyleExampleStatus(input.exampleId, input.status);
      }),
    draftsForEssay: protectedProcedure
      .input(z.object({ essayId: z.number() }))
      .query(async ({ ctx, input }) => {
        await assertTeacherEssayAccess(ctx.user, input.essayId);
        return db.getTeacherAiDraftsByEssay(input.essayId);
      }),
    revisionsForDraft: protectedProcedure
      .input(z.object({ draftId: z.number() }))
      .query(async ({ ctx, input }) => {
        const draft = await db.getTeacherAiDraftById(input.draftId);
        if (!draft) throw new TRPCError({ code: "NOT_FOUND" });
        await assertTeacherEssayAccess(ctx.user, draft.essayId);
        return db.getTeacherAiDraftRevisions(input.draftId);
      }),
    generateDraft: protectedProcedure
      .input(z.object({ essayId: z.number() }))
      .mutation(async ({ ctx, input }) => {
        await assertTeacherEssayAccess(ctx.user, input.essayId);
        const profileTeacherId = ctx.user.role === "admin" ? ctx.user.id : ctx.user.id;
        return db.generateTeacherAiDraft(input.essayId, profileTeacherId);
      }),
    saveDraftRevision: protectedProcedure
      .input(z.object({ draftId: z.number(), revisedComment: z.string().trim().min(20).max(12000), changeSummary: z.string().trim().max(1000).optional(), learningApproval: z.enum(["pending", "approved", "rejected", "withdrawn"]).optional() }))
      .mutation(async ({ ctx, input }) => {
        const draft = await db.getTeacherAiDraftById(input.draftId);
        if (!draft) throw new TRPCError({ code: "NOT_FOUND" });
        await assertTeacherEssayAccess(ctx.user, draft.essayId);
        if (ctx.user.role !== "admin" && draft.teacherId !== ctx.user.id) throw new TRPCError({ code: "FORBIDDEN", message: "작성 교사만 수정 이력을 저장할 수 있습니다." });
        return db.saveTeacherAiDraftRevision({ draftId: input.draftId, editorId: ctx.user.id, revisedComment: input.revisedComment, changeSummary: input.changeSummary, learningApproval: input.learningApproval });
      }),
    approveDraft: protectedProcedure
      .input(z.object({ draftId: z.number(), finalComment: z.string().trim().min(20).max(12000) }))
      .mutation(async ({ ctx, input }) => {
        const draft = await db.getTeacherAiDraftById(input.draftId);
        if (!draft) throw new TRPCError({ code: "NOT_FOUND" });
        await assertTeacherEssayAccess(ctx.user, draft.essayId);
        if (ctx.user.role !== "admin" && draft.teacherId !== ctx.user.id) throw new TRPCError({ code: "FORBIDDEN", message: "작성 교사만 최종 발송할 수 있습니다." });
        const result = await db.approveTeacherAiDraft({ draftId: input.draftId, teacherId: draft.teacherId, finalComment: input.finalComment });
        const essay = await db.getEssaySubmissionById(draft.essayId);
        if (essay) void sendPushToUser(essay.userId, { title: "교사 승인 첨삭이 도착했어요", body: `${essay.title}의 최종 첨삭을 확인해보세요.`, url: `/teacher-feedback/${essay.id}`, tag: `teacher-ai-approved-${draft.id}` });
        return result;
      }),
  }),
  aiGovernance: router({
    overview: adminProcedure.query(async () => {
      const [profiles, styleExamples, userStats, policies, consentAudit, dataRequests] = await Promise.all([
        db.getTeacherAiProfiles(),
        db.listTeacherAiStyleExamples(),
        db.getAllUsersStats(),
        db.getActivePolicyDocuments(),
        db.getPolicyConsentAudit(),
        db.getDataProcessingRequests(),
      ]);
      return {
        profiles,
        styleExamples,
        policies,
        consentAudit,
        dataRequests,
        teachers: userStats.users.filter((user) => user.role === "teacher" && user.teacherStatus === "approved"),
      };
    }),
    saveProfile: adminProcedure
      .input(z.object({
        teacherId: z.number(),
        displayName: z.string().min(2).max(100),
        tone: z.enum(["encouraging", "balanced", "direct"]),
        feedbackFocus: z.string().min(2).max(160),
        styleInstruction: z.string().max(4000).optional(),
        forbiddenPhrases: z.array(z.string().max(120)).max(30).optional(),
        rubricWeights: z.record(z.string(), z.number().min(0).max(100)).optional(),
        isEnabled: z.boolean(),
      }))
      .mutation(async ({ input }) => db.upsertTeacherAiProfile(input)),
    updateStyleExampleStatus: adminProcedure
      .input(z.object({ exampleId: z.number(), status: z.enum(["draft", "teacher_approved", "admin_approved", "rejected", "withdrawn"]) }))
      .mutation(async ({ input }) => db.updateTeacherAiStyleExampleStatus(input.exampleId, input.status)),
  }),
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
    recommendedTeachers: publicProcedure
      .input(z.object({ courseType: z.enum(["elementary", "middle_high", "high_univ", "general_adult"]) }))
      .query(async ({ input }) => db.getApprovedTeachersForRecommendation(input.courseType)),

    signup: publicProcedure
      .input(
        z.object({
          name: z.string().trim().min(2).max(80),
          email: z.string().trim().email().transform((value) => value.toLowerCase()),
          password: z.string().min(8).max(128),
          accountType: z.enum(["student", "parent"]).default("student"),
          courseType: z.enum(["elementary", "middle_high", "high_univ", "general_adult"]).optional(),
          preferredTeacherId: z.number().int().positive().optional(),
          consents: z.array(signupConsentSchema).min(1),
        }),
      )
      .mutation(async ({ ctx, input }) => {
        const approvedConsents = await validateSignupConsents(input.accountType, input.consents);
        if (input.accountType === "student" && !input.courseType) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "학생 회원은 학습 과정을 선택해야 합니다." });
        }
        if (input.preferredTeacherId) {
          const availableTeachers = await db.getApprovedTeachersForRecommendation(input.courseType);
          if (!availableTeachers.some((teacher) => teacher.id === input.preferredTeacherId)) {
            throw new TRPCError({ code: "BAD_REQUEST", message: "선택한 추천 교사를 찾을 수 없습니다." });
          }
        }
        const existing = await db.getUserByEmail(input.email);
        const token = createVerificationToken();
        const tokenHash = hashVerificationToken(token);
        const expiresAt = new Date(Date.now() + EMAIL_VERIFICATION_TTL_MS);

        if (existing) {
          if (existing.emailVerifiedAt) {
            throw new TRPCError({ code: "CONFLICT", message: "이미 가입된 이메일입니다." });
          }

          await db.updateVerificationToken(existing.id, tokenHash, expiresAt);
          await db.recordUserPolicyConsents(existing.id, approvedConsents);
          await sendUserVerificationEmail(ctx.req, existing, token);
          return { requiresVerification: true } as const;
        }

        const defaultAiTutor = input.accountType === "student" && !input.preferredTeacherId ? await db.getDefaultAiTutor() : null;
        const selectedTeacherId = input.accountType === "student" ? (input.preferredTeacherId ?? defaultAiTutor?.id ?? null) : null;
        const user = await db.createEmailUser({
          openId: `email_${nanoid(40)}`,
          name: input.name,
          email: input.email,
          loginMethod: "email",
          passwordHash: hashPassword(input.password),
          verificationTokenHash: tokenHash,
          verificationTokenExpiresAt: expiresAt,
          tag: input.accountType === "parent" ? "학부모" : getCourseTag(input.courseType!),
          teacherId: selectedTeacherId,
          preferredTeacherId: selectedTeacherId,
        });

        if (!user) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "회원가입에 실패했습니다." });
        await db.recordUserPolicyConsents(user.id, approvedConsents);
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
          consents: z.array(signupConsentSchema).min(1),
        }),
      )
      .mutation(async ({ ctx, input }) => {
        const approvedConsents = await validateSignupConsents("teacher", input.consents);
        const existing = await db.getUserByEmail(input.email);
        const token = createVerificationToken();
        const tokenHash = hashVerificationToken(token);
        const expiresAt = new Date(Date.now() + EMAIL_VERIFICATION_TTL_MS);

        if (existing) {
          if (existing.emailVerifiedAt) {
            throw new TRPCError({ code: "CONFLICT", message: "이미 가입된 이메일입니다." });
          }
          await db.updateVerificationToken(existing.id, tokenHash, expiresAt);
          await db.recordUserPolicyConsents(existing.id, approvedConsents);
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
          tag: "첨삭교사",
        });

        if (!user) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "교사회원 가입에 실패했습니다." });
        await db.recordUserPolicyConsents(user.id, approvedConsents);
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
        if (input.email === "admin@sample.com") {
          throw new TRPCError({ code: "UNAUTHORIZED", message: "관리자 샘플 계정은 제공되지 않습니다." });
        }
        let user = await db.getUserByEmail(input.email);
        
        // 만약 샘플 계정으로 로그인 시도 시 DB에 없으면 자동 생성 후 로그인 처리
        if (!user && input.email.endsWith("@sample.com")) {
          const sampleRole = input.email.startsWith("teacher") ? "teacher" : "user";
          const sampleName = sampleRole === "teacher" ? "김선생(샘플교사)" : "이학생(샘플학생)";
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

    getWorkbookQuestions: protectedProcedure
      .input(
        z.object({
          courseType: z.string(),
          level: z.number(),
          lessonIndex: z.number(),
        })
      )
      .query(({ input }) => db.getCurriculumWorkbookQuestions(input.courseType, input.level, input.lessonIndex)),

    submitWorkbookAnswer: protectedProcedure
      .input(
        z.object({
          questionId: z.number(),
          userAnswer: z.string(),
        })
      )
      .mutation(({ ctx, input }) => db.submitCurriculumWorkbookAnswer(ctx.user.id, input.questionId, input.userAnswer)),

    getMistakes: protectedProcedure.query(({ ctx }) => db.getWorkbookMistakesByUser(ctx.user.id)),

    addTeacherFeedback: protectedProcedure
      .input(
        z.object({
          answerId: z.number(),
          comment: z.string(),
          gradeScore: z.number(),
        })
      )
      .mutation(({ ctx, input }) => {
        if (ctx.user.role !== "admin" && ctx.user.role !== "user" && ctx.user.teacherStatus !== "approved") {
          throw new Error("교사 권한이 필요합니다.");
        }
        return db.addWorkbookTeacherFeedback(input.answerId, ctx.user.id, input.comment, input.gradeScore);
      }),

    getStats: protectedProcedure.query(({ ctx }) => db.getWorkbookStatsByUser(ctx.user.id)),

    removeMistake: protectedProcedure
      .input(z.object({ mistakeId: z.number(), source: z.enum(["workbook", "learning_tool"]).default("workbook") }))
      .mutation(({ ctx, input }) => input.source === "learning_tool"
        ? db.removeLearningToolMistake(input.mistakeId, ctx.user.id)
        : db.removeWorkbookMistake(input.mistakeId, ctx.user.id)),

    getRecommendedQuestions: protectedProcedure.query(({ ctx }) => db.getRecommendedQuestionsForUser(ctx.user.id)),

    getNotifications: protectedProcedure.query(({ ctx }) => db.getNotificationsByUser(ctx.user.id)),

    markNotificationRead: protectedProcedure
      .input(z.object({ notificationId: z.number() }))
      .mutation(({ ctx, input }) => db.markNotificationAsRead(input.notificationId, ctx.user.id)),

    markAllNotificationsRead: protectedProcedure.mutation(({ ctx }) => db.markAllNotificationsAsRead(ctx.user.id)),

    getUserBadges: protectedProcedure.query(({ ctx }) => db.getUserBadgesByUser(ctx.user.id)),

    getWeeklySummary: protectedProcedure.query(({ ctx }) => db.getWeeklyStudySummary(ctx.user.id)),

    awardReviewKing: protectedProcedure.mutation(({ ctx }) => db.awardReviewKingBadge(ctx.user.id)),

    getPushPrefs: protectedProcedure.query(({ ctx }) => db.getUserPushPreferences(ctx.user.id)),

    updatePushPrefs: protectedProcedure.input(z.object({
      teacherFeedback: z.boolean(),
      assignmentDeadline: z.boolean(),
      notice: z.boolean(),
    })).mutation(({ ctx, input }) => db.updateUserPushPreferences(ctx.user.id, input)),
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

  student: router({
    myAssignments: protectedProcedure.query(async ({ ctx }) => {
      if (ctx.user.role !== "user") throw new TRPCError({ code: "FORBIDDEN", message: "학습자 계정만 배정 과제를 확인할 수 있습니다." });
      return db.getStudentClassAssignments(ctx.user.id);
    }),
    submitAssignment: protectedProcedure
      .input(z.object({ assignmentId: z.number().int().positive(), content: z.string().trim().min(20).max(20000) }))
      .mutation(async ({ ctx, input }) => {
        if (ctx.user.role !== "user") throw new TRPCError({ code: "FORBIDDEN", message: "학습자 계정만 과제를 제출할 수 있습니다." });
        try {
          return await db.submitStudentClassAssignment(ctx.user.id, input.assignmentId, input.content);
        } catch (error: any) {
          throw new TRPCError({ code: "FORBIDDEN", message: error?.message || "과제를 제출할 수 없습니다." });
        }
      }),
  }),

  learningResources: router({
    myLessonGuideHistory: protectedProcedure.query(async ({ ctx }) => {
      if (ctx.user.role !== "user") throw new TRPCError({ code: "FORBIDDEN", message: "학습자 계정만 AI 가이드 이력을 조회할 수 있습니다." });
      return db.getAiLessonGuideHistoriesByUser(ctx.user.id);
    }),
    publishedWritingExamples: protectedProcedure
      .input(z.object({ search: z.string().trim().max(120).optional(), skillTag: z.string().trim().max(80).optional() }).optional())
      .query(async ({ ctx, input }) => {
        if (ctx.user.role !== "user") throw new TRPCError({ code: "FORBIDDEN", message: "학습자 계정만 예시문 라이브러리를 조회할 수 있습니다." });
        return db.getPublishedWritingExamples({ courseType: getCourseTypeFromUserTag(ctx.user.tag), search: input?.search, skillTag: input?.skillTag });
      }),
  }),

  teacherOperations: router({
    myPermissionGrants: protectedProcedure.query(async ({ ctx }) => {
      if (ctx.user.role !== "teacher" || ctx.user.teacherStatus !== "approved") {
        throw new TRPCError({ code: "FORBIDDEN", message: "승인된 첨삭교사 권한이 필요합니다." });
      }
      const grants = await db.getTeacherPermissionGrants();
      return grants.filter((grant) => grant.teacherId === ctx.user.id && grant.isActive === 1);
    }),
    managedStudents: protectedProcedure.query(async ({ ctx }) => {
      if (ctx.user.role !== "teacher" || ctx.user.teacherStatus !== "approved") {
        throw new TRPCError({ code: "FORBIDDEN", message: "승인된 첨삭교사 권한이 필요합니다." });
      }
      return db.getManagedStudentsForTeacher(ctx.user.id);
    }),
    classDashboard: protectedProcedure
      .input(z.object({ attendanceDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/) }))
      .query(async ({ ctx, input }) => {
        if (ctx.user.role !== "teacher" || ctx.user.teacherStatus !== "approved") throw new TRPCError({ code: "FORBIDDEN", message: "승인된 첨삭교사 권한이 필요합니다." });
        return db.getTeacherClassDashboard(ctx.user.id, input.attendanceDate);
      }),
    recordAttendance: protectedProcedure
      .input(z.object({ groupId: z.number().int().positive(), studentId: z.number().int().positive(), attendanceDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), status: z.enum(["present", "late", "absent", "excused"]), note: z.string().trim().max(500).optional() }))
      .mutation(async ({ ctx, input }) => {
        if (ctx.user.role !== "teacher" || ctx.user.teacherStatus !== "approved") throw new TRPCError({ code: "FORBIDDEN", message: "승인된 첨삭교사 권한이 필요합니다." });
        try { return await db.recordClassAttendance(ctx.user.id, input); } catch (error: any) { throw new TRPCError({ code: "FORBIDDEN", message: error?.message || "출결 기록 권한이 없습니다." }); }
      }),
    publishClassAnnouncement: protectedProcedure
      .input(z.object({ groupId: z.number().int().positive(), title: z.string().trim().min(2).max(255), content: z.string().trim().min(2).max(5000) }))
      .mutation(async ({ ctx, input }) => {
        if (ctx.user.role !== "teacher" || ctx.user.teacherStatus !== "approved") throw new TRPCError({ code: "FORBIDDEN", message: "승인된 첨삭교사 권한이 필요합니다." });
        try { return await db.publishClassAnnouncement(ctx.user.id, input); } catch (error: any) { throw new TRPCError({ code: "FORBIDDEN", message: error?.message || "공지 발송 권한이 없습니다." }); }
      }),
    createClassAssignment: protectedProcedure
      .input(z.object({ groupId: z.number().int().positive(), title: z.string().trim().min(2).max(255), instructions: z.string().trim().min(2).max(5000), dueAt: z.date().nullable().optional() }))
      .mutation(async ({ ctx, input }) => {
        if (ctx.user.role !== "teacher" || ctx.user.teacherStatus !== "approved") throw new TRPCError({ code: "FORBIDDEN", message: "승인된 첨삭교사 권한이 필요합니다." });
        try { return await db.createClassAssignment(ctx.user.id, input); } catch (error: any) { throw new TRPCError({ code: "FORBIDDEN", message: error?.message || "과제 배정 권한이 없습니다." }); }
      }),
    feedbackTemplates: protectedProcedure.query(async ({ ctx }) => {
      if (ctx.user.role !== "teacher" || ctx.user.teacherStatus !== "approved") throw new TRPCError({ code: "FORBIDDEN", message: "승인된 첨삭교사 권한이 필요합니다." });
      return db.listTeacherFeedbackTemplates(ctx.user.id);
    }),
    saveFeedbackTemplate: protectedProcedure
      .input(z.object({ templateId: z.number().int().positive().optional(), title: z.string().trim().min(2).max(120), content: z.string().trim().min(2).max(5000) }))
      .mutation(async ({ ctx, input }) => {
        if (ctx.user.role !== "teacher" || ctx.user.teacherStatus !== "approved") throw new TRPCError({ code: "FORBIDDEN", message: "승인된 첨삭교사 권한이 필요합니다." });
        return db.saveTeacherFeedbackTemplate(ctx.user.id, input);
      }),
    deleteFeedbackTemplate: protectedProcedure
      .input(z.object({ templateId: z.number().int().positive() }))
      .mutation(async ({ ctx, input }) => {
        if (ctx.user.role !== "teacher" || ctx.user.teacherStatus !== "approved") throw new TRPCError({ code: "FORBIDDEN", message: "승인된 첨삭교사 권한이 필요합니다." });
        return db.deleteTeacherFeedbackTemplate(ctx.user.id, input.templateId);
      }),
    monthlyAssignmentStats: protectedProcedure
      .input(z.object({ month: z.string().regex(/^\d{4}-\d{2}$/) }))
      .query(async ({ ctx, input }) => {
        if (ctx.user.role !== "teacher" || ctx.user.teacherStatus !== "approved") throw new TRPCError({ code: "FORBIDDEN", message: "승인된 첨삭교사 권한이 필요합니다." });
        return db.getTeacherMonthlyAssignmentStats(ctx.user.id, input.month);
      }),
    assignmentNotificationStats: protectedProcedure.query(async ({ ctx }) => {
      if (ctx.user.role !== "teacher" || ctx.user.teacherStatus !== "approved") throw new TRPCError({ code: "FORBIDDEN", message: "승인된 첨삭교사 권한이 필요합니다." });
      return db.getTeacherAssignmentNotificationStats(ctx.user.id);
    }),
    assignmentReminderHistory: protectedProcedure.query(async ({ ctx }) => {
      if (ctx.user.role !== "teacher" || ctx.user.teacherStatus !== "approved") throw new TRPCError({ code: "FORBIDDEN", message: "승인된 첨삭교사 권한이 필요합니다." });
      return db.getTeacherAssignmentReminderHistory(ctx.user.id);
    }),
    classAssignmentSubmissions: protectedProcedure.query(async ({ ctx }) => {
      if (ctx.user.role !== "teacher" || ctx.user.teacherStatus !== "approved") throw new TRPCError({ code: "FORBIDDEN", message: "승인된 첨삭교사 권한이 필요합니다." });
      return db.getTeacherClassAssignmentSubmissions(ctx.user.id);
    }),
    approvedWritingExamples: protectedProcedure.query(async ({ ctx }) => {
      if (ctx.user.role !== "teacher" || ctx.user.teacherStatus !== "approved") throw new TRPCError({ code: "FORBIDDEN", message: "승인된 첨삭교사 권한이 필요합니다." });
      return db.getTeacherApprovedWritingExamples(ctx.user.id);
    }),
    publishWritingExample: protectedProcedure
      .input(z.object({
        sourceSubmissionId: z.number().int().positive(),
        courseType: z.enum(["elementary", "middle_high", "high_univ", "general_adult"]),
        title: z.string().trim().min(2).max(255),
        topic: z.string().trim().min(2).max(255),
        skillTags: z.string().trim().max(255).optional(),
        anonymizedContent: z.string().trim().min(30).max(20000),
        teacherNote: z.string().trim().max(3000).optional(),
        confirmAnonymized: z.literal(true),
      }))
      .mutation(async ({ ctx, input }) => {
        if (ctx.user.role !== "teacher" || ctx.user.teacherStatus !== "approved") throw new TRPCError({ code: "FORBIDDEN", message: "승인된 첨삭교사 권한이 필요합니다." });
        return db.createApprovedWritingExample(ctx.user.id, input);
      }),
    withdrawWritingExample: protectedProcedure
      .input(z.object({ exampleId: z.number().int().positive() }))
      .mutation(async ({ ctx, input }) => {
        if (ctx.user.role !== "teacher" || ctx.user.teacherStatus !== "approved") throw new TRPCError({ code: "FORBIDDEN", message: "승인된 첨삭교사 권한이 필요합니다." });
        return db.withdrawApprovedWritingExample(ctx.user.id, input.exampleId);
      }),
    reviewClassAssignmentSubmission: protectedProcedure
      .input(z.object({ submissionId: z.number().int().positive(), score: z.number().int().min(0).max(100), teacherComment: z.string().trim().min(2).max(5000) }))
      .mutation(async ({ ctx, input }) => {
        if (ctx.user.role !== "teacher" || ctx.user.teacherStatus !== "approved") throw new TRPCError({ code: "FORBIDDEN", message: "승인된 첨삭교사 권한이 필요합니다." });
        try {
          return await db.reviewStudentClassAssignment(ctx.user.id, input.submissionId, input);
        } catch (error: any) {
          throw new TRPCError({ code: "FORBIDDEN", message: error?.message || "과제를 채점할 수 없습니다." });
        }
      }),
    classAssignmentAiFeedback: protectedProcedure
      .input(z.object({ submissionId: z.number().int().positive() }))
      .query(async ({ ctx, input }) => {
        if (ctx.user.role !== "teacher" || ctx.user.teacherStatus !== "approved") throw new TRPCError({ code: "FORBIDDEN", message: "승인된 첨삭교사 권한이 필요합니다." });
        const submissions = await db.getTeacherClassAssignmentSubmissions(ctx.user.id);
        if (!submissions.some((submission) => submission.id === input.submissionId)) throw new TRPCError({ code: "FORBIDDEN", message: "담당 반 학생의 제출물만 조회할 수 있습니다." });
        return db.getClassAssignmentAiFeedbacks(input.submissionId);
      }),
    generateClassAssignmentAiFeedback: protectedProcedure
      .input(z.object({ submissionId: z.number().int().positive() }))
      .mutation(async ({ ctx, input }) => {
        if (ctx.user.role !== "teacher" || ctx.user.teacherStatus !== "approved") throw new TRPCError({ code: "FORBIDDEN", message: "승인된 첨삭교사 권한이 필요합니다." });
        try {
          return await db.generateClassAssignmentAiFeedback(ctx.user.id, input.submissionId);
        } catch (error: any) {
          throw new TRPCError({ code: "FORBIDDEN", message: error?.message || "AI 1차 첨삭을 생성할 수 없습니다." });
        }
      }),
    notifyUpcomingAssignmentStudents: protectedProcedure
      .input(z.object({ hoursAhead: z.number().int().min(24).max(168).default(72) }))
      .mutation(async ({ ctx, input }) => {
        if (ctx.user.role !== "teacher" || ctx.user.teacherStatus !== "approved") throw new TRPCError({ code: "FORBIDDEN", message: "승인된 첨삭교사 권한이 필요합니다." });
        return db.notifyUpcomingAssignmentStudents(ctx.user.id, input.hoursAhead);
      }),
    updateStudentProgress: protectedProcedure
      .input(z.object({ studentId: z.number(), curriculumId: z.number(), score: z.number().min(0).max(100), completed: z.boolean() }))
      .mutation(async ({ ctx, input }) => {
        if (ctx.user.role !== "teacher" || ctx.user.teacherStatus !== "approved" || !(await db.canTeacherManageStudent(ctx.user.id, input.studentId, "progress"))) {
          throw new TRPCError({ code: "FORBIDDEN", message: "해당 학생의 진도 관리 권한이 없습니다." });
        }
        return db.upsertProgress({ userId: input.studentId, curriculumId: input.curriculumId, score: input.score, completed: input.completed ? 1 : 0, completedAt: input.completed ? new Date() : null });
      }),
    requestCertificateApproval: protectedProcedure
      .input(z.object({ studentId: z.number(), level: z.number().int().min(1).max(20).optional(), certificateType: z.enum(["level_certificate", "graduation_certificate"]) }))
      .mutation(async ({ ctx, input }) => {
        if (ctx.user.role !== "teacher" || ctx.user.teacherStatus !== "approved" || !(await db.canTeacherManageStudent(ctx.user.id, input.studentId, "certificate"))) {
          throw new TRPCError({ code: "FORBIDDEN", message: "해당 학생의 수료증 요청 권한이 없습니다." });
        }
        const eligibility = await db.getStudentCertificateEligibility(input.studentId);
        const grants = await db.getTeacherPermissionGrants();
        const applicableGrant = grants.find((grant) => grant.teacherId === ctx.user.id && grant.isActive === 1 && (grant.scopeType === "organization" || grant.studentId === input.studentId));
        return db.createCertificateApprovalRequest({
          studentId: input.studentId,
          courseType: eligibility.courseType,
          level: input.level,
          certificateType: input.certificateType,
          requestedBy: ctx.user.id,
          requestScope: applicableGrant?.scopeType || "student",
          evidenceCompletionRate: eligibility.completionRate,
          evidenceAverageScore: eligibility.averageScore,
        });
      }),
    reviewCertificateRequest: protectedProcedure
      .input(z.object({ requestId: z.number(), note: z.string().trim().max(1000).optional() }))
      .mutation(async ({ ctx, input }) => {
        if (ctx.user.role !== "teacher" || ctx.user.teacherStatus !== "approved") throw new TRPCError({ code: "FORBIDDEN" });
        return db.reviewCertificateApprovalRequestByTeacher(input.requestId, ctx.user.id, input.note);
      }),
    certificateRequests: protectedProcedure.query(async ({ ctx }) => {
      if (ctx.user.role !== "teacher" || ctx.user.teacherStatus !== "approved") throw new TRPCError({ code: "FORBIDDEN" });
      const requests = await db.getCertificateApprovalRequests();
      const permissions = await Promise.all(requests.map((request) => db.canTeacherManageStudent(ctx.user.id, request.studentId, "certificate")));
      return requests.filter((_, index) => permissions[index]);
    }),
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

    eligibility: protectedProcedure.query(({ ctx }) => db.getStudentCertificateEligibility(ctx.user.id)),

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
      .mutation(async ({ ctx, input }) => {
        if (ctx.user.role !== "user") throw new TRPCError({ code: "FORBIDDEN", message: "학습자 계정만 수료증을 신청할 수 있습니다." });
        try {
          return await db.issueCertificate({
          userId: ctx.user.id,
          courseType: input.courseType,
          level: input.level,
          certificateType: input.certificateType,
          shareToken: nanoid(),
          pdfUrl: input.pdfUrl,
          });
        } catch (error: any) {
          throw new TRPCError({ code: "BAD_REQUEST", message: error?.message || "수료증 발급 조건을 확인할 수 없습니다." });
        }
      }),
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

  badges: router({
    getByUser: protectedProcedure.query(async ({ ctx }) => {
      return await db.getUserBadges(ctx.user.id);
    }),
    award: protectedProcedure
      .input(z.object({ courseType: z.string(), badgeType: z.string(), badgeName: z.string() }))
      .mutation(async ({ ctx, input }) => {
        if (ctx.user.role !== "user") throw new TRPCError({ code: "FORBIDDEN", message: "학습자 계정만 학습 뱃지를 획득할 수 있습니다." });
        if (input.courseType !== getCourseTypeFromUserTag(ctx.user.tag)) {
          throw new TRPCError({ code: "FORBIDDEN", message: "가입한 과정의 학습 도구를 완료해야 해당 과정 뱃지를 획득할 수 있습니다." });
        }
        return await db.awardBadge(ctx.user.id, input.courseType, input.badgeType, input.badgeName);
      }),
  }),

  questionBank: router({
    list: protectedProcedure
      .input(z.object({ courseType: z.string().optional(), toolType: z.string().optional() }))
      .query(async ({ input }) => {
        return await db.getQuestionBankList(input.courseType, input.toolType);
      }),
    random: protectedProcedure
      .input(z.object({ courseType: z.string(), toolType: z.string(), limit: z.number().default(10) }))
      .query(async ({ input }) => {
        return await db.getRandomQuestions(input.courseType, input.toolType, input.limit);
      }),
    reorderingPractice: protectedProcedure
      .input(z.object({ courseType: z.enum(["elementary", "middle_high", "high_univ", "general_adult"]), limit: z.number().int().min(1).max(10).default(10) }))
      .query(async ({ input }) => {
        return await db.getReorderingPracticeSet(input.courseType, input.limit);
      }),
    recordMistake: protectedProcedure
      .input(z.object({
        questionBankId: z.number().int().positive(),
        courseType: z.enum(["elementary", "middle_high", "high_univ", "general_adult"]),
        toolType: z.enum(["quiz", "reordering", "summary"]),
        userAnswer: z.string().min(1).max(8000),
        score: z.number().min(0).max(100),
        aiFeedback: z.string().min(1).max(6000),
      }))
      .mutation(({ ctx, input }) => {
        if (ctx.user.role !== "user") {
          return { stored: true, skipped: true, reason: "관리자·교사 점검 결과는 학습자 오답 노트에 저장하지 않습니다." };
        }
        if (input.courseType !== getCourseTypeFromUserTag(ctx.user.tag)) {
          throw new TRPCError({ code: "FORBIDDEN", message: "가입한 과정의 학습 도구 결과만 저장할 수 있습니다." });
        }
        return db.recordLearningToolMistake({ userId: ctx.user.id, ...input });
      }),
    topicWizardGuide: protectedProcedure
      .input(z.object({
        step: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4)]),
        courseType: z.enum(["elementary", "middle_high", "high_univ", "general_adult"]),
        category: z.string().max(100).optional(),
        topic: z.string().max(500).optional(),
        mainIdea: z.string().max(1200).optional(),
        outline: z.string().max(4000).optional(),
      }))
      .mutation(({ ctx, input }) => {
        if (ctx.user.role === "user" && input.courseType !== getCourseTypeFromUserTag(ctx.user.tag)) {
          throw new TRPCError({ code: "FORBIDDEN", message: "가입한 과정의 AI 가이드만 이용할 수 있습니다." });
        }
        return db.generateTopicWizardGuide(input);
      }),
    lessonWritingGuide: protectedProcedure
      .input(z.object({
        courseType: z.enum(["elementary", "middle_high", "high_univ", "general_adult"]),
        level: z.number().int().min(1).max(20),
        lessonIndex: z.number().int().min(0).max(50),
        lessonTitle: z.string().min(2).max(300),
        lessonContent: z.string().min(2).max(3000),
        lessonExample: z.string().min(2).max(3000),
      }))
      .mutation(async ({ ctx, input }) => {
        if (ctx.user.role === "user" && input.courseType !== getCourseTypeFromUserTag(ctx.user.tag)) {
          throw new TRPCError({ code: "FORBIDDEN", message: "가입한 과정의 AI 레슨 가이드만 이용할 수 있습니다." });
        }
        const guide = await db.generateLessonWritingGuide(input);
        const history = await db.saveAiLessonGuideHistory({ userId: ctx.user.id, ...input, guide });
        return { ...guide, historyId: history?.id ?? null };
      }),
    analyzeThesis: protectedProcedure
      .input(z.object({
        thesis: z.string().trim().min(10).max(1200),
        courseType: z.enum(["elementary", "middle_high", "high_univ", "general_adult"]),
        topic: z.string().max(500).optional(),
      }))
      .mutation(({ ctx, input }) => {
        if (ctx.user.role === "user" && input.courseType !== getCourseTypeFromUserTag(ctx.user.tag)) {
          throw new TRPCError({ code: "FORBIDDEN", message: "가입한 과정의 주제문 분석만 이용할 수 있습니다." });
        }
        return db.analyzeThesisStatement(input);
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
        return await db.deleteQuestionBankItem(input.id, ctx.user.id, ctx.user.name || "관리자");
      }),
    bulkCreate: protectedProcedure
      .input(z.object({
        items: z.array(z.object({
          id: z.number().optional(),
          courseType: z.enum(["elementary", "middle_high", "high_univ", "general_adult"]),
          toolType: z.string(),
          title: z.string(),
          contentData: z.string(),
          difficulty: z.enum(["easy", "medium", "hard"]).optional(),
          isActive: z.number().optional(),
        })),
        upsert: z.boolean().default(false),
      }))
      .mutation(async ({ ctx, input }) => {
        if (ctx.user.role !== "admin") throw new TRPCError({ code: "FORBIDDEN" });
        let created = 0;
        let updated = 0;
        let failed = 0;
        const failures: Array<{ id?: number; title: string; courseType: string; toolType: string; reason: string }> = [];
        for (const item of input.items) {
          try {
            if (input.upsert) {
              const result = await db.upsertQuestionBankItem(item);
              if (result.action === "updated") updated += 1;
              else created += 1;
            } else {
              await db.createQuestionBankItem(item);
              created += 1;
            }
          } catch (error) {
            failed += 1;
            failures.push({
              id: item.id,
              title: item.title,
              courseType: item.courseType,
              toolType: item.toolType,
              reason: error instanceof Error ? error.message : "서버 반영 중 알 수 없는 오류가 발생했습니다.",
            });
          }
        }
        return { success: failed === 0, count: input.items.length, created, updated, failed, failures };
      }),

    deleteMany: protectedProcedure
      .input(z.object({ ids: z.array(z.number().int().positive()).min(1).max(1000) }))
      .mutation(async ({ ctx, input }) => {
        if (ctx.user.role !== "admin") throw new TRPCError({ code: "FORBIDDEN" });
        return await db.deleteQuestionBankItems(input.ids, ctx.user.id, ctx.user.name || "관리자");
      }),

    listTrash: protectedProcedure.query(async ({ ctx }) => {
      if (ctx.user.role !== "admin") throw new TRPCError({ code: "FORBIDDEN" });
      return await db.getQuestionBankTrash();
    }),

    restoreFromTrash: protectedProcedure
      .input(z.object({ trashId: z.number().int().positive() }))
      .mutation(async ({ ctx, input }) => {
        if (ctx.user.role !== "admin") throw new TRPCError({ code: "FORBIDDEN" });
        return await db.restoreQuestionBankTrashItem(input.trashId, ctx.user.id, ctx.user.name || "관리자");
      }),

    permanentlyDeleteTrashItem: protectedProcedure
      .input(z.object({ trashId: z.number().int().positive() }))
      .mutation(async ({ ctx, input }) => {
        if (ctx.user.role !== "admin") throw new TRPCError({ code: "FORBIDDEN" });
        return await db.permanentlyDeleteQuestionBankTrashItem(input.trashId, ctx.user.id, ctx.user.name || "관리자");
      }),

    restoreManyFromTrash: protectedProcedure
      .input(z.object({ trashIds: z.array(z.number().int().positive()).min(1).max(1000) }))
      .mutation(async ({ ctx, input }) => {
        if (ctx.user.role !== "admin") throw new TRPCError({ code: "FORBIDDEN" });
        return await db.restoreQuestionBankTrashItems(input.trashIds, ctx.user.id, ctx.user.name || "관리자");
      }),

    permanentlyDeleteTrashItems: protectedProcedure
      .input(z.object({ trashIds: z.array(z.number().int().positive()).min(1).max(1000) }))
      .mutation(async ({ ctx, input }) => {
        if (ctx.user.role !== "admin") throw new TRPCError({ code: "FORBIDDEN" });
        return await db.permanentlyDeleteQuestionBankTrashItems(input.trashIds, ctx.user.id, ctx.user.name || "관리자");
      }),

    maintenanceSettings: protectedProcedure.query(async ({ ctx }) => {
      if (ctx.user.role !== "admin") throw new TRPCError({ code: "FORBIDDEN" });
      return await db.getQuestionBankMaintenanceSettings();
    }),

    updateMaintenanceSettings: protectedProcedure
      .input(z.object({ retentionDays: z.number().int().min(1).max(365) }))
      .mutation(async ({ ctx, input }) => {
        if (ctx.user.role !== "admin") throw new TRPCError({ code: "FORBIDDEN" });
        return await db.updateQuestionBankMaintenanceSettings(input.retentionDays, ctx.user.id);
      }),

    operationLogs: protectedProcedure
      .input(z.object({
        limit: z.number().int().min(1).max(500).default(200),
        actionType: z.enum(["moved_to_trash", "restored", "permanently_deleted", "auto_purged"]).optional(),
        actorName: z.string().trim().min(1).max(100).optional(),
        startDate: z.date().optional(),
        endDate: z.date().optional(),
      }).optional())
      .query(async ({ ctx, input }) => {
        if (ctx.user.role !== "admin") throw new TRPCError({ code: "FORBIDDEN" });
        return await db.getQuestionBankOperationLogs(input);
      }),

    deleteByCourse: protectedProcedure
      .input(z.object({ courseType: z.string() }))
      .mutation(async ({ ctx, input }) => {
        if (ctx.user.role !== "admin") throw new TRPCError({ code: "FORBIDDEN" });
        const courseQuestions = await db.getQuestionBankList(input.courseType);
        return await db.deleteQuestionBankItems(courseQuestions.map((question) => question.id), ctx.user.id, ctx.user.name || "관리자");
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
      .input(z.object({
        courseType: z.enum(["elementary", "middle_high", "high_univ", "general_adult"]),
        toolType: z.enum(["quiz", "reordering", "summary", "topic_wizard", "thesis_checklist"]),
        count: z.number().int().min(1).max(5).default(3),
      }))
      .mutation(async ({ ctx, input }) => {
        if (ctx.user.role !== "admin") throw new TRPCError({ code: "FORBIDDEN" });
        return await db.generateAiQuestionsForCategory(input.courseType, input.toolType, input.count);
      }),
    previewAiQuestions: protectedProcedure
      .input(z.object({
        courseType: z.enum(["elementary", "middle_high", "high_univ", "general_adult"]),
        toolType: z.enum(["quiz", "reordering", "summary", "topic_wizard", "thesis_checklist"]),
        count: z.number().int().min(1).max(5).default(3),
      }))
      .mutation(async ({ ctx, input }) => {
        if (ctx.user.role !== "admin") throw new TRPCError({ code: "FORBIDDEN" });
        return await db.previewAiQuestionsForCategory(input.courseType, input.toolType, input.count);
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
    getTeacherPermissionGrants: protectedProcedure.query(async ({ ctx }) => {
      if (ctx.user.role !== "admin") throw new TRPCError({ code: "FORBIDDEN", message: "관리자 권한이 필요합니다." });
      return db.getTeacherPermissionGrants();
    }),
    saveTeacherPermissionGrant: protectedProcedure
      .input(z.object({
        grantId: z.number().optional(),
        teacherId: z.number(),
        scopeType: z.enum(["organization", "student"]),
        organizationName: z.string().trim().min(2).max(160).optional(),
        studentId: z.number().optional(),
        canManageProgress: z.boolean(),
        canRequestCertificate: z.boolean(),
        isActive: z.boolean(),
      }).superRefine((value, issue) => {
        if (value.scopeType === "organization" && !value.organizationName) issue.addIssue({ code: z.ZodIssueCode.custom, message: "조직 단위에는 조직 또는 학급 이름이 필요합니다.", path: ["organizationName"] });
        if (value.scopeType === "student" && !value.studentId) issue.addIssue({ code: z.ZodIssueCode.custom, message: "학생 단위에는 대상 학생 선택이 필요합니다.", path: ["studentId"] });
        if (!value.canManageProgress && !value.canRequestCertificate) issue.addIssue({ code: z.ZodIssueCode.custom, message: "최소 하나의 관리 권한을 선택해야 합니다.", path: ["canManageProgress"] });
      }))
      .mutation(async ({ ctx, input }) => {
        if (ctx.user.role !== "admin") throw new TRPCError({ code: "FORBIDDEN", message: "관리자 권한이 필요합니다." });
        return db.saveTeacherPermissionGrant({ ...input, organizationName: input.organizationName ?? null, studentId: input.studentId ?? null, canManageProgress: input.canManageProgress ? 1 : 0, canRequestCertificate: input.canRequestCertificate ? 1 : 0, isActive: input.isActive ? 1 : 0, grantedBy: ctx.user.id });
      }),
    setTeacherPermissionGrantActive: protectedProcedure
      .input(z.object({ grantId: z.number(), isActive: z.boolean() }))
      .mutation(async ({ ctx, input }) => {
        if (ctx.user.role !== "admin") throw new TRPCError({ code: "FORBIDDEN", message: "관리자 권한이 필요합니다." });
        return db.setTeacherPermissionGrantActive(input.grantId, input.isActive ? 1 : 0);
      }),
    getCertificateApprovalPolicies: protectedProcedure.query(async ({ ctx }) => {
      if (ctx.user.role !== "admin") throw new TRPCError({ code: "FORBIDDEN", message: "관리자 권한이 필요합니다." });
      return db.getCertificateApprovalPolicies();
    }),
    saveCertificateApprovalPolicy: protectedProcedure
      .input(z.object({ courseType: z.enum(["elementary", "middle_high", "high_univ", "general_adult"]), teacherReviewRequired: z.boolean(), adminApprovalRequired: z.boolean(), minimumCompletionRate: z.number().int().min(0).max(100), minimumAverageScore: z.number().int().min(0).max(100), isActive: z.boolean() }))
      .mutation(async ({ ctx, input }) => {
        if (ctx.user.role !== "admin") throw new TRPCError({ code: "FORBIDDEN", message: "관리자 권한이 필요합니다." });
        return db.saveCertificateApprovalPolicy({ ...input, teacherReviewRequired: input.teacherReviewRequired ? 1 : 0, adminApprovalRequired: input.adminApprovalRequired ? 1 : 0, isActive: input.isActive ? 1 : 0, updatedBy: ctx.user.id });
      }),
    getCertificateApprovalRequests: protectedProcedure.query(async ({ ctx }) => {
      if (ctx.user.role !== "admin") throw new TRPCError({ code: "FORBIDDEN", message: "관리자 권한이 필요합니다." });
      return db.getCertificateApprovalRequests();
    }),
    resolveCertificateApprovalRequest: protectedProcedure
      .input(z.object({ requestId: z.number(), approved: z.boolean(), note: z.string().trim().max(1000).optional() }))
      .mutation(async ({ ctx, input }) => {
        if (ctx.user.role !== "admin") throw new TRPCError({ code: "FORBIDDEN", message: "관리자 권한이 필요합니다." });
        return db.resolveCertificateApprovalRequestByAdmin({ requestId: input.requestId, adminId: ctx.user.id, approved: input.approved, note: input.note });
      }),
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
        await db.updateTeacherStatus(input.userId, input.teacherStatus, undefined, ctx.user.id);
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
        try {
          return await db.adminIssueCertificate({
            userId: input.userId,
            courseType: input.courseType,
            level: input.level,
            certificateType: input.certificateType,
            shareToken,
            issuedBy: ctx.user.id,
            issueReason: input.issueReason,
          });
        } catch (error: any) {
          throw new TRPCError({ code: "BAD_REQUEST", message: error?.message || "수료증 발급 조건을 확인할 수 없습니다." });
        }
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
      .input(z.object({ userId: z.number(), newRole: z.enum(["user", "teacher"]) }))
      .mutation(async ({ ctx, input }) => {
        if (ctx.user.role !== "admin") {
          throw new TRPCError({ code: "FORBIDDEN", message: "관리자 권한이 필요합니다." });
        }
        await db.changeLearnerTeacherRole(input.userId, input.newRole, ctx.user.id);
        return true;
      }),
    createAdminAccount: protectedProcedure
      .input(z.object({ name: z.string().trim().min(2).max(80), email: z.string().trim().email().transform((value) => value.toLowerCase()), password: z.string().min(10).max(128) }))
      .mutation(async ({ ctx, input }) => {
        if (ctx.user.role !== "admin") throw new TRPCError({ code: "FORBIDDEN", message: "관리자 권한이 필요합니다." });
        return db.createManagedAdminAccount({ openId: `admin_${nanoid(40)}`, name: input.name, email: input.email, passwordHash: hashPassword(input.password), actorId: ctx.user.id });
      }),
    adjustUserLevel: protectedProcedure
      .input(z.object({ userId: z.number().int().positive(), targetLevel: z.number().int().min(1).max(10) }))
      .mutation(async ({ ctx, input }) => {
        if (ctx.user.role !== "admin") throw new TRPCError({ code: "FORBIDDEN", message: "관리자 권한이 필요합니다." });
        return db.adjustManagedUserLevel(input.userId, input.targetLevel, ctx.user.id);
      }),
    getLearningGroups: protectedProcedure.query(async ({ ctx }) => {
      if (ctx.user.role !== "admin") throw new TRPCError({ code: "FORBIDDEN", message: "관리자 권한이 필요합니다." });
      return db.getLearningGroupsWithMembers();
    }),
    saveLearningGroup: protectedProcedure
      .input(z.object({ groupId: z.number().int().positive().optional(), name: z.string().trim().min(2).max(160), groupType: z.enum(["class", "group"]), courseType: z.enum(["elementary", "middle_high", "high_univ", "general_adult"]).nullable().optional(), description: z.string().max(2000).nullable().optional(), teacherId: z.number().int().positive().nullable().optional(), isActive: z.boolean() }))
      .mutation(async ({ ctx, input }) => {
        if (ctx.user.role !== "admin") throw new TRPCError({ code: "FORBIDDEN", message: "관리자 권한이 필요합니다." });
        return db.saveLearningGroup({ ...input, isActive: input.isActive ? 1 : 0, createdBy: ctx.user.id });
      }),
    addLearningGroupMember: protectedProcedure
      .input(z.object({ groupId: z.number().int().positive(), studentId: z.number().int().positive() }))
      .mutation(async ({ ctx, input }) => {
        if (ctx.user.role !== "admin") throw new TRPCError({ code: "FORBIDDEN", message: "관리자 권한이 필요합니다." });
        return db.addLearningGroupMember(input.groupId, input.studentId, ctx.user.id);
      }),
    removeLearningGroupMember: protectedProcedure
      .input(z.object({ groupId: z.number().int().positive(), studentId: z.number().int().positive() }))
      .mutation(async ({ ctx, input }) => {
        if (ctx.user.role !== "admin") throw new TRPCError({ code: "FORBIDDEN", message: "관리자 권한이 필요합니다." });
        return db.removeLearningGroupMember(input.groupId, input.studentId);
      }),
    assignStudentTeacher: protectedProcedure
      .input(z.object({ studentId: z.number().int().positive(), teacherId: z.number().int().positive().nullable() }))
      .mutation(async ({ ctx, input }) => {
        if (ctx.user.role !== "admin") throw new TRPCError({ code: "FORBIDDEN", message: "관리자 권한이 필요합니다." });
        return db.assignStudentTeacher(input.studentId, input.teacherId, ctx.user.id);
      }),
    getAuditLogs: protectedProcedure
      .input(z.object({ limit: z.number().int().min(1).max(200).default(100) }).optional())
      .query(async ({ ctx, input }) => {
        if (ctx.user.role !== "admin") throw new TRPCError({ code: "FORBIDDEN", message: "관리자 권한이 필요합니다." });
        return db.getAdminAuditLogs(input?.limit ?? 100);
      }),
    approveTeacher: protectedProcedure
      .input(z.object({ userId: z.number(), teacherLevel: z.number().optional() }))
      .mutation(async ({ ctx, input }) => {
        if (ctx.user.role !== "admin") {
          throw new TRPCError({ code: "FORBIDDEN", message: "관리자 권한이 필요합니다." });
        }
        await db.updateTeacherStatus(input.userId, "approved", input.teacherLevel, ctx.user.id);
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
