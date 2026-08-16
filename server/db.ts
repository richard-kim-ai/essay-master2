import { drizzle } from "drizzle-orm/mysql2";
import {
  InsertUser,
  users,
  curriculum,
  progress,
  quizAnswer,
  certificate,
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
  type InsertSocialProviderConfig,
  type InsertPushSubscription,
} from "../drizzle/schema";
import { eq, and, desc, gte } from "drizzle-orm";
import { ENV } from "./_core/env";
import { invokeLLM } from "./_core/llm";

let _db: ReturnType<typeof drizzle> | null = null;

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

export async function updateUserEmailVerified(userId: number) {
  const db = await getDb();
  if (!db) return;

  await db.update(users).set({ emailVerifiedAt: new Date() }).where(eq(users.id, userId));
}

export async function updateTeacherStatus(userId: number, teacherStatus: "pending" | "approved" | "rejected") {
  const db = await getDb();
  if (!db) return;

  await db.update(users).set({ teacherStatus }).where(eq(users.id, userId));
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
  if (!db) return [];

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
  if (!db) throw new Error("Database is not available");

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

  const [result] = await db.insert(certificate).values(input);
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

  const submissions = await getEssaySubmissionsByUser(userId);
  const userProgress = await getProgressByUser(userId);
  const userCerts = await getCertificatesByUser(userId);
  const aiFeedbacks = await getAIAutoFeedbackByUser(userId);

  return {
    user: {
      id: userRecord.id,
      name: userRecord.name,
      email: userRecord.email,
      role: userRecord.role,
      createdAt: userRecord.createdAt,
      lastSignedIn: userRecord.lastSignedIn,
      adminNotes: userRecord.adminNotes,
    },
    submissions,
    progress: userProgress,
    certificates: userCerts,
    aiFeedbacks,
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
  if (!db) return null;
  const [row] = await db.select().from(siteSettings).where(eq(siteSettings.settingKey, settingKey));
  return row?.content ?? "";
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
  return true;
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

export async function getLinkedStudentsForParent(parentId: number) {
  const db = await getDb();
  if (!db) return [];
  const links = await db.select().from(parentStudentLinks).where(eq(parentStudentLinks.parentId, parentId));
  const studentIds = links.map(l => l.studentId);
  if (studentIds.length === 0) return [];
  
  const allU = await db.select().from(users);
  return allU.filter(u => studentIds.includes(u.id));
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
    return { success: true, studentId: student.id };
  }
  await db.insert(parentStudentLinks).values({
    parentId,
    studentId: student.id,
  });
  return { success: true, studentId: student.id };
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
  const activeList = list.filter(q => q.isActive === 1);
  // 무작위 셔플 후 limit 개수만큼 반환
  const shuffled = [...activeList].sort(() => 0.5 - Math.random());
  return shuffled.slice(0, limit);
}

export async function createQuestionBankItem(data: {
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

export async function deleteQuestionBankItem(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  await db.delete(questionBank).where(eq(questionBank.id, id));
  return true;
}

// 초기 50개 * 4과정 = 200개 이상 시드 데이터 자동 주입 함수 (최초 1회 또는 필요시 실행)
export async function seedQuestionBankIfNeeded() {
  const list = await getQuestionBankList();
  if (list.length >= 200) return; // 이미 충분히 존재함

  const courseTypes = ["elementary", "middle_high", "high_univ", "general_adult"] as const;
  const toolTypes = ["quiz", "reordering", "summary", "topic_wizard", "thesis_checklist"] as const;

  const db = await getDb();
  if (!db) return;

  for (const c of courseTypes) {
    for (const t of toolTypes) {
      // 각 과정별 정확히 50문항 (5개 도구 * 10개 = 과정당 50개, 총 4과정 * 50 = 200문항)
      for (let i = 1; i <= 10; i++) {
        await db.insert(questionBank).values({
          courseType: c,
          toolType: t,
          title: `[${c.toUpperCase()}] ${t.toUpperCase()} 실전 문항 #${i}`,
          contentData: JSON.stringify({
            prompt: `${c} 과정 ${t} 학습을 위한 맞춤형 심화 프롬프트 #${i}`,
            options: t === "quiz" ? ["보기 1: 올바른 논증 구조", "보기 2: 주어와 술어의 호응 오류", "보기 3: 불필요한 수식어 과다", "보기 4: 문맥 단절"] : undefined,
            answer: t === "quiz" ? "보기 1: 올바른 논증 구조" : "모범 답안 및 핵심 키워드 해설",
            explanation: `${c} 학습자의 사고력 증진을 위한 해설 #${i}`,
          }),
          difficulty: i % 3 === 0 ? "hard" : i % 2 === 0 ? "medium" : "easy",
          isActive: 1,
        });
      }
    }
  }
}
