import { int, mysqlEnum, mysqlTable, text, timestamp, varchar, decimal } from "drizzle-orm/mysql-core";

/**
 * Core user table backing auth flow.
 * Extend this file with additional tables as your product grows.
 * Columns use camelCase to match both database fields and generated types.
 */
export const users = mysqlTable("users", {
  /**
   * Surrogate primary key. Auto-incremented numeric value managed by the database.
   * Use this for relations between tables.
   */
  id: int("id").autoincrement().primaryKey(),
  /** Manus OAuth identifier (openId) returned from the OAuth callback. Unique per user. */
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  passwordHash: text("passwordHash"),
  emailVerifiedAt: timestamp("emailVerifiedAt"),
  verificationTokenHash: varchar("verificationTokenHash", { length: 128 }),
  verificationTokenExpiresAt: timestamp("verificationTokenExpiresAt"),
  passwordResetTokenHash: varchar("passwordResetTokenHash", { length: 128 }),
  passwordResetTokenExpiresAt: timestamp("passwordResetTokenExpiresAt"),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

export const socialProviderConfig = mysqlTable("social_provider_config", {
  id: int("id").autoincrement().primaryKey(),
  provider: mysqlEnum("provider", ["google", "kakao", "naver"]).notNull().unique(),
  clientId: varchar("clientId", { length: 512 }),
  clientSecretEncrypted: text("clientSecretEncrypted"),
  enabled: int("enabled").default(0).notNull(),
  updatedBy: int("updatedBy"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type SocialProviderConfig = typeof socialProviderConfig.$inferSelect;
export type InsertSocialProviderConfig = typeof socialProviderConfig.$inferInsert;

export const appSecretConfig = mysqlTable("app_secret_config", {
  id: int("id").autoincrement().primaryKey(),
  settingKey: varchar("settingKey", { length: 128 }).notNull().unique(),
  encryptedValue: text("encryptedValue"),
  updatedBy: int("updatedBy"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type AppSecretConfig = typeof appSecretConfig.$inferSelect;
export type InsertAppSecretConfig = typeof appSecretConfig.$inferInsert;

export const pushSubscription = mysqlTable("push_subscription", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  endpoint: text("endpoint").notNull(),
  endpointHash: varchar("endpointHash", { length: 64 }).notNull().unique(),
  p256dh: varchar("p256dh", { length: 255 }).notNull(),
  auth: varchar("auth", { length: 255 }).notNull(),
  userAgent: text("userAgent"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type PushSubscription = typeof pushSubscription.$inferSelect;
export type InsertPushSubscription = typeof pushSubscription.$inferInsert;

// 커리큘럼 테이블
export const curriculum = mysqlTable("curriculum", {
  id: int("id").autoincrement().primaryKey(),
  courseType: mysqlEnum("courseType", ["elementary", "middle_high"]).notNull(),
  level: int("level").notNull(),
  title: varchar("title", { length: 255 }).notNull(),
  description: text("description"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type Curriculum = typeof curriculum.$inferSelect;
export type InsertCurriculum = typeof curriculum.$inferInsert;

// 학습 진도 테이블
export const progress = mysqlTable("progress", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  curriculumId: int("curriculumId").notNull(),
  score: int("score").default(0),
  completed: int("completed").default(0), // 0 or 1
  completedAt: timestamp("completedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Progress = typeof progress.$inferSelect;
export type InsertProgress = typeof progress.$inferInsert;

// 퀴즈 답변 테이블
export const quizAnswer = mysqlTable("quiz_answer", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  quizId: int("quizId").notNull(),
  userAnswer: text("userAnswer").notNull(),
  isCorrect: int("isCorrect").default(0), // 0 or 1
  feedback: text("feedback"),
  economyScore: decimal("economyScore", { precision: 3, scale: 2 }), // 경제성 점수 (0-1)
  clarityScore: decimal("clarityScore", { precision: 3, scale: 2 }), // 명료성 점수 (0-1)
  accuracyScore: decimal("accuracyScore", { precision: 3, scale: 2 }), // 정확성 점수 (0-1)
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type QuizAnswer = typeof quizAnswer.$inferSelect;
export type InsertQuizAnswer = typeof quizAnswer.$inferInsert;

// 수료증 테이블
export const certificate = mysqlTable("certificate", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  courseType: mysqlEnum("courseType", ["elementary", "middle_high"]).notNull(),
  level: int("level"),
  certificateType: mysqlEnum("certificateType", ["level_certificate", "graduation_certificate"]).notNull(),
  shareToken: varchar("shareToken", { length: 64 }).unique(),
  pdfUrl: text("pdfUrl"),
  issuedAt: timestamp("issuedAt").defaultNow().notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type Certificate = typeof certificate.$inferSelect;
export type InsertCertificate = typeof certificate.$inferInsert;

// 학생 논술 제출 테이블
export const essaySubmission = mysqlTable("essay_submission", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  curriculumId: int("curriculumId"),
  title: varchar("title", { length: 255 }).notNull(),
  content: text("content").notNull(),
  status: mysqlEnum("status", ["draft", "submitted", "reviewed"]).default("draft").notNull(),
  submittedAt: timestamp("submittedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type EssaySubmission = typeof essaySubmission.$inferSelect;
export type InsertEssaySubmission = typeof essaySubmission.$inferInsert;

// 선생님 첨삭 피드백 테이블
export const teacherFeedback = mysqlTable("teacher_feedback", {
  id: int("id").autoincrement().primaryKey(),
  essayId: int("essayId").notNull(),
  teacherId: int("teacherId").notNull(),
  overallComment: text("overallComment"),
  overallScore: int("overallScore"), // 0-100
  structureScore: int("structureScore"), // 구조 점수
  logicScore: int("logicScore"), // 논리력 점수
  expressionScore: int("expressionScore"), // 표현력 점수
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type TeacherFeedback = typeof teacherFeedback.$inferSelect;
export type InsertTeacherFeedback = typeof teacherFeedback.$inferInsert;

// 첨삭 코멘트 테이블 (문장별 코멘트)
export const feedbackComment = mysqlTable("feedback_comment", {
  id: int("id").autoincrement().primaryKey(),
  feedbackId: int("feedbackId").notNull(),
  lineNumber: int("lineNumber").notNull(),
  startIndex: int("startIndex").notNull(),
  endIndex: int("endIndex").notNull(),
  comment: text("comment").notNull(),
  commentType: mysqlEnum("commentType", ["grammar", "logic", "expression", "structure", "other"]).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type FeedbackComment = typeof feedbackComment.$inferSelect;
export type InsertFeedbackComment = typeof feedbackComment.$inferInsert;

// AI 자동 첨삭 결과 테이블
export const aiAutoFeedback = mysqlTable("ai_auto_feedback", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  essayTitle: varchar("essayTitle", { length: 255 }).notNull(),
  essayContent: text("essayContent").notNull(),
  courseType: mysqlEnum("courseType", ["elementary", "middle_high"]).notNull(),
  level: int("level").notNull(),
  overallComment: text("overallComment"),
  structureScore: int("structureScore"), // 0-100
  logicScore: int("logicScore"), // 0-100
  expressionScore: int("expressionScore"), // 0-100
  overallScore: int("overallScore"), // 0-100
  suggestions: text("suggestions"), // JSON array
  strengths: text("strengths"), // JSON array
  weaknesses: text("weaknesses"), // JSON array
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type AIAutoFeedback = typeof aiAutoFeedback.$inferSelect;
export type InsertAIAutoFeedback = typeof aiAutoFeedback.$inferInsert;
