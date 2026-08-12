import { and, eq } from "drizzle-orm";
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
  type InsertSocialProviderConfig,
  type InsertPushSubscription,
} from "../drizzle/schema";
import { ENV } from "./_core/env";

let _db: ReturnType<typeof drizzle> | null = null;

// Lazily create the drizzle instance so local tooling can run without a DB.
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

    if (Object.keys(updateSet).length === 0) {
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
  if (!db) {
    console.warn("[Database] Cannot get user: database not available");
    return undefined;
  }

  const result = await db
    .select()
    .from(users)
    .where(eq(users.openId, openId))
    .limit(1);

  return result.length > 0 ? result[0] : undefined;
}

export async function updateUserSocialProfile(userId: number, name: string | null, email: string | null, loginMethod: string) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  await db.update(users).set({ name, email, loginMethod, emailVerifiedAt: new Date(), lastSignedIn: new Date() }).where(eq(users.id, userId));
  const result = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  return result[0];
}

export async function updateUserSocialIdentity(userId: number, openId: string, name: string | null, email: string | null, loginMethod: string) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  await db.update(users).set({ openId, name, email, loginMethod, emailVerifiedAt: new Date(), lastSignedIn: new Date() }).where(eq(users.id, userId));
  return getUserByOpenId(openId);
}

export async function getUserByEmail(email: string) {
  const db = await getDb();
  if (!db) return undefined;

  const result = await db
    .select()
    .from(users)
    .where(eq(users.email, email))
    .limit(1);

  return result.length > 0 ? result[0] : undefined;
}

export async function createEmailUser(user: InsertUser) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");

  await db.insert(users).values(user);
  return getUserByOpenId(user.openId);
}

export async function updateVerificationToken(
  userId: number,
  tokenHash: string,
  expiresAt: Date,
) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");

  await db
    .update(users)
    .set({ verificationTokenHash: tokenHash, verificationTokenExpiresAt: expiresAt })
    .where(eq(users.id, userId));
}

export async function getUserByVerificationTokenHash(tokenHash: string) {
  const db = await getDb();
  if (!db) return undefined;

  const result = await db
    .select()
    .from(users)
    .where(eq(users.verificationTokenHash, tokenHash))
    .limit(1);

  return result.length > 0 ? result[0] : undefined;
}

export async function markEmailVerified(userId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");

  await db
    .update(users)
    .set({
      emailVerifiedAt: new Date(),
      verificationTokenHash: null,
      verificationTokenExpiresAt: null,
    })
    .where(eq(users.id, userId));

  return db.select().from(users).where(eq(users.id, userId)).limit(1);
}

export async function updateUserLastSignedIn(userId: number) {
  const db = await getDb();
  if (!db) return;

  await db.update(users).set({ lastSignedIn: new Date() }).where(eq(users.id, userId));
}

export async function updatePasswordResetToken(userId: number, tokenHash: string, expiresAt: Date) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  await db.update(users).set({ passwordResetTokenHash: tokenHash, passwordResetTokenExpiresAt: expiresAt }).where(eq(users.id, userId));
}

export async function getUserByPasswordResetTokenHash(tokenHash: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(users).where(eq(users.passwordResetTokenHash, tokenHash)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function resetUserPassword(userId: number, passwordHash: string) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  await db.update(users).set({ passwordHash, passwordResetTokenHash: null, passwordResetTokenExpiresAt: null }).where(eq(users.id, userId));
}

export async function listSocialProviderConfigs() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(socialProviderConfig);
}

export async function getSocialProviderConfig(provider: "google" | "kakao" | "naver") {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(socialProviderConfig).where(eq(socialProviderConfig.provider, provider)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function upsertSocialProviderConfig(input: InsertSocialProviderConfig) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  await db.insert(socialProviderConfig).values(input).onDuplicateKeyUpdate({
    set: {
      clientId: input.clientId ?? null,
      clientSecretEncrypted: input.clientSecretEncrypted ?? null,
      enabled: input.enabled ?? 0,
      updatedBy: input.updatedBy ?? null,
    },
  });
}

export async function getAppSecretConfig(settingKey: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(appSecretConfig).where(eq(appSecretConfig.settingKey, settingKey)).limit(1);
  return result.length > 0 ? result[0] : undefined;
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
    .where(eq(curriculum.id, id))
    .limit(1);

  return result.length > 0 ? result[0] : undefined;
}

export async function insertCurriculum(data: {
  courseType: "elementary" | "middle_high";
  level: number;
  title: string;
  description?: string;
}) {
  const db = await getDb();
  if (!db) return undefined;

  const result = await db.insert(curriculum).values(data);
  return result;
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

export async function getProgressByUserAndCurriculum(userId: number, curriculumId: number) {
  const db = await getDb();
  if (!db) return undefined;

  const result = await db
    .select()
    .from(progress)
    .where(and(eq(progress.userId, userId), eq(progress.curriculumId, curriculumId)))
    .limit(1);

  return result.length > 0 ? result[0] : undefined;
}

export async function upsertProgress(data: {
  userId: number;
  curriculumId: number;
  score: number;
  completed: number;
  completedAt?: Date;
}) {
  const db = await getDb();
  if (!db) return undefined;

  const existing = await getProgressByUserAndCurriculum(data.userId, data.curriculumId);

  if (existing) {
    return await db
      .update(progress)
      .set({
        score: data.score,
        completed: data.completed,
        completedAt: data.completedAt,
        updatedAt: new Date(),
      })
      .where(eq(progress.id, existing.id));
  } else {
    return await db.insert(progress).values(data);
  }
}

// ========== Quiz Answer Functions ==========

export async function saveQuizAnswer(data: {
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
  if (!db) return undefined;

  return await db.insert(quizAnswer).values(data);
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
    .where(eq(certificate.shareToken, shareToken))
    .limit(1);

  return result.length > 0 ? result[0] : undefined;
}

export async function issueCertificate(data: {
  userId: number;
  courseType: "elementary" | "middle_high";
  level?: number;
  certificateType: "level_certificate" | "graduation_certificate";
  shareToken: string;
  pdfUrl?: string;
}) {
  const db = await getDb();
  if (!db) return undefined;

  return await db.insert(certificate).values(data);
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
    .where(eq(essaySubmission.id, id))
    .limit(1);

  return result.length > 0 ? result[0] : undefined;
}

export async function createEssaySubmission(data: {
  userId: number;
  curriculumId?: number;
  title: string;
  content: string;
  status?: "draft" | "submitted" | "reviewed";
}) {
  const db = await getDb();
  if (!db) return undefined;

  return await db.insert(essaySubmission).values({
    ...data,
    status: data.status || "draft",
  });
}

export async function updateEssaySubmission(
  id: number,
  data: {
    title?: string;
    content?: string;
    status?: "draft" | "submitted" | "reviewed";
    submittedAt?: Date;
  }
) {
  const db = await getDb();
  if (!db) return undefined;

  return await db
    .update(essaySubmission)
    .set({
      ...data,
      updatedAt: new Date(),
    })
    .where(eq(essaySubmission.id, id));
}

// ========== Teacher Feedback Functions ==========

export async function getTeacherFeedbackByEssay(essayId: number) {
  const db = await getDb();
  if (!db) return undefined;

  const result = await db
    .select()
    .from(teacherFeedback)
    .where(eq(teacherFeedback.essayId, essayId))
    .limit(1);

  return result.length > 0 ? result[0] : undefined;
}

export async function createTeacherFeedback(data: {
  essayId: number;
  teacherId: number;
  overallComment?: string;
  overallScore?: number;
  structureScore?: number;
  logicScore?: number;
  expressionScore?: number;
}) {
  const db = await getDb();
  if (!db) return undefined;

  return await db.insert(teacherFeedback).values(data);
}

export async function updateTeacherFeedback(
  id: number,
  data: {
    overallComment?: string;
    overallScore?: number;
    structureScore?: number;
    logicScore?: number;
    expressionScore?: number;
  }
) {
  const db = await getDb();
  if (!db) return undefined;

  return await db
    .update(teacherFeedback)
    .set({
      ...data,
      updatedAt: new Date(),
    })
    .where(eq(teacherFeedback.id, id));
}

// ========== Feedback Comment Functions ==========

export async function getFeedbackCommentsByFeedback(feedbackId: number) {
  const db = await getDb();
  if (!db) return [];

  return await db
    .select()
    .from(feedbackComment)
    .where(eq(feedbackComment.feedbackId, feedbackId));
}

export async function createFeedbackComment(data: {
  feedbackId: number;
  lineNumber: number;
  startIndex: number;
  endIndex: number;
  comment: string;
  commentType: "grammar" | "logic" | "expression" | "structure" | "other";
}) {
  const db = await getDb();
  if (!db) return undefined;

  return await db.insert(feedbackComment).values(data);
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

export async function createAIAutoFeedback(data: {
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
  suggestions?: string; // JSON array
  strengths?: string; // JSON array
  weaknesses?: string; // JSON array
}) {
  const db = await getDb();
  if (!db) return undefined;

  return await db.insert(aiAutoFeedback).values(data);
}
