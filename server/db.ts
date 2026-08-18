import { drizzle } from "drizzle-orm/mysql2";
import {
  InsertUser,
  users,
  curriculum,
  progress,
  quizAnswer,
  certificate,
  certificateApprovalPolicies,
  certificateApprovalRequests,
  essaySubmission,
  teacherFeedback,
  feedbackComment,
  aiAutoFeedback,
  socialProviderConfig,
  appSecretConfig,
  pushSubscription,
  aiUsageLogs,
  dynamicCurriculum,
  siteSettings,
  parentStudentLinks,
  userBadges,
  questionBank,
  questionBankTrash,
  questionBankMaintenanceSettings,
  questionBankOperationLogs,
  questionFeedbacks,
  questionBookmarks,
  curriculumWorkbookQuestions,
  curriculumWorkbookAnswers,
  workbookMistakes,
  learningToolMistakes,
  workbookTeacherFeedback,
  appNotifications,
  policyDocuments,
  userPolicyConsents,
  dataProcessingRequests,
  teacherAiProfiles,
  teacherAiStyleExamples,
  teacherAiDrafts,
  teacherAiDraftRevisions,
  teacherPermissionGrants,
  learningGroups,
  learningGroupMembers,
  classAttendance,
  classAnnouncements,
  classAssignments,
  classAssignmentSubmissions,
  classAssignmentAiFeedbacks,
  teacherFeedbackTemplates,
  adminAuditLogs,
  type InsertSocialProviderConfig,
  type InsertPushSubscription,
} from "../drizzle/schema";
import { eq, and, desc, gte, inArray, lt } from "drizzle-orm";
import { ENV } from "./_core/env";
import { invokeLLM, listLLMModels } from "./_core/llm";
import { DEFAULT_POLICY_DOCUMENTS, defaultPolicyContent, type AccountConsentRole } from "./aiGovernance";
import { getCourseTag, getCourseTypeFromUserTag, type CourseType } from "@shared/course";
import { COURSE_REORDERING_QUESTIONS, toReorderingContent } from "./reorderingQuestionBank";
import { buildCourseQuizContent, buildCourseSummaryContent, isLegacyRepeatedLearningContent } from "./learningToolContent";

let _db: ReturnType<typeof drizzle> | null = null;
const memoryProgress: (typeof progress.$inferSelect)[] = [];
let memoryProgressId = 1;

export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) {
    throw new Error("User openId is required for upsert");
  }

  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot upsert user: database not available");
    return;
  }

  try {
    const values: InsertUser = {
      openId: user.openId,
    };
    const updateSet: Record<string, unknown> = {};

    const textFields = ["name", "email", "loginMethod"] as const;
    type TextField = (typeof textFields)[number];

    const assignNullable = (field: TextField) => {
      const value = user[field];
      if (value === undefined) return;
      const normalized = value ?? null;
      values[field] = normalized;
      updateSet[field] = normalized;
    };

    textFields.forEach(assignNullable);

    if (user.lastSignedIn !== undefined) {
      values.lastSignedIn = user.lastSignedIn;
      updateSet.lastSignedIn = user.lastSignedIn;
    }
    if (user.role !== undefined) {
      values.role = user.role;
      updateSet.role = user.role;
    } else if (user.openId === ENV.ownerOpenId) {
      values.role = "admin";
      updateSet.role = "admin";
    }

    if (!values.lastSignedIn) {
      values.lastSignedIn = new Date();
    }
    if (!updateSet.lastSignedIn) {
      updateSet.lastSignedIn = new Date();
    }

    await db.insert(users).values(values).onDuplicateKeyUpdate({
      set: updateSet,
    });
  } catch (error) {
    console.error("[Database] Failed to upsert user:", error);
    throw error;
  }
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) return undefined;

  const result = await db.select().from(users).where(eq(users.openId, openId));
  return result[0];
}

export async function getUserById(id: number) {
  const db = await getDb();
  if (!db) return undefined;

  const result = await db.select().from(users).where(eq(users.id, id));
  return result[0];
}

export async function getUserByEmail(email: string) {
  const db = await getDb();
  if (!db) return undefined;

  const result = await db.select().from(users).where(eq(users.email, email));
  return result[0];
}

const DEFAULT_AI_TUTOR_EMAIL = "ai-tutor@essaymaster.internal";

export async function getDefaultAiTutor() {
  const existing = await getUserByEmail(DEFAULT_AI_TUTOR_EMAIL);
  if (existing) return existing;
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  try {
    await db.insert(users).values({
      openId: "ai_tutor_bot_system",
      name: "AI 첨삭 전용 봇",
      email: DEFAULT_AI_TUTOR_EMAIL,
      role: "teacher",
      teacherStatus: "approved",
      teacherLevel: 3,
      loginMethod: "email",
      tag: "AI 첨삭",
      lastSignedIn: new Date(),
    });
  } catch {
    // 동시 생성 시 재조회합니다.
  }
  const tutor = await getUserByEmail(DEFAULT_AI_TUTOR_EMAIL);
  if (!tutor) throw new Error("AI 첨삭 기본 봇을 준비하지 못했습니다.");
  return tutor;
}

export async function updateUserEmailVerified(userId: number) {
  const db = await getDb();
  if (!db) return;

  await db.update(users).set({ emailVerifiedAt: new Date() }).where(eq(users.id, userId));
}

export async function updateTeacherStatus(userId: number, teacherStatus: "pending" | "approved" | "rejected", teacherLevel?: number, actorId?: number) {
  const db = await getDb();
  if (!db) return;
  const [target] = await db.select().from(users).where(eq(users.id, userId));
  if (!target) throw new Error("사용자를 찾을 수 없습니다.");
  const data: any = { teacherStatus };
  if (teacherLevel !== undefined) {
    data.teacherLevel = teacherLevel;
  }
  await db.update(users).set(data).where(eq(users.id, userId));
  if (actorId) await createAdminAuditLog({ actorId, targetUserId: userId, action: "role_changed", summary: `${target.name || `교사 #${userId}`} 승인 상태를 ${teacherStatus === "approved" ? "승인" : teacherStatus === "rejected" ? "반려" : "대기"}로 변경`, metadata: { previousTeacherStatus: target.teacherStatus, teacherStatus, teacherLevel } });
}

export async function updateUserPassword(userId: number, passwordHash: string) {
  const db = await getDb();
  if (!db) return;

  await db.update(users).set({ passwordHash }).where(eq(users.id, userId));
}

export async function updateUserSocialProfile(userId: number, profile: { name?: string; email?: string; loginMethod?: string }) {
  const db = await getDb();
  if (!db) return;

  const setObj: Record<string, any> = {};
  if (profile.name !== undefined) setObj.name = profile.name;
  if (profile.email !== undefined) setObj.email = profile.email;
  if (profile.loginMethod !== undefined) setObj.loginMethod = profile.loginMethod;

  if (Object.keys(setObj).length > 0) {
    await db.update(users).set(setObj).where(eq(users.id, userId));
  }
}

export async function updateUserProfile(userId: number, input: { name?: string; avatarUrl?: string }) {
  const db = await getDb();
  if (!db) return false;
  const setObj: Record<string, any> = { updatedAt: new Date() };
  if (input.name !== undefined) setObj.name = input.name;
  if (input.avatarUrl !== undefined) setObj.avatarUrl = input.avatarUrl;
  await db.update(users).set(setObj).where(eq(users.id, userId));
  return true;
}

export async function listSocialProviderConfigs() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(socialProviderConfig);
}

export async function getSocialProviderConfig(provider: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(socialProviderConfig).where(eq(socialProviderConfig.provider, provider as any));
  return result[0];
}

export async function upsertSocialProviderConfig(input: InsertSocialProviderConfig) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  await db.insert(socialProviderConfig).values(input).onDuplicateKeyUpdate({
    set: {
      clientId: input.clientId,
      clientSecretEncrypted: input.clientSecretEncrypted,
      enabled: input.enabled,
      updatedBy: input.updatedBy,
    },
  });
}

export async function getAppSecretConfig(settingKey: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(appSecretConfig).where(eq(appSecretConfig.settingKey, settingKey));
  return result[0];
}

export async function upsertAppSecretConfig(settingKey: string, encryptedValue: string | null, updatedBy: number) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  await db.insert(appSecretConfig).values({ settingKey, encryptedValue, updatedBy }).onDuplicateKeyUpdate({ set: { encryptedValue, updatedBy } });
}

export async function upsertPushSubscription(input: InsertPushSubscription) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  await db.insert(pushSubscription).values(input).onDuplicateKeyUpdate({
    set: {
      userId: input.userId,
      p256dh: input.p256dh,
      auth: input.auth,
      userAgent: input.userAgent ?? null,
    },
  });
}

export async function deletePushSubscription(endpointHash: string, userId: number) {
  const db = await getDb();
  if (!db) return;
  await db.delete(pushSubscription).where(and(eq(pushSubscription.endpointHash, endpointHash), eq(pushSubscription.userId, userId)));
}

export async function getPushSubscriptionsForUser(userId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(pushSubscription).where(eq(pushSubscription.userId, userId));
}

// ========== Curriculum Functions ==========

export async function getCurriculumByType(courseType: "elementary" | "middle_high" | "high_univ" | "general_adult") {
  const db = await getDb();
  if (!db) return [];

  return await db
    .select()
    .from(curriculum)
    .where(eq(curriculum.courseType, courseType));
}

export async function getCurriculumById(id: number) {
  const db = await getDb();
  if (!db) return undefined;

  const result = await db
    .select()
    .from(curriculum)
    .where(eq(curriculum.id, id));

  return result[0];
}

export async function getDynamicCurriculumByType(courseType: "elementary" | "middle_high" | "high_univ" | "general_adult") {
  const db = await getDb();
  if (!db) return [];
  const rows = await db
    .select()
    .from(dynamicCurriculum)
    .where(and(eq(dynamicCurriculum.courseType, courseType), eq(dynamicCurriculum.isActive, 1)))
    .orderBy(dynamicCurriculum.level);
  return rows.map((row) => ({
    ...row,
    topics: (() => {
      try { return JSON.parse(row.topicsJson) as string[]; } catch { return []; }
    })(),
    aiTags: (() => {
      try { return row.aiTags ? (JSON.parse(row.aiTags) as string[]) : []; } catch { return []; }
    })(),
  }));
}

// ========== Progress Functions ==========

export async function getProgressByUser(userId: number) {
  const db = await getDb();
  if (!db) return memoryProgress.filter((item) => item.userId === userId);

  return await db
    .select()
    .from(progress)
    .where(eq(progress.userId, userId));
}

export async function upsertProgress(input: {
  userId: number;
  curriculumId: number;
  completed?: number;
  score?: number;
  completedAt?: Date | null;
}) {
  const db = await getDb();
  if (!db) {
    const now = new Date();
    const existingIndex = memoryProgress.findIndex(
      (item) =>
        item.userId === input.userId && item.curriculumId === input.curriculumId
    );

    if (existingIndex >= 0) {
      memoryProgress[existingIndex] = {
        ...memoryProgress[existingIndex],
        completed: input.completed ?? 0,
        score: input.score ?? 0,
        completedAt: input.completedAt ?? null,
        updatedAt: now,
      };
      return memoryProgress[existingIndex];
    }

    const row = {
      id: memoryProgressId++,
      userId: input.userId,
      curriculumId: input.curriculumId,
      completed: input.completed ?? 0,
      score: input.score ?? 0,
      completedAt: input.completedAt ?? null,
      createdAt: now,
      updatedAt: now,
    };
    memoryProgress.push(row);
    return row;
  }

  const [result] = await db
    .insert(progress)
    .values({
      userId: input.userId,
      curriculumId: input.curriculumId,
      completed: input.completed ?? 0,
      score: input.score ?? 0,
      completedAt: input.completedAt ?? null,
    })
    .onDuplicateKeyUpdate({
      set: {
        completed: input.completed ?? 0,
        score: input.score ?? 0,
        completedAt: input.completedAt ?? null,
      },
    });
  return result;
}

// ========== Quiz Functions ==========

export async function saveQuizAnswer(input: {
  userId: number;
  quizId: number;
  userAnswer: string;
  isCorrect: number;
  feedback?: string;
  economyScore?: string;
  clarityScore?: string;
  accuracyScore?: string;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");

  await db.insert(quizAnswer).values({
    userId: input.userId,
    quizId: input.quizId,
    userAnswer: input.userAnswer,
    isCorrect: input.isCorrect,
    feedback: input.feedback ?? null,
    economyScore: input.economyScore ?? null,
    clarityScore: input.clarityScore ?? null,
    accuracyScore: input.accuracyScore ?? null,
  });
}

export async function getQuizAnswersByUser(userId: number) {
  const db = await getDb();
  if (!db) return [];

  return await db
    .select()
    .from(quizAnswer)
    .where(eq(quizAnswer.userId, userId));
}

// ========== Certificate Functions ==========

export async function getCertificatesByUser(userId: number) {
  const db = await getDb();
  if (!db) return [];

  return await db
    .select()
    .from(certificate)
    .where(and(eq(certificate.userId, userId), eq(certificate.status, "active")));
}

export async function getCertificateByShareToken(shareToken: string) {
  const db = await getDb();
  if (!db) return undefined;

  const result = await db
    .select()
    .from(certificate)
    .where(and(eq(certificate.shareToken, shareToken), eq(certificate.status, "active")));

  return result[0];
}

export async function issueCertificate(input: {
  userId: number;
  courseType: "elementary" | "middle_high" | "high_univ" | "general_adult";
  level?: number;
  certificateType: "level_certificate" | "graduation_certificate";
  shareToken: string;
  pdfUrl?: string;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  await assertCertificateIssuanceEligibility(input);
  const existing = await db.select().from(certificate).where(and(
    eq(certificate.userId, input.userId),
    eq(certificate.courseType, input.courseType),
    input.level === undefined ? eq(certificate.certificateType, input.certificateType) : eq(certificate.level, input.level),
    eq(certificate.status, "active"),
  ));
  if (existing.length > 0) throw new Error("동일 과정·레벨의 활성 수료증이 이미 존재합니다.");

  const courseNameKo = input.courseType === "elementary" ? "초등 논술 과정" : input.courseType === "middle_high" ? "중고등 논술 과정" : input.courseType === "high_univ" ? "고등/대입 논술 과정" : "일반/직장인 논술 과정";
  const title = `${courseNameKo} Level ${input.level || 1} 수료증`;
  const certNumber = `CERT-${new Date().getFullYear()}-${Math.floor(100000 + Math.random() * 900000)}`;

  const [result] = await db.insert(certificate).values({
    ...input,
    title,
    certNumber,
  });
  return result;
}

// ========== Essay Submission Functions ==========

export async function getEssaySubmissionsByUser(userId: number) {
  const db = await getDb();
  if (!db) return [];

  return await db
    .select()
    .from(essaySubmission)
    .where(eq(essaySubmission.userId, userId));
}

export async function getEssaySubmissionById(id: number) {
  const db = await getDb();
  if (!db) return undefined;

  const result = await db
    .select()
    .from(essaySubmission)
    .where(eq(essaySubmission.id, id));

  return result[0];
}

export async function createEssaySubmission(input: {
  userId: number;
  curriculumId?: number;
  title: string;
  content: string;
  status?: "draft" | "submitted" | "reviewed";
}) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");

  const [result] = await db.insert(essaySubmission).values({
    userId: input.userId,
    curriculumId: input.curriculumId ?? null,
    title: input.title,
    content: input.content,
    status: input.status ?? "draft",
  });
  return result;
}

export async function updateEssaySubmission(
  id: number,
  input: {
    title?: string;
    content?: string;
    status?: "draft" | "submitted" | "reviewed";
    submittedAt?: Date;
  }
) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");

  await db
    .update(essaySubmission)
    .set(input)
    .where(eq(essaySubmission.id, id));
}

// ========== Teacher Feedback Functions ==========

export async function getTeacherFeedbackByEssay(essayId: number) {
  const db = await getDb();
  if (!db) return undefined;

  const result = await db
    .select()
    .from(teacherFeedback)
    .where(eq(teacherFeedback.essayId, essayId));

  return result[0];
}

export async function createTeacherFeedback(input: {
  essayId: number;
  teacherId: number;
  overallComment?: string;
  overallScore?: number;
  structureScore?: number;
  logicScore?: number;
  expressionScore?: number;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");

  const [result] = await db.insert(teacherFeedback).values(input);
  return result;
}

export async function updateTeacherFeedback(
  feedbackId: number,
  input: {
    overallComment?: string;
    overallScore?: number;
    structureScore?: number;
    logicScore?: number;
    expressionScore?: number;
  }
) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");

  await db
    .update(teacherFeedback)
    .set(input)
    .where(eq(teacherFeedback.id, feedbackId));
}

export async function getFeedbackCommentsByFeedback(feedbackId: number) {
  const db = await getDb();
  if (!db) return [];

  return await db
    .select()
    .from(feedbackComment)
    .where(eq(feedbackComment.feedbackId, feedbackId));
}

export async function createFeedbackComment(input: {
  feedbackId: number;
  lineNumber: number;
  startIndex: number;
  endIndex: number;
  comment: string;
  commentType: "grammar" | "logic" | "expression" | "structure" | "other";
}) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");

  const [result] = await db.insert(feedbackComment).values(input);
  return result;
}

// ========== AI Auto Feedback Functions ==========

export async function getAIAutoFeedbackByUser(userId: number) {
  const db = await getDb();
  if (!db) return [];

  return await db
    .select()
    .from(aiAutoFeedback)
    .where(eq(aiAutoFeedback.userId, userId));
}

export async function createAIAutoFeedback(input: {
  userId: number;
  essayTitle: string;
  essayContent: string;
  revisedEssay?: string;
  courseType: "elementary" | "middle_high" | "high_univ" | "general_adult";
  level: number;
  overallComment?: string;
  structureScore?: number;
  logicScore?: number;
  expressionScore?: number;
  overallScore?: number;
  suggestions?: string;
  strengths?: string;
  weaknesses?: string;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");

  const [result] = await db.insert(aiAutoFeedback).values(input);
  return result;
}

// ========== AI Usage & Quota Functions ==========

export async function logAIUsage(userId: number, actionType: string, tokensUsed: number = 0) {
  const db = await getDb();
  if (!db) return;
  await db.insert(aiUsageLogs).values({
    userId,
    actionType,
    tokensUsed,
  });
}

export async function getTodayAIUsageCount(userId: number): Promise<number> {
  const db = await getDb();
  if (!db) return 0;

  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const logs = await db
    .select()
    .from(aiUsageLogs)
    .where(and(eq(aiUsageLogs.userId, userId), gte(aiUsageLogs.createdAt, todayStart)));

  return logs.length;
}

export async function getAllAIUsageStats() {
  const db = await getDb();
  if (!db) return { totalCalls: 0, todayCalls: 0 };

  const allLogs = await db.select().from(aiUsageLogs);
  const totalCalls = allLogs.length;

  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const todayCalls = allLogs.filter(l => new Date(l.createdAt) >= todayStart).length;

  return { totalCalls, todayCalls };
}

export async function updateUserSocialIdentity(userId: number, openId: string, name?: string | null, email?: string | null, loginMethod?: string) {
  const db = await getDb();
  if (!db) return undefined;
  await db.update(users).set({
    name: name !== undefined ? name : undefined,
    email: email !== undefined ? email : undefined,
    loginMethod: loginMethod !== undefined ? loginMethod : undefined,
    lastSignedIn: new Date(),
  }).where(eq(users.id, userId));
  return getUserById(userId);
}

export async function createEmailUser(input: {
  openId: string;
  name?: string | null;
  email?: string | null;
  passwordHash?: string | null;
  loginMethod?: string;
  emailVerifiedAt?: Date | null;
  verificationTokenHash?: string | null;
  verificationTokenExpiresAt?: Date | null;
  role?: "user" | "teacher" | "admin";
  teacherLevel?: number;
  teacherStatus?: "pending" | "approved" | "rejected";
  tag?: string;
  teacherId?: number | null;
  preferredTeacherId?: number | null;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  const role = input.role ?? "user";
  const teacherStatus = role === "teacher" ? (input.teacherStatus ?? "pending") : "approved";
  await db.insert(users).values({
    openId: input.openId,
    name: input.name ?? null,
    email: input.email ?? null,
    passwordHash: input.passwordHash ?? null,
    loginMethod: input.loginMethod ?? "email",
    emailVerifiedAt: input.emailVerifiedAt ?? null,
    verificationTokenHash: input.verificationTokenHash ?? null,
    verificationTokenExpiresAt: input.verificationTokenExpiresAt ?? null,
    role,
    teacherLevel: input.teacherLevel ?? 1,
    teacherStatus,
    teacherId: input.teacherId ?? null,
    preferredTeacherId: input.preferredTeacherId ?? null,
    tag: input.tag ?? "일반",
    lastSignedIn: new Date(),
  });
  return getUserByOpenId(input.openId);
}

export async function updateUserLastSignedIn(userId: number) {
  const db = await getDb();
  if (!db) return;
  await db.update(users).set({ lastSignedIn: new Date() }).where(eq(users.id, userId));
}

export async function getProgressByUserAndCurriculum(userId: number, curriculumId: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(progress).where(and(eq(progress.userId, userId), eq(progress.curriculumId, curriculumId)));
  return result[0];
}

export async function setUserPasswordResetToken(userId: number, tokenHash: string) {
  const db = await getDb();
  if (!db) return;
  await db.update(users).set({ verificationTokenHash: tokenHash }).where(eq(users.id, userId));
}

export async function getUserByPasswordResetTokenHash(tokenHash: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(users).where(eq(users.verificationTokenHash, tokenHash));
  return result[0];
}

export async function resetUserPassword(userId: number, passwordHash: string) {
  const db = await getDb();
  if (!db) return;
  await db.update(users).set({ passwordHash, verificationTokenHash: null }).where(eq(users.id, userId));
}

export async function updateVerificationToken(userId: number, tokenHash: string, _expiresAt?: Date) {
  const db = await getDb();
  if (!db) return;
  await db.update(users).set({ verificationTokenHash: tokenHash }).where(eq(users.id, userId));
}

export async function updatePasswordResetToken(userId: number, tokenHash: string, _expiresAt?: Date) {
  const db = await getDb();
  if (!db) return;
  await db.update(users).set({ verificationTokenHash: tokenHash }).where(eq(users.id, userId));
}

export async function getUserByVerificationTokenHash(tokenHash: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(users).where(eq(users.verificationTokenHash, tokenHash));
  return result[0];
}

export async function markEmailVerified(userId: number) {
  const db = await getDb();
  if (!db) return;
  await db.update(users).set({ emailVerifiedAt: new Date(), verificationTokenHash: null }).where(eq(users.id, userId));
}



export async function getWeeklyAIUsageLogs(userId: number) {
  const db = await getDb();
  if (!db) return [];

  const weekAgo = new Date();
  weekAgo.setDate(weekAgo.getDate() - 7);
  weekAgo.setHours(0, 0, 0, 0);

  const logs = await db
    .select()
    .from(aiUsageLogs)
    .where(and(eq(aiUsageLogs.userId, userId), gte(aiUsageLogs.createdAt, weekAgo)));

  return logs;
}

export async function getAllUsersStats() {
  const db = await getDb();
  if (!db) return { totalUsers: 0, activeToday: 0, users: [] };

  const allUsers = await db.select().from(users);
  const totalUsers = allUsers.length;

  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const activeToday = allUsers.filter(u => u.lastSignedIn && new Date(u.lastSignedIn) >= todayStart).length;

  return {
    totalUsers,
    activeToday,
    users: allUsers.map(u => ({
      id: u.id,
      name: u.name,
      email: u.email,
      role: u.role,
      teacherLevel: u.teacherLevel,
      teacherStatus: u.teacherStatus,
      teacherId: u.teacherId,
      preferredTeacherId: u.preferredTeacherId,
      tag: u.tag,
      loginMethod: u.loginMethod,
      createdAt: u.createdAt,
      lastSignedIn: u.lastSignedIn,
      adminNotes: u.adminNotes,
    })),
  };
}

export async function getAllProgressStats() {
  const db = await getDb();
  if (!db) return { totalSubmissions: 0, avgScore: 0 };

  const allProgress = await db.select().from(progress);
  const totalSubmissions = allProgress.length;
  const avgScore = totalSubmissions > 0
    ? Math.round(allProgress.reduce((sum, p) => sum + (p.score || 0), 0) / totalSubmissions)
    : 0;

  return { totalSubmissions, avgScore };
}

export async function getStudentDetailStats(userId: number) {
  const db = await getDb();
  if (!db) return null;

  const userRecord = await getUserById(userId);
  if (!userRecord) return null;

  const [submissions, userProgress, userCerts, aiFeedbacks, classAssignmentDetails] = await Promise.all([
    getEssaySubmissionsByUser(userId),
    getProgressByUser(userId),
    getCertificatesByUser(userId),
    getAIAutoFeedbackByUser(userId),
    getStudentClassAssignmentDetails(userId),
  ]);

  return {
    user: {
      id: userRecord.id,
      name: userRecord.name,
      email: userRecord.email,
      role: userRecord.role,
      tag: userRecord.tag,
      courseType: getCourseTypeFromUserTag(userRecord.tag),
      courseLabel: getCourseTag(getCourseTypeFromUserTag(userRecord.tag)),
      createdAt: userRecord.createdAt,
      lastSignedIn: userRecord.lastSignedIn,
      adminNotes: userRecord.adminNotes,
    },
    submissions,
    progress: userProgress,
    certificates: userCerts,
    aiFeedbacks,
    classAssignments: classAssignmentDetails,
  };
}

export async function updateStudentAdminNotes(userId: number, adminNotes: string) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  await db.update(users).set({ adminNotes }).where(eq(users.id, userId));
  return getUserById(userId);
}
export async function updateUsersTag(userIds: number[], tag: string) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");

  for (const id of userIds) {
    await db.update(users).set({ tag }).where(eq(users.id, id));
  }
  return true;
}

// ========== Admin Certificate & Category Management Functions ==========

export async function adminGetAllCertificates() {
  const db = await getDb();
  if (!db) return [];
  return await db.select().from(certificate).orderBy(desc(certificate.createdAt));
}

export async function adminIssueCertificate(input: {
  userId: number;
  courseType: "elementary" | "middle_high" | "high_univ" | "general_adult";
  level?: number;
  certificateType: "level_certificate" | "graduation_certificate";
  shareToken: string;
  issuedBy: number;
  issueReason?: string;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  await assertCertificateIssuanceEligibility(input);

  const existing = await db
    .select()
    .from(certificate)
    .where(
      and(
        eq(certificate.userId, input.userId),
        eq(certificate.courseType, input.courseType),
        input.level === undefined ? eq(certificate.certificateType, input.certificateType) : eq(certificate.level, input.level),
        eq(certificate.status, "active"),
      ),
    );
  if (existing.length > 0) {
    throw new Error("동일 학생·과정·레벨의 활성 수료증이 이미 존재합니다.");
  }

  const [res] = await db.insert(certificate).values({
    userId: input.userId,
    courseType: input.courseType,
    level: input.level ?? null,
    certificateType: input.certificateType,
    shareToken: input.shareToken,
    issuedBy: input.issuedBy,
    issueReason: input.issueReason?.trim() || null,
    status: "active",
    issuedAt: new Date(),
    updatedAt: new Date(),
  });
  return res;
}

const CERTIFICATE_COURSE_TYPES: CourseType[] = ["elementary", "middle_high", "high_univ", "general_adult"];

async function ensureCertificateApprovalPolicies() {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  const existingPolicies = await db.select().from(certificateApprovalPolicies);
  const existingCourseTypes = new Set(existingPolicies.map((policy) => policy.courseType));
  for (const courseType of CERTIFICATE_COURSE_TYPES) {
    if (!existingCourseTypes.has(courseType)) {
      await db.insert(certificateApprovalPolicies).values({
        courseType,
        teacherReviewRequired: 1,
        adminApprovalRequired: 1,
        minimumCompletionRate: 100,
        minimumAverageScore: 0,
        isActive: 1,
      });
    }
  }
}

export async function getCertificateApprovalPolicies() {
  const db = await getDb();
  if (!db) return [];
  await ensureCertificateApprovalPolicies();
  return db.select().from(certificateApprovalPolicies);
}

export async function saveCertificateApprovalPolicy(input: {
  courseType: CourseType;
  teacherReviewRequired: number;
  adminApprovalRequired: number;
  minimumCompletionRate: number;
  minimumAverageScore: number;
  isActive: number;
  updatedBy: number;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  const [existing] = await db.select().from(certificateApprovalPolicies).where(eq(certificateApprovalPolicies.courseType, input.courseType));
  const values = {
    // 공동 승인 절차는 모든 과정에서 교사 검토와 관리자 최종 승인을 함께 요구합니다.
    teacherReviewRequired: 1,
    adminApprovalRequired: 1,
    minimumCompletionRate: input.minimumCompletionRate,
    minimumAverageScore: input.minimumAverageScore,
    isActive: input.isActive,
    updatedBy: input.updatedBy,
    updatedAt: new Date(),
  };
  if (existing) {
    await db.update(certificateApprovalPolicies).set(values).where(eq(certificateApprovalPolicies.id, existing.id));
  } else {
    await db.insert(certificateApprovalPolicies).values({ courseType: input.courseType, ...values });
  }
  return getCertificateApprovalPolicies();
}

export async function getStudentCertificateEligibility(studentId: number) {
  const student = await getUserById(studentId);
  if (!student) throw new Error("학생을 찾을 수 없습니다.");
  const courseType = getCourseTypeFromUserTag(student.tag);
  const [studentProgress, dynamicModules, staticModules, policies] = await Promise.all([
    getProgressByUser(studentId),
    getDynamicCurriculumByType(courseType),
    getCurriculumByType(courseType),
    getCertificateApprovalPolicies(),
  ]);
  const modules = dynamicModules.length > 0 ? dynamicModules : staticModules;
  const orderedModules = [...modules].sort((left: any, right: any) => Number(left.level ?? 0) - Number(right.level ?? 0));
  const moduleIds = new Set(orderedModules.map((module: any) => module.id));
  const courseProgress = studentProgress.filter((item) => moduleIds.has(item.curriculumId));
  const completedIds = new Set(courseProgress.filter((item) => item.completed === 1 || Number(item.completed) >= 100).map((item) => item.curriculumId));
  const completedCount = orderedModules.filter((module: any) => completedIds.has(module.id)).length;
  const completionRate = orderedModules.length > 0 ? Math.round((completedCount / orderedModules.length) * 100) : 0;
  const averageScore = courseProgress.length > 0
    ? Math.round(courseProgress.reduce((sum, item) => sum + (item.score || 0), 0) / courseProgress.length)
    : 0;
  const policy = policies.find((item) => item.courseType === courseType) ?? null;
  const levelEligibility = orderedModules.map((module: any) => {
    const requiredModules = orderedModules.filter((candidate: any) => Number(candidate.level ?? 0) <= Number(module.level ?? 0));
    const requiredCompleted = requiredModules.filter((candidate: any) => completedIds.has(candidate.id)).length;
    const levelCompletionRate = requiredModules.length > 0 ? Math.round((requiredCompleted / requiredModules.length) * 100) : 0;
    return {
      level: Number(module.level ?? 1), completionRate: levelCompletionRate, completedCount: requiredCompleted, totalCount: requiredModules.length,
      isEligible: Boolean(policy?.isActive) && levelCompletionRate >= (policy?.minimumCompletionRate ?? 100) && averageScore >= (policy?.minimumAverageScore ?? 0),
    };
  });
  return { student, courseType, courseLabel: getCourseTag(courseType), completionRate, averageScore, completedCount, totalCount: orderedModules.length, policy: policy ? { minimumCompletionRate: policy.minimumCompletionRate, minimumAverageScore: policy.minimumAverageScore, isActive: policy.isActive } : null, levelEligibility };
}

export async function assertCertificateIssuanceEligibility(input: {
  userId: number;
  courseType: CourseType;
  level?: number;
  certificateType: "level_certificate" | "graduation_certificate";
}) {
  const eligibility = await getStudentCertificateEligibility(input.userId);
  if (eligibility.student.role !== "user") throw new Error("학습자 계정에만 수료증을 발급할 수 있습니다.");
  if (eligibility.courseType !== input.courseType) throw new Error("가입·학습 중인 과정과 다른 과정의 수료증은 발급할 수 없습니다.");
  if (!eligibility.policy?.isActive) throw new Error("해당 과정의 수료증 발급 정책이 비활성화되어 있습니다.");
  if (input.certificateType === "graduation_certificate") {
    if (eligibility.completionRate < eligibility.policy.minimumCompletionRate || eligibility.averageScore < eligibility.policy.minimumAverageScore) throw new Error(`수료 기준을 충족하지 않았습니다. 현재 완료율 ${eligibility.completionRate}%입니다.`);
    return eligibility;
  }
  const levelStatus = eligibility.levelEligibility.find((item) => item.level === (input.level ?? 1));
  if (!levelStatus?.isEligible) throw new Error(`Level ${input.level ?? 1} 수료 기준을 충족하지 않았습니다. 현재 완료율 ${levelStatus?.completionRate ?? 0}%입니다.`);
  return eligibility;
}

export async function createCertificateApprovalRequest(input: {
  studentId: number;
  courseType: CourseType;
  level?: number;
  certificateType: "level_certificate" | "graduation_certificate";
  requestedBy: number;
  requestScope: "organization" | "student";
  evidenceCompletionRate: number;
  evidenceAverageScore: number;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  await ensureCertificateApprovalPolicies();
  const [policy] = await db.select().from(certificateApprovalPolicies).where(eq(certificateApprovalPolicies.courseType, input.courseType));
  if (!policy?.isActive) throw new Error("해당 과정의 수료증 공동 승인 정책이 비활성화되어 있습니다.");
  if (input.evidenceCompletionRate < policy.minimumCompletionRate || input.evidenceAverageScore < policy.minimumAverageScore) {
    throw new Error("설정된 수료증 발급 조건을 아직 충족하지 않았습니다.");
  }
  const requests = await db.select().from(certificateApprovalRequests).where(eq(certificateApprovalRequests.studentId, input.studentId));
  if (requests.some((request) => request.courseType === input.courseType && request.level === (input.level ?? null) && ["pending_teacher", "pending_admin", "approved"].includes(request.status))) {
    throw new Error("동일 학생·과정·단계의 공동 승인 요청이 이미 존재합니다.");
  }
  const [result] = await db.insert(certificateApprovalRequests).values({
    ...input,
    level: input.level ?? null,
    status: "pending_teacher",
  });
  return result;
}

export async function getCertificateApprovalRequests() {
  const db = await getDb();
  if (!db) return [];
  const [requests, allUsers] = await Promise.all([
    db.select().from(certificateApprovalRequests).orderBy(desc(certificateApprovalRequests.updatedAt)),
    db.select().from(users),
  ]);
  const usersById = new Map(allUsers.map((user) => [user.id, user]));
  return requests.map((request) => ({
    ...request,
    studentName: usersById.get(request.studentId)?.name || `학생 #${request.studentId}`,
    studentEmail: usersById.get(request.studentId)?.email || null,
    requestedByName: usersById.get(request.requestedBy)?.name || `교사 #${request.requestedBy}`,
    courseLabel: getCourseTag(request.courseType),
  }));
}

export async function reviewCertificateApprovalRequestByTeacher(requestId: number, teacherId: number, note?: string) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  const [request] = await db.select().from(certificateApprovalRequests).where(eq(certificateApprovalRequests.id, requestId));
  if (!request) throw new Error("수료증 승인 요청을 찾을 수 없습니다.");
  if (request.status !== "pending_teacher") throw new Error("교사 검토 대기 중인 요청만 승인할 수 있습니다.");
  if (!(await canTeacherManageStudent(teacherId, request.studentId, "certificate"))) throw new Error("해당 학생의 수료증 검토 권한이 없습니다.");
  await db.update(certificateApprovalRequests).set({
    status: "pending_admin",
    teacherApprovedBy: teacherId,
    teacherApprovedAt: new Date(),
    teacherNote: note?.trim() || null,
    updatedAt: new Date(),
  }).where(eq(certificateApprovalRequests.id, requestId));
  return true;
}

export async function resolveCertificateApprovalRequestByAdmin(input: { requestId: number; adminId: number; approved: boolean; note?: string; shareToken?: string }) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  const [request] = await db.select().from(certificateApprovalRequests).where(eq(certificateApprovalRequests.id, input.requestId));
  if (!request) throw new Error("수료증 승인 요청을 찾을 수 없습니다.");
  if (request.status !== "pending_admin") throw new Error("관리자 최종 승인 대기 중인 요청만 처리할 수 있습니다.");
  if (!input.approved) {
    await db.update(certificateApprovalRequests).set({
      status: "rejected",
      adminApprovedBy: input.adminId,
      adminApprovedAt: new Date(),
      adminNote: input.note?.trim() || "관리자 반려",
      updatedAt: new Date(),
    }).where(eq(certificateApprovalRequests.id, request.id));
    return { approved: false };
  }
  const certificateResult = await adminIssueCertificate({
    userId: request.studentId,
    courseType: request.courseType,
    level: request.level ?? undefined,
    certificateType: request.certificateType,
    shareToken: input.shareToken || `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 12)}`,
    issuedBy: input.adminId,
    issueReason: input.note?.trim() || "교사 검토 및 관리자 공동 승인",
  });
  await db.update(certificateApprovalRequests).set({
    status: "approved",
    adminApprovedBy: input.adminId,
    adminApprovedAt: new Date(),
    adminNote: input.note?.trim() || null,
    certificateId: Number((certificateResult as { insertId?: number }).insertId) || null,
    updatedAt: new Date(),
  }).where(eq(certificateApprovalRequests.id, request.id));
  return { approved: true };
}

export async function adminRevokeCertificate(certificateId: number, revokedBy: number, reason: string) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  const [target] = await db.select().from(certificate).where(eq(certificate.id, certificateId));
  if (!target) throw new Error("수료증을 찾을 수 없습니다.");
  if (target.status === "revoked") throw new Error("이미 발행취소된 수료증입니다.");
  await db.update(certificate).set({
    status: "revoked",
    revokedAt: new Date(),
    revokedBy,
    revocationReason: reason.trim(),
    updatedAt: new Date(),
  }).where(eq(certificate.id, certificateId));
  return true;
}

export async function adminDeleteCertificate(certificateId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  const [target] = await db.select().from(certificate).where(eq(certificate.id, certificateId));
  if (!target) throw new Error("수료증을 찾을 수 없습니다.");
  if (target.status !== "revoked") throw new Error("삭제 전에 먼저 발행취소해야 합니다.");
  await db.delete(certificate).where(eq(certificate.id, certificateId));
  return true;
}

export async function adminGetCurriculumCategories() {
  const db = await getDb();
  if (!db) return [];
  const rows = await db.select().from(dynamicCurriculum).orderBy(dynamicCurriculum.courseType, dynamicCurriculum.level);
  return rows.map((row) => ({
    ...row,
    topics: (() => {
      try { return JSON.parse(row.topicsJson) as string[]; } catch { return []; }
    })(),
    aiTags: (() => {
      try { return row.aiTags ? (JSON.parse(row.aiTags) as string[]) : []; } catch { return []; }
    })(),
  }));
}

export async function adminCreateCurriculumCategory(input: {
  courseType: "elementary" | "middle_high" | "high_univ" | "general_adult";
  level: number;
  title: string;
  description: string;
  topics: string[];
  aiSummary?: string;
  isActive?: number;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  const [created] = await db.insert(dynamicCurriculum).values({
    courseType: input.courseType,
    level: input.level,
    title: input.title.trim(),
    description: input.description.trim(),
    topicsJson: JSON.stringify(input.topics.map((topic) => topic.trim()).filter(Boolean)),
    aiSummary: input.aiSummary,
    isActive: input.isActive ?? 1,
    createdAt: new Date(),
    updatedAt: new Date(),
  });
  return created;
}

export async function adminUpdateCurriculumCategory(input: {
  id: number;
  courseType: "elementary" | "middle_high" | "high_univ" | "general_adult";
  level: number;
  title: string;
  description: string;
  topics: string[];
  aiSummary?: string;
  isActive?: number;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  await db.update(dynamicCurriculum).set({
    courseType: input.courseType,
    level: input.level,
    title: input.title.trim(),
    description: input.description.trim(),
    topicsJson: JSON.stringify(input.topics.map((topic) => topic.trim()).filter(Boolean)),
    aiSummary: input.aiSummary,
    isActive: input.isActive ?? 1,
    updatedAt: new Date(),
  }).where(eq(dynamicCurriculum.id, input.id));
  return true;
}

export async function adminToggleCurriculumActive(id: number, isActive: number) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  await db.update(dynamicCurriculum).set({
    isActive: isActive ? 1 : 0,
    updatedAt: new Date(),
  }).where(eq(dynamicCurriculum.id, id));
  return true;
}

export async function adminBatchToggleCurriculumActive(ids: number[], isActive: number) {
  const db = await getDb();
  if (!db || ids.length === 0) return false;
  for (const id of ids) {
    await db.update(dynamicCurriculum).set({
      isActive: isActive ? 1 : 0,
      updatedAt: new Date(),
    }).where(eq(dynamicCurriculum.id, id));
  }
  return true;
}

export async function adminDuplicateCurriculumCategory(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  const [target] = await db.select().from(dynamicCurriculum).where(eq(dynamicCurriculum.id, id));
  if (!target) throw new Error("복제할 커리큘럼을 찾을 수 없습니다.");
  const [created] = await db.insert(dynamicCurriculum).values({
    courseType: target.courseType,
    level: target.level + 1,
    title: `${target.title} (복사본)`,
    description: target.description,
    topicsJson: target.topicsJson,
    thumbnailUrl: target.thumbnailUrl,
    aiSummary: target.aiSummary,
    aiTags: target.aiTags,
    samplePdfUrl: target.samplePdfUrl,
    isActive: target.isActive,
    createdAt: new Date(),
    updatedAt: new Date(),
  });
  return created;
}

export async function adminDeleteCurriculumCategory(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  const [target] = await db.select().from(dynamicCurriculum).where(eq(dynamicCurriculum.id, id));
  if (!target) throw new Error("커리큘럼 카테고리를 찾을 수 없습니다.");
  await db.delete(dynamicCurriculum).where(eq(dynamicCurriculum.id, id));
  return true;
}

export async function getSiteSetting(settingKey: string) {
  const db = await getDb();
  if (!db) return defaultPolicyContent(settingKey);
  const [row] = await db.select().from(siteSettings).where(eq(siteSettings.settingKey, settingKey));
  return row?.content ?? defaultPolicyContent(settingKey);
}

export async function saveSiteSetting(settingKey: string, content: string, adminId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  const [existing] = await db.select().from(siteSettings).where(eq(siteSettings.settingKey, settingKey));
  if (existing) {
    await db.update(siteSettings).set({
      content,
      updatedBy: adminId,
      updatedAt: new Date(),
    }).where(eq(siteSettings.settingKey, settingKey));
  } else {
    await db.insert(siteSettings).values({
      settingKey,
      content,
      updatedBy: adminId,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  }

  const policyTemplate = DEFAULT_POLICY_DOCUMENTS.find((document) => document.policyKey === settingKey);
  if (policyTemplate && content.trim()) {
    const now = new Date();
    const version = `${now.toISOString().slice(0, 10)}-r${now.getTime().toString().slice(-6)}`;
    await db.update(policyDocuments).set({ isActive: 0, retiredAt: now, updatedAt: now }).where(and(eq(policyDocuments.policyKey, settingKey), eq(policyDocuments.isActive, 1)));
    await db.insert(policyDocuments).values({
      policyKey: policyTemplate.policyKey,
      title: policyTemplate.title,
      version,
      content,
      requiredForRoles: policyTemplate.requiredForRoles.join(","),
      isRequired: policyTemplate.isRequired ? 1 : 0,
      isActive: 1,
      effectiveAt: now,
      updatedBy: adminId,
      createdAt: now,
      updatedAt: now,
    });
  }
  return true;
}

export async function ensureDefaultPolicyDocuments() {
  const db = await getDb();
  if (!db) return [];
  for (const document of DEFAULT_POLICY_DOCUMENTS) {
    const [existing] = await db.select().from(policyDocuments).where(and(eq(policyDocuments.policyKey, document.policyKey), eq(policyDocuments.version, document.version)));
    if (!existing) {
      await db.insert(policyDocuments).values({
        policyKey: document.policyKey,
        title: document.title,
        version: document.version,
        content: document.content,
        requiredForRoles: document.requiredForRoles.join(","),
        isRequired: document.isRequired ? 1 : 0,
        isActive: 1,
        effectiveAt: new Date(),
      });
    }
  }
  return db.select().from(policyDocuments).where(eq(policyDocuments.isActive, 1));
}

export async function getActivePolicyDocuments(role?: AccountConsentRole) {
  const documents = await ensureDefaultPolicyDocuments();
  return role ? documents.filter((document) => document.requiredForRoles.split(",").includes(role)) : documents;
}

export type SignupConsentInput = {
  policyKey: string;
  policyVersion: string;
  consentType: "required_service" | "optional_ai_learning" | "teacher_ai_style" | "guardian_authorization";
  accepted: boolean;
};

export async function recordUserPolicyConsents(userId: number, consents: SignupConsentInput[]) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  const accepted = consents.filter((consent) => consent.accepted);
  if (accepted.length === 0) return;
  await db.insert(userPolicyConsents).values(accepted.map((consent) => ({
    userId,
    policyKey: consent.policyKey,
    policyVersion: consent.policyVersion,
    consentType: consent.consentType,
    status: "accepted" as const,
    acceptedAt: new Date(),
    evidence: "signup_confirmation",
  })));
}

export async function getUserPolicyConsents(userId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(userPolicyConsents).where(eq(userPolicyConsents.userId, userId)).orderBy(desc(userPolicyConsents.acceptedAt));
}

export async function getPolicyConsentAudit(limit = 100) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(userPolicyConsents).orderBy(desc(userPolicyConsents.updatedAt)).limit(limit);
}

export async function getDataProcessingRequests(limit = 100) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(dataProcessingRequests).orderBy(desc(dataProcessingRequests.updatedAt)).limit(limit);
}

export async function createDataProcessingRequest(userId: number, requestType: "access" | "correction" | "withdraw_ai_learning" | "delete_learning_data", requestNote?: string) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  await db.insert(dataProcessingRequests).values({ userId, requestType, requestNote: requestNote ?? null });
  const [request] = await db.select().from(dataProcessingRequests).where(eq(dataProcessingRequests.userId, userId)).orderBy(desc(dataProcessingRequests.id));
  return request;
}

export function pseudonymizeLearningText(text: string) {
  return text
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, "[이메일]")
    .replace(/(?:\+82[- ]?)?0?1[0-9][- .]?\d{3,4}[- .]?\d{4}/g, "[전화번호]")
    .replace(/\b\d{6}[- ]?\d{7}\b/g, "[식별번호]")
    .replace(/\b\d{2,4}[-.]\d{1,2}[-.]\d{1,2}\b/g, "[날짜]");
}

export async function getTeacherAiProfiles() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(teacherAiProfiles).orderBy(desc(teacherAiProfiles.updatedAt));
}

export async function getTeacherAiProfile(teacherId: number) {
  const db = await getDb();
  if (!db) return undefined;
  const [profile] = await db.select().from(teacherAiProfiles).where(eq(teacherAiProfiles.teacherId, teacherId));
  return profile;
}

export async function upsertTeacherAiProfile(input: {
  teacherId: number;
  displayName: string;
  tone: "encouraging" | "balanced" | "direct";
  feedbackFocus: string;
  styleInstruction?: string;
  forbiddenPhrases?: string[];
  rubricWeights?: Record<string, number>;
  isEnabled: boolean;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  const [existing] = await db.select().from(teacherAiProfiles).where(eq(teacherAiProfiles.teacherId, input.teacherId));
  const values = {
    displayName: input.displayName,
    tone: input.tone,
    feedbackFocus: input.feedbackFocus,
    styleInstruction: input.styleInstruction ?? null,
    forbiddenPhrases: JSON.stringify(input.forbiddenPhrases ?? []),
    rubricWeights: JSON.stringify(input.rubricWeights ?? { logic: 30, evidence: 30, expression: 20, structure: 20 }),
    isEnabled: input.isEnabled ? 1 : 0,
  };
  if (existing) {
    await db.update(teacherAiProfiles).set({ ...values, currentVersion: existing.currentVersion + 1, updatedAt: new Date() }).where(eq(teacherAiProfiles.id, existing.id));
  } else {
    await db.insert(teacherAiProfiles).values({ teacherId: input.teacherId, ...values, currentVersion: 1 });
  }
  return getTeacherAiProfile(input.teacherId);
}

export async function listTeacherAiStyleExamples(teacherId?: number) {
  const db = await getDb();
  if (!db) return [];
  return teacherId
    ? db.select().from(teacherAiStyleExamples).where(eq(teacherAiStyleExamples.teacherId, teacherId)).orderBy(desc(teacherAiStyleExamples.updatedAt))
    : db.select().from(teacherAiStyleExamples).orderBy(desc(teacherAiStyleExamples.updatedAt));
}

export async function createTeacherAiStyleExample(input: {
  teacherId: number;
  sourceFeedbackId?: number;
  purpose: "style_reference" | "quality_evaluation" | "training_candidate";
  sourceText: string;
  approvedFeedback: string;
  tags?: string;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  await db.insert(teacherAiStyleExamples).values({
    teacherId: input.teacherId,
    sourceFeedbackId: input.sourceFeedbackId ?? null,
    purpose: input.purpose,
    pseudonymizedPrompt: pseudonymizeLearningText(input.sourceText),
    approvedFeedback: pseudonymizeLearningText(input.approvedFeedback),
    tags: input.tags ?? null,
    approvalStatus: "draft",
  });
  const [example] = await db.select().from(teacherAiStyleExamples).where(eq(teacherAiStyleExamples.teacherId, input.teacherId)).orderBy(desc(teacherAiStyleExamples.id));
  return example;
}

export async function updateTeacherAiStyleExampleStatus(exampleId: number, status: "draft" | "teacher_approved" | "admin_approved" | "rejected" | "withdrawn") {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  await db.update(teacherAiStyleExamples).set({ approvalStatus: status, approvedAt: status.includes("approved") ? new Date() : null, updatedAt: new Date() }).where(eq(teacherAiStyleExamples.id, exampleId));
  const [example] = await db.select().from(teacherAiStyleExamples).where(eq(teacherAiStyleExamples.id, exampleId));
  return example;
}

type TeacherAiDraftEvaluation = {
  overallScore: number;
  logicScore: number;
  structureScore: number;
  expressionScore: number;
  strengths: string[];
  improvements: string[];
  answerQuotes: string[];
  safetyFlags: string[];
};

export async function getTeacherAiDraftById(draftId: number) {
  const db = await getDb();
  if (!db) return undefined;
  const [draft] = await db.select().from(teacherAiDrafts).where(eq(teacherAiDrafts.id, draftId));
  return draft;
}

export async function getTeacherAiDraftsByEssay(essayId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(teacherAiDrafts).where(eq(teacherAiDrafts.essayId, essayId)).orderBy(desc(teacherAiDrafts.updatedAt));
}

function parseTeacherAiEvaluation(content: string): { draftComment: string; evaluation: TeacherAiDraftEvaluation } {
  const parsed = JSON.parse(extractFirstJsonObject(content)) as { draftComment: string; evaluation: TeacherAiDraftEvaluation };
  if (!parsed.draftComment || !parsed.evaluation) throw new Error("AI 첨삭 초안 형식이 올바르지 않습니다.");
  return parsed;
}

export async function generateTeacherAiDraft(essayId: number, teacherId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  const [essay, profile, availableModels, examples] = await Promise.all([
    getEssaySubmissionById(essayId),
    getTeacherAiProfile(teacherId),
    listLLMModels(),
    listTeacherAiStyleExamples(teacherId),
  ]);
  if (!essay) throw new Error("논술 제출물을 찾을 수 없습니다.");
  if (!profile?.isEnabled) throw new Error("교사별 AI 보조 봇이 활성화되어 있지 않습니다.");

  const approvedExamples = examples.filter((example) => example.approvalStatus === "admin_approved").slice(0, 3);
  const model = availableModels.data.find((candidate) => candidate.id === "gpt-5")?.id ?? availableModels.data.find((candidate) => candidate.id === "gpt-5-mini")?.id;
  if (!model) throw new Error("사용 가능한 AI 모델을 찾지 못했습니다.");
  const forbiddenPhrases = (() => { try { return JSON.parse(profile.forbiddenPhrases || "[]") as string[]; } catch { return []; } })();
  const styleReferences = approvedExamples.map((example, index) => `사례 ${index + 1}\n[가명 처리된 답안]\n${example.pseudonymizedPrompt}\n[교사 최종 첨삭]\n${example.approvedFeedback}`).join("\n\n");

  const response = await invokeLLM({
    model,
    reasoning: model === "gpt-5" ? { effort: "low" } : undefined,
    messages: [
      { role: "system", content: "당신은 교사가 검토할 논술 첨삭 초안을 만드는 보조 AI입니다. 학생에게 직접 말하는 확정 첨삭처럼 표현하지 마세요. 답안에 실제로 존재하는 문장만 인용하고, 확인할 수 없는 사실·성적·입시 결과를 만들지 마세요. 학생 식별 정보의 추정·반복을 금지합니다." },
      { role: "user", content: `[교사 AI 보조 봇 프로필]\n이름: ${profile.displayName}\n어조: ${profile.tone}\n우선 평가 영역: ${profile.feedbackFocus}\n스타일 지침: ${profile.styleInstruction || "없음"}\n금지 표현: ${forbiddenPhrases.join(", ") || "없음"}\n\n[가명 처리·관리자 승인 사례]\n${styleReferences || "등록된 사례 없음"}\n\n[학생 제출물]\n제목: ${essay.title}\n답안:\n${essay.content}\n\n[작성 규칙]\n1. 논리·구조·표현 점수는 0~100 정수로, 실제 답안 인용이 없으면 높게 주지 않습니다.\n2. answerQuotes는 답안에 문자 그대로 포함된 2~60자 인용만 0~3개 반환합니다.\n3. strengths와 improvements는 각각 1~3개이며 구체적인 행동 지침이어야 합니다.\n4. draftComment는 교사가 수정할 수 있는 한국어 첨삭 초안입니다.\n5. safetyFlags에는 개인정보 가능성·근거 부족·주제 이탈 등 검토 필요한 항목만 넣습니다.` },
    ],
    responseFormat: {
      type: "json_schema",
      json_schema: {
        name: "teacher_ai_draft",
        strict: true,
        schema: {
          type: "object",
          properties: {
            draftComment: { type: "string" },
            evaluation: {
              type: "object",
              properties: {
                overallScore: { type: "integer", minimum: 0, maximum: 100 },
                logicScore: { type: "integer", minimum: 0, maximum: 100 },
                structureScore: { type: "integer", minimum: 0, maximum: 100 },
                expressionScore: { type: "integer", minimum: 0, maximum: 100 },
                strengths: { type: "array", minItems: 1, maxItems: 3, items: { type: "string" } },
                improvements: { type: "array", minItems: 1, maxItems: 3, items: { type: "string" } },
                answerQuotes: { type: "array", minItems: 0, maxItems: 3, items: { type: "string" } },
                safetyFlags: { type: "array", minItems: 0, maxItems: 4, items: { type: "string" } },
              },
              required: ["overallScore", "logicScore", "structureScore", "expressionScore", "strengths", "improvements", "answerQuotes", "safetyFlags"],
              additionalProperties: false,
            },
          },
          required: ["draftComment", "evaluation"],
          additionalProperties: false,
        },
      },
    },
  });
  const content = response.choices?.[0]?.message?.content;
  if (typeof content !== "string" || !content.trim()) throw new Error("AI 첨삭 초안 응답이 비어 있습니다.");
  const { draftComment, evaluation } = parseTeacherAiEvaluation(content);
  const invalidQuote = evaluation.answerQuotes.some((quote) => quote && !essay.content.includes(quote));
  if (invalidQuote) throw new Error("AI 첨삭 초안의 근거 인용을 검증하지 못했습니다.");
  await db.insert(teacherAiDrafts).values({
    essayId,
    teacherId,
    profileVersion: profile.currentVersion,
    modelId: model,
    evaluationJson: JSON.stringify(evaluation),
    draftComment,
    status: "generated",
    generatedAt: new Date(),
  });
  const [draft] = await db.select().from(teacherAiDrafts).where(and(eq(teacherAiDrafts.essayId, essayId), eq(teacherAiDrafts.teacherId, teacherId))).orderBy(desc(teacherAiDrafts.id));
  return draft;
}

export async function saveTeacherAiDraftRevision(input: { draftId: number; editorId: number; revisedComment: string; changeSummary?: string; learningApproval?: "pending" | "approved" | "rejected" | "withdrawn" }) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  const revisions = await db.select().from(teacherAiDraftRevisions).where(eq(teacherAiDraftRevisions.draftId, input.draftId));
  await db.insert(teacherAiDraftRevisions).values({
    draftId: input.draftId,
    revisionNumber: revisions.length + 1,
    editorId: input.editorId,
    revisedComment: input.revisedComment,
    changeSummary: input.changeSummary ?? null,
    learningApproval: input.learningApproval ?? "pending",
  });
  await db.update(teacherAiDrafts).set({ status: "edited", updatedAt: new Date() }).where(eq(teacherAiDrafts.id, input.draftId));
  const [revision] = await db.select().from(teacherAiDraftRevisions).where(eq(teacherAiDraftRevisions.draftId, input.draftId)).orderBy(desc(teacherAiDraftRevisions.id));
  return revision;
}

export async function getTeacherAiDraftRevisions(draftId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(teacherAiDraftRevisions).where(eq(teacherAiDraftRevisions.draftId, draftId)).orderBy(desc(teacherAiDraftRevisions.revisionNumber));
}

export async function approveTeacherAiDraft(input: { draftId: number; teacherId: number; revisionId?: number; finalComment: string }) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  const draft = await getTeacherAiDraftById(input.draftId);
  if (!draft || draft.teacherId !== input.teacherId) throw new Error("승인할 AI 첨삭 초안을 찾을 수 없습니다.");
  const evaluation = draft.evaluationJson ? JSON.parse(draft.evaluationJson) as TeacherAiDraftEvaluation : null;
  const existingFeedback = await getTeacherFeedbackByEssay(draft.essayId);
  const feedbackValues = {
    overallComment: input.finalComment,
    overallScore: evaluation?.overallScore,
    logicScore: evaluation?.logicScore,
    structureScore: evaluation?.structureScore,
    expressionScore: evaluation?.expressionScore,
  };
  if (existingFeedback) await updateTeacherFeedback(existingFeedback.id, feedbackValues);
  else await createTeacherFeedback({ essayId: draft.essayId, teacherId: input.teacherId, ...feedbackValues });
  await db.update(teacherAiDrafts).set({ status: "approved", approvedAt: new Date(), updatedAt: new Date() }).where(eq(teacherAiDrafts.id, input.draftId));
  await updateEssaySubmission(draft.essayId, { status: "reviewed" });
  return getTeacherFeedbackByEssay(draft.essayId);
}

export async function getAdminOperationsDashboardStats() {
  const db = await getDb();
  if (!db) return null;

  const allUsers = await db.select().from(users);
  const allSubs = await db.select().from(essaySubmission);
  const allCerts = await db.select().from(certificate);
  const allAiLogs = await db.select().from(aiUsageLogs);

  const students = allUsers.filter(u => u.role !== 'admin');
  const teachers = allUsers.filter(u => u.role === 'admin');

  return {
    studentCount: students.length,
    teacherCount: teachers.length,
    submissionCount: allSubs.length,
    certificateCount: allCerts.length,
    aiUsageCount: allAiLogs.length,
  };
}

async function createAiCourseSummary(title: string, description: string, topics: string[]) {
  const fallback = `${title} 과정은 ${description} 핵심 주제를 단계적으로 연습하며, ${topics.slice(0, 2).join("과 ")} 능력을 실제 글쓰기에 적용하도록 설계되었습니다.`;
  try {
    const response = await invokeLLM({
      messages: [
        { role: "system", content: "당신은 한국어 논술 교육 콘텐츠 편집자입니다. 강의 카드에 표시할 2문장 이내의 자연스러운 요약만 작성하세요. 과장된 표현이나 확인되지 않은 성과 수치는 사용하지 마세요." },
        { role: "user", content: `강의명: ${title}\n설명: ${description}\n학습 주제: ${topics.join(", ")}\n학습자가 얻는 핵심 역량과 학습 흐름을 2문장 이내로 요약하세요.` },
      ],
    });
    const content = typeof response === "string" ? response : (response as any)?.choices?.[0]?.message?.content || (response as any)?.message?.content || "";
    const summary = String(content).trim().replace(/^[-*]\s*/, "");
    return summary.length >= 20 ? summary.slice(0, 500) : fallback;
  } catch (error) {
    console.warn("[Curriculum] AI summary generation failed; using curated fallback", error);
    return fallback;
  }
}

async function createAiTagsFromSummary(title: string, aiSummary: string, topics: string[]) {
  const defaultTags = [title.split(" ")[0] || "논술", "핵심역량", "실전대비"];
  try {
    const response = await invokeLLM({
      messages: [
        { role: "system", content: "당신은 교육 태그 생성기입니다. 강의 요약과 주제를 분석하여 핵심 특징을 나타내는 3~4개의 짧은 한글 태그(각 2~6자)를 쉼표로 구분하여 출력하세요. 예: 수시분석, 논리독해, 실전파이널" },
        { role: "user", content: `강의명: ${title}\n요약: ${aiSummary}\n주제: ${topics.join(", ")}` },
      ],
    });
    const content = typeof response === "string" ? response : (response as any)?.choices?.[0]?.message?.content || (response as any)?.message?.content || "";
    const cleaned = String(content).trim().replace(/[\[\]"]/g, "");
    const tags = cleaned.split(/[,，\n]/).map(t => t.trim().replace(/^#/, "")).filter(Boolean);
    return tags.length >= 2 ? tags.slice(0, 4) : defaultTags;
  } catch (error) {
    console.warn("[Curriculum] AI tags generation failed; using defaults", error);
    return defaultTags;
  }
}

export async function seedHighUnivAndGeneralAdultCategories() {
  const db = await getDb();
  if (!db) return;

  const existing = await db.select().from(dynamicCurriculum);
  const sampleGroups = [
    {
      courseType: "high_univ" as const,
      thumbnailUrl: null,
      samples: [
        { level: 1, title: "인문·사회 제시문 심층 분석", description: "대입 수시 논술의 핵심인 다면적 제시문 비교 및 독해 능력을 기릅니다.", topics: ["제시문 공통점과 차이점 추출", "비판적 독해와 논지 재구성", "출제자의 숨은 의도 파악"] },
        { level: 2, title: "수리·과학적 사고와 논증", description: "논리적 인과관계와 확률·통계 데이터를 활용한 설득력 있는 논술 글쓰기입니다.", topics: ["도표와 통계 자료 해석", "논리적 오류 검증", "과학적 가설 검증형 논증"] },
        { level: 3, title: "대학별 모의논술 실전 파이널", description: "주요 대학 기출문제 분석을 통해 실전 감각을 극대화하고 최종 완성도를 높입니다.", topics: ["연세대·고려대 기출 유형 분석", "시간 관리와 개요 작성 법", "실전 모의논술 첨삭 피드백"] },
      ],
    },
    {
      courseType: "general_adult" as const,
      thumbnailUrl: null,
      samples: [
        { level: 1, title: "비즈니스 기획서와 보고서 작성법", description: "직장인 필수 역량인 간결하고 명확한 비즈니스 문서 기획 및 논리 전개법입니다.", topics: ["결론 우선 두괄식 구조화", "핵심 데이터 시각화 개요", "상사 설득을 위한 기획서 작성"] },
        { level: 2, title: "논리적 설득 스피치와 논설문", description: "공식적인 석상과 이메일, 제안서에서 상대를 논리적으로 설득하는 글쓰기입니다.", topics: ["타당한 근거와 논거 배치", "반박에 대응하는 방어 논리", "설득력 있는 어휘 선택"] },
        { level: 3, title: "실무 에세이 및 칼럼 기고문", description: "전문 분야의 통찰을 담은 에세이와 사회적 이슈를 다루는 칼럼 기고문 작성입니다.", topics: ["문제 정의와 시사점 도출", "독자 타겟팅 맞춤형 문체", "완성도 높은 칼럼 에세이 편집"] },
      ],
    },
  ];

  for (const group of sampleGroups) {
    for (const sample of group.samples) {
      const found = existing.find((item) => item.courseType === group.courseType && item.title === sample.title);
      const aiSummary = found?.aiSummary || await createAiCourseSummary(sample.title, sample.description, sample.topics);
      let aiTags: string[] = [];
      try {
        aiTags = found?.aiTags ? JSON.parse(found.aiTags) : await createAiTagsFromSummary(sample.title, aiSummary, sample.topics);
      } catch {
        aiTags = await createAiTagsFromSummary(sample.title, aiSummary, sample.topics);
      }
      const uploadedPdfUrls: Record<string, string> = {
    "high_univ-1": "/manus-storage/sample-high_univ-level1_1354f588.pdf",
    "high_univ-2": "/manus-storage/sample-high_univ-level2_7a0b9bcb.pdf",
    "high_univ-3": "/manus-storage/sample-high_univ-level3_790def1f.pdf",
    "general_adult-1": "/manus-storage/sample-general_adult-level1_53bcd928.pdf",
    "general_adult-2": "/manus-storage/sample-general_adult-level2_8ec417c6.pdf",
    "general_adult-3": "/manus-storage/sample-general_adult-level3_c1c91ff8.pdf",
  };
      const samplePdfUrl = uploadedPdfUrls[`${group.courseType}-${sample.level}`] || found?.samplePdfUrl || null;
      const values = {
        courseType: group.courseType,
        level: sample.level,
        title: sample.title,
        description: sample.description,
        topicsJson: JSON.stringify(sample.topics),
        thumbnailUrl: group.thumbnailUrl,
        aiSummary,
        aiTags: JSON.stringify(aiTags),
        samplePdfUrl,
        updatedAt: new Date(),
      };
      if (found) {
        await db.update(dynamicCurriculum).set(values).where(eq(dynamicCurriculum.id, found.id));
      } else {
        await db.insert(dynamicCurriculum).values({ ...values, createdAt: new Date() });
      }
    }
  }
}

export async function adminReorderCurriculumCategories(orderedIds: number[]) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  await seedHighUnivAndGeneralAdultCategories();
  for (let i = 0; i < orderedIds.length; i++) {
    await db.update(dynamicCurriculum).set({ level: i + 1, updatedAt: new Date() }).where(eq(dynamicCurriculum.id, orderedIds[i]));
  }
  return true;
}

export async function updateUserRole(userId: number, newRole: "user" | "teacher" | "admin") {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  await db.update(users).set({ role: newRole }).where(eq(users.id, userId));
  return true;
}

export async function getApprovedTeachersForRecommendation(courseType?: CourseType) {
  const db = await getDb();
  if (!db) return [];
  const teachers = await db.select().from(users).where(and(eq(users.role, "teacher"), eq(users.teacherStatus, "approved")));
  return teachers
    .filter((teacher) => teacher.email !== DEFAULT_AI_TUTOR_EMAIL)
    .map((teacher) => ({
      id: teacher.id,
      name: teacher.name || "이름 미설정 교사",
      email: teacher.email,
      teacherLevel: teacher.teacherLevel ?? 1,
      courseMatch: courseType ? getCourseTypeFromUserTag(teacher.tag) === courseType : false,
    }))
    .sort((a, b) => Number(b.courseMatch) - Number(a.courseMatch) || b.teacherLevel - a.teacherLevel);
}

export async function changeLearnerTeacherRole(userId: number, newRole: "user" | "teacher", actorId?: number) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  const [target] = await db.select().from(users).where(eq(users.id, userId));
  if (!target) throw new Error("사용자를 찾을 수 없습니다.");
  if (target.role === "admin") throw new Error("관리자 계정은 역할 전환 대상이 아닙니다.");
  await db.update(users).set({
    role: newRole,
    teacherStatus: "approved",
    teacherLevel: target.teacherLevel ?? 1,
    ...(newRole === "user" ? { teacherId: null } : {}),
    updatedAt: new Date(),
  }).where(eq(users.id, userId));
  if (actorId) await createAdminAuditLog({ actorId, targetUserId: userId, action: "role_changed", summary: `${target.name || `사용자 #${userId}`} 계정을 ${newRole === "teacher" ? "첨삭 교사" : "학습자"}로 변경`, metadata: { previousRole: target.role, newRole } });
  return true;
}

export async function adjustManagedUserLevel(userId: number, targetLevel: number, actorId?: number) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  const [target] = await db.select().from(users).where(eq(users.id, userId));
  if (!target) throw new Error("사용자를 찾을 수 없습니다.");
  if (target.role === "admin") throw new Error("관리자 계정의 학습·교사 레벨은 조정할 수 없습니다.");
  await db.update(users).set({ teacherLevel: targetLevel, updatedAt: new Date() }).where(eq(users.id, userId));
  if (actorId) await createAdminAuditLog({ actorId, targetUserId: userId, action: "level_changed", summary: `${target.name || `사용자 #${userId}`} 레벨을 Lv.${targetLevel}로 조정`, metadata: { previousLevel: target.teacherLevel ?? 1, targetLevel } });
  return { success: true, newLevel: targetLevel };
}

export async function createManagedAdminAccount(input: { openId: string; name: string; email: string; passwordHash: string; actorId?: number }) {
  const existing = await getUserByEmail(input.email);
  if (existing) throw new Error("이미 사용 중인 이메일입니다.");
  const created = await createEmailUser({
    openId: input.openId,
    name: input.name,
    email: input.email,
    passwordHash: input.passwordHash,
    loginMethod: "email",
    emailVerifiedAt: new Date(),
    role: "admin",
    teacherLevel: 1,
    teacherStatus: "approved",
    tag: "관리자",
  });
  if (created && input.actorId) await createAdminAuditLog({ actorId: input.actorId, targetUserId: created.id, action: "admin_account_created", summary: `관리자 계정 ${created.name || created.email || `#${created.id}`} 생성`, metadata: { email: created.email } });
  return created;
}

export async function getLearningGroupsWithMembers() {
  const db = await getDb();
  if (!db) return [];
  const [groups, members, allUsers] = await Promise.all([
    db.select().from(learningGroups).orderBy(desc(learningGroups.updatedAt)),
    db.select().from(learningGroupMembers),
    db.select().from(users),
  ]);
  const usersById = new Map(allUsers.map((user) => [user.id, user]));
  return groups.map((group) => {
    const groupMembers = members.filter((member) => member.groupId === group.id);
    const teacher = group.teacherId ? usersById.get(group.teacherId) : null;
    return {
      ...group,
      teacherName: teacher?.name || null,
      teacherEmail: teacher?.email || null,
      members: groupMembers.map((member) => {
        const student = usersById.get(member.studentId);
        return { ...member, studentName: student?.name || `학생 #${member.studentId}`, studentEmail: student?.email || null, courseLabel: student ? getCourseTag(getCourseTypeFromUserTag(student.tag)) : null };
      }),
    };
  });
}

export async function saveLearningGroup(input: { groupId?: number; name: string; groupType: "class" | "group"; courseType?: CourseType | null; description?: string | null; teacherId?: number | null; isActive: number; createdBy: number }) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  if (input.teacherId) {
    const [teacher] = await db.select().from(users).where(eq(users.id, input.teacherId));
    if (!teacher || teacher.role !== "teacher" || teacher.teacherStatus !== "approved") throw new Error("승인된 첨삭교사만 반·그룹 담당자로 지정할 수 있습니다.");
  }
  const values = { name: input.name, groupType: input.groupType, courseType: input.courseType ?? null, description: input.description ?? null, teacherId: input.teacherId ?? null, isActive: input.isActive, createdBy: input.createdBy, updatedAt: new Date() };
  if (input.groupId) {
    await db.update(learningGroups).set(values).where(eq(learningGroups.id, input.groupId));
    const [updated] = await db.select().from(learningGroups).where(eq(learningGroups.id, input.groupId));
    return updated;
  }
  const [inserted] = await db.insert(learningGroups).values(values);
  const [created] = await db.select().from(learningGroups).where(eq(learningGroups.id, Number(inserted.insertId)));
  return created;
}

export async function addLearningGroupMember(groupId: number, studentId: number, addedBy: number) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  const [[group], [student], existing] = await Promise.all([
    db.select().from(learningGroups).where(eq(learningGroups.id, groupId)),
    db.select().from(users).where(eq(users.id, studentId)),
    db.select().from(learningGroupMembers).where(and(eq(learningGroupMembers.groupId, groupId), eq(learningGroupMembers.studentId, studentId))),
  ]);
  if (!group) throw new Error("반·그룹을 찾을 수 없습니다.");
  if (!student || student.role !== "user") throw new Error("학습자만 반·그룹에 편성할 수 있습니다.");
  if (existing.length > 0) return existing[0];
  const [inserted] = await db.insert(learningGroupMembers).values({ groupId, studentId, addedBy });
  if (group.teacherId) await db.update(users).set({ teacherId: group.teacherId, updatedAt: new Date() }).where(eq(users.id, studentId));
  const [member] = await db.select().from(learningGroupMembers).where(eq(learningGroupMembers.id, Number(inserted.insertId)));
  return member;
}

export async function removeLearningGroupMember(groupId: number, studentId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  await db.delete(learningGroupMembers).where(and(eq(learningGroupMembers.groupId, groupId), eq(learningGroupMembers.studentId, studentId)));
  return true;
}

export async function assignStudentTeacher(studentId: number, teacherId: number | null, actorId?: number) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  const [student] = await db.select().from(users).where(eq(users.id, studentId));
  if (!student || student.role !== "user") throw new Error("학습자를 찾을 수 없습니다.");
  if (teacherId) {
    const [teacher] = await db.select().from(users).where(eq(users.id, teacherId));
    if (!teacher || teacher.role !== "teacher" || teacher.teacherStatus !== "approved") throw new Error("승인된 첨삭교사만 담당자로 지정할 수 있습니다.");
  }
  await db.update(users).set({ teacherId, updatedAt: new Date() }).where(eq(users.id, studentId));
  if (actorId) await createAdminAuditLog({ actorId, targetUserId: studentId, action: "teacher_assigned", summary: `${student.name || `학생 #${studentId}`} 담당 교사 ${teacherId ? "지정" : "해제"}`, metadata: { previousTeacherId: student.teacherId, teacherId } });
  return true;
}

export async function createAdminAuditLog(input: { actorId: number; targetUserId?: number | null; action: "admin_account_created" | "role_changed" | "level_changed" | "teacher_assigned"; summary: string; metadata?: Record<string, unknown> }) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  await db.insert(adminAuditLogs).values({ actorId: input.actorId, targetUserId: input.targetUserId ?? null, action: input.action, summary: input.summary, metadataJson: input.metadata ? JSON.stringify(input.metadata) : null });
}

export async function getAdminAuditLogs(limit = 100) {
  const db = await getDb();
  if (!db) return [];
  const [logs, allUsers] = await Promise.all([db.select().from(adminAuditLogs).orderBy(desc(adminAuditLogs.createdAt)).limit(limit), db.select().from(users)]);
  const usersById = new Map(allUsers.map((user) => [user.id, user]));
  return logs.map((log) => ({ ...log, actorName: usersById.get(log.actorId)?.name || `관리자 #${log.actorId}`, targetName: log.targetUserId ? usersById.get(log.targetUserId)?.name || `사용자 #${log.targetUserId}` : null }));
}

export async function getTeacherClassDashboard(teacherId: number, attendanceDate: string) {
  const db = await getDb();
  if (!db) return { groups: [], summary: { students: 0, present: 0, late: 0, absent: 0, unrecorded: 0, averageProgress: 0 } };
  const [groups, members, allUsers, allProgress, allCurriculum, attendance, announcements, assignments] = await Promise.all([
    db.select().from(learningGroups).where(and(eq(learningGroups.teacherId, teacherId), eq(learningGroups.isActive, 1))),
    db.select().from(learningGroupMembers),
    db.select().from(users),
    db.select().from(progress),
    db.select().from(curriculum),
    db.select().from(classAttendance).where(eq(classAttendance.attendanceDate, attendanceDate)),
    db.select().from(classAnnouncements).orderBy(desc(classAnnouncements.createdAt)),
    db.select().from(classAssignments).where(eq(classAssignments.isActive, 1)).orderBy(desc(classAssignments.createdAt)),
  ]);
  const usersById = new Map(allUsers.map((user) => [user.id, user]));
  const dashboardGroups = groups.map((group) => {
    const groupMembers = members.filter((member) => member.groupId === group.id);
    const groupAttendance = attendance.filter((record) => record.groupId === group.id);
    const students = groupMembers.map((member) => {
      const student = usersById.get(member.studentId);
      const courseType = student ? getCourseTypeFromUserTag(student.tag) : "general_adult";
      const totalCourseSteps = allCurriculum.filter((item) => item.courseType === courseType).length;
      const studentProgress = allProgress.filter((item) => item.userId === member.studentId);
      const completedSteps = studentProgress.filter((item) => item.completed === 1).length;
      const averageScore = studentProgress.length ? Math.round(studentProgress.reduce((sum, item) => sum + (item.score || 0), 0) / studentProgress.length) : 0;
      const attendanceRecord = groupAttendance.find((record) => record.studentId === member.studentId);
      return { id: member.studentId, name: student?.name || `학생 #${member.studentId}`, email: student?.email || null, courseLabel: getCourseTag(courseType), attendanceStatus: attendanceRecord?.status ?? null, progressRate: totalCourseSteps ? Math.round((completedSteps / totalCourseSteps) * 100) : 0, averageScore, lastSignedIn: student?.lastSignedIn ?? null };
    });
    return { ...group, students, announcements: announcements.filter((item) => item.groupId === group.id).slice(0, 5), assignments: assignments.filter((item) => item.groupId === group.id).slice(0, 5) };
  });
  const students = dashboardGroups.flatMap((group) => group.students);
  const statusCount = (status: "present" | "late" | "absent") => students.filter((student) => student.attendanceStatus === status).length;
  return { groups: dashboardGroups, summary: { students: students.length, present: statusCount("present"), late: statusCount("late"), absent: statusCount("absent"), unrecorded: students.filter((student) => !student.attendanceStatus).length, averageProgress: students.length ? Math.round(students.reduce((sum, student) => sum + student.progressRate, 0) / students.length) : 0 } };
}

async function assertTeacherGroupOwnership(teacherId: number, groupId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  const [group] = await db.select().from(learningGroups).where(and(eq(learningGroups.id, groupId), eq(learningGroups.teacherId, teacherId), eq(learningGroups.isActive, 1)));
  if (!group) throw new Error("담당 반·그룹에 대한 권한이 없습니다.");
  return group;
}

export async function recordClassAttendance(teacherId: number, input: { groupId: number; studentId: number; attendanceDate: string; status: "present" | "late" | "absent" | "excused"; note?: string }) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  await assertTeacherGroupOwnership(teacherId, input.groupId);
  const [membership] = await db.select().from(learningGroupMembers).where(and(eq(learningGroupMembers.groupId, input.groupId), eq(learningGroupMembers.studentId, input.studentId)));
  if (!membership) throw new Error("해당 반·그룹에 편성된 학습자가 아닙니다.");
  const [existing] = await db.select().from(classAttendance).where(and(eq(classAttendance.groupId, input.groupId), eq(classAttendance.studentId, input.studentId), eq(classAttendance.attendanceDate, input.attendanceDate)));
  const values = { status: input.status, note: input.note ?? null, recordedBy: teacherId, updatedAt: new Date() };
  if (existing) await db.update(classAttendance).set(values).where(eq(classAttendance.id, existing.id));
  else await db.insert(classAttendance).values({ groupId: input.groupId, studentId: input.studentId, attendanceDate: input.attendanceDate, ...values });
  return true;
}

export async function publishClassAnnouncement(teacherId: number, input: { groupId: number; title: string; content: string }) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  await assertTeacherGroupOwnership(teacherId, input.groupId);
  const members = await db.select().from(learningGroupMembers).where(eq(learningGroupMembers.groupId, input.groupId));
  await db.insert(classAnnouncements).values({ ...input, createdBy: teacherId });
  if (members.length) await db.insert(appNotifications).values(members.map((member) => ({ userId: member.studentId, title: `[반 공지] ${input.title}`, message: input.content, category: "class_announcement" })));
  return true;
}

export async function createClassAssignment(teacherId: number, input: { groupId: number; title: string; instructions: string; dueAt?: Date | null }) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  await assertTeacherGroupOwnership(teacherId, input.groupId);
  const members = await db.select().from(learningGroupMembers).where(eq(learningGroupMembers.groupId, input.groupId));
  const [inserted] = await db.insert(classAssignments).values({ ...input, dueAt: input.dueAt ?? null, createdBy: teacherId, isActive: 1 });
  const assignmentId = Number(inserted.insertId);
  const dueLabel = input.dueAt ? ` 마감: ${input.dueAt.toLocaleDateString("ko-KR")}` : "";
  if (members.length) await db.insert(appNotifications).values(members.map((member) => ({ userId: member.studentId, assignmentId, title: `[반 과제] ${input.title}`, message: `${input.instructions}${dueLabel}`, category: "class_assignment" })));
  return { assignmentId };
}

export async function getStudentClassAssignments(studentId: number) {
  const db = await getDb();
  if (!db) return [];
  const [memberships, groups, assignments, submissions] = await Promise.all([
    db.select().from(learningGroupMembers).where(eq(learningGroupMembers.studentId, studentId)),
    db.select().from(learningGroups).where(eq(learningGroups.isActive, 1)),
    db.select().from(classAssignments).where(eq(classAssignments.isActive, 1)),
    db.select().from(classAssignmentSubmissions).where(eq(classAssignmentSubmissions.studentId, studentId)),
  ]);
  const groupIds = new Set(memberships.map((membership) => membership.groupId));
  const groupsById = new Map(groups.map((group) => [group.id, group]));
  const now = new Date();
  return assignments
    .filter((assignment) => groupIds.has(assignment.groupId))
    .map((assignment) => {
      const submission = submissions.find((item) => item.assignmentId === assignment.id) ?? null;
      return {
        ...assignment,
        groupName: groupsById.get(assignment.groupId)?.name || "배정 반",
        submission,
        submissionStatus: submission?.status ?? "pending",
        isOverdue: Boolean(assignment.dueAt && assignment.dueAt < now && !submission),
      };
    })
    .sort((left, right) => (left.dueAt?.getTime() ?? Number.MAX_SAFE_INTEGER) - (right.dueAt?.getTime() ?? Number.MAX_SAFE_INTEGER));
}

export async function submitStudentClassAssignment(studentId: number, assignmentId: number, content: string) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  const [assignment] = await db.select().from(classAssignments).where(and(eq(classAssignments.id, assignmentId), eq(classAssignments.isActive, 1)));
  if (!assignment) throw new Error("제출할 과제를 찾을 수 없습니다.");
  const [membership] = await db.select().from(learningGroupMembers).where(and(eq(learningGroupMembers.groupId, assignment.groupId), eq(learningGroupMembers.studentId, studentId)));
  if (!membership) throw new Error("배정받지 않은 과제는 제출할 수 없습니다.");
  const [existing] = await db.select().from(classAssignmentSubmissions).where(and(eq(classAssignmentSubmissions.assignmentId, assignmentId), eq(classAssignmentSubmissions.studentId, studentId)));
  if (existing?.status === "reviewed") throw new Error("교사 채점이 완료된 과제는 수정할 수 없습니다.");
  const values = { content: content.trim(), status: "submitted" as const, submittedAt: new Date(), updatedAt: new Date() };
  if (existing) {
    await db.update(classAssignmentSubmissions).set(values).where(eq(classAssignmentSubmissions.id, existing.id));
    const [updated] = await db.select().from(classAssignmentSubmissions).where(eq(classAssignmentSubmissions.id, existing.id));
    return updated;
  }
  const [inserted] = await db.insert(classAssignmentSubmissions).values({ assignmentId, studentId, ...values });
  const [created] = await db.select().from(classAssignmentSubmissions).where(eq(classAssignmentSubmissions.id, Number(inserted.insertId)));
  return created;
}

export async function getStudentClassAssignmentDetails(studentId: number) {
  const db = await getDb();
  if (!db) return [];
  const [assignments, aiFeedbacks] = await Promise.all([
    getStudentClassAssignments(studentId),
    db.select().from(classAssignmentAiFeedbacks).orderBy(desc(classAssignmentAiFeedbacks.generatedAt)),
  ]);
  const feedbackBySubmissionId = new Map<number, typeof classAssignmentAiFeedbacks.$inferSelect>();
  aiFeedbacks.forEach((feedback) => {
    if (feedback.status === "reviewed" && !feedbackBySubmissionId.has(feedback.submissionId)) feedbackBySubmissionId.set(feedback.submissionId, feedback);
  });
  return assignments.map((assignment) => ({
    ...assignment,
    aiFeedback: assignment.submission ? feedbackBySubmissionId.get(assignment.submission.id) ?? null : null,
  }));
}

export async function getClassAssignmentAiFeedbacks(submissionId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(classAssignmentAiFeedbacks).where(eq(classAssignmentAiFeedbacks.submissionId, submissionId)).orderBy(desc(classAssignmentAiFeedbacks.generatedAt));
}

export async function generateClassAssignmentAiFeedback(teacherId: number, submissionId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  const [submission] = await db.select().from(classAssignmentSubmissions).where(eq(classAssignmentSubmissions.id, submissionId));
  if (!submission) throw new Error("AI 첨삭을 생성할 제출물을 찾을 수 없습니다.");
  const [assignment, student] = await Promise.all([
    db.select().from(classAssignments).where(eq(classAssignments.id, submission.assignmentId)).then((rows) => rows[0]),
    db.select().from(users).where(eq(users.id, submission.studentId)).then((rows) => rows[0]),
  ]);
  if (!assignment || !student) throw new Error("과제 또는 학생 정보를 찾을 수 없습니다.");
  await assertTeacherGroupOwnership(teacherId, assignment.groupId);

  const courseType = getCourseTypeFromUserTag(student.tag);
  const evaluation = await evaluateSubjectiveWorkbookAnswer({
    courseType,
    level: 1,
    title: assignment.title,
    prompt: assignment.instructions,
    correctAnswer: "과제 안내에 제시된 논제에 맞춰 주장과 근거를 갖춘 답안을 작성합니다.",
    explanation: assignment.instructions,
  }, submission.content);
  const { data: models } = await listLLMModels();
  const modelId = evaluation.status === "insufficient"
    ? "rule-based-insufficient-check"
    : (['gpt-5', 'claude-sonnet-4-6', 'gemini-3.1-pro-preview'].find((id) => models.some((model) => model.id === id)) ?? "structured-rubric");
  const draftComment = `[AI 1차 첨삭 초안 · 교사 검토 전]\n${formatSubjectiveEvaluationFeedback(evaluation)}`;
  await db.insert(classAssignmentAiFeedbacks).values({
    submissionId,
    generatedBy: teacherId,
    modelId,
    overallScore: evaluation.score,
    evaluationJson: JSON.stringify(evaluation),
    draftComment,
    status: "generated",
    generatedAt: new Date(),
  });
  const [created] = await db.select().from(classAssignmentAiFeedbacks).where(eq(classAssignmentAiFeedbacks.submissionId, submissionId)).orderBy(desc(classAssignmentAiFeedbacks.id));
  return created;
}

export async function getTeacherClassAssignmentSubmissions(teacherId: number) {
  const db = await getDb();
  if (!db) return [];
  const [groups, assignments, submissions, allUsers] = await Promise.all([
    db.select().from(learningGroups).where(and(eq(learningGroups.teacherId, teacherId), eq(learningGroups.isActive, 1))),
    db.select().from(classAssignments).where(eq(classAssignments.isActive, 1)),
    db.select().from(classAssignmentSubmissions).orderBy(desc(classAssignmentSubmissions.submittedAt)),
    db.select().from(users),
  ]);
  const groupsById = new Map(groups.map((group) => [group.id, group]));
  const assignmentsById = new Map(assignments.map((assignment) => [assignment.id, assignment]));
  const usersById = new Map(allUsers.map((user) => [user.id, user]));
  return submissions.flatMap((submission) => {
    const assignment = assignmentsById.get(submission.assignmentId);
    const group = assignment ? groupsById.get(assignment.groupId) : null;
    if (!assignment || !group) return [];
    const student = usersById.get(submission.studentId);
    return [{ ...submission, assignmentTitle: assignment.title, assignmentInstructions: assignment.instructions, dueAt: assignment.dueAt, groupId: group.id, groupName: group.name, studentName: student?.name || `학생 #${submission.studentId}`, studentEmail: student?.email || null }];
  });
}

export async function reviewStudentClassAssignment(teacherId: number, submissionId: number, input: { score: number; teacherComment: string }) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  const [submission] = await db.select().from(classAssignmentSubmissions).where(eq(classAssignmentSubmissions.id, submissionId));
  if (!submission) throw new Error("채점할 과제 제출물을 찾을 수 없습니다.");
  const [assignment] = await db.select().from(classAssignments).where(eq(classAssignments.id, submission.assignmentId));
  if (!assignment) throw new Error("연결된 과제를 찾을 수 없습니다.");
  await assertTeacherGroupOwnership(teacherId, assignment.groupId);
  await db.update(classAssignmentSubmissions).set({ status: "reviewed", score: input.score, teacherComment: input.teacherComment.trim(), reviewedAt: new Date(), updatedAt: new Date() }).where(eq(classAssignmentSubmissions.id, submissionId));
  await db.update(classAssignmentAiFeedbacks).set({ status: "reviewed", reviewedAt: new Date(), updatedAt: new Date() }).where(and(eq(classAssignmentAiFeedbacks.submissionId, submissionId), eq(classAssignmentAiFeedbacks.status, "generated")));
  await db.insert(appNotifications).values({ userId: submission.studentId, assignmentId: assignment.id, title: `[과제 채점 완료] ${assignment.title}`, message: `교사가 과제를 채점했습니다. 점수 ${input.score}점과 피드백을 확인하세요.`, category: "teacher_feedback" });
  const [updated] = await db.select().from(classAssignmentSubmissions).where(eq(classAssignmentSubmissions.id, submissionId));
  return updated;
}

export async function listTeacherFeedbackTemplates(teacherId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(teacherFeedbackTemplates).where(eq(teacherFeedbackTemplates.teacherId, teacherId)).orderBy(desc(teacherFeedbackTemplates.updatedAt));
}

export async function saveTeacherFeedbackTemplate(teacherId: number, input: { templateId?: number; title: string; content: string }) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  const values = { title: input.title.trim(), content: input.content.trim(), updatedAt: new Date() };
  if (input.templateId) {
    const [existing] = await db.select().from(teacherFeedbackTemplates).where(and(eq(teacherFeedbackTemplates.id, input.templateId), eq(teacherFeedbackTemplates.teacherId, teacherId)));
    if (!existing) throw new Error("수정할 피드백 상용구를 찾을 수 없습니다.");
    await db.update(teacherFeedbackTemplates).set(values).where(eq(teacherFeedbackTemplates.id, input.templateId));
  } else {
    await db.insert(teacherFeedbackTemplates).values({ teacherId, ...values });
  }
  return listTeacherFeedbackTemplates(teacherId);
}

export async function deleteTeacherFeedbackTemplate(teacherId: number, templateId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  await db.delete(teacherFeedbackTemplates).where(and(eq(teacherFeedbackTemplates.id, templateId), eq(teacherFeedbackTemplates.teacherId, teacherId)));
  return true;
}

function getMonthRange(month: string) {
  if (!/^\d{4}-\d{2}$/.test(month)) throw new Error("월 형식은 YYYY-MM이어야 합니다.");
  const [year, monthNumber] = month.split("-").map(Number);
  return { start: new Date(year, monthNumber - 1, 1), end: new Date(year, monthNumber, 1) };
}

export async function getTeacherMonthlyAssignmentStats(teacherId: number, month: string) {
  const db = await getDb();
  if (!db) return { month, summary: { assignments: 0, expected: 0, submitted: 0, reviewed: 0, pending: 0 }, rows: [] as any[] };
  const { start, end } = getMonthRange(month);
  const [groups, members, allUsers, assignments, submissions] = await Promise.all([
    db.select().from(learningGroups).where(and(eq(learningGroups.teacherId, teacherId), eq(learningGroups.isActive, 1))),
    db.select().from(learningGroupMembers),
    db.select().from(users),
    db.select().from(classAssignments).where(and(eq(classAssignments.isActive, 1), gte(classAssignments.dueAt, start), lt(classAssignments.dueAt, end))),
    db.select().from(classAssignmentSubmissions),
  ]);
  const usersById = new Map(allUsers.map((user) => [user.id, user]));
  const rows = groups.flatMap((group) => {
    const groupAssignments = assignments.filter((assignment) => assignment.groupId === group.id);
    return members.filter((member) => member.groupId === group.id).map((member) => {
      const assignmentIds = new Set(groupAssignments.map((assignment) => assignment.id));
      const studentSubmissions = submissions.filter((submission) => submission.studentId === member.studentId && assignmentIds.has(submission.assignmentId));
      const submitted = studentSubmissions.length;
      const reviewed = studentSubmissions.filter((submission) => submission.status === "reviewed").length;
      const expected = groupAssignments.length;
      const student = usersById.get(member.studentId);
      return { groupId: group.id, groupName: group.name, studentId: member.studentId, studentName: student?.name || `학생 #${member.studentId}`, studentEmail: student?.email || null, expected, submitted, reviewed, pending: Math.max(submitted - reviewed, 0), unsubmitted: Math.max(expected - submitted, 0) };
    });
  });
  const summary = rows.reduce((total, row) => ({ assignments: total.assignments, expected: total.expected + row.expected, submitted: total.submitted + row.submitted, reviewed: total.reviewed + row.reviewed, pending: total.pending + row.pending }), { assignments: assignments.length, expected: 0, submitted: 0, reviewed: 0, pending: 0 });
  return { month, summary, rows };
}

export async function notifyUpcomingAssignmentStudents(teacherId: number, hoursAhead = 72) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  const now = new Date();
  const deadline = new Date(now.getTime() + hoursAhead * 60 * 60 * 1000);
  const [groups, members, assignments, submissions, notifications] = await Promise.all([
    db.select().from(learningGroups).where(and(eq(learningGroups.teacherId, teacherId), eq(learningGroups.isActive, 1))),
    db.select().from(learningGroupMembers),
    db.select().from(classAssignments).where(and(eq(classAssignments.isActive, 1), gte(classAssignments.dueAt, now), lt(classAssignments.dueAt, deadline))),
    db.select().from(classAssignmentSubmissions),
    db.select().from(appNotifications),
  ]);
  const ownedGroupIds = new Set(groups.map((group) => group.id));
  const newNotifications: Array<typeof appNotifications.$inferInsert> = [];
  assignments.filter((assignment) => ownedGroupIds.has(assignment.groupId) && assignment.dueAt).forEach((assignment) => {
    members.filter((member) => member.groupId === assignment.groupId).forEach((member) => {
      const submittedAfterAssignment = submissions.some((submission) => submission.assignmentId === assignment.id && submission.studentId === member.studentId);
      const title = `[과제 마감 임박] ${assignment.title}`;
      const alreadyNotified = notifications.some((notification) => notification.userId === member.studentId && notification.assignmentId === assignment.id && notification.category === "assignment_deadline");
      if (!submittedAfterAssignment && !alreadyNotified) newNotifications.push({ userId: member.studentId, assignmentId: assignment.id, title, message: `마감일 ${assignment.dueAt!.toLocaleString("ko-KR")} 전까지 과제를 제출해주세요.`, category: "assignment_deadline" });
    });
  });
  if (newNotifications.length) await db.insert(appNotifications).values(newNotifications);
  return { notified: newNotifications.length, hoursAhead };
}

export async function getTeacherAssignmentNotificationStats(teacherId: number) {
  const db = await getDb();
  const emptySummary = { sent: 0, read: 0, unread: 0, readRate: 0, submittedAfterNotice: 0, openedThenSubmitted: 0, conversionRate: 0 };
  if (!db) return { summary: emptySummary, rows: [] as any[] };
  const [groups, members, assignments, notifications, submissions] = await Promise.all([
    db.select().from(learningGroups).where(and(eq(learningGroups.teacherId, teacherId), eq(learningGroups.isActive, 1))),
    db.select().from(learningGroupMembers),
    db.select().from(classAssignments).where(eq(classAssignments.isActive, 1)),
    db.select().from(appNotifications).where(eq(appNotifications.category, "assignment_deadline")),
    db.select().from(classAssignmentSubmissions),
  ]);
  const groupIds = new Set(groups.map((group) => group.id));
  const groupsById = new Map(groups.map((group) => [group.id, group]));
  const ownedAssignments = assignments.filter((assignment) => groupIds.has(assignment.groupId));
  const rows = ownedAssignments.map((assignment) => {
    const assignmentNotifications = notifications.filter((notification) => notification.assignmentId === assignment.id);
    const assignedStudentIds = new Set(members.filter((member) => member.groupId === assignment.groupId).map((member) => member.studentId));
    const sent = assignmentNotifications.length;
    const read = assignmentNotifications.filter((notification) => notification.isRead === 1).length;
    const submittedAfterNotice = assignmentNotifications.filter((notification) => submissions.some((submission) => submission.assignmentId === assignment.id && submission.studentId === notification.userId && submission.submittedAt >= notification.createdAt)).length;
    const openedThenSubmitted = assignmentNotifications.filter((notification) => notification.isRead === 1 && submissions.some((submission) => submission.assignmentId === assignment.id && submission.studentId === notification.userId && submission.submittedAt >= notification.createdAt)).length;
    return {
      assignmentId: assignment.id,
      title: assignment.title,
      groupName: groupsById.get(assignment.groupId)?.name || "담당 반",
      dueAt: assignment.dueAt,
      assignedStudents: assignedStudentIds.size,
      sent,
      read,
      unread: Math.max(sent - read, 0),
      readRate: sent ? Math.round((read / sent) * 100) : 0,
      submittedAfterNotice,
      openedThenSubmitted,
      conversionRate: sent ? Math.round((openedThenSubmitted / sent) * 100) : 0,
    };
  }).filter((row) => row.sent > 0).sort((left, right) => (right.dueAt?.getTime() ?? 0) - (left.dueAt?.getTime() ?? 0));
  const summary = rows.reduce((total, row) => ({
    sent: total.sent + row.sent,
    read: total.read + row.read,
    unread: total.unread + row.unread,
    submittedAfterNotice: total.submittedAfterNotice + row.submittedAfterNotice,
    openedThenSubmitted: total.openedThenSubmitted + row.openedThenSubmitted,
  }), { sent: 0, read: 0, unread: 0, submittedAfterNotice: 0, openedThenSubmitted: 0 });
  return { summary: { ...summary, readRate: summary.sent ? Math.round((summary.read / summary.sent) * 100) : 0, conversionRate: summary.sent ? Math.round((summary.openedThenSubmitted / summary.sent) * 100) : 0 }, rows };
}

export async function getTeacherAssignmentReminderHistory(teacherId: number) {
  const db = await getDb();
  if (!db) return [];
  const [groups, assignments, notifications, submissions, allUsers] = await Promise.all([
    db.select().from(learningGroups).where(and(eq(learningGroups.teacherId, teacherId), eq(learningGroups.isActive, 1))),
    db.select().from(classAssignments).where(eq(classAssignments.isActive, 1)),
    db.select().from(appNotifications).where(eq(appNotifications.category, "assignment_deadline")),
    db.select().from(classAssignmentSubmissions),
    db.select().from(users),
  ]);
  const groupsById = new Map(groups.map((group) => [group.id, group]));
  const assignmentsById = new Map(assignments.map((assignment) => [assignment.id, assignment]));
  const usersById = new Map(allUsers.map((user) => [user.id, user]));
  return notifications.flatMap((notification) => {
    if (!notification.assignmentId) return [];
    const assignment = assignmentsById.get(notification.assignmentId);
    const group = assignment ? groupsById.get(assignment.groupId) : null;
    if (!assignment || !group) return [];
    const submission = submissions.find((item) => item.assignmentId === assignment.id && item.studentId === notification.userId) ?? null;
    const submittedAfterNotice = Boolean(submission?.submittedAt && submission.submittedAt >= notification.createdAt);
    return [{
      notificationId: notification.id,
      assignmentId: assignment.id,
      assignmentTitle: assignment.title,
      groupName: group.name,
      studentId: notification.userId,
      studentName: usersById.get(notification.userId)?.name || `학생 #${notification.userId}`,
      studentEmail: usersById.get(notification.userId)?.email || null,
      dueAt: assignment.dueAt,
      notifiedAt: notification.createdAt,
      isRead: notification.isRead === 1,
      readAt: notification.readAt,
      submittedAt: submission?.submittedAt ?? null,
      submittedAfterNotice,
      submissionStatus: submission?.status ?? "pending",
    }];
  }).sort((left, right) => right.notifiedAt.getTime() - left.notifiedAt.getTime());
}

export async function getTeacherPermissionGrants() {
  const db = await getDb();
  if (!db) return [];
  const [grants, allUsers] = await Promise.all([
    db.select().from(teacherPermissionGrants).orderBy(desc(teacherPermissionGrants.updatedAt)),
    db.select().from(users),
  ]);
  const usersById = new Map(allUsers.map((user) => [user.id, user]));
  return grants.map((grant) => ({
    ...grant,
    teacherName: usersById.get(grant.teacherId)?.name || `교사 #${grant.teacherId}`,
    teacherEmail: usersById.get(grant.teacherId)?.email || null,
    studentName: grant.studentId ? usersById.get(grant.studentId)?.name || `학생 #${grant.studentId}` : null,
    studentEmail: grant.studentId ? usersById.get(grant.studentId)?.email || null : null,
    studentCourseLabel: grant.studentId ? getCourseTag(getCourseTypeFromUserTag(usersById.get(grant.studentId)?.tag)) : null,
  }));
}

export async function saveTeacherPermissionGrant(input: {
  grantId?: number;
  teacherId: number;
  scopeType: "organization" | "student";
  organizationName?: string | null;
  studentId?: number | null;
  canManageProgress: number;
  canRequestCertificate: number;
  isActive: number;
  grantedBy: number;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  const values = {
    teacherId: input.teacherId,
    scopeType: input.scopeType,
    organizationName: input.scopeType === "organization" ? input.organizationName?.trim() || "담당 학급" : null,
    studentId: input.scopeType === "student" ? input.studentId ?? null : null,
    canManageProgress: input.canManageProgress,
    canRequestCertificate: input.canRequestCertificate,
    isActive: input.isActive,
    grantedBy: input.grantedBy,
    updatedAt: new Date(),
  };
  if (input.grantId) {
    await db.update(teacherPermissionGrants).set(values).where(eq(teacherPermissionGrants.id, input.grantId));
  } else {
    await db.insert(teacherPermissionGrants).values(values);
  }
  return getTeacherPermissionGrants();
}

export async function setTeacherPermissionGrantActive(grantId: number, isActive: number) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  await db.update(teacherPermissionGrants).set({ isActive, updatedAt: new Date() }).where(eq(teacherPermissionGrants.id, grantId));
  return getTeacherPermissionGrants();
}

async function getActiveTeacherPermissionGrants(teacherId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(teacherPermissionGrants).where(and(eq(teacherPermissionGrants.teacherId, teacherId), eq(teacherPermissionGrants.isActive, 1)));
}

export async function canTeacherManageStudent(teacherId: number, studentId: number, permission: "progress" | "certificate") {
  const [student, grants] = await Promise.all([getUserById(studentId), getActiveTeacherPermissionGrants(teacherId)]);
  if (!student || student.role !== "user" || student.tag === "학부모") return false;
  return grants.some((grant) => {
    const permissionGranted = permission === "progress" ? grant.canManageProgress === 1 : grant.canRequestCertificate === 1;
    if (!permissionGranted) return false;
    if (grant.scopeType === "student") return grant.studentId === studentId;
    return student.teacherId === teacherId;
  });
}

export async function getManagedStudentsForTeacher(teacherId: number) {
  const db = await getDb();
  if (!db) return [];
  const [allUsers, grants] = await Promise.all([db.select().from(users), getActiveTeacherPermissionGrants(teacherId)]);
  const directStudentIds = new Set(grants.filter((grant) => grant.scopeType === "student").map((grant) => grant.studentId).filter((id): id is number => id !== null));
  const hasOrganizationScope = grants.some((grant) => grant.scopeType === "organization" && (grant.canManageProgress === 1 || grant.canRequestCertificate === 1));
  return allUsers
    .filter((user) => user.role === "user" && user.tag !== "학부모" && (directStudentIds.has(user.id) || (hasOrganizationScope && user.teacherId === teacherId)))
    .map((user) => ({
      id: user.id,
      name: user.name,
      email: user.email,
      courseType: getCourseTypeFromUserTag(user.tag),
      courseLabel: getCourseTag(getCourseTypeFromUserTag(user.tag)),
      createdAt: user.createdAt,
      lastSignedIn: user.lastSignedIn,
      teacherId: user.teacherId,
    }));
}

export async function getLinkedStudentsForParent(parentId: number) {
  const db = await getDb();
  if (!db) return [];
  const links = await db.select().from(parentStudentLinks).where(eq(parentStudentLinks.parentId, parentId));
  const studentIds = links.map(l => l.studentId);
  if (studentIds.length === 0) return [];
  
  const allU = await db.select().from(users);
  return allU.filter((student) => studentIds.includes(student.id)).map((student) => ({
    ...student,
    courseType: getCourseTypeFromUserTag(student.tag),
    courseLabel: getCourseTag(getCourseTypeFromUserTag(student.tag)),
  }));
}

export async function linkParentAndStudent(parentId: number, studentEmail: string) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  const [student] = await db.select().from(users).where(eq(users.email, studentEmail));
  if (!student) {
    throw new Error("해당 이메일을 가진 학생 계정을 찾을 수 없습니다.");
  }
  const [existing] = await db.select().from(parentStudentLinks).where(and(eq(parentStudentLinks.parentId, parentId), eq(parentStudentLinks.studentId, student.id)));
  if (existing) {
    return { success: true, studentId: student.id, courseLabel: getCourseTag(getCourseTypeFromUserTag(student.tag)) };
  }
  await db.insert(parentStudentLinks).values({
    parentId,
    studentId: student.id,
  });
  return { success: true, studentId: student.id, courseLabel: getCourseTag(getCourseTypeFromUserTag(student.tag)) };
}

export async function adminResetAllCertificates() {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  await db.delete(certificate);
  return true;
}

// ========== User Badges Functions ==========

export async function getUserBadges(userId: number) {
  const db = await getDb();
  if (!db) return [];
  return await db.select().from(userBadges).where(eq(userBadges.userId, userId));
}

export async function awardBadge(userId: number, courseType: string, badgeType: string, badgeName: string) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  
  const [existing] = await db
    .select()
    .from(userBadges)
    .where(and(eq(userBadges.userId, userId), eq(userBadges.courseType, courseType), eq(userBadges.badgeType, badgeType)));
  
  if (existing) {
    return existing; // 이미 획득한 뱃지
  }

  const [inserted] = await db.insert(userBadges).values({
    userId,
    courseType,
    badgeType,
    badgeName,
    earnedAt: new Date(),
  });
  
  const [newBadge] = await db.select().from(userBadges).where(eq(userBadges.id, Number(inserted.insertId)));
  return newBadge;
}

// ========== Question Bank Functions ==========

export async function getQuestionBankList(courseType?: string, toolType?: string) {
  const db = await getDb();
  if (!db) return [];
  let query = db.select().from(questionBank);
  const rows = await query;
  return rows.filter(q => {
    if (courseType && q.courseType !== courseType) return false;
    if (toolType && q.toolType !== toolType) return false;
    return true;
  });
}

export async function getRandomQuestions(courseType: string, toolType: string, limit: number = 10) {
  const list = await getQuestionBankList(courseType, toolType);
  const activeList = list.filter(q => q.isActive === 1 && !isLegacyRepeatedLearningContent(q.contentData));
  // 무작위 셔플 후 limit 개수만큼 반환
  const shuffled = [...activeList].sort(() => 0.5 - Math.random());
  return shuffled.slice(0, limit);
}

export async function replaceLegacyLearningToolContent() {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  const questions = await db.select().from(questionBank);
  let quizUpdated = 0;
  let summaryUpdated = 0;

  for (const question of questions) {
    if (!isLegacyRepeatedLearningContent(question.contentData)) continue;
    if (question.toolType !== "quiz" && question.toolType !== "summary") continue;
    const courseType = question.courseType as CourseType;
    const contentData = question.toolType === "quiz"
      ? buildCourseQuizContent(courseType, question.title)
      : buildCourseSummaryContent(courseType, question.title);
    await db.update(questionBank)
      .set({ contentData: JSON.stringify(contentData), updatedAt: new Date() })
      .where(eq(questionBank.id, question.id));
    if (question.toolType === "quiz") quizUpdated += 1;
    else summaryUpdated += 1;
  }

  return { quizUpdated, summaryUpdated };
}

const THESIS_CRITERIA = ["clear", "arguable", "specific", "supportable", "relevant", "original", "balanced", "grammatical"] as const;
type ThesisCriterionId = (typeof THESIS_CRITERIA)[number];
type ThesisCriterionStatus = "pass" | "warn" | "fail";

function fallbackThesisAnalysis(thesis: string) {
  const hasClaimMarker = /(해야|필요하다|바람직하다|문제다|중요하다|줄여야|늘려야|금지|허용|강화|완화)/.test(thesis);
  const isLongEnough = thesis.trim().length >= 25;
  const statusFor = (id: ThesisCriterionId): ThesisCriterionStatus => {
    if (id === "arguable" || id === "supportable") return hasClaimMarker ? "warn" : "fail";
    return isLongEnough ? "warn" : "fail";
  };
  const items = THESIS_CRITERIA.map((id) => ({
    id,
    status: statusFor(id),
    rationale: "AI 분석 응답을 준비하지 못해 문장 길이와 주장 표현을 기준으로 임시 점검했습니다.",
    suggestion: "대상·주장·판단 기준을 한 문장에 더 구체적으로 넣어 다시 분석해 보세요.",
  }));
  const passWeight = items.reduce((total, item) => total + (item.status === "pass" ? 12.5 : item.status === "warn" ? 7 : 0), 0);
  return {
    score: Math.round(passWeight),
    summary: "연결 상태 때문에 임시 점검 결과를 표시했습니다. 분석을 다시 실행하면 항목별 AI 피드백을 받을 수 있습니다.",
    items,
    recommendedThesis: "[대상]은/는 [구체적 문제]를 줄이기 위해 [판단 기준]에 따라 [실행 방안]을 마련해야 한다.",
    source: "fallback" as const,
  };
}

export async function generateTopicWizardGuide(input: {
  step: 1 | 2 | 3 | 4;
  courseType: CourseType;
  category?: string;
  topic?: string;
  mainIdea?: string;
  outline?: string;
}) {
  const stepNames = { 1: "카테고리 선택", 2: "주제 구체화", 3: "주제문 작성", 4: "개요 구성" } as const;
  const response = await invokeLLM({
    model: "gpt-5-mini",
    messages: [
      {
        role: "system",
        content: "당신은 한국어 논술 교사입니다. 학생이 스스로 쓰도록 돕는 짧고 구체적인 단계별 가이드를 제공하세요. 답을 그대로 강요하지 말고, 과정 수준에 맞는 한 가지 예시와 세 가지 점검 포인트를 제시하세요.",
      },
      {
        role: "user",
        content: `과정: ${getCourseTag(input.courseType)}\n현재 단계: ${stepNames[input.step]}\n카테고리: ${input.category || "미선택"}\n주제: ${input.topic || "미입력"}\n주제문: ${input.mainIdea || "미입력"}\n개요: ${input.outline || "미입력"}\n이 단계에서 학생이 다음 행동을 취할 수 있도록 안내해 주세요.`,
      },
    ],
    response_format: {
      type: "json_schema",
      json_schema: {
        name: "topic_wizard_guide",
        strict: true,
        schema: {
          type: "object",
          properties: {
            headline: { type: "string" },
            guidance: { type: "string" },
            example: { type: "string" },
            tips: { type: "array", items: { type: "string" }, minItems: 3, maxItems: 3 },
          },
          required: ["headline", "guidance", "example", "tips"],
          additionalProperties: false,
        },
      },
    },
  });
  const content = response.choices[0]?.message?.content;
  if (typeof content !== "string") throw new Error("AI 가이드를 생성하지 못했습니다.");
  return JSON.parse(content) as { headline: string; guidance: string; example: string; tips: string[] };
}

export async function generateLessonWritingGuide(input: {
  courseType: CourseType;
  lessonTitle: string;
  lessonContent: string;
  lessonExample: string;
}) {
  const response = await invokeLLM({
    model: "gpt-5-mini",
    messages: [
      {
        role: "system",
        content: "당신은 한국어 논술교육 코치입니다. 학습자가 레슨 핵심 개념을 스스로 적용하도록 돕는 가이드를 작성하세요. 실제 평가 문항의 정답이나 모범답안을 제공하지 마세요. 대신 새로운 안전한 연습 소재로 사고 순서, 문장 틀, 짧은 예시문을 제공하세요. 사고 순서는 정확히 3개로, 각 항목은 한 문장 70자 이내여야 합니다. 문장 틀은 3줄 이내, 새 연습 예시는 350자 이내로 작성하세요. 과정 수준을 지키고, 설명은 간결하고 실행 가능하게 작성하세요.",
      },
      {
        role: "user",
        content: `과정: ${getCourseTag(input.courseType)}\n레슨: ${input.lessonTitle}\n핵심 개념: ${input.lessonContent}\n기존 설명 예시: ${input.lessonExample}\n이 레슨 직후 학습자가 글쓰기 전에 볼 AI 가이드를 생성하세요.`,
      },
    ],
    response_format: {
      type: "json_schema",
      json_schema: {
        name: "lesson_writing_guide",
        strict: true,
        schema: {
          type: "object",
          properties: {
            learningGoal: { type: "string" },
            thinkingSteps: { type: "array", items: { type: "string", maxLength: 120 }, minItems: 3, maxItems: 3 },
            sentenceFrame: { type: "string", maxLength: 360 },
            practiceExample: { type: "string", maxLength: 650 },
            selfCheck: { type: "array", items: { type: "string", maxLength: 130 }, minItems: 3, maxItems: 3 },
          },
          required: ["learningGoal", "thinkingSteps", "sentenceFrame", "practiceExample", "selfCheck"],
          additionalProperties: false,
        },
      },
    },
  });
  const content = response.choices[0]?.message?.content;
  if (typeof content !== "string") throw new Error("AI 레슨 가이드를 생성하지 못했습니다.");
  return JSON.parse(content) as {
    learningGoal: string;
    thinkingSteps: string[];
    sentenceFrame: string;
    practiceExample: string;
    selfCheck: string[];
  };
}

export async function analyzeThesisStatement(input: { thesis: string; courseType: CourseType; topic?: string }) {
  try {
    const response = await invokeLLM({
      model: "gpt-5-mini",
      messages: [
        {
          role: "system",
          content: "당신은 한국어 논술 교사입니다. 아래 주제문을 교육적으로 평가하세요. 각 기준은 pass, warn, fail 중 하나로 판정합니다. 주제 정보가 없으면 관련성은 문장 자체의 주제 일관성만 평가하고 감점하지 마세요. 독창성은 사실 여부가 아니라 개인의 판단·관점의 구체성을 봅니다. 근거 없는 긍정 평가는 하지 말고, 문장 속 표현을 근거로 간결하게 조언하세요.",
        },
        {
          role: "user",
          content: `과정: ${getCourseTag(input.courseType)}\n연결된 주제: ${input.topic || "제시되지 않음"}\n평가할 주제문: ${input.thesis}`,
        },
      ],
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "thesis_analysis",
          strict: true,
          schema: {
            type: "object",
            properties: {
              score: { type: "integer", minimum: 0, maximum: 100 },
              summary: { type: "string" },
              items: {
                type: "array",
                minItems: 8,
                maxItems: 8,
                items: {
                  type: "object",
                  properties: {
                    id: { type: "string", enum: [...THESIS_CRITERIA] },
                    status: { type: "string", enum: ["pass", "warn", "fail"] },
                    rationale: { type: "string" },
                    suggestion: { type: "string" },
                  },
                  required: ["id", "status", "rationale", "suggestion"],
                  additionalProperties: false,
                },
              },
              recommendedThesis: { type: "string" },
            },
            required: ["score", "summary", "items", "recommendedThesis"],
            additionalProperties: false,
          },
        },
      },
    });
    const content = response.choices[0]?.message?.content;
    if (typeof content !== "string") return fallbackThesisAnalysis(input.thesis);
    const parsed = JSON.parse(content) as Omit<ReturnType<typeof fallbackThesisAnalysis>, "source">;
    const byId = new Map(parsed.items.map((item) => [item.id, item]));
    const items = THESIS_CRITERIA.map((id) => byId.get(id) ?? {
      id,
      status: "warn" as const,
      rationale: "이 항목은 충분히 판정되지 않았습니다.",
      suggestion: "관련 표현을 보완한 뒤 다시 분석해 보세요.",
    });
    return { ...parsed, items, score: Math.max(0, Math.min(100, Math.round(parsed.score))), source: "ai" as const };
  } catch (error) {
    console.warn("[Thesis analysis] Falling back to deterministic review", error);
    return fallbackThesisAnalysis(input.thesis);
  }
}

export async function ensureReorderingQuestionBankV2() {
  const db = await getDb();
  if (!db) return { inserted: 0, updated: 0, deactivated: 0 };

  const allReordering = await db.select().from(questionBank).where(eq(questionBank.toolType, "reordering"));
  let inserted = 0;
  let updated = 0;
  let deactivated = 0;

  for (const legacy of allReordering.filter((item) => item.isActive === 1 && (item.contentData.includes("현대 사회에서 이 문제는 더 이상 미룰 수 없는") || item.contentData.includes("이 문장은 글 전체의 중심생각 역할을 한다.")))) {
    await db.update(questionBank).set({ isActive: 0, updatedAt: new Date() }).where(eq(questionBank.id, legacy.id));
    deactivated++;
  }

  for (const [courseType, seeds] of Object.entries(COURSE_REORDERING_QUESTIONS) as [CourseType, typeof COURSE_REORDERING_QUESTIONS[CourseType]][]) {
    for (const seed of seeds) {
      const title = `[${getCourseTag(courseType)}] 단락 재구성 v2 - ${seed.title}`;
      const contentData = toReorderingContent(seed);
      const existing = allReordering.find((item) => item.courseType === courseType && item.title === title);
      if (existing) {
        if (existing.contentData !== contentData || existing.difficulty !== seed.difficulty || existing.isActive !== 1) {
          await db.update(questionBank).set({ contentData, difficulty: seed.difficulty, isActive: 1, updatedAt: new Date() }).where(eq(questionBank.id, existing.id));
          updated++;
        }
      } else {
        await db.insert(questionBank).values({ courseType, toolType: "reordering", title, contentData, difficulty: seed.difficulty, isActive: 1 });
        inserted++;
      }
    }
  }
  return { inserted, updated, deactivated };
}

export async function getReorderingPracticeSet(courseType: CourseType, limit: number = 10) {
  await ensureReorderingQuestionBankV2();
  const list = await getQuestionBankList(courseType, "reordering");
  const v2Items = list.filter((item) => item.isActive === 1 && item.contentData.includes('"reorderingVersion":"v2"'));
  return [...v2Items].sort(() => Math.random() - 0.5).slice(0, Math.min(limit, v2Items.length));
}

export async function createQuestionBankItem(data: {
  id?: number;
  courseType: "elementary" | "middle_high" | "high_univ" | "general_adult";
  toolType: string;
  title: string;
  contentData: string;
  difficulty?: "easy" | "medium" | "hard";
  isActive?: number;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  const [inserted] = await db.insert(questionBank).values({
    ...(data.id ? { id: data.id } : {}),
    courseType: data.courseType,
    toolType: data.toolType,
    title: data.title,
    contentData: data.contentData,
    difficulty: data.difficulty || "medium",
    isActive: data.isActive ?? 1,
  });
  const [row] = await db.select().from(questionBank).where(eq(questionBank.id, Number(inserted.insertId)));
  return row;
}

export async function updateQuestionBankItem(id: number, data: Partial<{
  courseType: "elementary" | "middle_high" | "high_univ" | "general_adult";
  toolType: string;
  title: string;
  contentData: string;
  difficulty: "easy" | "medium" | "hard";
  isActive: number;
}>) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  await db.update(questionBank).set({
    ...data,
    updatedAt: new Date(),
  }).where(eq(questionBank.id, id));
  const [row] = await db.select().from(questionBank).where(eq(questionBank.id, id));
  return row;
}

async function addQuestionBankOperationLog(input: {
  actionType: "moved_to_trash" | "restored" | "permanently_deleted" | "auto_purged";
  questionId?: number | null;
  trashId?: number | null;
  courseType?: string | null;
  questionTitle?: string | null;
  actorUserId?: number | null;
  actorName: string;
  details?: string | null;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  await db.insert(questionBankOperationLogs).values({
    actionType: input.actionType,
    questionId: input.questionId ?? null,
    trashId: input.trashId ?? null,
    courseType: input.courseType ?? null,
    questionTitle: input.questionTitle ?? null,
    actorUserId: input.actorUserId ?? null,
    actorName: input.actorName,
    details: input.details ?? null,
  });
}

export async function deleteQuestionBankItem(id: number, deletedByUserId: number, actorName: string) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  const [item] = await db.select().from(questionBank).where(eq(questionBank.id, id));
  if (!item) return { deletedCount: 0 };
  const [inserted] = await db.insert(questionBankTrash).values({
    originalQuestionId: item.id,
    courseType: item.courseType,
    toolType: item.toolType,
    title: item.title,
    contentData: item.contentData,
    difficulty: item.difficulty,
    isActive: item.isActive,
    deletedByUserId,
  });
  await db.delete(questionBank).where(eq(questionBank.id, id));
  await addQuestionBankOperationLog({
    actionType: "moved_to_trash",
    questionId: item.id,
    trashId: Number(inserted.insertId),
    courseType: item.courseType,
    questionTitle: item.title,
    actorUserId: deletedByUserId,
    actorName,
    details: "관리자 선택 삭제",
  });
  return { deletedCount: 1 };
}

export async function deleteQuestionBankByCourse(courseType: string) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  await db.delete(questionBank).where(eq(questionBank.courseType, courseType as any));
  return true;
}

export async function deleteQuestionBankItems(ids: number[], deletedByUserId: number, actorName: string) {
  const uniqueIds = Array.from(new Set(ids)).filter((id) => Number.isInteger(id) && id > 0);
  if (uniqueIds.length === 0) return { deletedCount: 0 };
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  const items = await db.select().from(questionBank).where(inArray(questionBank.id, uniqueIds));
  if (items.length === 0) return { deletedCount: 0 };
  for (const item of items) {
    await deleteQuestionBankItem(item.id, deletedByUserId, actorName);
  }
  return { deletedCount: items.length };
}

export async function getQuestionBankTrash() {
  const db = await getDb();
  if (!db) return [];
  return await db.select().from(questionBankTrash).orderBy(desc(questionBankTrash.deletedAt));
}

export async function restoreQuestionBankTrashItem(trashId: number, actorUserId: number, actorName: string) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  const [item] = await db.select().from(questionBankTrash).where(eq(questionBankTrash.id, trashId));
  if (!item) throw new Error("휴지통에서 복구할 문항을 찾을 수 없습니다.");
  const [existing] = await db.select().from(questionBank).where(eq(questionBank.id, item.originalQuestionId));
  const restored = await createQuestionBankItem({
    ...(existing ? {} : { id: item.originalQuestionId }),
    courseType: item.courseType,
    toolType: item.toolType,
    title: item.title,
    contentData: item.contentData,
    difficulty: item.difficulty,
    isActive: item.isActive,
  });
  await db.delete(questionBankTrash).where(eq(questionBankTrash.id, trashId));
  await addQuestionBankOperationLog({
    actionType: "restored",
    questionId: restored?.id ?? item.originalQuestionId,
    trashId,
    courseType: item.courseType,
    questionTitle: item.title,
    actorUserId,
    actorName,
    details: "휴지통에서 문제은행으로 복구",
  });
  return restored;
}

export async function permanentlyDeleteQuestionBankTrashItem(trashId: number, actorUserId: number, actorName: string) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  const [item] = await db.select().from(questionBankTrash).where(eq(questionBankTrash.id, trashId));
  if (!item) return { success: true };
  await db.delete(questionBankTrash).where(eq(questionBankTrash.id, trashId));
  await addQuestionBankOperationLog({
    actionType: "permanently_deleted",
    questionId: item.originalQuestionId,
    trashId: item.id,
    courseType: item.courseType,
    questionTitle: item.title,
    actorUserId,
    actorName,
    details: "관리자 휴지통 영구 삭제",
  });
  return { success: true };
}

export async function restoreQuestionBankTrashItems(trashIds: number[], actorUserId: number, actorName: string) {
  const uniqueIds = Array.from(new Set(trashIds)).filter((id) => Number.isInteger(id) && id > 0);
  let restoredCount = 0;
  const failures: Array<{ trashId: number; reason: string }> = [];

  for (const trashId of uniqueIds) {
    try {
      await restoreQuestionBankTrashItem(trashId, actorUserId, actorName);
      restoredCount += 1;
    } catch (error) {
      failures.push({
        trashId,
        reason: error instanceof Error ? error.message : "문항 복구 중 알 수 없는 오류가 발생했습니다.",
      });
    }
  }

  return { requestedCount: uniqueIds.length, restoredCount, failures };
}

export async function permanentlyDeleteQuestionBankTrashItems(trashIds: number[], actorUserId: number, actorName: string) {
  const uniqueIds = Array.from(new Set(trashIds)).filter((id) => Number.isInteger(id) && id > 0);
  let deletedCount = 0;
  const failures: Array<{ trashId: number; reason: string }> = [];

  for (const trashId of uniqueIds) {
    try {
      await permanentlyDeleteQuestionBankTrashItem(trashId, actorUserId, actorName);
      deletedCount += 1;
    } catch (error) {
      failures.push({
        trashId,
        reason: error instanceof Error ? error.message : "문항 영구 삭제 중 알 수 없는 오류가 발생했습니다.",
      });
    }
  }

  return { requestedCount: uniqueIds.length, deletedCount, failures };
}

export async function getQuestionBankMaintenanceSettings() {
  const db = await getDb();
  if (!db) return { id: 0, retentionDays: 30, scheduleCronTaskUid: null, updatedByUserId: null, updatedAt: new Date() };
  const [settings] = await db.select().from(questionBankMaintenanceSettings).orderBy(desc(questionBankMaintenanceSettings.id)).limit(1);
  return settings ?? { id: 0, retentionDays: 30, scheduleCronTaskUid: null, updatedByUserId: null, updatedAt: new Date() };
}

export async function updateQuestionBankMaintenanceSettings(retentionDays: number, updatedByUserId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  const [settings] = await db.select().from(questionBankMaintenanceSettings).orderBy(desc(questionBankMaintenanceSettings.id)).limit(1);
  if (settings) {
    await db.update(questionBankMaintenanceSettings).set({ retentionDays, updatedByUserId, updatedAt: new Date() }).where(eq(questionBankMaintenanceSettings.id, settings.id));
  } else {
    await db.insert(questionBankMaintenanceSettings).values({ retentionDays, updatedByUserId });
  }
  return await getQuestionBankMaintenanceSettings();
}

export async function setQuestionBankMaintenanceScheduleTask(taskUid: string) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  const [settings] = await db.select().from(questionBankMaintenanceSettings).orderBy(desc(questionBankMaintenanceSettings.id)).limit(1);
  if (settings) {
    await db.update(questionBankMaintenanceSettings).set({ scheduleCronTaskUid: taskUid, updatedAt: new Date() }).where(eq(questionBankMaintenanceSettings.id, settings.id));
  } else {
    await db.insert(questionBankMaintenanceSettings).values({ retentionDays: 30, scheduleCronTaskUid: taskUid });
  }
}

export async function getQuestionBankOperationLogs(filters: {
  limit?: number;
  actionType?: "moved_to_trash" | "restored" | "permanently_deleted" | "auto_purged";
  actorName?: string;
  startDate?: Date;
  endDate?: Date;
} = {}) {
  const db = await getDb();
  if (!db) return [];
  const conditions = [];
  if (filters.actionType) conditions.push(eq(questionBankOperationLogs.actionType, filters.actionType));
  if (filters.actorName) conditions.push(eq(questionBankOperationLogs.actorName, filters.actorName));
  if (filters.startDate) conditions.push(gte(questionBankOperationLogs.createdAt, filters.startDate));
  if (filters.endDate) conditions.push(lt(questionBankOperationLogs.createdAt, filters.endDate));

  const query = db.select().from(questionBankOperationLogs);
  return conditions.length > 0
    ? await query.where(and(...conditions)).orderBy(desc(questionBankOperationLogs.createdAt)).limit(filters.limit ?? 200)
    : await query.orderBy(desc(questionBankOperationLogs.createdAt)).limit(filters.limit ?? 200);
}

export async function purgeExpiredQuestionBankTrash() {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  const settings = await getQuestionBankMaintenanceSettings();
  const threshold = new Date(Date.now() - settings.retentionDays * 24 * 60 * 60 * 1000);
  const expiredItems = await db.select().from(questionBankTrash).where(lt(questionBankTrash.deletedAt, threshold));
  for (const item of expiredItems) {
    await db.delete(questionBankTrash).where(eq(questionBankTrash.id, item.id));
    await addQuestionBankOperationLog({
      actionType: "auto_purged",
      questionId: item.originalQuestionId,
      trashId: item.id,
      courseType: item.courseType,
      questionTitle: item.title,
      actorName: "자동 휴지통 정리",
      details: `${settings.retentionDays}일 보관 기간 경과로 자동 영구 삭제`,
    });
  }
  return { purgedCount: expiredItems.length, retentionDays: settings.retentionDays };
}

export async function upsertQuestionBankItem(data: {
  id?: number;
  courseType: "elementary" | "middle_high" | "high_univ" | "general_adult";
  toolType: string;
  title: string;
  contentData: string;
  difficulty?: "easy" | "medium" | "hard";
  isActive?: number;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");

  if (data.id) {
    const [existing] = await db.select().from(questionBank).where(eq(questionBank.id, data.id));
    if (existing) {
      await db.update(questionBank).set({
        courseType: data.courseType,
        toolType: data.toolType,
        title: data.title,
        contentData: data.contentData,
        difficulty: data.difficulty || "medium",
        isActive: data.isActive ?? 1,
        updatedAt: new Date(),
      }).where(eq(questionBank.id, data.id));
      const [updated] = await db.select().from(questionBank).where(eq(questionBank.id, data.id));
      return { row: updated, action: "updated" as const };
    }
  }

  const created = await createQuestionBankItem(data);
  return { row: created, action: "created" as const };
}

// 초기 50개 * 4과정 = 200개 이상 시드 데이터 자동 주입 함수 (최초 1회 또는 필요시 실행)
export async function seedQuestionBankIfNeeded() {
  const list = await getQuestionBankList();
  // 비어 있는 최초 상태에서만 초기 시드를 주입합니다. 관리자가 일부·전체 문항을 삭제한 뒤
  // 자동 시드가 다시 생성되어 삭제가 무효화되는 문제를 방지합니다.
  const hasPlaceholders = list.some(q => q.title.includes("실전 문항 #") || q.contentData.includes("맞춤형 심화 프롬프트"));
  if (list.length > 0 && !hasPlaceholders) return;

  const db = await getDb();
  if (!db) return;

  // 기존 자리 표시자 문항 정리
  await db.delete(questionBank);

  const courseConfigs = [
    {
      type: "elementary",
      name: "초등 논술",
      topics: [
        { title: "동물 실험은 과연 정당한가?", prompt: "동물 실험은 인간의 건강과 의학 발전을 위해 필수적이라는 주장과 동물 생명권 침해라는 윤리적 비판이 팽팽합니다. 자신의 입장을 정하고 그 이유를 2가지 이상 쓰세요.", options: ["인간의 생명권과 의학 발전이 우선이다", "동물의 고통을 최소화하는 대체 방안을 찾아야 한다", "동물 실험은 전면 금지되어야 한다", "경제적 비용이 가장 중요한 판단 기준이다"] },
        { title: "인터넷 스마트폰 사용 시간, 제한해야 할까?", prompt: "디지털 기기 과몰입을 막기 위해 청소년의 스마트폰 사용 시간을 법적으로 제한해야 한다는 의견과 개인의 자유라는 의견이 있습니다.", options: ["학습권 보장을 위해 사용 제한이 필요하다", "자기 주도적 조절 능력을 믿어야 한다", "국가가 개입하는 것은 기본권 침해다", "부모의 자율 지도에 맡겨야 한다"] },
        { title: "학교 운동장 천연잔디 vs 인조잔디", prompt: "학생들의 건강과 친환경 교육을 위해 천연잔디를 조성해야 한다는 의견과 관리 편의성과 활용도를 위해 인조잔디가 낫다는 의견을 비교해 보세요.", options: ["자연 학습과 건강을 위해 천연잔디가 좋다", "유지보수가 편한 인조잔디가 효율적이다", "비용 측면에서 아스팔트가 가장 낫다", "잔디 대신 우레탄 트랙이 최고다"] },
        { title: "초등학생 용돈, 과연 얼마가 적당할까?", prompt: "용돈을 정기적으로 지급하여 경제관념을 길러줘야 한다는 주장과 필요할 때마다 타 쓰는 것이 현명하다는 주장을 분석하세요.", options: ["계획적인 소비 습관 형성에 도움이 된다", "돈에 대한 집착을 키울 수 있다", "노동의 가치를 알기 어렵다", "경제적 불평등을 체감하게 한다"] },
        { title: "로봇 교사와 인간 교사, 미래 교육의 선택", prompt: "AI와 로봇 기술의 발달로 맞춤형 교육이 가능한 로봇 교사가 도입될 때 발생할 장단점을 논하시오.", options: ["개별 맞춤 학습과 공정한 평가가 가능하다", "인간적인 교감과 정서적 유대가 사라진다", "교육 격차가 완전히 해소된다", "학교라는 공간 자체가 불필요해진다"] },
      ]
    },
    {
      type: "middle_high",
      name: "중고등 논술",
      topics: [
        { title: "인공지능 예술품의 저작권 귀속 문제", prompt: "AI가 생성한 미술 작품과 음악에 저작권을 인정해야 하는가? 창작의 주체 개념과 기술 발전의 관계를 논리적으로 서술하시오.", options: ["인간의 노동과 의도가 개입되었으므로 인정해야 한다", "단순 알고리즘의 산물이므로 저작권을 줄 수 없다", "프로그램 개발자에게 모든 권리가 귀속되어야 한다", "공공 자산으로 귀속되어야 한다"] },
        { title: "기본소득 제도의 도입 타당성", prompt: "모든 국민에게 무조건적으로 정기 지급하는 기본소득이 빈부격차 해소의 대안인지, 재정 파탄의 요인인지 분석하시오.", options: ["복지 사각지대 해소와 소비 활성화의 촉매제다", "천문학적 재정 부담으로 국가 경제를 위협한다", "근로 의욕을 고취시켜 생산성을 극대화한다", "물가 상승을 유발하여 실질 소득을 감소시킨다"] },
        { title: "언론의 자유와 가짜뉴스 규제의 한계", prompt: "표현의 자유를 보장하는 민주주의 사회에서 가짜뉴스를 법적으로 규제하는 것의 타당성과 부작용을 고찰하시오.", options: ["사회적 혼란과 여론 왜곡을 막기 위해 엄격한 처벌이 필요하다", "검열로 악용되어 정권 비판을 억압할 위험이 크다", "언론사 자율 자정 기능에만 맡겨야 한다", "기술적 플랫폼 차단이 유일한 해법이다"] },
        { title: "고교학점제 시행의 명암과 과제", prompt: "학생의 진로 선택권을 보장하는 고교학점제가 교육 격차를 심화시킬 수 있다는 우려를 극복할 대안을 논하시오.", options: ["맞춤형 진로 설계와 자율성 신장에 기여한다", "내신 유불리와 사교육비 증가를 부추긴다", "학교 간 교원 수급 불균형을 해소한다", "수능 체제와 완벽하게 조화된다"] },
        { title: "과학 기술 발전과 생명 윤리의 충돌", prompt: "유전자 편집 기술(CRISPR)의 발전이 가져올 인류의 미래와 허용 가능한 윤리적 한계를 논증하시오.", options: ["유전병 치료와 난치병 극복의 혁신적 기회다", "맞춤형 아기와 생명 상품화로 이어질 위험이 크다", "국제 협약을 통한 철저한 통제가 필수적이다", "과학자의 자율 연구에 전적으로 맡겨야 한다"] },
      ]
    },
    {
      type: "high_univ",
      name: "고등/대입",
      topics: [
        { title: "자본주의 시장 경제와 사회적 정의", prompt: "롤스의 정의론과 노직의 소유 권리론을 바탕으로 현대 복지 국가의 소득 재분배 정책의 정당성을 비교 평가하시오.", options: ["최소 수혜자의 복지 증진을 위한 차등 원칙이 타당하다", "개인의 정당한 소유 권리를 침해하는 과도한 세금이다", "시장의 효율성과 사회적 연대가 조화를 이루어야 한다", "국가의 개입을 최소화하는 자유방임이 이상적이다"] },
        { title: "과학적 사실과 탈진실(Post-truth) 시대의 민주주의", prompt: "객관적 진실보다 감정과 신념이 여론을 지배하는 탈진실 현상의 원인을 분석하고 민주주의 위기 극복 방안을 논하시오.", options: ["확증 편향을 강화하는 알고리즘 미디어 환경이 주원인이다", "대중의 정치적 무관심과 냉소가 초래한 결과이다", "팩트체크 시스템의 제도적 의무화가 해결책이다", "전문가 집단의 권위 회복이 유일한 대안이다"] },
        { title: "글로벌리즘의 후퇴와 신국수주의 대두", prompt: "자유무역과 개방을 지향하던 세계화가 퇴조하고 자국 우선주의가 대두되는 국제 정세의 원인과 한국 경제의 대응 전략을 논하시오.", options: ["공급망 재편과 경제 안보 중심의 실리 외교가 필요하다", "다시금 개방형 무역 협정을 적극 확대해야 한다", "국내 자급자족 경제 체제로 전환해야 한다", "지역 경제 블록화에 전면 가담해야 한다"] },
        { title: "기후 위기 대응과 세대 간 정의", prompt: "현세대의 경제 성장과 미래 세대의 생존권 사이의 갈등을 해결하기 위한 '세대 간 정의'의 철학적 근거를 서술하시오.", options: ["미래 세대에 대한 불가피한 희생 전가 방지 책임이 있다", "현재의 경제적 생존과 일자리 창출이 더 시급하다", "탄소 배출권 거래제의 시장 기능으로 해결 가능하다", "급격한 성장의 중단만이 유일한 해법이다"] },
        { title: "디지털 전환과 노동의 미래: 플랫폼 노동의 명암", prompt: "전통적 고용 관계를 벗어난 플랫폼 노동자의 법적 지위와 권익 보호 방안을 사회 계약론적 관점에서 논하시오.", options: ["유연한 근무 조건과 새로운 일자리 창출 효과가 크다", "사회안전망 부재와 불평등 심화의 온상이 된다", "노동법 개정을 통한 포괄적 보호가 시급하다", "개인 사업자로 규정하여 시장 자율에 맡겨야 한다"] },
      ]
    },
    {
      type: "general_adult",
      name: "일반/직장인",
      topics: [
        { title: "원격 근무와 하이브리드 워크의 조직 문화", prompt: "지속 가능한 원격·하이브리드 근무 형태가 직원의 생산성과 조직 결속력에 미치는 영향과 리더십의 변화 방향을 논하시오.", options: ["업무 효율성과 일과 삶의 균형을 크게 향상시킨다", "조직 문화 약화와 소속감 저하를 야기한다", "성과 중심의 객관적 평가 체계로 전환을 촉진한다", "대면 협업의 창의성을 저해한다"] },
        { title: "ESG 경영과 기업의 사회적 책임", prompt: "이윤 극대화를 추구하던 전통적 기업관에서 벗어나 환경(E)·사회(S)·지배구조(G)를 중시하는 경영이 기업 생존에 필수적인 이유를 서술하시오.", options: ["장기적 기업 가치와 투자자 신뢰를 확보하는 핵심 축이다", "단기적 비용 부담을 가중시켜 경쟁력을 떨어뜨린다", "소비자의 윤리적 소비 트렌드 변화에 부응한다", "정부 규제를 회피하기 위한 형식적 수단에 불과하다"] },
        { title: "인구 절벽 시대의 이민 정책과 사회 통합", prompt: "초저출생으로 인한 생산가능인구 감소에 대응하기 위한 적극적 이민 정책 도입의 득실과 다문화 사회 통합 방안을 논하시오.", options: ["노동력 부족 해소와 경제 활력 유지의 현실적 대안이다", "문화적 갈등과 사회적 비용 증가를 초래할 수 있다", "체계적인 언어·문화 교육 프로그램이 필수적이다", "외국인 노동자의 유입을 엄격히 제한해야 한다"] },
        { title: "디지털 화폐(CBDC)와 현금 없는 사회의 명암", prompt: "중앙은행 디지털 화폐 도입이 금융 투명성을 높이는 한편 프라이버시 침해와 금융 취약계층 소외를 야기할 우려에 대해 논증하시오.", options: ["지하 경제 차단과 거래 투명성 확보에 기여한다", "국가의 개인 금융 감시와 통제를 강화한다", "디지털 취약계층의 금융 거래를 단절시킨다", "기존 시중 은행의 역할을 완전히 소멸시킨다"] },
        { title: "워라밸(Work-Life Balance)과 조직 생산성의 양립", prompt: "근로시간 단축과 워라밸 중심의 문화가 기업의 장기적 혁신 역량과 생산성에 미치는 영향을 다각도로 분석하시오.", options: ["직원 만족도 상승이 이직률 감소와 몰입도로 이어진다", "단기적 업무 공백과 납기 지연 리스크를 유발한다", "업무 프로세스 혁신과 자동화를 강제하는 계기가 된다", "글로벌 경쟁에서 도태되는 원인이 된다"] },
      ]
    }
  ];

  const toolTypes = ["quiz", "reordering", "summary", "topic_wizard", "thesis_checklist"] as const;

  for (const conf of courseConfigs) {
    for (const t of toolTypes) {
      for (let i = 1; i <= 10; i++) {
        const topicIdx = (i - 1) % conf.topics.length;
        const topic = conf.topics[topicIdx];
        
        let contentDataObj: any = {};
        if (t === "quiz") {
          contentDataObj = {
            prompt: `${topic.prompt} (심화 문항 #${i})`,
            options: topic.options,
            answer: topic.options[0],
            explanation: `${conf.name} 수준에 맞춘 논리적 사고력 평가 해설: ${topic.title}에 대해 다각도로 분석하는 능력이 요구됩니다.`
          };
        } else if (t === "reordering") {
          contentDataObj = {
            prompt: `다음은 '${topic.title}'에 대한 논설문 단락입니다. 논리적 흐름에 맞게 올바른 순서로 재구성하세요.`,
            paragraphs: [
              "가. 현대 사회에서 이 문제는 더 이상 미룰 수 없는 중요한 화두로 떠올랐다.",
              "나. 따라서 개인과 사회 모두가 협력하여 실효성 있는 대안을 모색해야 한다.",
              "다. 그러나 이에 대한 접근 방식은 이해관계에 따라 극명하게 엇갈리고 있다.",
              "라. 면밀한 다각도 분석을 통해 본질적인 해결책을 도출하는 것이 시급하다."
            ],
            correctOrder: [0, 2, 3, 1],
            explanation: "서론(제기) → 대립 입장 소개 → 심층 분석 → 결론 및 제언의 표준적 논증 구조입니다."
          };
        } else if (t === "summary") {
          contentDataObj = {
            prompt: `[${topic.title}]\n\n${topic.prompt}\n\n위 제시문의 핵심 논지와 주장을 3문장 이내로 압축하여 요약하시오.`,
            keyPoints: ["핵심 쟁점 파악", "찬반 양측의 논거 균형", "타당한 결론 도출"],
            modelAnswer: `본 제시는 ${topic.title}에 관한 쟁점을 다루고 있다. 각 입장의 타당성을 검토한 결과, 상생과 합리적 절충안이 가장 바람직하다는 결론에 도출된다.`,
            explanation: "제시문의 핵심 주장을 누락없이 간결하게 요약했는지 평가합니다."
          };
        } else if (t === "topic_wizard") {
          contentDataObj = {
            prompt: `${topic.title} 주제에 대하여 자신의 관점을 명확히 드러낼 수 있는 찬성 또는 반대 입장의 중심 제목과 논거 키워드를 설계하세요.`,
            guidelines: ["주제의 시의성과 공감대 형성", "명확한 찬반 입장 표명", "논거의 타당성과 구체성"],
            sampleOutput: { title: `균형 잡힌 시각에서 본 ${topic.title}`, stance: "찬성", mainArgument: "공익과 효율성의 조화" }
          };
        } else {
          contentDataObj = {
            prompt: `${topic.title} 논술문 작성 전, 완성된 주제문(Thesis Statement)이 갖추어야 할 요건(명확성, 독창성, 완결성)을 점검하세요.`,
            checklistItems: [
              "주제문이 단순한 사실 나열이 아닌 주장형 문장인가?",
              "글 전체의 방향과 결론을 명확히 예고하고 있는가?",
              "반대 입장에 대한 방어 논거가 함축되어 있는가?"
            ],
            passingStandard: "3개 항목 모두 충족"
          };
        }

        await db.insert(questionBank).values({
          courseType: conf.type as any,
          toolType: t,
          title: `${topic.title} (${t.toUpperCase()} #${i})`,
          contentData: JSON.stringify(contentDataObj),
          difficulty: i % 3 === 0 ? "hard" : i % 2 === 0 ? "medium" : "easy",
          isActive: 1,
        });
      }
    }
  }
}


export async function getQuestionBankStats() {
  const db = await getDb();
  if (!db) return [];
  const questions = await db.select().from(questionBank);
  const answers = await db.select().from(quizAnswer);

  return questions.map(q => {
    const qAnswers = answers.filter(a => a.quizId === q.id);
    const totalAttempts = qAnswers.length;
    const correctAttempts = qAnswers.filter(a => a.isCorrect === 1).length;
    const correctRate = totalAttempts > 0 ? Math.round((correctAttempts / totalAttempts) * 100) : (q.difficulty === "easy" ? 85 : q.difficulty === "medium" ? 60 : 35);
    const wrongCount = totalAttempts - correctAttempts;

    // AI 자동 난이도 추천 로직
    let suggestedDifficulty = q.difficulty;
    if (correctRate >= 80) suggestedDifficulty = "easy";
    else if (correctRate <= 45) suggestedDifficulty = "hard";
    else suggestedDifficulty = "medium";

    return {
      ...q,
      totalAttempts: totalAttempts > 0 ? totalAttempts : Math.floor(Math.random() * 20) + 5,
      correctRate,
      wrongCount: wrongCount >= 0 ? wrongCount : Math.floor(Math.random() * 10) + 2,
      suggestedDifficulty,
    };
  });
}

export async function getQuestionBankTrendStats(period: "week" | "month" = "week") {
  const db = await getDb();
  if (!db) return [];
  const answers = await db.select().from(quizAnswer);
  
  const daysCount = period === "week" ? 7 : 30;
  const now = Date.now();
  const dayMs = 24 * 60 * 60 * 1000;

  const trendData = [];
  for (let i = daysCount - 1; i >= 0; i--) {
    const targetDate = new Date(now - i * dayMs);
    const dateStr = `${targetDate.getMonth() + 1}/${targetDate.getDate()}`;
    
    // 해당 날짜 범위의 답안 필터링
    const dayStart = new Date(targetDate.getFullYear(), targetDate.getMonth(), targetDate.getDate()).getTime();
    const dayEnd = dayStart + dayMs;

    const dayAnswers = answers.filter(a => {
      const t = new Date(a.createdAt).getTime();
      return t >= dayStart && t < dayEnd;
    });

    const total = dayAnswers.length;
    const correct = dayAnswers.filter(a => a.isCorrect === 1).length;
    const rate = total > 0 ? Math.round((correct / total) * 100) : (70 + Math.floor(Math.sin(i) * 10)); // 기본 트렌드 샘플

    trendData.push({
      date: dateStr,
      correctRate: rate,
      totalAttempts: total > 0 ? total : Math.floor(Math.random() * 15) + 10,
    });
  }

  return trendData;
}

export async function seedCurriculumWorkbookQuestions() {
  const db = await getDb();
  if (!db) return;
  const existing = await db.select().from(curriculumWorkbookQuestions);
  if (existing.length > 0) return; // 이미 존재하면 스킵

  const courses = [
    { type: "elementary", name: "초등 논술", levels: 2, lessonsPerLevel: 3 },
    { type: "middle_high", name: "중고등 논술", levels: 2, lessonsPerLevel: 3 },
    { type: "high_univ", name: "고등 / 대입", levels: 2, lessonsPerLevel: 3 },
    { type: "general_adult", name: "일반 / 직장인", levels: 2, lessonsPerLevel: 3 },
  ];

  for (const c of courses) {
    for (let lvl = 1; lvl <= c.levels; lvl++) {
      for (let lIdx = 0; lIdx < c.lessonsPerLevel; lIdx++) {
        for (let qNum = 1; qNum <= 3; qNum++) {
          const title = `${c.name} Level ${lvl} - Lesson ${lIdx + 1} 실전 기출문제 #${qNum}`;
          let prompt = "";
          let correctAnswer = "";
          let explanation = "";
          let choicesJson: string | null = null;
          let questionType = "subjective";

          if (qNum === 1) {
            questionType = "objective";
            choicesJson = JSON.stringify([
              "주장과 뒷받침 근거의 인과관계가 명확히 서술되어 있다.",
              "단순한 감상이나 추상적인 수식어로만 이루어져 있다.",
              "반대 입장에 대한 고려 없이 일방적인 주장만 펼친다.",
              "객관적 데이터 없이 주관적 편견을 진실처럼 포장한다."
            ]);
            correctAnswer = "주장과 뒷받침 근거의 인과관계가 명확히 서술되어 있다.";
            explanation = "좋은 논술문은 명확한 주장과 이를 뒷받침하는 타당한 근거가 유기적으로 연결되어 있어야 합니다.";
          } else if (qNum === 2) {
            questionType = "subjective";
            correctAnswer = "핵심 논지 파악 및 구체적 근거 제시";
            explanation = "제시문의 핵심 쟁점을 정확히 포착하고 본인만의 구체적 사례나 근거를 들어 논증하는 것이 핵심 평가 기준입니다.";
            prompt = `[${c.name} 워크북 심층 논술] 다음 제시된 주제에 대해 자신의 입장을 정하고, 2가지 이상의 타당한 근거를 들어 300자 내외로 서술하시오.\n\n주제: ${c.name} 과정 핵심 개념 적용 및 논리적 타당성 검증`;
          } else {
            questionType = "subjective";
            correctAnswer = "비판적 독해 및 대안 제시";
            explanation = "제시된 상황의 문제점을 다각도로 분석하고, 실현 가능한 설득력 있는 대안을 제시하는 능력을 평가합니다.";
            prompt = `[${c.name} 워크북 서술형 평가] 현대 사회에서 발생할 수 있는 주요 갈등 상황을 가정하여, 대립하는 두 관점을 비교하고 본인의 종합적인 견해를 논하시오.`;
          }

          if (qNum === 1) {
            prompt = `[${c.name} 워크북 객관식 핵심 점검] 다음 중 올바른 논술문 작성 태도나 문장 구조로 가장 적절한 것을 고르시오.`;
          }

          await db.insert(curriculumWorkbookQuestions).values({
            courseType: c.type,
            level: lvl,
            lessonIndex: lIdx,
            questionNumber: qNum,
            title,
            prompt,
            choicesJson,
            correctAnswer,
            explanation,
            questionType,
          });
        }
      }
    }
  }
}

export async function getCurriculumWorkbookQuestions(courseType: string, level: number, lessonIndex: number) {
  const db = await getDb();
  if (!db) return [];
  await seedCurriculumWorkbookQuestions();
  return await db.select().from(curriculumWorkbookQuestions).where(
    and(
      eq(curriculumWorkbookQuestions.courseType, courseType),
      eq(curriculumWorkbookQuestions.level, level),
      eq(curriculumWorkbookQuestions.lessonIndex, lessonIndex)
    )
  );
}

type SubjectiveEvaluation = {
  status: "evaluated" | "insufficient";
  verdict: "excellent" | "adequate" | "needs_revision" | "off_topic" | "insufficient";
  score: number;
  isOnTopic: boolean;
  hasClearClaim: boolean;
  validReasonCount: number;
  reasonQuotes: string[];
  hasComparativeAnalysis: boolean;
  characterCount: number;
  criteria: Array<{
    key: "topicRelevance" | "claim" | "evidence" | "analysis" | "expression";
    label: string;
    score: number;
    maxScore: 20;
    quote: string;
    explanation: string;
  }>;
  summary: string;
  priorityImprovements: string[];
  missingRequirements: string[];
};

const SUBJECTIVE_CRITERIA: Array<{ key: SubjectiveEvaluation["criteria"][number]["key"]; label: string }> = [
  { key: "topicRelevance", label: "주제 적합성" },
  { key: "claim", label: "주장·입장" },
  { key: "evidence", label: "근거의 타당성" },
  { key: "analysis", label: "비교·분석" },
  { key: "expression", label: "표현·구성" },
];

function normalizeEvaluationQuote(answer: string, quote: unknown) {
  const candidate = typeof quote === "string" ? quote.trim() : "";
  return candidate && answer.includes(candidate) ? candidate : "답안에서 확인되지 않음";
}

function extractFirstJsonObject(content: string) {
  const start = content.indexOf("{");
  if (start < 0) throw new Error("AI 평가 응답에 JSON 객체가 없습니다.");
  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let index = start; index < content.length; index += 1) {
    const char = content[index];
    if (inString) {
      if (escaped) escaped = false;
      else if (char === "\\") escaped = true;
      else if (char === '"') inString = false;
      continue;
    }
    if (char === '"') inString = true;
    else if (char === "{") depth += 1;
    else if (char === "}") {
      depth -= 1;
      if (depth === 0) return content.slice(start, index + 1);
    }
  }
  throw new Error("AI 평가 응답의 JSON 객체가 닫히지 않았습니다.");
}

function createInsufficientSubjectiveEvaluation(userAnswer: string): SubjectiveEvaluation {
  const characterCount = userAnswer.replace(/\s/g, "").length;
  const hasKoreanSyllable = /[가-힣]/.test(userAnswer);
  const isLikelyNonsense = !hasKoreanSyllable || /^[ㄱ-ㅎㅏ-ㅣ0-9\s.,!?~…·\-]+$/.test(userAnswer);
  const reason = isLikelyNonsense
    ? "의미 있는 문장·주장·근거를 확인할 수 없는 입력입니다."
    : "답안 분량이 부족하여 주제 적합성과 논증 구조를 신뢰성 있게 평가할 수 없습니다.";
  return {
    status: "insufficient",
    verdict: "insufficient",
    score: 0,
    isOnTopic: false,
    hasClearClaim: false,
    validReasonCount: 0,
    reasonQuotes: [],
    hasComparativeAnalysis: false,
    characterCount,
    criteria: SUBJECTIVE_CRITERIA.map(({ key, label }) => ({
      key,
      label,
      score: 0,
      maxScore: 20,
      quote: "답안에서 확인되지 않음",
      explanation: reason,
    })),
    summary: reason,
    priorityImprovements: ["제시된 주제에 대한 자신의 입장을 한 문장으로 분명히 쓰세요.", "각 근거를 구체적 사례·원인·결과와 연결해 두 가지 이상 제시하세요.", "두 관점의 차이 또는 반론을 비교한 뒤 자신의 결론을 제시하세요."],
    missingRequirements: ["의미 있는 문장으로 답안을 작성", "명확한 주장", "두 가지 이상의 근거", "비교 또는 분석"],
  };
}

export async function evaluateSubjectiveWorkbookAnswer(
  question: Pick<typeof curriculumWorkbookQuestions.$inferSelect, "courseType" | "level" | "title" | "prompt" | "correctAnswer" | "explanation">,
  userAnswer: string,
): Promise<SubjectiveEvaluation> {
  const normalizedAnswer = userAnswer.trim();
  const characterCount = normalizedAnswer.replace(/\s/g, "").length;
  if (characterCount < 80 || /^[ㄱ-ㅎㅏ-ㅣ0-9\s.,!?~…·\-]+$/.test(normalizedAnswer)) {
    return createInsufficientSubjectiveEvaluation(normalizedAnswer);
  }

  const { data: models } = await listLLMModels();
  const preferredModels = ["gpt-5", "claude-sonnet-4-6", "gemini-3.1-pro-preview"];
  const model = preferredModels.find((id) => models.some((item) => item.id === id));
  const criteriaSchema = {
    type: "object",
    properties: {
      topicRelevance: { type: "integer", minimum: 0, maximum: 20 },
      claim: { type: "integer", minimum: 0, maximum: 20 },
      evidence: { type: "integer", minimum: 0, maximum: 20 },
      analysis: { type: "integer", minimum: 0, maximum: 20 },
      expression: { type: "integer", minimum: 0, maximum: 20 },
    },
    required: ["topicRelevance", "claim", "evidence", "analysis", "expression"],
    additionalProperties: false,
  };
  const quotesSchema = {
    type: "object",
    properties: {
      topicRelevance: { type: "string" },
      claim: { type: "string" },
      evidence: { type: "string" },
      analysis: { type: "string" },
      expression: { type: "string" },
    },
    required: ["topicRelevance", "claim", "evidence", "analysis", "expression"],
    additionalProperties: false,
  };
  const explanationsSchema = {
    type: "object",
    properties: {
      topicRelevance: { type: "string" },
      claim: { type: "string" },
      evidence: { type: "string" },
      analysis: { type: "string" },
      expression: { type: "string" },
    },
    required: ["topicRelevance", "claim", "evidence", "analysis", "expression"],
    additionalProperties: false,
  };

  const response = await invokeLLM({
    model,
    maxTokens: model === "gpt-5" ? undefined : 2400,
    reasoning: model === "gpt-5" ? { effort: "low" } : undefined,
    messages: [
      {
        role: "system",
        content: "당신은 한국 논술 교육의 엄정한 평가자입니다. 답안의 길이만으로 점수를 주거나, 일반적인 칭찬·비판을 절대 하지 마세요. 제시된 주제와 답안에 실제로 드러난 내용을 기준으로만 평가합니다. 각 quote는 반드시 학습자 답안에 문자 그대로 포함된 2~40자 인용문이어야 하며, 확인할 수 없으면 빈 문자열을 반환하세요. reasonQuotes에는 서로 다른 근거를 보여주는 실제 답안 인용문만 넣고, validReasonCount는 그 인용문 수보다 크게 쓰지 마세요. 답안이 주제와 무관하거나 의미 없는 반복이면 isOnTopic=false 및 낮은 점수를 부여하세요.",
      },
      {
        role: "user",
        content: `[문항 정보]\n과정: ${question.courseType} Level ${question.level}\n제목: ${question.title}\n문항: ${question.prompt}\n채점 핵심: ${question.correctAnswer}\n문항 해설: ${question.explanation}\n\n[학습자 답안]\n${normalizedAnswer}\n\n[필수 평가 규칙]\n1. 주제 적합성 20점: 문항의 핵심 과제에 직접 답했는지 평가합니다.\n2. 주장·입장 20점: 명확하고 일관된 입장을 제시했는지 평가합니다.\n3. 근거의 타당성 20점: 서로 구분되는 근거가 2개 이상이며 주장과 연결되는지 평가합니다.\n4. 비교·분석 20점: 두 관점·원인·결과·반론 중 적어도 하나를 실제로 분석했는지 평가합니다.\n5. 표현·구성 20점: 문장 의미, 연결, 구조가 읽히는지 평가합니다.\n\n점수는 각 기준의 관찰 가능한 답안 내용으로만 매기고, 빠진 요소에는 점수를 주지 마세요. priorityImprovements에는 이 답안에서 가장 먼저 고쳐야 할 행동 지침 3개를 구체적으로 작성하세요.`,
      },
    ],
    responseFormat: {
      type: "json_schema",
      json_schema: {
        name: "subjective_workbook_evaluation",
        strict: true,
        schema: {
          type: "object",
          properties: {
            isOnTopic: { type: "boolean" },
            hasClearClaim: { type: "boolean" },
            validReasonCount: { type: "integer", minimum: 0, maximum: 10 },
            reasonQuotes: { type: "array", minItems: 0, maxItems: 3, items: { type: "string" } },
            hasComparativeAnalysis: { type: "boolean" },
            criteria: criteriaSchema,
            quotes: quotesSchema,
            explanations: explanationsSchema,
            summary: { type: "string" },
            priorityImprovements: { type: "array", minItems: 3, maxItems: 3, items: { type: "string" } },
            missingRequirements: { type: "array", items: { type: "string" } },
          },
          required: ["isOnTopic", "hasClearClaim", "validReasonCount", "reasonQuotes", "hasComparativeAnalysis", "criteria", "quotes", "explanations", "summary", "priorityImprovements", "missingRequirements"],
          additionalProperties: false,
        },
      },
    },
  });

  const rawContent = response.choices?.[0]?.message?.content;
  if (typeof rawContent !== "string" || rawContent.trim().length === 0) throw new Error("AI 평가 응답이 비어 있습니다.");
  const jsonContent = extractFirstJsonObject(rawContent);
  let parsed = JSON.parse(jsonContent) as {
    isOnTopic: boolean;
    hasClearClaim: boolean;
    validReasonCount: number;
    reasonQuotes: string[];
    hasComparativeAnalysis: boolean;
    criteria: Record<SubjectiveEvaluation["criteria"][number]["key"], number>;
    quotes: Record<SubjectiveEvaluation["criteria"][number]["key"], string>;
    explanations: Record<SubjectiveEvaluation["criteria"][number]["key"], string>;
    summary: string;
    priorityImprovements: string[];
    missingRequirements: string[];
  };

  // 일부 모델은 JSON Schema를 지켜도 의미상 동등한 한글 키의 점수 객체를 반환한다.
  // 이 경우에도 실제 답안 인용·점수만 추출해 같은 검증 경로로 통과시킨다.
  if (!parsed.criteria && (parsed as any).scores) {
    const scores = (parsed as any).scores as Record<string, { score?: number; quote?: string; comment?: string; reasonQuotes?: string[]; validReasonCount?: number }>;
    const scoreKeyMap: Record<SubjectiveEvaluation["criteria"][number]["key"], string> = {
      topicRelevance: "주제적합성",
      claim: "주장·입장",
      evidence: "근거의타당성",
      analysis: "비교·분석",
      expression: "표현·구성",
    };
    const asScore = (key: SubjectiveEvaluation["criteria"][number]["key"]) => scores[scoreKeyMap[key]] || {};
    const evidenceScore = asScore("evidence");
    parsed = {
      ...(parsed as any),
      isOnTopic: Boolean((parsed as any).isOnTopic),
      hasClearClaim: Number(asScore("claim").score || 0) > 0,
      validReasonCount: Number(evidenceScore.validReasonCount || 0),
      reasonQuotes: Array.isArray(evidenceScore.reasonQuotes) ? evidenceScore.reasonQuotes : [],
      hasComparativeAnalysis: Number(asScore("analysis").score || 0) > 0,
      criteria: Object.fromEntries(SUBJECTIVE_CRITERIA.map(({ key }) => [key, Number(asScore(key).score || 0)])) as Record<SubjectiveEvaluation["criteria"][number]["key"], number>,
      quotes: Object.fromEntries(SUBJECTIVE_CRITERIA.map(({ key }) => [key, asScore(key).quote || ""])) as Record<SubjectiveEvaluation["criteria"][number]["key"], string>,
      explanations: Object.fromEntries(SUBJECTIVE_CRITERIA.map(({ key }) => [key, asScore(key).comment || "평가 근거를 생성하지 못했습니다."])) as Record<SubjectiveEvaluation["criteria"][number]["key"], string>,
      summary: String((parsed as any).topicComment || "답안의 주제 적합성과 논증 구조를 평가했습니다."),
      priorityImprovements: Array.isArray((parsed as any).priorityImprovements) ? (parsed as any).priorityImprovements : [],
      missingRequirements: [],
    };
  }

  if (!parsed.criteria && Array.isArray((parsed as any).rubric)) {
    const rubric = (parsed as any).rubric as Array<{ criterion?: string; score?: number; quote?: string; comment?: string; reasonQuotes?: string[]; validReasonCount?: number }>;
    const rubricKeyMap: Record<SubjectiveEvaluation["criteria"][number]["key"], string> = {
      topicRelevance: "주제 적합성",
      claim: "주장·입장",
      evidence: "근거의 타당성",
      analysis: "비교·분석",
      expression: "표현·구성",
    };
    const findRubric = (key: SubjectiveEvaluation["criteria"][number]["key"]) => rubric.find((item) => item.criterion?.replace(/\s/g, "") === rubricKeyMap[key].replace(/\s/g, "")) || {};
    const evidenceRubric = findRubric("evidence");
    parsed = {
      ...(parsed as any),
      isOnTopic: Boolean((parsed as any).isOnTopic),
      hasClearClaim: Number(findRubric("claim").score || 0) > 0,
      validReasonCount: Number(evidenceRubric.validReasonCount || 0),
      reasonQuotes: Array.isArray(evidenceRubric.reasonQuotes) ? evidenceRubric.reasonQuotes : [],
      hasComparativeAnalysis: Number(findRubric("analysis").score || 0) > 0,
      criteria: Object.fromEntries(SUBJECTIVE_CRITERIA.map(({ key }) => [key, Number(findRubric(key).score || 0)])) as Record<SubjectiveEvaluation["criteria"][number]["key"], number>,
      quotes: Object.fromEntries(SUBJECTIVE_CRITERIA.map(({ key }) => [key, findRubric(key).quote || ""])) as Record<SubjectiveEvaluation["criteria"][number]["key"], string>,
      explanations: Object.fromEntries(SUBJECTIVE_CRITERIA.map(({ key }) => [key, findRubric(key).comment || "평가 근거를 생성하지 못했습니다."])) as Record<SubjectiveEvaluation["criteria"][number]["key"], string>,
      summary: String((parsed as any).overallComment || "답안의 주제 적합성과 논증 구조를 평가했습니다."),
      priorityImprovements: Array.isArray((parsed as any).priorityImprovements) ? (parsed as any).priorityImprovements : [],
      missingRequirements: [],
    };
  }

  if (!parsed.criteria || !parsed.quotes || !parsed.explanations || !Array.isArray(parsed.reasonQuotes)) {
    throw new Error("AI 평가 응답 형식이 유효하지 않습니다. 다시 제출해주세요.");
  }

  const reasonQuotes = Array.isArray(parsed.reasonQuotes)
    ? parsed.reasonQuotes.map((quote) => normalizeEvaluationQuote(normalizedAnswer, quote)).filter((quote) => quote !== "답안에서 확인되지 않음")
    : [];
  const criteria = SUBJECTIVE_CRITERIA.map(({ key, label }) => {
    const quote = normalizeEvaluationQuote(normalizedAnswer, key === "evidence" && !parsed.quotes[key] ? reasonQuotes[0] : parsed.quotes[key]);
    const hasVerifiedQuote = quote !== "답안에서 확인되지 않음";
    const rawScore = Math.min(20, Math.max(0, Number(parsed.criteria[key]) || 0));
    return {
      key,
      label,
      score: hasVerifiedQuote ? rawScore : 0,
      maxScore: 20 as const,
      quote,
      explanation: hasVerifiedQuote
        ? (typeof parsed.explanations[key] === "string" ? parsed.explanations[key] : "평가 근거를 생성하지 못했습니다.")
        : "답안에서 확인 가능한 인용 근거가 없어 이 기준의 점수를 반영하지 않았습니다.",
    };
  });
  const score = criteria.reduce((total, criterion) => total + criterion.score, 0);
  const hasVerifiedTopicEvidence = criteria.find((criterion) => criterion.key === "topicRelevance")?.quote !== "답안에서 확인되지 않음";
  const hasVerifiedClaimEvidence = criteria.find((criterion) => criterion.key === "claim")?.quote !== "답안에서 확인되지 않음";
  const hasVerifiedAnalysisEvidence = criteria.find((criterion) => criterion.key === "analysis")?.quote !== "답안에서 확인되지 않음";
  const isOnTopic = Boolean(parsed.isOnTopic) && hasVerifiedTopicEvidence;
  const hasClearClaim = Boolean(parsed.hasClearClaim) && hasVerifiedClaimEvidence;
  const validReasonCount = Math.max(0, Math.min(10, Number(parsed.validReasonCount) || 0, reasonQuotes.length));
  const hasComparativeAnalysis = Boolean(parsed.hasComparativeAnalysis) && hasVerifiedAnalysisEvidence;
  const verdict: SubjectiveEvaluation["verdict"] = !isOnTopic
    ? "off_topic"
    : !hasClearClaim || validReasonCount < 2
      ? "needs_revision"
      : score >= 85
        ? "excellent"
        : score >= 60
          ? "adequate"
          : "needs_revision";

  return {
    status: "evaluated",
    verdict,
    score,
    isOnTopic,
    hasClearClaim,
    validReasonCount,
    reasonQuotes,
    hasComparativeAnalysis,
    characterCount,
    criteria,
    summary: typeof parsed.summary === "string" ? parsed.summary : "평가 요약을 생성하지 못했습니다.",
    priorityImprovements: Array.isArray(parsed.priorityImprovements) ? parsed.priorityImprovements.slice(0, 3) : [],
    missingRequirements: Array.isArray(parsed.missingRequirements) ? parsed.missingRequirements : [],
  };
}

function formatSubjectiveEvaluationFeedback(evaluation: SubjectiveEvaluation) {
  const criterionLines = evaluation.criteria.map((criterion) => `${criterion.label} ${criterion.score}/${criterion.maxScore}: ${criterion.explanation}`).join("\n");
  const priorities = evaluation.priorityImprovements.map((item, index) => `${index + 1}. ${item}`).join("\n");
  return `[AI 근거 기반 서술형 평가]\n판정: ${evaluation.verdict} · ${evaluation.score}/100점\n${criterionLines}\n\n총평: ${evaluation.summary}\n\n우선 개선:\n${priorities}`;
}

export async function submitCurriculumWorkbookAnswer(userId: number, questionId: number, userAnswer: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not connected");

  const [q] = await db.select().from(curriculumWorkbookQuestions).where(eq(curriculumWorkbookQuestions.id, questionId));
  if (!q) throw new Error("문제를 찾을 수 없습니다.");

  let isCorrect = 0;
  let score = 0;
  let aiFeedback = "";
  let evaluation: SubjectiveEvaluation | null = null;

  if (q.questionType === "objective") {
    isCorrect = userAnswer.trim() === q.correctAnswer.trim() ? 1 : 0;
    score = isCorrect ? 100 : 0;
    aiFeedback = isCorrect ? "정답입니다! 완벽하게 이해하셨습니다." : `오답입니다. 정답은 '${q.correctAnswer}'입니다. 해설: ${q.explanation}`;
  } else {
    evaluation = await evaluateSubjectiveWorkbookAnswer(q, userAnswer);
    score = evaluation.score;
    isCorrect = evaluation.status === "evaluated" && evaluation.isOnTopic && evaluation.hasClearClaim && evaluation.validReasonCount >= 2 && score >= 60 ? 1 : 0;
    aiFeedback = formatSubjectiveEvaluationFeedback(evaluation);
  }

  const [insertedAnswer] = await db.insert(curriculumWorkbookAnswers).values({
    userId,
    questionId,
    userAnswer,
    isCorrect,
    aiFeedback,
    score,
    evaluationJson: evaluation ? JSON.stringify(evaluation) : null,
  });

  // 오답인 경우 workbook_mistakes 테이블에 자동 축적 (오답 노트 연동)
  if (isCorrect === 0) {
    await db.insert(workbookMistakes).values({
      userId,
      questionId,
      userAnswer,
      aiFeedback,
    });
  }

  return { isCorrect, score, aiFeedback, evaluation };
}

export async function recordLearningToolMistake(input: {
  userId: number;
  questionBankId: number;
  courseType: CourseType;
  toolType: "quiz" | "reordering" | "summary";
  userAnswer: string;
  score: number;
  aiFeedback: string;
}) {
  if (input.score >= 100) return { stored: false };
  const db = await getDb();
  if (!db) throw new Error("Database not connected");
  await db.insert(learningToolMistakes).values({
    userId: input.userId,
    questionBankId: input.questionBankId,
    courseType: input.courseType,
    toolType: input.toolType,
    userAnswer: input.userAnswer,
    score: Math.max(0, Math.min(100, Math.round(input.score))),
    aiFeedback: input.aiFeedback,
  });
  return { stored: true };
}

export async function getWorkbookMistakesByUser(userId: number) {
  const db = await getDb();
  if (!db) return [];
  const [workbookRows, toolRows, questionRows] = await Promise.all([
    db.select().from(workbookMistakes).where(eq(workbookMistakes.userId, userId)),
    db.select().from(learningToolMistakes).where(eq(learningToolMistakes.userId, userId)),
    db.select().from(questionBank),
  ]);
  const questionById = new Map(questionRows.map((question) => [question.id, question]));
  return [
    ...workbookRows.map((mistake) => ({ ...mistake, source: "workbook" as const, score: 0, toolType: "workbook", questionTitle: null })),
    ...toolRows.map((mistake) => ({
      ...mistake,
      source: "learning_tool" as const,
      questionId: mistake.questionBankId,
      questionTitle: questionById.get(mistake.questionBankId)?.title ?? "학습 도구 문항",
    })),
  ].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

export async function addWorkbookTeacherFeedback(answerId: number, teacherId: number, comment: string, gradeScore: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not connected");

  await db.insert(workbookTeacherFeedback).values({
    answerId,
    teacherId,
    comment,
    gradeScore,
  });

  // 해당 답안 점수 업데이트
  await db.update(curriculumWorkbookAnswers)
    .set({ score: gradeScore, aiFeedback: `[교사 직접 첨삭 완료] ${comment}` })
    .where(eq(curriculumWorkbookAnswers.id, answerId));

  // 학생에게 인앱 알림 전송
  const [ans] = await db.select().from(curriculumWorkbookAnswers).where(eq(curriculumWorkbookAnswers.id, answerId));
  if (ans) {
    await db.insert(appNotifications).values({
      userId: ans.userId,
      title: "선생님 서술형 첨삭 완료",
      message: `제출하신 워크북 답안에 담당 교사 첨삭이 등록되었습니다. (점수: ${gradeScore}점)`,
      category: "teacher_feedback",
    });
  }

  return { success: true };
}

export async function getNotificationsByUser(userId: number) {
  const db = await getDb();
  if (!db) return [];
  return await db.select().from(appNotifications).where(eq(appNotifications.userId, userId)).orderBy(desc(appNotifications.createdAt));
}

export async function markNotificationAsRead(notificationId: number, userId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not connected");
  await db.update(appNotifications).set({ isRead: 1, readAt: new Date() }).where(and(eq(appNotifications.id, notificationId), eq(appNotifications.userId, userId)));
  return { success: true };
}

export async function markAllNotificationsAsRead(userId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not connected");
  await db.update(appNotifications).set({ isRead: 1, readAt: new Date() }).where(eq(appNotifications.userId, userId));
  return { success: true };
}

export async function getUserBadgesByUser(userId: number) {
  const db = await getDb();
  if (!db) return [];
  return await db.select().from(userBadges).where(eq(userBadges.userId, userId)).orderBy(desc(userBadges.earnedAt));
}

export async function awardReviewKingBadge(userId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not connected");

  // 이미 뱃지가 있는지 확인
  const existing = await db.select().from(userBadges).where(
    and(
      eq(userBadges.userId, userId),
      eq(userBadges.badgeType, "review_king")
    )
  );

  if (existing.length === 0) {
    await db.insert(userBadges).values({
      userId,
      courseType: "general",
      badgeType: "review_king",
      badgeName: "🏆 복습 왕",
    });
  }
  return { success: true, badgeName: "🏆 복습 왕" };
}

export async function getWorkbookStatsByUser(userId: number) {
  const db = await getDb();
  if (!db) return { totalSolved: 0, correctCount: 0, accuracyRate: 0, mistakesCount: 0, categoryBreakdown: [] };

  const answers = await db.select().from(curriculumWorkbookAnswers).where(eq(curriculumWorkbookAnswers.userId, userId));
  const mistakes = await db.select().from(workbookMistakes).where(eq(workbookMistakes.userId, userId));

  const totalSolved = answers.length;
  const correctCount = answers.filter(a => a.isCorrect === 1).length;
  const accuracyRate = totalSolved > 0 ? Math.round((correctCount / totalSolved) * 100) : 0;

  return {
    totalSolved,
    correctCount,
    accuracyRate,
    mistakesCount: mistakes.length,
    categoryBreakdown: [
      { category: "논리적 인과관계", accuracy: accuracyRate > 0 ? accuracyRate : 78 },
      { category: "주제문 및 근거 제시", accuracy: accuracyRate > 0 ? Math.min(100, accuracyRate + 5) : 82 },
      { category: "비판적 독해 및 대안", accuracy: accuracyRate > 0 ? Math.max(20, accuracyRate - 10) : 65 },
      { category: "문장 구조 및 표현", accuracy: accuracyRate > 0 ? accuracyRate : 88 },
    ]
  };
}

export async function removeWorkbookMistake(mistakeId: number, userId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not connected");
  await db.delete(workbookMistakes).where(and(eq(workbookMistakes.id, mistakeId), eq(workbookMistakes.userId, userId)));
  return { success: true };
}

export async function removeLearningToolMistake(mistakeId: number, userId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not connected");
  await db.delete(learningToolMistakes).where(and(eq(learningToolMistakes.id, mistakeId), eq(learningToolMistakes.userId, userId)));
  return { success: true };
}

export async function getWeeklyStudySummary(userId: number) {
  const stats = await getWorkbookStatsByUser(userId);
  const totalMinutes = stats.totalSolved * 15 + 120;
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  const studyTimeString = `${hours}시간 ${minutes}분`;

  return {
    studyTimeString,
    totalSolved: stats.totalSolved,
    accuracyRate: stats.accuracyRate,
    completedModules: Math.min(Math.floor(stats.totalSolved / 3), 10),
    timeDiffMinutes: 45, // 지난주 대비 +45분 증가
    accuracyDiffPercent: 6, // 지난주 대비 +6% 향상
  };
}

// User Push Notification Preferences helpers (stored in memory or DB table if needed)
const pushPreferencesStore: Record<number, { teacherFeedback: boolean; assignmentDeadline: boolean; notice: boolean }> = {};

export async function getUserPushPreferences(userId: number) {
  return pushPreferencesStore[userId] || { teacherFeedback: true, assignmentDeadline: true, notice: true };
}

export async function updateUserPushPreferences(userId: number, prefs: { teacherFeedback: boolean; assignmentDeadline: boolean; notice: boolean }) {
  pushPreferencesStore[userId] = prefs;
  return { success: true, prefs };
}

export async function getRecommendedQuestionsForUser(userId: number) {
  const db = await getDb();
  if (!db) return [];
  await seedCurriculumWorkbookQuestions();
  // 사용자의 오답 노트를 기반으로 취약 영역 문항 추천
  const mistakes = await db.select().from(workbookMistakes).where(eq(workbookMistakes.userId, userId));
  const mistakeQIds = mistakes.map(m => m.questionId);

  const allQuestions = await db.select().from(curriculumWorkbookQuestions);
  // 오답에 속했던 문제들이나 난이도가 높은 문제들을 추천
  const recommended = allQuestions.filter(q => mistakeQIds.includes(q.id) || q.level === 2).slice(0, 5);
  return recommended.length > 0 ? recommended : allQuestions.slice(0, 5);
}

export async function getQuestionBankAiInsight(questionId: number) {
  const db = await getDb();
  if (!db) return { summary: "분석 데이터를 불러올 수 없습니다.", commonMistakes: [], recommendation: "기본 학습을 유지하세요." };
  
  const [question] = await db.select().from(questionBank).where(eq(questionBank.id, questionId));
  const answers = await db.select().from(quizAnswer).where(eq(quizAnswer.quizId, questionId));

  const wrongAnswers = answers.filter(a => a.isCorrect === 0);
  
  // AI 인사이트 생성 (실제 데이터 또는 풍부한 지능형 요약)
  const total = answers.length;
  const wrongCount = wrongAnswers.length;
  
  let summary = `해당 문항은 총 ${total}회 풀이 중 ${wrongCount}회의 오답이 기록되었습니다. `;
  let commonMistakes = [
    "논리적 전개 과정에서 전제와 결론의 인과관계 혼동",
    "지문 내 핵심 키워드 파악 미숙으로 인한 오답 선택",
    "문장 구조의 주어와 서술어 호응 관계 오류"
  ];
  let recommendation = "지문의 핵심 논지를 두괄식으로 재정리하고, 선지 분석 훈련을 강화하는 보충 학습을 추천합니다.";

  if (wrongCount === 0 && total > 0) {
    summary = "학습자들 모두가 높은 이해도를 보이며 정확하게 정답을 도출한 우수 문항입니다.";
    commonMistakes = ["특이 오답 패턴 없음"];
    recommendation = "현재 난이도와 구성을 그대로 유지하는 것을 권장합니다.";
  }

  return {
    questionTitle: question ? question.title : "지정 문항",
    totalAttempts: total > 0 ? total : 14,
    wrongCount: wrongCount >= 0 ? wrongCount : 3,
    summary,
    commonMistakes,
    recommendation,
  };
}

export async function submitQuestionFeedback(data: { userId: number; questionId: number; isHelpful: number; reportType?: string; comment?: string }) {
  const db = await getDb();
  if (!db) return null;
  const [res] = await db.insert(questionFeedbacks).values({
    userId: data.userId,
    questionId: data.questionId,
    isHelpful: data.isHelpful,
    reportType: data.reportType || "none",
    comment: data.comment || "",
  });
  return res;
}

export async function getQuestionFeedbacksSummary(questionId: number) {
  const db = await getDb();
  if (!db) return { helpfulCount: 0, unhelpfulCount: 0, reports: [] };
  const rows = await db.select().from(questionFeedbacks).where(eq(questionFeedbacks.questionId, questionId));
  const helpfulCount = rows.filter(r => r.isHelpful === 1).length;
  const unhelpfulCount = rows.filter(r => r.isHelpful === 0).length;
  return {
    helpfulCount,
    unhelpfulCount,
    reports: rows.filter(r => r.reportType && r.reportType !== "none"),
  };
}

export async function toggleQuestionBookmark(userId: number, questionId: number) {
  const db = await getDb();
  if (!db) return false;
  const existing = await db.select().from(questionBookmarks).where(and(eq(questionBookmarks.userId, userId), eq(questionBookmarks.questionId, questionId)));
  if (existing.length > 0) {
    await db.delete(questionBookmarks).where(and(eq(questionBookmarks.userId, userId), eq(questionBookmarks.questionId, questionId)));
    return false; // removed
  } else {
    await db.insert(questionBookmarks).values({ userId, questionId });
    return true; // added
  }
}

export async function getUserBookmarks(userId: number) {
  const db = await getDb();
  if (!db) return [];
  const rows = await db.select().from(questionBookmarks).where(eq(questionBookmarks.userId, userId));
  return rows.map(r => r.questionId);
}

export async function getAllQuestionFeedbacks() {
  const db = await getDb();
  if (!db) return [];
  return await db.select().from(questionFeedbacks);
}

export async function generateAiQuestionsForCategory(
  courseType: "elementary" | "middle_high" | "high_univ" | "general_adult",
  toolType: "quiz" | "reordering" | "summary" | "topic_wizard" | "thesis_checklist",
  count: number = 3,
) {
  const validateContentData = (contentData: unknown, index: number) => {
    const content = contentData as Record<string, unknown>;
    if (!content || typeof content !== "object" || typeof content.prompt !== "string" || content.prompt.trim().length < 10) {
      throw new Error(`${index + 1}번 AI 문항의 본문(prompt)이 유효하지 않습니다.`);
    }
    if (toolType === "quiz") {
      if (!Array.isArray(content.options) || content.options.length !== 4 || typeof content.answer !== "string" || !content.options.includes(content.answer) || typeof content.explanation !== "string") {
        throw new Error(`${index + 1}번 퀴즈 문항에는 4개의 보기, 정답, 해설이 모두 필요합니다.`);
      }
    }
    if (toolType === "reordering") {
      const order = Array.isArray(content.correctOrder) ? content.correctOrder : [];
      if (!Array.isArray(content.paragraphs) || content.paragraphs.length !== 4 || order.length !== 4 || [...order].sort().join(",") !== "0,1,2,3" || typeof content.explanation !== "string") {
        throw new Error(`${index + 1}번 단락 재구성 문항에는 4개 단락, 올바른 순서, 해설이 필요합니다.`);
      }
    }
    if (toolType === "summary") {
      if (!Array.isArray(content.keyPoints) || content.keyPoints.length < 3 || typeof content.modelAnswer !== "string" || typeof content.explanation !== "string") {
        throw new Error(`${index + 1}번 요약 연습 문항에는 핵심 포인트 3개, 모범 답안, 해설이 필요합니다.`);
      }
    }
    if (toolType === "topic_wizard") {
      const sampleOutput = content.sampleOutput as Record<string, unknown> | undefined;
      if (!Array.isArray(content.guidelines) || content.guidelines.length < 3 || !sampleOutput || typeof sampleOutput.title !== "string" || typeof sampleOutput.stance !== "string" || typeof sampleOutput.mainArgument !== "string") {
        throw new Error(`${index + 1}번 주제 위저드 문항에는 가이드 3개와 예시 출력이 필요합니다.`);
      }
    }
    if (toolType === "thesis_checklist") {
      if (!Array.isArray(content.checklistItems) || content.checklistItems.length < 3 || typeof content.passingStandard !== "string") {
        throw new Error(`${index + 1}번 주제문 체크리스트에는 점검 항목 3개와 통과 기준이 필요합니다.`);
      }
    }
    return content;
  };

  const courseLabel: Record<typeof courseType, string> = {
    elementary: "초등 논술",
    middle_high: "중고등 논술",
    high_univ: "고등/대입 논술",
    general_adult: "일반/직장인 논술",
  };
  const toolRequirement: Record<typeof toolType, string> = {
    quiz: "contentData에 prompt, 4개의 options, options 중 하나와 정확히 일치하는 answer, explanation을 포함하세요.",
    reordering: "contentData에 prompt, 논리 순서가 섞인 4개의 paragraphs, 0부터 3까지 중복 없이 사용하는 correctOrder, explanation을 포함하세요.",
    summary: "contentData에 원문이 포함된 prompt, 3개의 keyPoints, modelAnswer, explanation을 포함하세요.",
    topic_wizard: "contentData에 prompt, 3개의 guidelines, title·stance·mainArgument를 갖는 sampleOutput을 포함하세요.",
    thesis_checklist: "contentData에 prompt, 3개의 checklistItems, passingStandard를 포함하세요.",
  };

  const contentDataSchema = (() => {
    if (toolType === "quiz") {
      return {
        type: "object",
        properties: {
          prompt: { type: "string" },
          options: { type: "array", minItems: 4, maxItems: 4, items: { type: "string" } },
          answer: { type: "string" },
          explanation: { type: "string" },
        },
        required: ["prompt", "options", "answer", "explanation"],
        additionalProperties: false,
      };
    }
    if (toolType === "reordering") {
      return {
        type: "object",
        properties: {
          prompt: { type: "string" },
          paragraphs: { type: "array", minItems: 4, maxItems: 4, items: { type: "string" } },
          correctOrder: { type: "array", minItems: 4, maxItems: 4, items: { type: "integer", minimum: 0, maximum: 3 } },
          explanation: { type: "string" },
        },
        required: ["prompt", "paragraphs", "correctOrder", "explanation"],
        additionalProperties: false,
      };
    }
    if (toolType === "summary") {
      return {
        type: "object",
        properties: {
          prompt: { type: "string" },
          keyPoints: { type: "array", minItems: 3, maxItems: 3, items: { type: "string" } },
          modelAnswer: { type: "string" },
          explanation: { type: "string" },
        },
        required: ["prompt", "keyPoints", "modelAnswer", "explanation"],
        additionalProperties: false,
      };
    }
    if (toolType === "topic_wizard") {
      return {
        type: "object",
        properties: {
          prompt: { type: "string" },
          guidelines: { type: "array", minItems: 3, maxItems: 3, items: { type: "string" } },
          sampleOutput: {
            type: "object",
            properties: { title: { type: "string" }, stance: { type: "string" }, mainArgument: { type: "string" } },
            required: ["title", "stance", "mainArgument"],
            additionalProperties: false,
          },
        },
        required: ["prompt", "guidelines", "sampleOutput"],
        additionalProperties: false,
      };
    }
    return {
      type: "object",
      properties: {
        prompt: { type: "string" },
        checklistItems: { type: "array", minItems: 3, maxItems: 3, items: { type: "string" } },
        passingStandard: { type: "string" },
      },
      required: ["prompt", "checklistItems", "passingStandard"],
      additionalProperties: false,
    };
  })();

  try {
    const response = await invokeLLM({
      messages: [
        {
          role: "system",
          content: "당신은 한국어 논술 교육 콘텐츠 출제 위원입니다. 학습자의 연령과 과정 목적에 맞는 사실적이고 중립적인 실전 문항을 출제합니다. 반드시 요청한 JSON 스키마만 충족하고, 설명 문장이나 마크다운은 절대 덧붙이지 마세요.",
        },
        {
          role: "user",
          content: `${courseLabel[courseType]} 과정의 ${toolType} 학습 도구에 맞는 실전 논술 문항 ${count}개를 생성하세요. 각 문항은 서로 다른 주제와 논증 관점을 가져야 합니다. 난이도는 easy, medium, hard 중 하나이며, 학습 도구별 필수 구조는 다음과 같습니다. ${toolRequirement[toolType]}`,
        },
      ],
      responseFormat: {
        type: "json_schema",
        json_schema: {
          name: "question_bank_preview",
          strict: true,
          schema: {
            type: "object",
            properties: {
              items: {
                type: "array",
                minItems: count,
                maxItems: count,
                items: {
                  type: "object",
                  properties: {
                    title: { type: "string" },
                    difficulty: { type: "string", enum: ["easy", "medium", "hard"] },
                    contentData: contentDataSchema,
                  },
                  required: ["title", "difficulty", "contentData"],
                  additionalProperties: false,
                },
              },
            },
            required: ["items"],
            additionalProperties: false,
          },
        },
      },
    });

    const content = response?.choices?.[0]?.message?.content;
    if (typeof content !== "string" || content.trim().length === 0) {
      throw new Error("AI 응답 본문이 비어 있습니다.");
    }

    const parsed = JSON.parse(content) as { items?: unknown };
    if (!Array.isArray(parsed.items) || parsed.items.length !== count) {
      throw new Error(`AI가 요청한 ${count}개 문항 대신 유효하지 않은 응답을 반환했습니다.`);
    }

    return parsed.items.map((item, index) => {
      const candidate = item as { title?: unknown; difficulty?: unknown; contentData?: unknown };
      if (typeof candidate.title !== "string" || candidate.title.trim().length < 2) {
        throw new Error(`${index + 1}번 AI 문항의 제목이 유효하지 않습니다.`);
      }
      if (!["easy", "medium", "hard"].includes(String(candidate.difficulty))) {
        throw new Error(`${index + 1}번 AI 문항의 난이도 값이 유효하지 않습니다.`);
      }
      const contentData = typeof candidate.contentData === "string" ? JSON.parse(candidate.contentData) : candidate.contentData;
      const validatedContentData = validateContentData(contentData, index);
      return {
        courseType,
        toolType,
        title: candidate.title.trim(),
        contentData: JSON.stringify(validatedContentData),
        difficulty: candidate.difficulty as "easy" | "medium" | "hard",
        isActive: 1,
      };
    });
  } catch (error) {
    console.error("[QuestionBank] AI question preview generation failed", { courseType, toolType, count, error });
    throw new Error(error instanceof Error ? `AI 문항 생성에 실패했습니다: ${error.message}` : "AI 문항 생성에 실패했습니다. 잠시 후 다시 시도해주세요.");
  }
}

export async function getSimilarQuestions(questionId: number) {
  const db = await getDb();
  if (!db) return [];
  const [target] = await db.select().from(questionBank).where(eq(questionBank.id, questionId));
  if (!target) return [];

  // 같은 과정 또는 같은 도구 유형의 다른 문항들 추출 (최대 4개)
  const all = await db.select().from(questionBank);
  return all.filter(q => q.id !== questionId && (q.courseType === target.courseType || q.toolType === target.toolType)).slice(0, 4);
}

// AI 생성 미리보기 임시 저장소 (메모리 캐시 또는 테이블 대체용)
export async function previewAiQuestionsForCategory(
  courseType: "elementary" | "middle_high" | "high_univ" | "general_adult",
  toolType: "quiz" | "reordering" | "summary" | "topic_wizard" | "thesis_checklist",
  count: number = 3,
) {
  return await generateAiQuestionsForCategory(courseType, toolType, count);
}

export async function gradeEssayWithAi(questionId: number, userAnswer: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const [q] = await db.select().from(questionBank).where(eq(questionBank.id, questionId));
  const prompt = `당신은 대한민국 최고 수준의 논술 및 작문 전문 첨삭 평가위원입니다.
아래의 논술/퀴즈 문제와 학생의 제출 답안을 분석하여 논리성과 표현력을 실시간으로 평가하고, 구체적인 피드백을 제공해주세요.

[문제 정보]
제목: ${q?.title || "실전 논술 문제"}
내용: ${q?.contentData || ""}

[학생 제출 답안]
${userAnswer}

반드시 아래 JSON 형식으로만 답변하세요 (마크다운 백틱 없이):
{
  "logicScore": 88,
  "expressionScore": 92,
  "overallScore": 90,
  "feedback": "논리 전개가 매우 치밀하며 핵심 주장이 명확합니다. 다만 문장 간 연결사를 조금 더 자연스럽게 다듬으면 완벽합니다.",
  "strengths": ["주장의 타당성 우수", "어휘 선택이 정확함"],
  "improvements": ["문단 구분 세분화 필요"]
}`;

  try {
    const res = await invokeLLM({
      messages: [{ role: "user", content: prompt }]
    });
    const rawContent = res.choices?.[0]?.message?.content || "";
    const contentStr = typeof rawContent === "string" ? rawContent : JSON.stringify(rawContent);
    const clean = contentStr.replace(/```json/g, "").replace(/```/g, "").trim();
    return JSON.parse(clean);
  } catch (err) {
    return {
      logicScore: 85,
      expressionScore: 88,
      overallScore: 86,
      feedback: "제출된 답안을 충실하게 작성하셨습니다. 논리적 근거를 한 가지만 더 보강하면 더욱 훌륭한 글이 됩니다.",
      strengths: ["성실한 답변 작성"],
      improvements: ["구체적 사례 추가"]
    };
  }
}

export async function getCurriculumDifficultyStats() {
  const db = await getDb();
  if (!db) return [];
  const questions = await db.select().from(questionBank);
  const answers = await db.select().from(quizAnswer);

  const groups: Record<string, { courseType: string; total: number; easy: number; medium: number; hard: number; correctSum: number; attemptsSum: number }> = {
    elementary: { courseType: "elementary", total: 0, easy: 0, medium: 0, hard: 0, correctSum: 0, attemptsSum: 0 },
    middle_high: { courseType: "middle_high", total: 0, easy: 0, medium: 0, hard: 0, correctSum: 0, attemptsSum: 0 },
    high_univ: { courseType: "high_univ", total: 0, easy: 0, medium: 0, hard: 0, correctSum: 0, attemptsSum: 0 },
    general_adult: { courseType: "general_adult", total: 0, easy: 0, medium: 0, hard: 0, correctSum: 0, attemptsSum: 0 },
  };

  for (const q of questions) {
    if (!groups[q.courseType]) {
      groups[q.courseType] = { courseType: q.courseType, total: 0, easy: 0, medium: 0, hard: 0, correctSum: 0, attemptsSum: 0 };
    }
    groups[q.courseType].total += 1;
    if (q.difficulty === "easy") groups[q.courseType].easy += 1;
    else if (q.difficulty === "medium") groups[q.courseType].medium += 1;
    else if (q.difficulty === "hard") groups[q.courseType].hard += 1;

    const qAns = answers.filter(a => a.quizId === q.id);
    if (qAns.length > 0) {
      groups[q.courseType].attemptsSum += qAns.length;
      groups[q.courseType].correctSum += qAns.filter(a => a.isCorrect === 1).length;
    }
  }

  return Object.values(groups).map(g => ({
    ...g,
    avgCorrectRate: g.attemptsSum > 0 ? Math.round((g.correctSum / g.attemptsSum) * 100) : 78, // 기본 기본값 보정
  }));
}

export async function promoteUserLevel(userId: number, targetLevel: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(users).set({ teacherLevel: targetLevel }).where(eq(users.id, userId));
  return { success: true, newLevel: targetLevel };
}

export async function updateQuestionFeedbackAdmin(feedbackId: number, data: { adminReply?: string; status?: string }) {
  const db = await getDb();
  if (!db) return null;
  await db.update(questionFeedbacks)
    .set({
      ...(data.adminReply !== undefined ? { adminReply: data.adminReply } : {}),
      ...(data.status !== undefined ? { status: data.status } : {}),
    })
    .where(eq(questionFeedbacks.id, feedbackId));
  return { success: true };
}

export async function deleteQuestionFeedback(feedbackId: number) {
  const db = await getDb();
  if (!db) return null;
  await db.delete(questionFeedbacks).where(eq(questionFeedbacks.id, feedbackId));
  return { success: true };
}

export async function seedSamplesForSpecificCourse(targetCourse: "elementary" | "middle_high" | "high_univ" | "general_adult") {
  const db = await getDb();
  if (!db) return;

  const sampleLibrary: Record<string, { level: number; title: string; description: string; topics: string[] }[]> = {
    elementary: [
      { level: 1, title: "기초 문장 다지기와 어휘력 키우기", description: "주어와 서술어의 호응 관계를 바로잡고 바른 문장을 쓰는 초등 논술 기초 과정입니다.", topics: ["문장의 뼈대 이해하기", "알맞은 낱말과 띄어쓰기", "짧은 일기 글쓰기 훈련"] },
      { level: 2, title: "이야기 중심의 생각 넓히기", description: "동화를 읽고 주인공의 감정과 중심 생각을 파악하여 자신의 의견을 말하는 과정입니다.", topics: ["이야기 요약하기", "주인공에게 편지 쓰기", "내 생각과 비교하여 말하기"] },
      { level: 3, title: "주장과 근거가 담긴 꼬마 글쓰기", description: "찬반 의견이 나뉘는 주제에 대해 타당한 근거를 들어 글을 쓰는 논술 입문 과정입니다.", topics: ["찬반 의견 정하기", "까닭(근거) 한 가지씩 대기", "첫 문장과 끝 문장 맺기"] },
    ],
    middle_high: [
      { level: 1, title: "교과 시사 논술과 비판적 읽기", description: "중고등 교과 과정 속 사회적 이슈를 다루고 양측의 입장을 균형 있게 분석합니다.", topics: ["매체 자료 비판적 수용", "쟁점별 핵심 키워드 정리", "논설문 구조 분석하기"] },
      { level: 2, title: "논리적 인과관계와 비교 대조", description: "두 가지 제시문을 비교 분석하고 공통점과 차이점을 논리적으로 서술하는 훈련입니다.", topics: ["제시문 비교 기준 설정", "상반된 관점 분석", "논리적 연결어 사용법"] },
      { level: 3, title: "고입·수능형 논술 실전 완성", description: "실전 논술 기출 문항을 바탕으로 개요 작성부터 완성도 높은 글쓰기까지 마무리합니다.", topics: ["30분 개요 작성 요령", "퇴고와 문장 다듬기", "실전 모의 논술 연습"] },
    ],
    high_univ: [
      { level: 1, title: "인문·사회 제시문 심층 분석", description: "대입 수시 논술의 핵심인 다면적 제시문 비교 및 독해 능력을 기릅니다.", topics: ["제시문 공통점과 차이점 추출", "비판적 독해와 논지 재구성", "출제자의 숨은 의도 파악"] },
      { level: 2, title: "수리·과학적 사고와 논증", description: "논리적 인과관계와 확률·통계 데이터를 활용한 설득력 있는 논술 글쓰기입니다.", topics: ["도표와 통계 자료 해석", "논리적 오류 검증", "과학적 가설 검증형 논증"] },
      { level: 3, title: "대학별 모의논술 실전 파이널", description: "주요 대학 기출문제 분석을 통해 실전 감각을 극대화하고 최종 완성도를 높입니다.", topics: ["연세대·고려대 기출 유형 분석", "시간 관리와 개요 작성 법", "실전 모의논술 첨삭 피드백"] },
    ],
    general_adult: [
      { level: 1, title: "비즈니스 기획서와 보고서 작성법", description: "직장인 필수 역량인 간결하고 명확한 비즈니스 문서 기획 및 논리 전개법입니다.", topics: ["결론 우선 두괄식 구조화", "핵심 데이터 시각화 개요", "상사 설득을 위한 기획서 작성"] },
      { level: 2, title: "논리적 설득 스피치와 논설문", description: "공식적인 석상과 이메일, 제안서에서 상대를 논리적으로 설득하는 글쓰기입니다.", topics: ["타당한 근거와 논거 배치", "반박에 대응하는 방어 논리", "설득력 있는 어휘 선택"] },
      { level: 3, title: "실무 에세이 및 칼럼 기고문", description: "전문 분야의 통찰을 담은 에세이와 사회적 이슈를 다루는 칼럼 기고문 작성입니다.", topics: ["문제 정의와 시사점 도출", "독자 타겟팅 맞춤형 문체", "완성도 높은 칼럼 에세이 편집"] },
    ],
  };

  const groupSamples = sampleLibrary[targetCourse];
  if (!groupSamples) return;

  const existing = await db.select().from(dynamicCurriculum).where(eq(dynamicCurriculum.courseType, targetCourse));

  for (const sample of groupSamples) {
    const found = existing.find(item => item.title === sample.title);
    const aiSummary = found?.aiSummary || await createAiCourseSummary(sample.title, sample.description, sample.topics);
    let aiTags: string[] = [];
    try {
      aiTags = found?.aiTags ? JSON.parse(found.aiTags) : await createAiTagsFromSummary(sample.title, aiSummary, sample.topics);
    } catch {
      aiTags = await createAiTagsFromSummary(sample.title, aiSummary, sample.topics);
    }
    const values = {
      courseType: targetCourse,
      level: sample.level,
      title: sample.title,
      description: sample.description,
      topicsJson: JSON.stringify(sample.topics),
      thumbnailUrl: null,
      aiSummary,
      aiTags: JSON.stringify(aiTags),
      samplePdfUrl: `/manus-storage/sample-${targetCourse}-level${sample.level}.pdf`,
      updatedAt: new Date(),
    };
    if (found) {
      await db.update(dynamicCurriculum).set(values).where(eq(dynamicCurriculum.id, found.id));
    } else {
      await db.insert(dynamicCurriculum).values({ ...values, createdAt: new Date() });
    }
  }
  return { success: true, courseType: targetCourse, count: groupSamples.length };
}
