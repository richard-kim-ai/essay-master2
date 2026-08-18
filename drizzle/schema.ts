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
  avatarUrl: text("avatarUrl"),
  loginMethod: varchar("loginMethod", { length: 64 }),
  passwordHash: text("passwordHash"),
  emailVerifiedAt: timestamp("emailVerifiedAt"),
  verificationTokenHash: varchar("verificationTokenHash", { length: 128 }),
  verificationTokenExpiresAt: timestamp("verificationTokenExpiresAt"),
  passwordResetTokenHash: varchar("passwordResetTokenHash", { length: 128 }),
  passwordResetTokenExpiresAt: timestamp("passwordResetTokenExpiresAt"),
  role: mysqlEnum("role", ["user", "teacher", "admin"]).default("user").notNull(),
  teacherLevel: int("teacherLevel").default(1), // 1: 주니어 첨삭교사, 2: 시니어 첨삭교사, 3: 수석 교사(커리큘럼/반 관리)
  teacherStatus: mysqlEnum("teacherStatus", ["pending", "approved", "rejected"]).default("approved").notNull(), // 교사 가입 승인 상태
  teacherId: int("teacherId"), // 학생이 배정된 담당 교사 ID
  preferredTeacherId: int("preferredTeacherId"), // 학생 가입 시 선택한 추천 교사 ID (관리자 배정 전 희망값)
  adminNotes: text("adminNotes"),
  tag: varchar("tag", { length: 64 }).default("일반").notNull(),
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

export const parentStudentLinks = mysqlTable("parent_student_links", {
  id: int("id").autoincrement().primaryKey(),
  parentId: int("parentId").notNull(),
  studentId: int("studentId").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type ParentStudentLink = typeof parentStudentLinks.$inferSelect;
export type InsertParentStudentLink = typeof parentStudentLinks.$inferInsert;

// 학습자는 학급 또는 주제별 그룹에 소속될 수 있으며, 그룹마다 승인 교사를 한 명 지정합니다.
export const learningGroups = mysqlTable("learning_groups", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 160 }).notNull(),
  groupType: mysqlEnum("groupType", ["class", "group"]).default("class").notNull(),
  courseType: mysqlEnum("courseType", ["elementary", "middle_high", "high_univ", "general_adult"]),
  description: text("description"),
  teacherId: int("teacherId"),
  isActive: int("isActive").default(1).notNull(),
  createdBy: int("createdBy").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export const learningGroupMembers = mysqlTable("learning_group_members", {
  id: int("id").autoincrement().primaryKey(),
  groupId: int("groupId").notNull(),
  studentId: int("studentId").notNull(),
  addedBy: int("addedBy").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type LearningGroup = typeof learningGroups.$inferSelect;
export type LearningGroupMember = typeof learningGroupMembers.$inferSelect;

// 반 운영에서 출결을 일자별로 기록하고 교사가 담당 학생의 참여 상태를 확인합니다.
export const classAttendance = mysqlTable("class_attendance", {
  id: int("id").autoincrement().primaryKey(),
  groupId: int("groupId").notNull(),
  studentId: int("studentId").notNull(),
  attendanceDate: varchar("attendanceDate", { length: 10 }).notNull(), // YYYY-MM-DD
  status: mysqlEnum("status", ["present", "late", "absent", "excused"]).default("present").notNull(),
  note: varchar("note", { length: 500 }),
  recordedBy: int("recordedBy").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

// 반 공지와 과제는 수신 대상 반을 보존하고 학생별 인앱 알림으로 함께 전달합니다.
export const classAnnouncements = mysqlTable("class_announcements", {
  id: int("id").autoincrement().primaryKey(),
  groupId: int("groupId").notNull(),
  title: varchar("title", { length: 255 }).notNull(),
  content: text("content").notNull(),
  createdBy: int("createdBy").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export const classAssignments = mysqlTable("class_assignments", {
  id: int("id").autoincrement().primaryKey(),
  groupId: int("groupId").notNull(),
  title: varchar("title", { length: 255 }).notNull(),
  instructions: text("instructions").notNull(),
  dueAt: timestamp("dueAt"),
  createdBy: int("createdBy").notNull(),
  isActive: int("isActive").default(1).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

// 반 과제별 학생 제출물과 교사 채점 상태를 분리해 관리합니다.
export const classAssignmentSubmissions = mysqlTable("class_assignment_submissions", {
  id: int("id").autoincrement().primaryKey(),
  assignmentId: int("assignmentId").notNull(),
  studentId: int("studentId").notNull(),
  content: text("content").notNull(),
  status: mysqlEnum("status", ["submitted", "reviewed"]).default("submitted").notNull(),
  submittedAt: timestamp("submittedAt").defaultNow().notNull(),
  reviewedAt: timestamp("reviewedAt"),
  score: int("score"),
  teacherComment: text("teacherComment"),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

// 교사 최종 채점 전 AI가 생성한 과제별 1차 첨삭 초안과 구조화 평가 근거를 보존합니다.
export const classAssignmentAiFeedbacks = mysqlTable("class_assignment_ai_feedbacks", {
  id: int("id").autoincrement().primaryKey(),
  submissionId: int("submissionId").notNull(),
  generatedBy: int("generatedBy").notNull(),
  modelId: varchar("modelId", { length: 120 }).notNull(),
  overallScore: int("overallScore").notNull(),
  evaluationJson: text("evaluationJson").notNull(),
  draftComment: text("draftComment").notNull(),
  status: mysqlEnum("status", ["generated", "reviewed", "discarded"]).default("generated").notNull(),
  generatedAt: timestamp("generatedAt").defaultNow().notNull(),
  reviewedAt: timestamp("reviewedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

// 교사가 반복 사용하는 채점·첨삭 문구를 개인별로 보관합니다.
export const teacherFeedbackTemplates = mysqlTable("teacher_feedback_templates", {
  id: int("id").autoincrement().primaryKey(),
  teacherId: int("teacherId").notNull(),
  title: varchar("title", { length: 120 }).notNull(),
  content: text("content").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

// 관리자 계정 생성과 역할·레벨 조정은 별도 원장으로 남겨 운영자가 추적할 수 있습니다.
export const adminAuditLogs = mysqlTable("admin_audit_logs", {
  id: int("id").autoincrement().primaryKey(),
  actorId: int("actorId").notNull(),
  targetUserId: int("targetUserId"),
  action: mysqlEnum("action", ["admin_account_created", "role_changed", "level_changed", "teacher_assigned"]).notNull(),
  summary: varchar("summary", { length: 500 }).notNull(),
  metadataJson: text("metadataJson"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type ClassAttendance = typeof classAttendance.$inferSelect;
export type ClassAnnouncement = typeof classAnnouncements.$inferSelect;
export type ClassAssignment = typeof classAssignments.$inferSelect;
export type ClassAssignmentSubmission = typeof classAssignmentSubmissions.$inferSelect;
export type ClassAssignmentAiFeedback = typeof classAssignmentAiFeedbacks.$inferSelect;
export type TeacherFeedbackTemplate = typeof teacherFeedbackTemplates.$inferSelect;
export type AdminAuditLog = typeof adminAuditLogs.$inferSelect;

// 관리자가 교사에게 부여하는 진도·수료증 권한입니다. 조직 전체 또는 특정 학생으로 범위를 제한합니다.
export const teacherPermissionGrants = mysqlTable("teacher_permission_grants", {
  id: int("id").autoincrement().primaryKey(),
  teacherId: int("teacherId").notNull(),
  scopeType: mysqlEnum("scopeType", ["organization", "student"]).notNull(),
  organizationName: varchar("organizationName", { length: 160 }),
  studentId: int("studentId"),
  canManageProgress: int("canManageProgress").default(0).notNull(),
  canRequestCertificate: int("canRequestCertificate").default(0).notNull(),
  isActive: int("isActive").default(1).notNull(),
  grantedBy: int("grantedBy").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type TeacherPermissionGrant = typeof teacherPermissionGrants.$inferSelect;
export type InsertTeacherPermissionGrant = typeof teacherPermissionGrants.$inferInsert;

// 수료증 발급 조건은 과정별로 관리하며, 기본값은 교사 검토와 관리자 최종 승인을 모두 요구합니다.
export const certificateApprovalPolicies = mysqlTable("certificate_approval_policies", {
  id: int("id").autoincrement().primaryKey(),
  courseType: mysqlEnum("courseType", ["elementary", "middle_high", "high_univ", "general_adult"]).notNull().unique(),
  teacherReviewRequired: int("teacherReviewRequired").default(1).notNull(),
  adminApprovalRequired: int("adminApprovalRequired").default(1).notNull(),
  minimumCompletionRate: int("minimumCompletionRate").default(100).notNull(),
  minimumAverageScore: int("minimumAverageScore").default(0).notNull(),
  isActive: int("isActive").default(1).notNull(),
  updatedBy: int("updatedBy"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type CertificateApprovalPolicy = typeof certificateApprovalPolicies.$inferSelect;
export type InsertCertificateApprovalPolicy = typeof certificateApprovalPolicies.$inferInsert;

// 교사 검토와 관리자 최종 승인 단계를 독립적으로 남겨 수료증 발급 사유를 감사 가능하게 합니다.
export const certificateApprovalRequests = mysqlTable("certificate_approval_requests", {
  id: int("id").autoincrement().primaryKey(),
  studentId: int("studentId").notNull(),
  courseType: mysqlEnum("courseType", ["elementary", "middle_high", "high_univ", "general_adult"]).notNull(),
  level: int("level"),
  certificateType: mysqlEnum("certificateType", ["level_certificate", "graduation_certificate"]).notNull(),
  status: mysqlEnum("status", ["pending_teacher", "pending_admin", "approved", "rejected"]).default("pending_teacher").notNull(),
  requestedBy: int("requestedBy").notNull(),
  requestScope: mysqlEnum("requestScope", ["organization", "student"]).notNull(),
  evidenceCompletionRate: int("evidenceCompletionRate").default(0).notNull(),
  evidenceAverageScore: int("evidenceAverageScore").default(0).notNull(),
  teacherApprovedBy: int("teacherApprovedBy"),
  teacherApprovedAt: timestamp("teacherApprovedAt"),
  teacherNote: text("teacherNote"),
  adminApprovedBy: int("adminApprovedBy"),
  adminApprovedAt: timestamp("adminApprovedAt"),
  adminNote: text("adminNote"),
  certificateId: int("certificateId"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type CertificateApprovalRequest = typeof certificateApprovalRequests.$inferSelect;
export type InsertCertificateApprovalRequest = typeof certificateApprovalRequests.$inferInsert;

export type AppSecretConfig = typeof appSecretConfig.$inferSelect;
export type InsertAppSecretConfig = typeof appSecretConfig.$inferInsert;

export const siteSettings = mysqlTable("site_settings", {
  id: int("id").autoincrement().primaryKey(),
  settingKey: varchar("settingKey", { length: 128 }).notNull().unique(), // 'terms_of_service', 'privacy_policy' 등
  content: text("content"),
  updatedBy: int("updatedBy"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type SiteSetting = typeof siteSettings.$inferSelect;
export type InsertSiteSetting = typeof siteSettings.$inferInsert;

// 회원 동의의 버전·목적·철회 이력을 보존하는 정책 문서 및 동의 원장
export const policyDocuments = mysqlTable("policy_documents", {
  id: int("id").autoincrement().primaryKey(),
  policyKey: varchar("policyKey", { length: 80 }).notNull(), // terms_of_service, privacy_policy, ai_learning_consent, teacher_ai_code
  title: varchar("title", { length: 160 }).notNull(),
  version: varchar("version", { length: 32 }).notNull(),
  content: text("content").notNull(),
  requiredForRoles: varchar("requiredForRoles", { length: 80 }).notNull(), // student,parent,teacher
  isRequired: int("isRequired").default(0).notNull(),
  isActive: int("isActive").default(1).notNull(),
  effectiveAt: timestamp("effectiveAt").defaultNow().notNull(),
  retiredAt: timestamp("retiredAt"),
  updatedBy: int("updatedBy"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export const userPolicyConsents = mysqlTable("user_policy_consents", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  policyKey: varchar("policyKey", { length: 80 }).notNull(),
  policyVersion: varchar("policyVersion", { length: 32 }).notNull(),
  consentType: mysqlEnum("consentType", ["required_service", "optional_ai_learning", "teacher_ai_style", "guardian_authorization"]).notNull(),
  status: mysqlEnum("status", ["accepted", "withdrawn"]).default("accepted").notNull(),
  acceptedAt: timestamp("acceptedAt").defaultNow().notNull(),
  withdrawnAt: timestamp("withdrawnAt"),
  evidence: varchar("evidence", { length: 120 }).default("signup_confirmation").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export const dataProcessingRequests = mysqlTable("data_processing_requests", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  requestType: mysqlEnum("requestType", ["access", "correction", "withdraw_ai_learning", "delete_learning_data"]).notNull(),
  status: mysqlEnum("status", ["received", "in_review", "completed", "rejected"]).default("received").notNull(),
  requestNote: text("requestNote"),
  handlingNote: text("handlingNote"),
  handledBy: int("handledBy"),
  handledAt: timestamp("handledAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type PolicyDocument = typeof policyDocuments.$inferSelect;
export type UserPolicyConsent = typeof userPolicyConsents.$inferSelect;
export type DataProcessingRequest = typeof dataProcessingRequests.$inferSelect;

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
  courseType: mysqlEnum("courseType", ["elementary", "middle_high", "high_univ", "general_adult"]).notNull(),
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

// 서버가 검증한 학습 도구 수행 결과만 뱃지 수여 근거로 사용합니다.
export const learningToolAttempts = mysqlTable("learning_tool_attempts", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  questionBankId: int("questionBankId").notNull(),
  courseType: mysqlEnum("courseType", ["elementary", "middle_high", "high_univ", "general_adult"]).notNull(),
  toolType: mysqlEnum("toolType", ["quiz", "reordering", "summary"]).notNull(),
  score: int("score").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type LearningToolAttempt = typeof learningToolAttempts.$inferSelect;
export type InsertLearningToolAttempt = typeof learningToolAttempts.$inferInsert;

// 수료증 테이블
export const certificate = mysqlTable("certificate", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  courseType: mysqlEnum("courseType", ["elementary", "middle_high", "high_univ", "general_adult"]).notNull(),
  level: int("level"),
  certificateType: mysqlEnum("certificateType", ["level_certificate", "graduation_certificate"]).notNull(),
  certNumber: varchar("certNumber", { length: 64 }),
  title: varchar("title", { length: 255 }),
  shareToken: varchar("shareToken", { length: 64 }).unique(),
  pdfUrl: text("pdfUrl"),
  status: mysqlEnum("status", ["active", "revoked"]).default("active").notNull(),
  issuedBy: int("issuedBy"),
  issueReason: text("issueReason"),
  revokedAt: timestamp("revokedAt"),
  revokedBy: int("revokedBy"),
  revocationReason: text("revocationReason"),
  issuedAt: timestamp("issuedAt").defaultNow().notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
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

// 교사별 AI 보조 봇: 스타일 설정, 승인 사례, AI 초안과 교사 수정 이력을 분리 보관
export const teacherAiProfiles = mysqlTable("teacher_ai_profiles", {
  id: int("id").autoincrement().primaryKey(),
  teacherId: int("teacherId").notNull().unique(),
  displayName: varchar("displayName", { length: 100 }).notNull(),
  tone: mysqlEnum("tone", ["encouraging", "balanced", "direct"]).default("balanced").notNull(),
  feedbackFocus: varchar("feedbackFocus", { length: 160 }).default("논리·근거·표현의 균형").notNull(),
  styleInstruction: text("styleInstruction"),
  forbiddenPhrases: text("forbiddenPhrases"), // JSON array
  rubricWeights: text("rubricWeights"), // JSON object
  isEnabled: int("isEnabled").default(0).notNull(),
  currentVersion: int("currentVersion").default(1).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export const teacherAiStyleExamples = mysqlTable("teacher_ai_style_examples", {
  id: int("id").autoincrement().primaryKey(),
  teacherId: int("teacherId").notNull(),
  sourceFeedbackId: int("sourceFeedbackId"),
  purpose: mysqlEnum("purpose", ["style_reference", "quality_evaluation", "training_candidate"]).default("style_reference").notNull(),
  pseudonymizedPrompt: text("pseudonymizedPrompt").notNull(),
  approvedFeedback: text("approvedFeedback").notNull(),
  tags: varchar("tags", { length: 255 }),
  approvalStatus: mysqlEnum("approvalStatus", ["draft", "teacher_approved", "admin_approved", "rejected", "withdrawn"]).default("draft").notNull(),
  approvedAt: timestamp("approvedAt"),
  expiresAt: timestamp("expiresAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export const teacherAiDrafts = mysqlTable("teacher_ai_drafts", {
  id: int("id").autoincrement().primaryKey(),
  essayId: int("essayId").notNull(),
  teacherId: int("teacherId").notNull(),
  profileVersion: int("profileVersion").notNull(),
  modelId: varchar("modelId", { length: 120 }).notNull(),
  evaluationJson: text("evaluationJson"),
  draftComment: text("draftComment").notNull(),
  status: mysqlEnum("status", ["generated", "edited", "approved", "discarded"]).default("generated").notNull(),
  generatedAt: timestamp("generatedAt").defaultNow().notNull(),
  approvedAt: timestamp("approvedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export const teacherAiDraftRevisions = mysqlTable("teacher_ai_draft_revisions", {
  id: int("id").autoincrement().primaryKey(),
  draftId: int("draftId").notNull(),
  revisionNumber: int("revisionNumber").notNull(),
  editorId: int("editorId").notNull(),
  revisedComment: text("revisedComment").notNull(),
  changeSummary: text("changeSummary"),
  learningApproval: mysqlEnum("learningApproval", ["pending", "approved", "rejected", "withdrawn"]).default("pending").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type TeacherAiProfile = typeof teacherAiProfiles.$inferSelect;
export type TeacherAiStyleExample = typeof teacherAiStyleExamples.$inferSelect;
export type TeacherAiDraft = typeof teacherAiDrafts.$inferSelect;
export type TeacherAiDraftRevision = typeof teacherAiDraftRevisions.$inferSelect;

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
  revisedEssay: text("revisedEssay"), // AI가 제안하는 개선 답안 본문
  courseType: mysqlEnum("courseType", ["elementary", "middle_high", "high_univ", "general_adult"]).notNull(),
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

// AI 사용량 및 일일 쿼터 로그 테이블
export const aiUsageLogs = mysqlTable("ai_usage_logs", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  actionType: varchar("actionType", { length: 50 }).notNull(), // 'essay_feedback', 'sentence_quiz', etc.
  tokensUsed: int("tokensUsed").default(0).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type AIUsageLog = typeof aiUsageLogs.$inferSelect;
export type InsertAIUsageLog = typeof aiUsageLogs.$inferInsert;

// 관리자 메모 히스토리 테이블
export const adminMemoHistory = mysqlTable("admin_memo_history", {
  id: int("id").autoincrement().primaryKey(),
  studentId: int("studentId").notNull(),
  adminId: int("adminId").notNull(),
  adminName: varchar("adminName", { length: 255 }).notNull(),
  content: text("content").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type AdminMemoHistory = typeof adminMemoHistory.$inferSelect;
export type InsertAdminMemoHistory = typeof adminMemoHistory.$inferInsert;

// 동적 커리큘럼 카테고리 테이블 (관리자가 추가/수정/삭제 가능)
export const dynamicCurriculum = mysqlTable("dynamic_curriculum", {
  id: int("id").autoincrement().primaryKey(),
  courseType: mysqlEnum("courseType", ["elementary", "middle_high", "high_univ", "general_adult"]).notNull(),
  level: int("level").notNull(),
  title: varchar("title", { length: 255 }).notNull(),
  description: text("description").notNull(),
  topicsJson: text("topicsJson").notNull(), // JSON string array of topics
  thumbnailUrl: varchar("thumbnailUrl", { length: 500 }),
  aiSummary: text("aiSummary"),
  aiTags: text("aiTags"), // JSON string array of auto-generated tags
  samplePdfUrl: varchar("samplePdfUrl", { length: 500 }),
  isActive: int("isActive").default(1).notNull(), // 1: 활성, 0: 비활성
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
});

export type DynamicCurriculum = typeof dynamicCurriculum.$inferSelect;
export type InsertDynamicCurriculum = typeof dynamicCurriculum.$inferInsert;

// 이론학습용 설명·교재식 예시·강의 중 확인문제 콘텐츠.
// question_bank의 랜덤 출제·평가 문항과 절대 혼합하지 않는다.
export const lessonTheoryContent = mysqlTable("lesson_theory_content", {
  id: int("id").autoincrement().primaryKey(),
  contentScope: mysqlEnum("contentScope", ["THEORY_LESSON"]).default("THEORY_LESSON").notNull(),
  courseType: mysqlEnum("courseType", ["elementary", "middle_high", "high_univ", "general_adult"]).notNull(),
  lessonLevel: int("lessonLevel").notNull(),
  theoryCategory: varchar("theoryCategory", { length: 32 }).notNull(),
  theorySubcategory: varchar("theorySubcategory", { length: 128 }).notNull(),
  exampleMode: mysqlEnum("exampleMode", ["TEXTBOOK_SIMILAR", "TEXTBOOK_PLUS_NEW"]).default("TEXTBOOK_PLUS_NEW").notNull(),
  title: varchar("title", { length: 255 }).notNull(),
  contentData: text("contentData").notNull(),
  sourceNote: varchar("sourceNote", { length: 255 }).default("논술의 기초 정리본 기반 재구성"),
  isActive: int("isActive").default(1).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type LessonTheoryContent = typeof lessonTheoryContent.$inferSelect;
export type InsertLessonTheoryContent = typeof lessonTheoryContent.$inferInsert;

// AI가 생성한 이론 콘텐츠는 관리자 승인 전까지 본문 테이블과 분리해 보관한다.
export const lessonTheoryDrafts = mysqlTable("lesson_theory_drafts", {
  id: int("id").autoincrement().primaryKey(),
  courseType: mysqlEnum("courseType", ["elementary", "middle_high", "high_univ", "general_adult"]).notNull(),
  lessonLevel: int("lessonLevel").notNull(),
  theoryCategory: varchar("theoryCategory", { length: 32 }).notNull(),
  theorySubcategory: varchar("theorySubcategory", { length: 128 }).notNull(),
  exampleMode: mysqlEnum("exampleMode", ["TEXTBOOK_SIMILAR", "TEXTBOOK_PLUS_NEW"]).default("TEXTBOOK_PLUS_NEW").notNull(),
  title: varchar("title", { length: 255 }).notNull(),
  contentData: text("contentData").notNull(),
  sourceNote: varchar("sourceNote", { length: 255 }).default("AI 생성 이론 콘텐츠"),
  generationRequestJson: text("generationRequestJson"),
  modelId: varchar("modelId", { length: 120 }),
  qaIssuesJson: text("qaIssuesJson"),
  status: mysqlEnum("status", ["preview", "approved", "rejected"]).default("preview").notNull(),
  createdBy: int("createdBy").notNull(),
  approvedBy: int("approvedBy"),
  approvedAt: timestamp("approvedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type LessonTheoryDraft = typeof lessonTheoryDrafts.$inferSelect;
export type InsertLessonTheoryDraft = typeof lessonTheoryDrafts.$inferInsert;

// 이론 레슨의 강의 중 확인문제를 완료한 학습자만 별도로 기록한다.
export const lessonTheoryProgress = mysqlTable("lesson_theory_progress", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  theoryContentId: int("theoryContentId").notNull(),
  completedAt: timestamp("completedAt").defaultNow().notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type LessonTheoryProgress = typeof lessonTheoryProgress.$inferSelect;
export type InsertLessonTheoryProgress = typeof lessonTheoryProgress.$inferInsert;

// 학습도구 뱃지 테이블
export const userBadges = mysqlTable("user_badges", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  courseType: varchar("courseType", { length: 64 }).notNull(), // elementary, middle_high, high_univ, general_adult
  badgeType: varchar("badgeType", { length: 64 }).notNull(), // summary, reordering, quiz, topic_wizard, thesis_checklist
  badgeName: varchar("badgeName", { length: 128 }).notNull(),
  earnedAt: timestamp("earnedAt").defaultNow().notNull(),
});

export type UserBadge = typeof userBadges.$inferSelect;
export type InsertUserBadge = typeof userBadges.$inferInsert;

// 문제은행 (Question Bank) 테이블 - 각 커리큘럼별 50개씩 총 200개 이상 관리
export const questionBank = mysqlTable("question_bank", {
  id: int("id").autoincrement().primaryKey(),
  courseType: mysqlEnum("courseType", ["elementary", "middle_high", "high_univ", "general_adult"]).notNull(),
  toolType: varchar("toolType", { length: 64 }).notNull(), // quiz, reordering, summary, topic_wizard, thesis_checklist
  title: varchar("title", { length: 255 }).notNull(),
  contentData: text("contentData").notNull(), // JSON 문자열로 문제 본문, 보기, 정답, 해설 등 저장
  difficulty: mysqlEnum("difficulty", ["easy", "medium", "hard"]).default("medium").notNull(),
  isActive: int("isActive").default(1).notNull(), // 1: 활성, 0: 비활성
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type QuestionBank = typeof questionBank.$inferSelect;
export type InsertQuestionBank = typeof questionBank.$inferInsert;

// 문제은행 휴지통: 관리자 삭제 문항을 임시 보관하여 안전하게 복구
export const questionBankTrash = mysqlTable("question_bank_trash", {
  id: int("id").autoincrement().primaryKey(),
  originalQuestionId: int("originalQuestionId").notNull(),
  courseType: mysqlEnum("courseType", ["elementary", "middle_high", "high_univ", "general_adult"]).notNull(),
  toolType: varchar("toolType", { length: 64 }).notNull(),
  title: varchar("title", { length: 255 }).notNull(),
  contentData: text("contentData").notNull(),
  difficulty: mysqlEnum("difficulty", ["easy", "medium", "hard"]).default("medium").notNull(),
  isActive: int("isActive").default(1).notNull(),
  deletedByUserId: int("deletedByUserId").notNull(),
  deletedAt: timestamp("deletedAt").defaultNow().notNull(),
});

export type QuestionBankTrash = typeof questionBankTrash.$inferSelect;
export type InsertQuestionBankTrash = typeof questionBankTrash.$inferInsert;

// 문제은행 휴지통 보관 기간 및 자동 정리 스케줄 설정
export const questionBankMaintenanceSettings = mysqlTable("question_bank_maintenance_settings", {
  id: int("id").autoincrement().primaryKey(),
  retentionDays: int("retentionDays").default(30).notNull(),
  scheduleCronTaskUid: varchar("scheduleCronTaskUid", { length: 65 }),
  updatedByUserId: int("updatedByUserId"),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type QuestionBankMaintenanceSettings = typeof questionBankMaintenanceSettings.$inferSelect;
export type InsertQuestionBankMaintenanceSettings = typeof questionBankMaintenanceSettings.$inferInsert;

// 문제은행 문항 삭제·복구·자동 정리 감사 로그
export const questionBankOperationLogs = mysqlTable("question_bank_operation_logs", {
  id: int("id").autoincrement().primaryKey(),
  actionType: varchar("actionType", { length: 32 }).notNull(), // moved_to_trash, restored, permanently_deleted, auto_purged
  questionId: int("questionId"),
  trashId: int("trashId"),
  courseType: varchar("courseType", { length: 64 }),
  questionTitle: varchar("questionTitle", { length: 255 }),
  actorUserId: int("actorUserId"),
  actorName: varchar("actorName", { length: 255 }).notNull(),
  details: text("details"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type QuestionBankOperationLog = typeof questionBankOperationLogs.$inferSelect;
export type InsertQuestionBankOperationLog = typeof questionBankOperationLogs.$inferInsert;

// 문제 피드백 및 오류 신고 테이블
export const questionFeedbacks = mysqlTable("question_feedbacks", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  questionId: int("questionId").notNull(),
  isHelpful: int("isHelpful").notNull(), // 1: 도움됨, 0: 도움 안됨
  reportType: varchar("reportType", { length: 50 }), // 'none', 'typo', 'wrong_answer', 'unclear', 'other'
  comment: text("comment"),
  adminReply: text("adminReply"), // 관리자 정정 및 답변 내용
  status: varchar("status", { length: 30 }).default("pending").notNull(), // 'pending', 'resolved', 'dismissed'
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type QuestionFeedback = typeof questionFeedbacks.$inferSelect;
export type InsertQuestionFeedback = typeof questionFeedbacks.$inferInsert;

// 문제 즐겨찾기(북마크) 테이블
export const questionBookmarks = mysqlTable("question_bookmarks", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  questionId: int("questionId").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type QuestionBookmark = typeof questionBookmarks.$inferSelect;
export type InsertQuestionBookmark = typeof questionBookmarks.$inferInsert;

// 커리큘럼 워크북 레슨별 고정 기출문제 테이블
export const curriculumWorkbookQuestions = mysqlTable("curriculum_workbook_questions", {
  id: int("id").autoincrement().primaryKey(),
  courseType: varchar("courseType", { length: 50 }).notNull(), // elementary, middle_high, high_univ, general_adult
  level: int("level").notNull(),
  lessonIndex: int("lessonIndex").notNull(), // 0, 1, 2...
  questionNumber: int("questionNumber").notNull(), // 1, 2, 3
  title: varchar("title", { length: 255 }).notNull(),
  prompt: text("prompt").notNull(),
  choicesJson: text("choicesJson"), // JSON string array for choices if objective
  correctAnswer: varchar("correctAnswer", { length: 255 }).notNull(),
  explanation: text("explanation").notNull(),
  questionType: varchar("questionType", { length: 50 }).default("subjective").notNull(), // subjective, objective
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type CurriculumWorkbookQuestion = typeof curriculumWorkbookQuestions.$inferSelect;
export type InsertCurriculumWorkbookQuestion = typeof curriculumWorkbookQuestions.$inferInsert;

// 학생별 커리큘럼 워크북 문제 풀이 및 답안 제출 기록 테이블
export const curriculumWorkbookAnswers = mysqlTable("curriculum_workbook_answers", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  questionId: int("questionId").notNull(),
  userAnswer: text("userAnswer").notNull(),
  isCorrect: int("isCorrect").default(0).notNull(), // 1 for correct, 0 for incorrect or pending AI grade
  aiFeedback: text("aiFeedback"),
  score: int("score").default(0), // 0-100 score
  evaluationJson: text("evaluationJson"), // 서술형 AI 평가의 주제 적합성·논증·근거·분석·표현 기준별 결과
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type CurriculumWorkbookAnswer = typeof curriculumWorkbookAnswers.$inferSelect;
export type InsertCurriculumWorkbookAnswer = typeof curriculumWorkbookAnswers.$inferInsert;

// 워크북 기출 오답 자동 축적 테이블 (오답 노트 연동)
export const workbookMistakes = mysqlTable("workbook_mistakes", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  questionId: int("questionId").notNull(),
  userAnswer: text("userAnswer").notNull(),
  aiFeedback: text("aiFeedback"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type WorkbookMistake = typeof workbookMistakes.$inferSelect;
export type InsertWorkbookMistake = typeof workbookMistakes.$inferInsert;

// 문제은행 기반 학습 도구의 오답 기록: 퀴즈·단락 재구성·요약 연습 등 100점 미만 결과를 오답 노트에 축적한다.
export const learningToolMistakes = mysqlTable("learning_tool_mistakes", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  questionBankId: int("questionBankId").notNull(),
  courseType: varchar("courseType", { length: 50 }).notNull(),
  toolType: varchar("toolType", { length: 64 }).notNull(),
  userAnswer: text("userAnswer").notNull(),
  score: int("score").notNull(),
  aiFeedback: text("aiFeedback"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type LearningToolMistake = typeof learningToolMistakes.$inferSelect;
export type InsertLearningToolMistake = typeof learningToolMistakes.$inferInsert;

// 학생이 요청한 AI 레슨 가이드를 보존하여 이후 동일한 학습 맥락에서 다시 열람합니다.
export const aiLessonGuideHistories = mysqlTable("ai_lesson_guide_histories", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  courseType: varchar("courseType", { length: 50 }).notNull(),
  level: int("level").notNull(),
  lessonIndex: int("lessonIndex").notNull(),
  lessonTitle: varchar("lessonTitle", { length: 255 }).notNull(),
  guideJson: text("guideJson").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type AiLessonGuideHistory = typeof aiLessonGuideHistories.$inferSelect;
export type InsertAiLessonGuideHistory = typeof aiLessonGuideHistories.$inferInsert;

// 교사가 담당 반의 채점 완료 답안을 익명화·편집해 승인한 뒤 학생 참고용으로 게시합니다.
export const approvedWritingExamples = mysqlTable("approved_writing_examples", {
  id: int("id").autoincrement().primaryKey(),
  sourceSubmissionId: int("sourceSubmissionId").notNull(),
  teacherId: int("teacherId").notNull(),
  courseType: mysqlEnum("courseType", ["elementary", "middle_high", "high_univ", "general_adult"]).notNull(),
  title: varchar("title", { length: 255 }).notNull(),
  topic: varchar("topic", { length: 255 }).notNull(),
  skillTags: varchar("skillTags", { length: 255 }),
  anonymizedContent: text("anonymizedContent").notNull(),
  teacherNote: text("teacherNote"),
  status: mysqlEnum("status", ["draft", "published", "withdrawn"]).default("draft").notNull(),
  publishedAt: timestamp("publishedAt"),
  withdrawnAt: timestamp("withdrawnAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type ApprovedWritingExample = typeof approvedWritingExamples.$inferSelect;
export type InsertApprovedWritingExample = typeof approvedWritingExamples.$inferInsert;

// 교사 서술형 워크북 첨삭 피드백 테이블
export const workbookTeacherFeedback = mysqlTable("workbook_teacher_feedback", {
  id: int("id").autoincrement().primaryKey(),
  answerId: int("answerId").notNull(),
  teacherId: int("teacherId").notNull(),
  comment: text("comment").notNull(),
  gradeScore: int("gradeScore").default(0),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type WorkbookTeacherFeedback = typeof workbookTeacherFeedback.$inferSelect;
export type InsertWorkbookTeacherFeedback = typeof workbookTeacherFeedback.$inferInsert;

// 인앱 알림 센터 테이블 (교사 첨삭, 과제 마감, 공지 등)
export const appNotifications = mysqlTable("app_notifications", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  title: varchar("title", { length: 255 }).notNull(),
  message: text("message").notNull(),
  category: varchar("category", { length: 50 }).default("teacher_feedback").notNull(), // 'teacher_feedback', 'assignment', 'system'
  assignmentId: int("assignmentId"),
  isRead: int("isRead").default(0).notNull(), // 0: 안 읽음, 1: 읽음
  readAt: timestamp("readAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type AppNotification = typeof appNotifications.$inferSelect;
export type InsertAppNotification = typeof appNotifications.$inferInsert;
