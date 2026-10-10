import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { storagePut } from "./storage";
import { systemRouter } from "./_core/systemRouter";
import { adminProcedure, publicProcedure, protectedProcedure, router } from "./_core/trpc";
import * as db from "./db";
import { z } from "zod";
import { nanoid } from "nanoid";
import { evaluateConfiguredWriting } from "./configuredWritingEvaluation";
import { normalizeAllowedDomains, validateExternalEvaluationEndpoint } from "./evaluationModelRegistry";
import { getHumanEvaluationQualityMetrics } from "./evaluationMetrics";
import { evaluateWritingHeuristic, getHumanReviewReasons } from "./writingCorrectionEngine";
import { evaluateWritingWithLLM } from "./writingEvaluationEngine";
import { getTrialAccess, isEligibleTrialEvaluation, TRIAL_AI_EVALUATION_LIMIT } from "./trialPolicy";

// 샘플 체험(비로그인) AI 첨삭 실체험 남용 방지 한도
const SAMPLE_AI_SESSION_LIMIT = 3;
const SAMPLE_AI_IP_DAILY_LIMIT = 10;
const SAMPLE_AI_TEXT_MAX_LENGTH = 300;
// 세션 토큰·IP 헤더를 바꿔도 넘을 수 없는 서비스 전체 일일 상한(AI 비용 보호).
const SAMPLE_AI_GLOBAL_DAILY_LIMIT = 300;

import { resolveClientIp } from "./clientIp";
import { publicBaseUrl } from "./publicUrl";
import { consumeRateLimit, RATE_RULES, type RateLimitRule } from "./rateLimit";
import {
  GUARDIAN_AGREEMENT_LABELS,
  GUARDIAN_CONSENT_COURSE,
  GUARDIAN_CONSENT_INTRO,
  GUARDIAN_CONSENT_METHOD,
  GUARDIAN_CONSENT_SECTIONS,
  GUARDIAN_CONSENT_TITLE,
  GUARDIAN_CONSENT_VERSION,
  GUARDIAN_RELATIONS,
  calculateAge,
  maskName,
} from "@shared/guardian";
import { decryptSecret, encryptSecret } from "./security";
import { removeSubscription, saveSubscription, sendPushToUser } from "./push";
import { sdk } from "./_core/sdk";
import { TRPCError } from "@trpc/server";
import {
  createVerificationToken,
  sendGuardianConsentEmail,
  hashPassword,
  hashVerificationToken,
  sendPasswordResetEmail,
  sendVerificationEmail,
  verifyPasswordAsync,
  sendAnnouncementEmail,
} from "./email";
import { getCourseTag, getCourseTypeFromUserTag } from "@shared/course";
import type { CourseType } from "@shared/course";

const EMAIL_VERIFICATION_TTL_MS = 24 * 60 * 60 * 1000;
const GUARDIAN_CONSENT_TTL_MS = 14 * 24 * 60 * 60 * 1000;
const SESSION_TTL_MS = 365 * 24 * 60 * 60 * 1000;

const questionGenerationInput = z.object({
  course: z.string().trim().min(1).optional(),
  courseType: z.enum(["elementary", "middle_high", "high_univ", "general_adult"]).optional(),
  tool_type: z.string().trim().min(1).optional(),
  toolType: z.enum(["quiz", "reordering", "summary", "topic_wizard", "thesis_checklist"]).optional(),
  theory_category: z.string().trim().min(1).default("AUTO"),
  difficulty: z.union([z.literal("AUTO"), z.coerce.number().int().min(1).max(5)]).default("AUTO"),
  question_count: z.coerce.number().int().min(1).max(20).optional(),
  count: z.coerce.number().int().min(1).max(20).optional(),
  topic: z.string().trim().min(1).default("AUTO"),
}).superRefine((value, ctx) => {
  if (!value.course && !value.courseType) ctx.addIssue({ code: z.ZodIssueCode.custom, message: "생성할 과정이 필요합니다.", path: ["course"] });
  if (!value.tool_type && !value.toolType) ctx.addIssue({ code: z.ZodIssueCode.custom, message: "생성할 학습 도구가 필요합니다.", path: ["tool_type"] });
});

const theoryContentWriteInput = z.object({
  courseType: z.enum(["elementary", "middle_high", "high_univ", "general_adult"]),
  lessonLevel: z.coerce.number().int().min(1).max(5),
  theoryCategory: z.string().trim().min(2).max(32),
  theorySubcategory: z.string().trim().min(2).max(128),
  exampleMode: z.enum(["TEXTBOOK_SIMILAR", "TEXTBOOK_PLUS_NEW"]),
  title: z.string().trim().min(4).max(255),
  contentData: z.string().trim().min(20),
  sourceNote: z.string().trim().min(2).max(255).optional(),
  isActive: z.coerce.number().int().min(0).max(1).optional(),
});

const theoryGenerationInput = z.object({
  course: z.enum(["ELEMENTARY", "MIDDLE_HIGH", "HIGH_ADMISSION", "GENERAL_WORK"]),
  theory_category: z.string().trim().min(2).max(32),
  theory_subcategory: z.string().trim().min(2).max(128).default("AUTO"),
  lesson_level: z.coerce.number().int().min(1).max(5),
  content_count: z.coerce.number().int().min(1).max(6).default(3),
  example_mode: z.enum(["TEXTBOOK_SIMILAR", "TEXTBOOK_PLUS_NEW"]).default("TEXTBOOK_PLUS_NEW"),
  context: z.string().trim().min(2).max(500).default("AUTO"),
});

// 인증·재설정·보호자 동의 메일의 링크 주소는 서버 설정(PUBLIC_BASE_URL)을 우선한다(요청자가 정한 주소를 쓰지 않는다).
function requestOrigin(req: { protocol: string; headers: Record<string, unknown> }) {
  return publicBaseUrl(req);
}

// 로그인·메일 발송·가입처럼 반복 호출이 위험한 요청의 횟수를 제한한다.
function enforceRateLimit(name: string, key: string, rule: RateLimitRule) {
  const result = consumeRateLimit(name, key, rule);
  if (!result.allowed) {
    throw new TRPCError({ code: "TOO_MANY_REQUESTS", message: `요청이 너무 많습니다. ${Math.ceil(result.retryAfterSec / 60)}분 뒤에 다시 시도해 주세요.` });
  }
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

const GUARDIAN_RESEND_COOLDOWN_MS = 5 * 60 * 1000;

// 새 동의 링크를 발급(이전 링크는 즉시 무효)하고 보호자에게 동의 요청 메일을 보낸다.
async function issueGuardianConsentLink(
  req: { protocol: string; headers: Record<string, unknown> },
  consent: { id: number; guardianEmail: string; guardianName: string },
  childName: string,
) {
  const token = createVerificationToken();
  await db.refreshGuardianConsentToken(consent.id, hashVerificationToken(token), new Date(Date.now() + GUARDIAN_CONSENT_TTL_MS));
  await sendGuardianConsentEmail({
    to: consent.guardianEmail,
    guardianName: consent.guardianName,
    childName,
    consentUrl: `${requestOrigin(req)}/guardian-consent?token=${encodeURIComponent(token)}`,
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

// 제출 글과 그 첨삭은 글 주인·배정 교사·관리자만 볼 수 있다(글 번호만으로 남의 글을 열 수 없게 한다).
async function assertEssayReadAccess(user: { id: number; role: string; teacherStatus?: string | null }, essayId: number) {
  const essay = await db.getEssaySubmissionById(essayId);
  if (!essay) throw new TRPCError({ code: "NOT_FOUND", message: "논술 제출물을 찾을 수 없습니다." });
  if (user.role === "admin" || essay.userId === user.id) return essay;
  if (user.role === "teacher" && user.teacherStatus === "approved") {
    const student = await db.getUserById(essay.userId);
    if (student?.teacherId === user.id) return essay;
  }
  throw new TRPCError({ code: "FORBIDDEN", message: "본인 또는 담당 학생의 제출물만 확인할 수 있습니다." });
}

const SCORE_0_100 = z.number().int().min(0).max(100);

// 로그인하지 않아도 읽을 수 있는 사이트 설정(공개 문서)
const PUBLIC_SITE_SETTING_KEYS = ["terms_of_service", "privacy_policy"];

function assertApprovedTeacherOrAdmin(user: { role: string; teacherStatus?: string | null }) {
  if (user.role === "admin") return;
  if (user.role === "teacher" && user.teacherStatus === "approved") return;
  throw new TRPCError({ code: "FORBIDDEN", message: "승인된 교사 또는 관리자만 사용할 수 있습니다." });
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
        if (ctx.user.role !== "admin" && !(ctx.user.role === "teacher" && ctx.user.teacherStatus === "approved")) throw new TRPCError({ code: "FORBIDDEN", message: "승인된 교사 권한이 필요합니다." });
        return db.upsertTeacherAiProfile({ teacherId: ctx.user.id, ...input });
      }),
    myStyleExamples: protectedProcedure.query(async ({ ctx }) => db.listTeacherAiStyleExamples(ctx.user.id)),
    createStyleExample: protectedProcedure
      .input(z.object({ sourceFeedbackId: z.number().optional(), purpose: z.enum(["style_reference", "quality_evaluation", "training_candidate"]), sourceText: z.string().min(20).max(12000), approvedFeedback: z.string().min(20).max(12000), tags: z.string().max(255).optional() }))
      .mutation(async ({ ctx, input }) => {
        if (ctx.user.role !== "admin" && !(ctx.user.role === "teacher" && ctx.user.teacherStatus === "approved")) throw new TRPCError({ code: "FORBIDDEN", message: "승인된 교사 권한이 필요합니다." });
        return db.createTeacherAiStyleExample({ teacherId: ctx.user.id, ...input });
      }),
    updateStyleExampleStatus: protectedProcedure
      .input(z.object({ exampleId: z.number(), status: z.enum(["draft", "teacher_approved", "admin_approved", "rejected", "withdrawn"]) }))
      .mutation(async ({ ctx, input }) => {
        if (ctx.user.role !== "admin" && !(ctx.user.role === "teacher" && ctx.user.teacherStatus === "approved")) throw new TRPCError({ code: "FORBIDDEN", message: "승인된 교사 권한이 필요합니다." });
        const example = await db.getTeacherAiStyleExampleById(input.exampleId);
        if (!example) throw new TRPCError({ code: "NOT_FOUND", message: "예시를 찾을 수 없습니다." });
        if (ctx.user.role !== "admin") {
          // 교사는 본인 예시만 다루고, 관리자 승인·반려는 관리자만 정한다.
          if (example.teacherId !== ctx.user.id) throw new TRPCError({ code: "FORBIDDEN", message: "본인이 작성한 예시만 변경할 수 있습니다." });
          if (input.status === "admin_approved" || input.status === "rejected") throw new TRPCError({ code: "FORBIDDEN", message: "관리자 승인·반려는 관리자만 할 수 있습니다." });
        }
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
      .query(async ({ input }) => {
        // 가입 전(비로그인)에도 열리는 목록이므로 교사의 이메일 같은 연락처는 내려주지 않는다.
        const teachers = await db.getApprovedTeachersForRecommendation(input.courseType);
        return teachers.map(({ email: _email, ...teacher }) => teacher);
      }),

    signup: publicProcedure
      .input(
        z.object({
          name: z.string().trim().min(2).max(80),
          email: z.string().trim().email().transform((value) => value.toLowerCase()),
          password: z.string().min(8).max(128),
          accountType: z.enum(["student", "parent"]).default("student"),
          courseType: z.enum(["elementary", "middle_high", "high_univ", "general_adult"]).optional(),
          preferredTeacherId: z.number().int().positive().optional(),
          // 학생 회원은 만 14세 미만 여부를 판정하기 위해 생년월일(YYYY-MM-DD)이 필요하다.
          birthDate: z.string().trim().max(10).optional(),
          guardian: z
            .object({
              name: z.string().trim().min(2).max(40),
              relation: z.enum(GUARDIAN_RELATIONS),
              email: z.string().trim().email().transform((value) => value.toLowerCase()),
            })
            .optional(),
          consents: z.array(signupConsentSchema).min(1),
        }),
      )
      .mutation(async ({ ctx, input }) => {
        enforceRateLimit("signup-ip", resolveClientIp(ctx.req), RATE_RULES.signupByIp);
        // 보호자(법정대리인) 동의는 초등 과정 가입자에게만 적용한다. 학년과 만 나이가 일치하지 않을 수 있어
        // 생년월일로 대상을 가르지 않고, 초등 과정이면 생년월일과 보호자 정보를 받아 보호자 이메일로 동의를 확인한다.
        const guardianConsentRequired = input.accountType === "student" && input.courseType === GUARDIAN_CONSENT_COURSE;
        if (guardianConsentRequired) {
          if (!input.birthDate) {
            throw new TRPCError({ code: "BAD_REQUEST", message: "초등 과정 학생은 생년월일을 입력해야 합니다." });
          }
          const age = calculateAge(input.birthDate);
          if (age === null || age > 120) {
            throw new TRPCError({ code: "BAD_REQUEST", message: "생년월일을 정확히 입력해 주세요." });
          }
          if (!input.guardian) {
            throw new TRPCError({ code: "BAD_REQUEST", message: "초등 과정 학생은 법정대리인(보호자) 정보를 입력해야 합니다." });
          }
          if (input.guardian.email === input.email) {
            throw new TRPCError({ code: "BAD_REQUEST", message: "보호자 이메일은 학생 이메일과 달라야 합니다." });
          }
        }
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
          return { requiresVerification: true, requiresGuardianConsent: false, guardianEmailSent: false } as const;
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

        // 만 14세 미만이면 법정대리인 동의 기록을 만들고 보호자에게 동의 확인 메일을 보낸다. 동의 전에는 로그인할 수 없다.
        let guardianEmailSent = false;
        if (guardianConsentRequired && input.guardian && input.birthDate) {
          const guardianToken = createVerificationToken();
          await db.createGuardianConsent({
            userId: user.id,
            childBirthDate: input.birthDate,
            guardianName: input.guardian.name,
            guardianRelation: input.guardian.relation,
            guardianEmail: input.guardian.email,
            tokenHash: hashVerificationToken(guardianToken),
            tokenExpiresAt: new Date(Date.now() + GUARDIAN_CONSENT_TTL_MS),
            consentVersion: GUARDIAN_CONSENT_VERSION,
          });
          try {
            await sendGuardianConsentEmail({
              to: input.guardian.email,
              guardianName: input.guardian.name,
              childName: user.name || input.name,
              consentUrl: `${requestOrigin(ctx.req)}/guardian-consent?token=${encodeURIComponent(guardianToken)}`,
            });
            guardianEmailSent = true;
          } catch (error) {
            console.error("[Guardian] consent email failed", error);
          }
        }

        await sendUserVerificationEmail(ctx.req, user, token);
        return { requiresVerification: true, requiresGuardianConsent: guardianConsentRequired, guardianEmailSent } as const;
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
        enforceRateLimit("signup-ip", resolveClientIp(ctx.req), RATE_RULES.signupByIp);
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
        enforceRateLimit("mail-email", input.email, RATE_RULES.mailByEmail);
        enforceRateLimit("mail-ip", resolveClientIp(ctx.req), RATE_RULES.mailByIp);
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
      // origin은 이전 화면과의 호환을 위해 받기만 하고 쓰지 않는다. 링크 주소는 서버가 정한다.
      .input(z.object({ email: z.string().trim().email().transform((value) => value.toLowerCase()), origin: z.string().optional() }))
      .mutation(async ({ ctx, input }) => {
        enforceRateLimit("mail-email", input.email, RATE_RULES.mailByEmail);
        enforceRateLimit("mail-ip", resolveClientIp(ctx.req), RATE_RULES.mailByIp);
        const user = await db.getUserByEmail(input.email);
        if (user?.email && user.passwordHash) {
          const token = createVerificationToken();
          await db.updatePasswordResetToken(user.id, hashVerificationToken(token), new Date(Date.now() + 60 * 60 * 1000));
          await sendPasswordResetEmail({
            to: user.email,
            name: user.name || "학습자",
            resetUrl: `${publicBaseUrl(ctx.req)}/reset-password?token=${encodeURIComponent(token)}`,
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
        // 비밀번호 무차별 대입을 막기 위해 이메일별·접속지별 시도 횟수를 제한한다.
        enforceRateLimit("login-email", input.email, RATE_RULES.loginByEmail);
        enforceRateLimit("login-ip", resolveClientIp(ctx.req), RATE_RULES.loginByIp);
        // 샘플 계정 자동 생성(원클릭 샘플 로그인)은 제거했다. 누구나 알 수 있는 비밀번호로 승인된 교사 권한 계정이 만들어지는 문제가 있었다.
        const user = await db.getUserByEmail(input.email);

        if (!user?.passwordHash || !(await verifyPasswordAsync(input.password, user.passwordHash))) {
          throw new TRPCError({ code: "UNAUTHORIZED", message: "이메일 또는 비밀번호를 확인해주세요." });
        }
        // 초등 과정 가입 아동은 법정대리인(보호자)이 동의하기 전까지 로그인할 수 없다.
        const guardianStatus = await db.getLatestGuardianConsentStatusForUser(user.id);
        if (guardianStatus && guardianStatus !== "approved") {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: "보호자(법정대리인)의 동의가 아직 완료되지 않았습니다. 보호자에게 발송된 메일에서 동의를 완료해 주세요. 메일을 받지 못했거나 링크가 만료되었다면 ceo@ufinsu.com으로 문의해 주세요.",
          });
        }
        // 이메일 인증을 마치지 않은 계정은 로그인할 수 없다.
        if (!user.emailVerifiedAt) {
          throw new TRPCError({ code: "FORBIDDEN", message: "EMAIL_NOT_VERIFIED" });
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

    // 비로그인 방문자도 과정 구성을 확인할 수 있도록 공개해도 되는 필드만 반환한다(썸네일·PDF 경로·내부 id 제외).
    getPublicOverview: publicProcedure
      .input(z.enum(["elementary", "middle_high", "high_univ", "general_adult"]))
      .query(async ({ input }) => {
        const items = await db.getDynamicCurriculumByType(input);
        return items.map((item) => ({
          level: item.level,
          title: item.title,
          description: item.description,
          topics: item.topics,
          aiSummary: item.aiSummary,
          aiTags: item.aiTags,
        }));
      }),

    getDynamicByType: protectedProcedure
      .input(z.enum(["elementary", "middle_high", "high_univ", "general_adult"]))
      .query(({ input }) => db.getDynamicCurriculumByType(input)),

    getTheoryContent: protectedProcedure
      .input(z.object({
        courseType: z.enum(["elementary", "middle_high", "high_univ", "general_adult"]),
        lessonLevel: z.number().int().min(1).max(5).optional(),
        theoryCategory: z.string().trim().min(1).max(32).optional(),
      }))
      .query(({ input }) => db.getLessonTheoryContentList(input)),

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

    getWorkbookLessonBundle: protectedProcedure
      .input(z.object({
        courseType: z.enum(["elementary", "middle_high", "high_univ", "general_adult"]),
        level: z.number().int().min(1).max(20),
        lessonIndex: z.number().int().min(0).max(50),
      }))
      .query(({ input }) => db.getWorkbookLessonBundle({
        courseType: input.courseType,
        lessonLevel: input.level,
        lessonIndex: input.lessonIndex,
      })),

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
          answerId: z.number().int().positive(),
          comment: z.string().trim().min(1).max(5000),
          gradeScore: SCORE_0_100,
        })
      )
      .mutation(async ({ ctx, input }) => {
        // 워크북 점수는 수료 판정의 근거이므로, 승인된 담당 교사와 관리자만 정할 수 있다(학생·학부모 불가).
        const answer = await db.getWorkbookAnswerById(input.answerId);
        if (!answer) throw new TRPCError({ code: "NOT_FOUND", message: "답안을 찾을 수 없습니다." });
        if (ctx.user.role !== "admin") {
          if (ctx.user.role !== "teacher" || ctx.user.teacherStatus !== "approved") throw new TRPCError({ code: "FORBIDDEN", message: "승인된 첨삭교사 권한이 필요합니다." });
          const student = await db.getUserById(answer.userId);
          if (!student || student.teacherId !== ctx.user.id) throw new TRPCError({ code: "FORBIDDEN", message: "배정된 학생의 답안만 첨삭할 수 있습니다." });
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

  // ========== Theory lesson content routes ==========
  theoryContent: router({
    list: adminProcedure
      .input(z.object({ courseType: z.enum(["elementary", "middle_high", "high_univ", "general_adult"]).optional(), status: z.enum(["all", "active", "inactive"]).optional() }).optional())
      .query(({ input }) => db.getTheoryContentAdminList(input)),

    listDrafts: adminProcedure
      .input(z.object({ status: z.enum(["preview", "approved", "rejected"]).optional() }).optional())
      .query(({ input }) => db.getTheoryDrafts(input)),

    create: adminProcedure.input(theoryContentWriteInput).mutation(({ input }) => db.createTheoryContent(input)),

    update: adminProcedure
      .input(z.object({ id: z.number().int().positive(), data: theoryContentWriteInput }))
      .mutation(({ input }) => db.updateTheoryContent(input.id, input.data)),

    setActive: adminProcedure
      .input(z.object({ id: z.number().int().positive(), isActive: z.boolean() }))
      .mutation(({ input }) => db.setTheoryContentActive(input.id, input.isActive)),

    getLessonConnectionOptions: adminProcedure
      .input(z.object({
        courseType: z.enum(["elementary", "middle_high", "high_univ", "general_adult"]),
        lessonLevel: z.number().int().min(1).max(20),
        lessonIndex: z.number().int().min(0).max(50),
      }))
      .query(({ input }) => db.getWorkbookLessonConnectionOptions(input)),

    saveLessonConnection: adminProcedure
      .input(z.object({
        courseType: z.enum(["elementary", "middle_high", "high_univ", "general_adult"]),
        lessonLevel: z.number().int().min(1).max(20),
        lessonIndex: z.number().int().min(0).max(50),
        connectionMode: z.enum(["automatic", "manual"]),
        theoryContentIds: z.array(z.number().int().positive()).max(20),
        workbookQuestionIds: z.array(z.number().int().positive()).max(10),
      }))
      .mutation(({ ctx, input }) => db.saveWorkbookLessonConnection(ctx.user.id, input)),

    generatePreviews: adminProcedure
      .input(theoryGenerationInput)
      .mutation(({ ctx, input }) => db.generateTheoryContentPreviews(ctx.user.id, input)),

    updateDraft: adminProcedure
      .input(z.object({ id: z.number().int().positive(), data: theoryContentWriteInput }))
      .mutation(({ input }) => db.updateTheoryDraft(input.id, input.data)),

    approveDraft: adminProcedure
      .input(z.object({ id: z.number().int().positive() }))
      .mutation(({ ctx, input }) => db.approveTheoryDraft(input.id, ctx.user.id)),

    rejectDraft: adminProcedure
      .input(z.object({ id: z.number().int().positive() }))
      .mutation(({ ctx, input }) => db.rejectTheoryDraft(input.id, ctx.user.id)),

    getMyProgress: protectedProcedure
      .input(z.object({ theoryContentIds: z.array(z.number().int().positive()).max(30).optional() }).optional())
      .query(({ ctx, input }) => db.getTheoryProgressByUser(ctx.user.id, input?.theoryContentIds)),

    completeCheck: protectedProcedure
      .input(z.object({ theoryContentId: z.number().int().positive() }))
      .mutation(({ ctx, input }) => db.completeTheoryCheck(ctx.user.id, input.theoryContentId)),
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

    // 점수·완료 여부는 클라이언트가 정하지 않는다. 서버가 채점해 저장한 워크북 답안으로 계산한다.
    upsert: protectedProcedure
      .input(z.object({ courseType: z.enum(["elementary", "middle_high", "high_univ", "general_adult"]), level: z.number().int().min(1).max(20) }))
      .mutation(async ({ ctx, input }) => {
        // 관리자·교사·학부모 계정의 미리보기, 그리고 가입 과정이 아닌 다른 과정을 둘러보는 경우에는 학습 기록을 남기지 않는다.
        if (ctx.user.role !== "user" || ctx.user.tag === "학부모" || input.courseType !== getCourseTypeFromUserTag(ctx.user.tag)) return null;
        try {
          return await db.recordLessonProgress(ctx.user, input.level);
        } catch (error: any) {
          throw new TRPCError({ code: "FORBIDDEN", message: error?.message || "진도를 저장할 수 없습니다." });
        }
      }),
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
      .input(z.object({ quizId: z.number().int().positive(), userAnswer: z.string().trim().min(1).max(4000) }))
      .mutation(({ ctx, input }) => {
        if (ctx.user.role !== "user") throw new TRPCError({ code: "FORBIDDEN", message: "학습자 계정만 퀴즈 결과를 저장할 수 있습니다." });
        return db.verifyAndSaveQuizAttempt(ctx.user.id, input.quizId, input.userAnswer, getCourseTypeFromUserTag(ctx.user.tag));
      }),

    getDetailedSentenceFeedback: protectedProcedure
      .input(z.object({ quizId: z.number().int().positive(), studentSentence: z.string().trim().min(5).max(1000) }))
      .mutation(({ ctx, input }) => {
        if (ctx.user.role !== "user") throw new TRPCError({ code: "FORBIDDEN", message: "학습자 계정만 문장 맞춤 피드백을 요청할 수 있습니다." });
        return db.getDetailedSentenceFeedbackForQuiz({
          userId: ctx.user.id,
          quizId: input.quizId,
          studentSentence: input.studentSentence,
          expectedCourseType: getCourseTypeFromUserTag(ctx.user.tag),
        });
      }),

    getByUser: protectedProcedure.query(({ ctx }) =>
      db.getQuizAnswersByUser(ctx.user.id)
    ),
  }),

  // ========== Certificate Routes ==========
  certificate: router({
    getUserCertificates: protectedProcedure.query(({ ctx }) =>
      db.getCertificatesByUser(ctx.user.id)
    ),

    eligibility: protectedProcedure.query(({ ctx }) => db.getStudentCertificateEligibility(ctx.user.id, ctx.user)),

    getByShareToken: publicProcedure
      .input(z.string())
      .query(({ input }) => db.getCertificateByShareToken(input)),

    issue: protectedProcedure
      .input(
        z.object({
          courseType: z.enum(["elementary", "middle_high", "high_univ", "general_adult"]),
          level: z.number().int().min(1).max(20).optional(),
          certificateType: z.enum([
            "level_certificate",
            "graduation_certificate",
          ]),
        })
      )
      .mutation(async ({ ctx, input }) => {
        if (ctx.user.role !== "user" || ctx.user.tag === "학부모") throw new TRPCError({ code: "FORBIDDEN", message: "학습자 계정만 수료증을 신청할 수 있습니다." });
        try {
          // 발급 근거(완료율·평균 점수)는 서버가 계산한 진행 기록이다. pdfUrl 등 파일 주소는 클라이언트에서 받지 않는다.
          return await db.issueCertificate({
          userId: ctx.user.id,
          courseType: input.courseType,
          level: input.level,
          certificateType: input.certificateType,
          shareToken: nanoid(),
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
      .query(({ ctx, input }) => assertEssayReadAccess(ctx.user, input)),

    create: protectedProcedure
      .input(
        z.object({
          curriculumId: z.number().optional(),
          title: z.string().trim().min(1).max(255),
          content: z.string().max(50000),
          // 채점 완료(reviewed)는 교사 승인 과정에서 서버가 정한다.
          status: z.enum(["draft", "submitted"]).optional(),
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
          title: z.string().trim().min(1).max(255).optional(),
          content: z.string().max(50000).optional(),
          status: z.enum(["draft", "submitted"]).optional(),
          submittedAt: z.date().optional(),
        })
      )
      .mutation(async ({ ctx, input }) => {
        // 본인 글만 고칠 수 있고, 교사 채점이 끝난 글은 고칠 수 없다.
        const essay = await db.getEssaySubmissionById(input.id);
        if (!essay) throw new TRPCError({ code: "NOT_FOUND", message: "논술 제출물을 찾을 수 없습니다." });
        if (essay.userId !== ctx.user.id) throw new TRPCError({ code: "FORBIDDEN", message: "본인의 제출물만 수정할 수 있습니다." });
        if (essay.status === "reviewed") throw new TRPCError({ code: "FORBIDDEN", message: "교사 채점이 완료된 제출물은 수정할 수 없습니다." });
        return db.updateEssaySubmission(input.id, {
          title: input.title,
          content: input.content,
          status: input.status,
          submittedAt: input.submittedAt,
        });
      }),
  }),

  // ========== Teacher Feedback Routes ==========
  teacherFeedback: router({
    // 첨삭 조회: 글 주인·배정 교사·관리자만. 쓰기: 배정 교사·관리자만(학생이 교사 점수·코멘트를 만들거나 바꿀 수 없다).
    getByEssay: protectedProcedure
      .input(z.number())
      .query(async ({ ctx, input }) => {
        await assertEssayReadAccess(ctx.user, input);
        return db.getTeacherFeedbackByEssay(input);
      }),

    create: protectedProcedure
      .input(
        z.object({
          essayId: z.number(),
          overallComment: z.string().max(10000).optional(),
          overallScore: SCORE_0_100.optional(),
          structureScore: SCORE_0_100.optional(),
          logicScore: SCORE_0_100.optional(),
          expressionScore: SCORE_0_100.optional(),
        })
      )
      .mutation(async ({ ctx, input }) => {
        const essay = await assertTeacherEssayAccess(ctx.user, input.essayId);
        if (await db.getTeacherFeedbackByEssay(input.essayId)) throw new TRPCError({ code: "CONFLICT", message: "이미 첨삭이 등록된 제출물입니다. 기존 첨삭을 수정해 주세요." });
        const feedback = await db.createTeacherFeedback({
          essayId: input.essayId,
          teacherId: ctx.user.id,
          overallComment: input.overallComment,
          overallScore: input.overallScore,
          structureScore: input.structureScore,
          logicScore: input.logicScore,
          expressionScore: input.expressionScore,
        });
        void sendPushToUser(essay.userId, { title: "새로운 첨삭 피드백이 도착했어요", body: `${essay.title}에 선생님 피드백이 등록되었습니다.`, url: `/teacher-feedback?essayId=${essay.id}`, tag: `feedback-${essay.id}` });
        return feedback;
      }),

    update: protectedProcedure
      .input(
        z.object({
          id: z.number(),
          overallComment: z.string().max(10000).optional(),
          overallScore: SCORE_0_100.optional(),
          structureScore: SCORE_0_100.optional(),
          logicScore: SCORE_0_100.optional(),
          expressionScore: SCORE_0_100.optional(),
        })
      )
      .mutation(async ({ ctx, input }) => {
        const feedback = await db.getTeacherFeedbackById(input.id);
        if (!feedback) throw new TRPCError({ code: "NOT_FOUND", message: "첨삭을 찾을 수 없습니다." });
        await assertTeacherEssayAccess(ctx.user, feedback.essayId);
        return db.updateTeacherFeedback(input.id, {
          overallComment: input.overallComment,
          overallScore: input.overallScore,
          structureScore: input.structureScore,
          logicScore: input.logicScore,
          expressionScore: input.expressionScore,
        });
      }),

    getComments: protectedProcedure
      .input(z.number())
      .query(async ({ ctx, input }) => {
        const feedback = await db.getTeacherFeedbackById(input);
        if (!feedback) return [];
        await assertEssayReadAccess(ctx.user, feedback.essayId);
        return db.getFeedbackCommentsByFeedback(input);
      }),

    addComment: protectedProcedure
      .input(
        z.object({
          feedbackId: z.number(),
          lineNumber: z.number().int().min(0),
          startIndex: z.number().int().min(0),
          endIndex: z.number().int().min(0),
          comment: z.string().trim().min(1).max(5000),
          commentType: z.enum([
            "grammar",
            "logic",
            "expression",
            "structure",
            "other",
          ]),
        })
      )
      .mutation(async ({ ctx, input }) => {
        const feedback = await db.getTeacherFeedbackById(input.feedbackId);
        if (!feedback) throw new TRPCError({ code: "NOT_FOUND", message: "첨삭을 찾을 수 없습니다." });
        await assertTeacherEssayAccess(ctx.user, feedback.essayId);
        return db.createFeedbackComment(input);
      }),
  }),

  // ========== Master Prompt Writing Evaluation Routes ==========
  writingEvaluationEngine: router({
    evaluate: protectedProcedure.input(z.object({ metadata: z.record(z.string(), z.unknown()), task: z.string().trim().min(1).max(10000), submission: z.object({ essay_text: z.string().trim().min(1).max(20000) }) })).mutation(async ({ ctx, input }) => {
      // 학습자용 한도(체험·일일·이용권)를 거치지 않는 도구이므로 승인된 교사와 관리자만 쓰고, 호출 횟수도 제한한다.
      assertApprovedTeacherOrAdmin(ctx.user);
      enforceRateLimit("eval-engine", String(ctx.user.id), RATE_RULES.evalEngineByUser);
      const result = await evaluateWritingWithLLM(input);
      await db.logAIUsage(ctx.user.id, "writing_evaluation_v1", result.token_usage);
      return result;
    }),
    evaluateAndCorrect: protectedProcedure.input(z.object({ metadata: z.record(z.string(), z.unknown()), task: z.string().trim().min(1).max(10000), submission: z.object({ essay_text: z.string().trim().min(1).max(20000) }) })).mutation(async ({ ctx, input }) => {
      // 학습자용 한도(체험·일일·이용권)를 거치지 않는 도구이므로 승인된 교사와 관리자만 쓰고, 호출 횟수도 제한한다.
      assertApprovedTeacherOrAdmin(ctx.user);
      enforceRateLimit("eval-engine", String(ctx.user.id), RATE_RULES.evalEngineByUser);
      const result = await evaluateWritingWithLLM(input);
      await db.logAIUsage(ctx.user.id, "writing_evaluation_v1", result.token_usage);
      return result;
    }),
    reevaluate: protectedProcedure.input(z.object({ metadata: z.record(z.string(), z.unknown()), task: z.string().trim().min(1).max(10000), submission: z.object({ essay_text: z.string().trim().min(1).max(20000) }) })).mutation(async ({ ctx, input }) => {
      // 학습자용 한도(체험·일일·이용권)를 거치지 않는 도구이므로 승인된 교사와 관리자만 쓰고, 호출 횟수도 제한한다.
      assertApprovedTeacherOrAdmin(ctx.user);
      enforceRateLimit("eval-engine", String(ctx.user.id), RATE_RULES.evalEngineByUser);
      const result = await evaluateWritingWithLLM(input);
      await db.logAIUsage(ctx.user.id, "writing_evaluation_v1", result.token_usage);
      return result;
    }),
  }),

  // ========== 샘플 체험(비로그인) AI 첨삭 실체험 ==========
  // 계정에 저장되지 않는 익명 1회성 평가입니다. 세션 토큰 + IP 해시로 한도를 확인합니다.
  sampleEvaluation: router({
    evaluate: publicProcedure
      .input(z.object({
        sessionToken: z.string().trim().min(10).max(64),
        task: z.string().trim().min(1).max(500),
        // 샘플에서 고른 과정. 평가가 과정 수준(초등~일반)에 맞게 이뤄지도록 평가 엔진에 전달한다.
        courseType: z.enum(["elementary", "middle_high", "high_univ", "general_adult"]).optional(),
        essayText: z.string().trim().min(1).max(SAMPLE_AI_TEXT_MAX_LENGTH),
      }))
      .mutation(async ({ ctx, input }) => {
        // 한도를 기록할 DB가 없으면 한도 없이 AI를 호출하게 되므로 요청을 받지 않는다.
        if (!(await db.getDb())) {
          throw new TRPCError({ code: "SERVICE_UNAVAILABLE", message: "지금은 AI 첨삭 체험을 이용할 수 없습니다. 잠시 후 다시 시도해 주세요." });
        }

        const sessionCount = await db.getSampleAiUsageCountBySession(input.sessionToken);
        if (sessionCount >= SAMPLE_AI_SESSION_LIMIT) {
          throw new TRPCError({ code: "TOO_MANY_REQUESTS", message: "이번 방문에서 체험 가능한 AI 첨삭을 모두 사용했습니다." });
        }

        const ipHash = db.hashSampleClientIp(resolveClientIp(ctx.req));
        const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
        const ipCount = await db.getSampleAiUsageCountByIpSince(ipHash, since);
        if (ipCount >= SAMPLE_AI_IP_DAILY_LIMIT) {
          throw new TRPCError({ code: "TOO_MANY_REQUESTS", message: "오늘 이 네트워크에서 체험 가능한 AI 첨삭을 모두 사용했습니다." });
        }

        const globalCount = await db.getSampleAiUsageCountSince(since);
        if (globalCount >= SAMPLE_AI_GLOBAL_DAILY_LIMIT) {
          throw new TRPCError({ code: "SERVICE_UNAVAILABLE", message: "오늘 제공 가능한 AI 첨삭 체험이 모두 소진되었습니다. 내일 다시 이용하거나 로그인하고 7일 무료 체험을 시작해 주세요." });
        }

        // AI 호출 전에 사용 기록을 먼저 남겨 동시에 여러 번 보내는 요청이 한도를 넘지 못하게 한다.
        await db.logSampleAiUsage(input.sessionToken, ipHash);
        return await evaluateWritingWithLLM({
          metadata: { source: "sample_experience", ...(input.courseType ? { course_type: input.courseType } : {}) },
          task: input.task,
          submission: { essay_text: input.essayText },
        });
      }),
  }),

  // ========== AI Auto Feedback Routes ==========
  aiAutoFeedback: router({
    getByUser: protectedProcedure.query(({ ctx }) =>
      db.getAIAutoFeedbackByUser(ctx.user.id)
    ),

    getTodayQuota: protectedProcedure.query(async ({ ctx }) => {
        const trial = getTrialAccess(ctx.user.createdAt);
        if (ctx.user.role === "user" && trial.isActive) {
          const used = await db.getAIUsageCountByAction(ctx.user.id, "trial_essay_feedback");
          return { used, limit: TRIAL_AI_EVALUATION_LIMIT, remaining: Math.max(0, TRIAL_AI_EVALUATION_LIMIT - used), isTrial: true, daysRemaining: trial.daysRemaining };
        }
        const count = await db.getTodayAIUsageCount(ctx.user.id);
        const limit = 5; // 일일 무료 공용 크레딧 제한
        return { used: count, limit, remaining: Math.max(0, limit - count), isTrial: false, daysRemaining: 0 };
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
      .input(z.object({ essayTitle: z.string().trim().min(1).max(255), essayContent: z.string().trim().min(20).max(20000), courseType: z.enum(["elementary", "middle_high", "high_univ", "general_adult"]), level: z.number().int().min(1).max(5), lessonNumber: z.number().int().min(1).max(20).optional(), submissionSource: z.enum(["lesson_one_essay"]).optional(), sourceVerificationFailed: z.boolean().optional() }))
      .mutation(async ({ ctx, input }) => {
        const trial = getTrialAccess(ctx.user.createdAt);
        const isTrialUser = ctx.user.role === "user" && trial.isActive;
        if (isTrialUser && !isEligibleTrialEvaluation(input)) {
          throw new TRPCError({ code: "FORBIDDEN", message: "7일 무료 체험의 AI 논술 평가는 레슨 1의 첫 서술형 제출에만 제공됩니다." });
        }
        if (isTrialUser && await db.getAIUsageCountByAction(ctx.user.id, "trial_essay_feedback") >= TRIAL_AI_EVALUATION_LIMIT) {
          throw new TRPCError({ code: "FORBIDDEN", message: "7일 무료 체험에서는 AI 논술 평가를 1회 제공했습니다. 정식 이용 정책을 확인해 주세요." });
        }
        if (!isTrialUser && ctx.user.role !== "admin" && await db.getTodayAIUsageCount(ctx.user.id) >= 5) throw new TRPCError({ code: "FORBIDDEN", message: "일일 AI 자동 첨삭 횟수(5회)를 모두 소모했습니다. 내일 다시 이용해주세요." });
        const difficultyPreset = await db.getDifficultyOperationPreset();
        const request = { essayTitle: input.essayTitle, essayContent: input.essayContent, courseType: input.courseType, level: input.level, difficultyMode: difficultyPreset.mode, sourceVerificationFailed: Boolean(input.sourceVerificationFailed) } as const;
        const heuristic = evaluateWritingHeuristic(request);
        const semantic = await evaluateWritingWithLLM({ metadata: { title: input.essayTitle, course_type: input.courseType, level: input.level, difficulty_mode: difficultyPreset.mode }, task: input.essayTitle, submission: { essay_text: input.essayContent } });
        const feedback = { structureScore: semantic.dimension_scores.find((item) => item.competency === "macro_structure")?.score ?? semantic.total_score, logicScore: semantic.dimension_scores.find((item) => item.competency === "logical_inference")?.score ?? semantic.total_score, expressionScore: semantic.dimension_scores.find((item) => item.competency === "sentence_expression")?.score ?? semantic.total_score, overallScore: semantic.total_score, strengths: semantic.strengths, weaknesses: semantic.improvement_points, suggestions: semantic.feedback.revision_steps, overallComment: semantic.feedback.summary, revisedEssay: input.essayContent, sentenceCorrections: [], confidence: semantic.fallback_used ? 0.25 : 0.85, correction_status: semantic.fallback_used ? "fallback" as const : "completed" as const, fallback_used: semantic.fallback_used, provider_error: semantic.provider_error, latency_ms: 0, model_id: "builtin-llm-v1.1", token_usage: semantic.token_usage, estimated_cost_microusd: 0 };
        await db.logAIUsage(ctx.user.id, isTrialUser ? "trial_essay_feedback" : "essay_feedback", feedback.token_usage);
        await db.createEvaluationModelOperation({ modelId: feedback.model_id, status: feedback.correction_status, latencyMs: feedback.latency_ms, tokenUsage: feedback.token_usage, estimatedCostMicrousd: feedback.estimated_cost_microusd, errorSummary: feedback.provider_error });
        const savedFeedback = await db.createAIAutoFeedback({ userId: ctx.user.id, essayTitle: input.essayTitle, essayContent: input.essayContent, courseType: input.courseType, level: input.level, overallComment: feedback.overallComment, structureScore: feedback.structureScore, logicScore: feedback.logicScore, expressionScore: feedback.expressionScore, overallScore: feedback.overallScore, revisedEssay: feedback.revisedEssay, suggestions: JSON.stringify(feedback.suggestions), strengths: JSON.stringify(feedback.strengths), weaknesses: JSON.stringify(feedback.weaknesses) });
        const feedbackId = Number((savedFeedback as { insertId?: number }).insertId || 0) || null;
        const record = await db.createWritingEvaluationRecord({ userId: ctx.user.id, feedbackId, modelId: feedback.model_id, correctionStatus: feedback.correction_status, fallbackUsed: feedback.fallback_used ? 1 : 0, providerError: feedback.provider_error, latencyMs: feedback.latency_ms, tokenUsage: feedback.token_usage, estimatedCostMicrousd: feedback.estimated_cost_microusd, confidence: feedback.confidence.toFixed(4), heuristicOverallScore: heuristic.overallScore, modelOverallScore: feedback.overallScore, sourceVerificationFailed: input.sourceVerificationFailed ? 1 : 0, resultJson: JSON.stringify({ correction_status: feedback.correction_status, fallback_used: feedback.fallback_used, provider_error: feedback.provider_error, latency_ms: feedback.latency_ms, model_id: feedback.model_id, sentenceCorrections: feedback.sentenceCorrections }) });
        const evaluationRecordId = Number((record as { insertId?: number }).insertId || 0);
        const reviewReasons = getHumanReviewReasons(feedback, heuristic.overallScore, Boolean(input.sourceVerificationFailed));
        if (reviewReasons.length && evaluationRecordId) await db.createEvaluationReviewQueueItem({ evaluationRecordId, userId: ctx.user.id, reasonsJson: JSON.stringify(reviewReasons) });
        return { ...(savedFeedback as object), ...feedback, id: feedbackId, evaluationRecordId, reviewQueued: reviewReasons.length > 0 };
      }),
  }),

  evaluationModels: router({
    list: adminProcedure.query(async () => (await db.listEvaluationModelConfigs()).map(({ encryptedApiKey: _secret, ...config }) => config)),
    save: adminProcedure.input(z.object({ modelId: z.string().trim().min(1).max(160), endpoint: z.string().url().max(1024), allowedDomains: z.array(z.string().trim().min(1).max(255)).min(1).max(20), apiKey: z.string().min(8).max(4096), timeoutMs: z.number().int().min(1000).max(30000).default(15000), isActive: z.boolean().default(true) })).mutation(async ({ ctx, input }) => {
      const allowedDomains = normalizeAllowedDomains(input.allowedDomains);
      const validation = validateExternalEvaluationEndpoint(input.endpoint, allowedDomains);
      if (!validation.valid) throw new TRPCError({ code: "BAD_REQUEST", message: validation.message });
      return db.saveEvaluationModelConfig({ modelId: input.modelId, endpoint: input.endpoint, allowedDomainsJson: JSON.stringify(allowedDomains), encryptedApiKey: encryptSecret(input.apiKey), timeoutMs: input.timeoutMs, isActive: input.isActive ? 1 : 0, createdBy: ctx.user.id });
    }),
    operationStats: adminProcedure.query(() => db.getEvaluationModelOperationStats()),
    reviewQueue: adminProcedure.query(() => db.listEvaluationReviewQueue()),
    updateReviewQueue: adminProcedure.input(z.object({ id: z.number().int().positive(), status: z.enum(["open", "reviewing", "resolved"]), resolutionNote: z.string().max(4000).nullable().optional() })).mutation(({ ctx, input }) => db.updateEvaluationReviewQueueItem({ ...input, assignedAdminId: ctx.user.id })),
    humanQualityMetrics: adminProcedure.input(z.array(z.object({ humanScore: z.number().min(0).max(100), modelScore: z.number().min(0).max(100) })).max(10000)).query(({ input }) => getHumanEvaluationQualityMetrics(input)),
  }),

  evaluationAppeals: router({
    create: protectedProcedure.input(z.object({ evaluationRecordId: z.number().int().positive(), reason: z.string().trim().min(10).max(4000), requestedAction: z.enum(["recheck"]) })).mutation(async ({ ctx, input }) => {
      const record = await db.getWritingEvaluationRecord(input.evaluationRecordId);
      if (!record || record.userId !== ctx.user.id) throw new TRPCError({ code: "NOT_FOUND", message: "이의제기를 제출할 평가 기록을 찾을 수 없습니다." });
      return db.createEvaluationAppeal({ ...input, userId: ctx.user.id });
    }),
    mine: protectedProcedure.query(({ ctx }) => db.listEvaluationAppeals(ctx.user.id)),
    list: adminProcedure.query(() => db.listEvaluationAppeals()),
    update: adminProcedure.input(z.object({ id: z.number().int().positive(), status: z.enum(["submitted", "under_review", "accepted", "rejected", "resolved"]), adminNote: z.string().max(4000).nullable().optional() })).mutation(({ ctx, input }) => db.updateEvaluationAppeal({ ...input, adminId: ctx.user.id })),
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
        if (!(["quiz", "summary", "reordering_10_session"] as const).includes(input.badgeType as "quiz" | "summary" | "reordering_10_session")) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "검증 가능한 학습 도구 뱃지만 수여할 수 있습니다." });
        }
        const eligibility = await db.getLearningToolBadgeEligibility(ctx.user.id, input.courseType as CourseType, input.badgeType as "quiz" | "summary" | "reordering_10_session");
        if (!eligibility.eligible) throw new TRPCError({ code: "FORBIDDEN", message: eligibility.message });
        return await db.awardBadge(ctx.user.id, input.courseType, input.badgeType, input.badgeName);
      }),
  }),

  questionBank: router({
    list: protectedProcedure
      .input(z.object({ courseType: z.string().optional(), toolType: z.string().optional() }))
      .query(async ({ input }) => {
        return await db.getQuestionBankList(input.courseType, input.toolType);
      }),
    publicStats: publicProcedure.query(async () => {
      return await db.getQuestionBankPublicStats();
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
    reorderingSubmit: protectedProcedure
      .input(z.object({ questionId: z.number().int().positive(), orderedParagraphIds: z.array(z.string().min(1)).min(3).max(12) }))
      .mutation(({ ctx, input }) => {
        if (ctx.user.role !== "user") throw new TRPCError({ code: "FORBIDDEN", message: "학습자 계정만 단락 재구성 결과를 저장할 수 있습니다." });
        return db.verifyAndRecordReorderingAttempt(ctx.user.id, input.questionId, input.orderedParagraphIds, getCourseTypeFromUserTag(ctx.user.tag));
      }),
    difficultyLearningGuide: protectedProcedure
      .mutation(async ({ ctx }) => {
        if (ctx.user.role !== "user") throw new TRPCError({ code: "FORBIDDEN", message: "학습자 계정만 맞춤 학습 가이드를 받을 수 있습니다." });
        return db.generateDifficultyLearningGuide(ctx.user.id, getCourseTypeFromUserTag(ctx.user.tag));
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
        if (data.title !== undefined || data.contentData !== undefined || data.courseType !== undefined || data.toolType !== undefined || data.difficulty !== undefined) {
          const existing = (await db.getQuestionBankList()).find((item) => item.id === id);
          if (!existing) throw new TRPCError({ code: "NOT_FOUND", message: "수정할 문항을 찾을 수 없습니다." });
          await db.assertQuestionBankItemQuality({ ...existing, ...data, id });
        }
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
        const acceptedItems: Array<{ title: string; contentData: string }> = [];
        for (const item of input.items) {
          try {
            await db.assertQuestionBankItemQuality(item, acceptedItems);
            if (input.upsert) {
              const result = await db.upsertQuestionBankItem(item);
              if (result.action === "updated") updated += 1;
              else created += 1;
            } else {
              await db.createQuestionBankItem(item);
              created += 1;
            }
            acceptedItems.push({ title: item.title, contentData: item.contentData });
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
        const summary = await db.getQuestionFeedbacksSummary(input.questionId);
        // 다른 사용자가 남긴 신고 원문은 관리자만 볼 수 있다. 학습자에게는 집계만 준다.
        return ctx.user.role === "admin" ? summary : { ...summary, reports: [] };
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
        if (ctx.user.role !== "user") return await db.gradeEssayWithAi(input.questionId, input.userAnswer);
        return await db.gradeAndRecordSummaryAttempt(ctx.user.id, input.questionId, input.userAnswer, getCourseTypeFromUserTag(ctx.user.tag));
      }),
    curriculumDifficultyStats: protectedProcedure.query(async ({ ctx }) => {
      if (ctx.user.role !== "admin") throw new TRPCError({ code: "FORBIDDEN" });
      return await db.getCurriculumDifficultyStats();
    }),
    generateAiQuestions: protectedProcedure
      .input(questionGenerationInput)
      .mutation(async ({ ctx, input }) => {
        if (ctx.user.role !== "admin") throw new TRPCError({ code: "FORBIDDEN" });
        return db.previewGeneratedQuestionBankItems({ course: input.course ?? input.courseType!, tool_type: input.tool_type ?? input.toolType!, theory_category: input.theory_category, difficulty: input.difficulty, question_count: input.question_count ?? input.count ?? 3, topic: input.topic });
      }),
    previewAiQuestions: protectedProcedure
      .input(questionGenerationInput)
      .mutation(async ({ ctx, input }) => {
        if (ctx.user.role !== "admin") throw new TRPCError({ code: "FORBIDDEN" });
        return db.previewGeneratedQuestionBankItems({ course: input.course ?? input.courseType!, tool_type: input.tool_type ?? input.toolType!, theory_category: input.theory_category, difficulty: input.difficulty, question_count: input.question_count ?? input.count ?? 3, topic: input.topic });
      }),
    promoteUser: protectedProcedure
      .input(z.object({ userId: z.number().int().positive(), targetLevel: z.number().int().min(1).max(3) }))
      .mutation(async ({ ctx, input }) => {
        // 교사 레벨은 첨삭·반 관리 권한을 정하므로 관리자만 바꿀 수 있고, 대상은 교사 계정이어야 한다.
        if (ctx.user.role !== "admin") throw new TRPCError({ code: "FORBIDDEN", message: "관리자 권한이 필요합니다." });
        const target = await db.getUserById(input.userId);
        if (!target || target.role !== "teacher") throw new TRPCError({ code: "BAD_REQUEST", message: "교사 계정만 레벨을 변경할 수 있습니다." });
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
    getDifficultyOperationPreset: protectedProcedure
      .query(async ({ ctx }) => {
        if (ctx.user.role !== "admin") throw new TRPCError({ code: "FORBIDDEN", message: "관리자 권한이 필요합니다." });
        return db.getDifficultyOperationPreset();
      }),
    saveDifficultyOperationPreset: protectedProcedure
      .input(z.object({ mode: z.enum(["standard", "advanced"]) }))
      .mutation(async ({ ctx, input }) => {
        if (ctx.user.role !== "admin") throw new TRPCError({ code: "FORBIDDEN", message: "관리자 권한이 필요합니다." });
        return db.saveDifficultyOperationPreset(input.mode, ctx.user.id);
      }),
    getSiteSettingAdmin: publicProcedure
      .input(z.object({ settingKey: z.string() }))
      .query(async ({ ctx, input }) => {
        // 비로그인·학습자에게는 공개 문서(약관·개인정보처리방침)만 열어 준다. 그 밖의 설정은 관리자만 읽을 수 있다.
        if (ctx.user?.role !== "admin" && !PUBLIC_SITE_SETTING_KEYS.includes(input.settingKey)) {
          throw new TRPCError({ code: "FORBIDDEN", message: "공개되지 않은 설정입니다." });
        }
        return await db.getSiteSetting(input.settingKey);
      }),
    sendBatchAnnouncement: protectedProcedure
      .input(z.object({
        studentIds: z.array(z.number().int().positive()).min(1).max(100),
        subject: z.string().trim().min(1).max(150),
        body: z.string().trim().min(1).max(5000),
      }))
      .mutation(async ({ ctx, input }) => {
        if (ctx.user.role !== "admin") throw new TRPCError({ code: "FORBIDDEN", message: "관리자 권한이 필요합니다." });
        enforceRateLimit("announce", String(ctx.user.id), RATE_RULES.announceByAdmin);
        const recipients = (await Promise.all(Array.from(new Set(input.studentIds)).map((id) => db.getUserById(id))))
          .filter((user): user is NonNullable<typeof user> => Boolean(user));
        let sent = 0;
        let failed = 0;
        let skipped = 0;
        for (const recipient of recipients) {
          if (!recipient.email) { skipped += 1; continue; }
          try {
            await sendAnnouncementEmail({ to: recipient.email, name: recipient.name || "회원", subject: input.subject, body: input.body });
            sent += 1;
          } catch (error) {
            console.error("[announcement] send failed", recipient.id, error);
            failed += 1;
          }
        }
        skipped += input.studentIds.length - recipients.length;
        return { sent, failed, skipped };
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
  // 만 14세 미만 아동의 법정대리인(보호자)이 메일 링크로 동의서를 확인하고 동의하는 흐름
  guardian: router({
    getConsent: publicProcedure
      .input(z.object({ token: z.string().min(32).max(200) }))
      .query(async ({ input }) => {
        const consent = await db.getGuardianConsentByTokenHash(hashVerificationToken(input.token));
        if (!consent) return { state: "invalid" as const };
        if (consent.status === "approved") return { state: "approved" as const };
        if (consent.status !== "pending") return { state: "invalid" as const };
        if (consent.tokenExpiresAt.getTime() < Date.now()) return { state: "expired" as const };
        const child = await db.getUserById(consent.userId);
        // 보호자 화면에는 아동 정보를 일부만 보여준다(이름 가운데 가림, 출생연도만).
        return {
          state: "pending" as const,
          childNameMasked: maskName(child?.name),
          childBirthYear: consent.childBirthDate.slice(0, 4),
          relation: consent.guardianRelation,
          title: GUARDIAN_CONSENT_TITLE,
          intro: GUARDIAN_CONSENT_INTRO,
          sections: GUARDIAN_CONSENT_SECTIONS,
          labels: GUARDIAN_AGREEMENT_LABELS,
        };
      }),

    confirm: publicProcedure
      .input(
        z.object({
          token: z.string().min(32).max(200),
          guardianName: z.string().trim().min(2).max(40),
          agreeCollection: z.literal(true),
          agreeGuardian: z.literal(true),
        }),
      )
      .mutation(async ({ ctx, input }) => {
        const consent = await db.getGuardianConsentByTokenHash(hashVerificationToken(input.token));
        if (!consent || consent.status !== "pending" || consent.tokenExpiresAt.getTime() < Date.now()) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "동의 링크가 만료되었거나 이미 처리되었습니다." });
        }
        const normalize = (value: string) => value.replace(/\s+/g, "").toLowerCase();
        if (normalize(input.guardianName) !== normalize(consent.guardianName)) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "입력하신 성명이 가입 시 입력된 보호자 성명과 다릅니다." });
        }
        const userAgent = ctx.req.headers["user-agent"];
        await db.approveGuardianConsent(consent.id, {
          method: GUARDIAN_CONSENT_METHOD,
          consentVersion: consent.consentVersion,
          confirmedGuardianName: input.guardianName,
          agreements: { agreeCollection: true, agreeGuardian: true },
          ipHash: db.hashSampleClientIp(resolveClientIp(ctx.req)),
          userAgent: (Array.isArray(userAgent) ? userAgent[0] : userAgent ?? "").slice(0, 200),
        });
        return { success: true } as const;
      }),

    // 아동이 보호자 동의 메일을 다시 받도록 요청한다. 계정 존재 여부를 알려주지 않도록 항상 같은 응답을 하고, 5분에 한 번만 발송한다.
    resendConsent: publicProcedure
      .input(z.object({ email: z.string().trim().email().transform((value) => value.toLowerCase()) }))
      .mutation(async ({ ctx, input }) => {
        const user = await db.getUserByEmail(input.email);
        const consent = user ? await db.getLatestGuardianConsentForUser(user.id) : null;
        if (user && consent && consent.status === "pending" && Date.now() - consent.updatedAt.getTime() > GUARDIAN_RESEND_COOLDOWN_MS) {
          try {
            await issueGuardianConsentLink(ctx.req, consent, user.name || "학생");
          } catch (error) {
            // 발송 실패 여부로 계정 존재를 알 수 없도록 같은 응답을 유지한다.
            console.error("[Guardian] resend failed", error);
          }
        }
        return { success: true } as const;
      }),

    // 동의 관리대장(관리자용): 동의 일시·확인 수단·문구 버전 등을 확인한다.
    adminList: adminProcedure.query(async () => db.listGuardianConsents()),

    // 관리자가 동의 대기 중인 보호자에게 동의 메일을 다시 보낸다.
    adminResend: adminProcedure
      .input(z.object({ id: z.number().int().positive() }))
      .mutation(async ({ ctx, input }) => {
        const consent = await db.getGuardianConsentById(input.id);
        if (!consent || consent.status !== "pending") {
          throw new TRPCError({ code: "BAD_REQUEST", message: "동의 대기 중인 요청만 다시 보낼 수 있습니다." });
        }
        const child = await db.getUserById(consent.userId);
        await issueGuardianConsentLink(ctx.req, consent, child?.name || "학생");
        return { success: true } as const;
      }),

    // 법정대리인의 동의 철회 요청을 관리자가 처리한다. 철회되면 아동 계정은 로그인할 수 없다.
    adminWithdraw: adminProcedure
      .input(z.object({ id: z.number().int().positive() }))
      .mutation(async ({ input }) => {
        const consent = await db.getGuardianConsentById(input.id);
        if (!consent || consent.status === "withdrawn") {
          throw new TRPCError({ code: "BAD_REQUEST", message: "철회할 수 있는 동의 기록이 없습니다." });
        }
        await db.withdrawGuardianConsent(input.id);
        return { success: true } as const;
      }),
  }),

  parent: router({
    linkedStudents: protectedProcedure.query(async ({ ctx }) => {
      return await db.getLinkedStudentsForParent(ctx.user.id);
    }),
    linkStudent: protectedProcedure
      .input(z.object({ studentEmail: z.string().email() }))
      .mutation(async ({ ctx, input }) => {
        if (ctx.user.role !== "admin" && !(ctx.user.role === "user" && ctx.user.tag === "학부모")) {
          throw new TRPCError({ code: "FORBIDDEN", message: "학부모 계정만 자녀 계정을 연결할 수 있습니다." });
        }
        const linked = await db.linkParentAndStudent(ctx.user.id, input.studentEmail);
        if (!linked) {
          throw new TRPCError({ code: "NOT_FOUND", message: "연결할 수 있는 학생 계정을 찾을 수 없습니다. 이메일을 다시 확인해 주세요." });
        }
        return linked;
      }),
    // 학부모 본인이 보낸 요청 중 아직 연결되지 않은(승인 대기·거절) 목록
    linkRequests: protectedProcedure.query(async ({ ctx }) => {
      return await db.getParentLinkRequests(ctx.user.id);
    }),
    // 학생 본인에게 온 연결 요청과 이미 연결된 학부모 목록. 학생 계정이 아니면 빈 목록을 반환한다.
    myParentLinks: protectedProcedure.query(async ({ ctx }) => {
      if (ctx.user.role !== "user" || ctx.user.tag === "학부모") return { pending: [], approved: [] };
      const [pending, approved] = await Promise.all([
        db.getPendingLinkRequestsForStudent(ctx.user.id),
        db.getApprovedParentsForStudent(ctx.user.id),
      ]);
      return { pending, approved };
    }),
    // 학생이 학부모 연결 요청을 승인·거절하거나 이미 연결된 학부모를 해제한다.
    respondToRequest: protectedProcedure
      .input(z.object({ linkId: z.number().int().positive(), accept: z.boolean() }))
      .mutation(async ({ ctx, input }) => {
        if (ctx.user.role !== "user" || ctx.user.tag === "학부모") {
          throw new TRPCError({ code: "FORBIDDEN", message: "학생 계정만 학부모 연결 요청에 응답할 수 있습니다." });
        }
        const result = await db.respondToParentLinkRequest(ctx.user.id, input.linkId, input.accept);
        if (!result) {
          throw new TRPCError({ code: "NOT_FOUND", message: "처리할 수 있는 연결 요청을 찾을 수 없습니다." });
        }
        return result;
      }),
    studentDetail: protectedProcedure
      .input(z.object({ studentId: z.number() }))
      .query(async ({ ctx, input }) => {
        // 관리자, 연결된 학부모, 진도 관리 권한을 받은 승인 교사만 조회할 수 있다.
        const isAdmin = ctx.user.role === "admin";
        let isAuthorized = isAdmin;
        if (!isAuthorized && ctx.user.role === "teacher" && ctx.user.teacherStatus === "approved") {
          isAuthorized = await db.canTeacherManageStudent(ctx.user.id, input.studentId, "progress");
        }
        if (!isAuthorized) {
          const linked = await db.getLinkedStudentsForParent(ctx.user.id);
          isAuthorized = linked.some(s => s.id === input.studentId);
        }
        if (!isAuthorized) {
          throw new TRPCError({ code: "FORBIDDEN", message: "해당 학생의 학습 정보에 접근할 권한이 없습니다." });
        }
        // 운영자 내부 메모는 관리자에게만 보여준다.
        return await db.getStudentDetailStats(input.studentId, { includeAdminNotes: isAdmin });
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
        // 한 코멘트가 한 줄로 저장되어야 keepParentCommentsOnly가 줄 단위로 걸러낼 수 있다.
        const singleLineComment = input.comment.trim().replace(/\s*\n\s*/g, " ");
        const newMemo = `[학부모 코멘트(${ctx.user.name || "학부모"})] ${singleLineComment} (${new Date().toLocaleString()})`;
        const updatedNotes = existingNotes ? `${existingNotes}\n${newMemo}` : newMemo;
        await db.updateStudentAdminNotes(input.studentId, updatedNotes);
        return true;
      }),
  }),
});

export type AppRouter = typeof appRouter;
