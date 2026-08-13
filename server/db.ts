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
  type InsertSocialProviderConfig,
  type InsertPushSubscription,
} from "../drizzle/schema";
import { eq, and, desc, gte } from "drizzle-orm";
import { ENV } from "./_core/env";

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

export async function getCurriculumByType(courseType: "elementary" | "middle_high") {
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
    .where(eq(certificate.userId, userId));
}

export async function getCertificateByShareToken(shareToken: string) {
  const db = await getDb();
  if (!db) return undefined;

  const result = await db
    .select()
    .from(certificate)
    .where(eq(certificate.shareToken, shareToken));

  return result[0];
}

export async function issueCertificate(input: {
  userId: number;
  courseType: "elementary" | "middle_high";
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
  courseType: "elementary" | "middle_high";
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
}) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  await db.insert(users).values({
    openId: input.openId,
    name: input.name ?? null,
    email: input.email ?? null,
    passwordHash: input.passwordHash ?? null,
    loginMethod: input.loginMethod ?? "email",
    emailVerifiedAt: input.emailVerifiedAt ?? null,
    verificationTokenHash: input.verificationTokenHash ?? null,
    verificationTokenExpiresAt: input.verificationTokenExpiresAt ?? null,
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
      loginMethod: u.loginMethod,
      createdAt: u.createdAt,
      lastSignedIn: u.lastSignedIn,
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
    },
    submissions,
    progress: userProgress,
    certificates: userCerts,
    aiFeedbacks,
  };
}
