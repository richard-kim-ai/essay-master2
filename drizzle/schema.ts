import { index, int, mediumtext, mysqlEnum, mysqlTable, text, timestamp, uniqueIndex, varchar, decimal } from "drizzle-orm/mysql-core";

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
}, (table) => ({
  idxEmail: index("idx_users_email").on(table.email),
}));

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
  // 학부모가 요청하면 pending, 학생이 승인해야 approved가 된다. 승인 단계 도입 전 기존 연결은 approved로 유지한다.
  status: mysqlEnum("status", ["pending", "approved", "rejected"]).default("approved").notNull(),
  respondedAt: timestamp("respondedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => ({
  idxStudentId: index("idx_parent_student_links_studentId").on(table.studentId),
  idxParentId: index("idx_parent_student_links_parentId").on(table.parentId),
}));

// 만 14세 미만 아동 가입 시 법정대리인 동의 기록(개인정보 보호법 제22조의2). 동의 관리대장으로 쓴다.
export const guardianConsents = mysqlTable("guardian_consents", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  // 아동 생년월일(YYYY-MM-DD). 만 14세 미만 판정의 근거로 이 기록에만 보관한다.
  childBirthDate: varchar("childBirthDate", { length: 10 }).notNull(),
  guardianName: varchar("guardianName", { length: 80 }).notNull(),
  guardianRelation: varchar("guardianRelation", { length: 32 }).notNull(),
  guardianEmail: varchar("guardianEmail", { length: 320 }).notNull(),
  tokenHash: varchar("tokenHash", { length: 128 }).notNull(),
  tokenExpiresAt: timestamp("tokenExpiresAt").notNull(),
  status: mysqlEnum("status", ["pending", "approved", "withdrawn"]).default("pending").notNull(),
  // 어떤 문구와 확인 수단으로 동의받았는지 증명하기 위한 값
  consentVersion: varchar("consentVersion", { length: 32 }).notNull(),
  consentMethod: varchar("consentMethod", { length: 32 }).default("email_confirmation").notNull(),
  approvedAt: timestamp("approvedAt"),
  // 동의 시점의 증적(접속 IP 해시, 브라우저 정보 일부, 입력한 보호자 성명, 체크한 항목). 원문 IP는 저장하지 않는다.
  evidenceJson: text("evidenceJson"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => ({
  idxUserId: index("idx_guardian_consents_userId").on(table.userId),
}));

export type GuardianConsent = typeof guardianConsents.$inferSelect;
export type InsertGuardianConsent = typeof guardianConsents.$inferInsert;

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
  /** 이 반의 비용을 부담하는 기관 계약(없으면 개별 학습자 반). 계약이 있으면 이 반에서의 교사 활동은 개별 정산에서 제외된다. */
  contractId: int("contractId"),
  isActive: int("isActive").default(1).notNull(),
  createdBy: int("createdBy").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => ({
  idxTeacherId: index("idx_learning_groups_teacherId").on(table.teacherId),
}));

export const learningGroupMembers = mysqlTable("learning_group_members", {
  id: int("id").autoincrement().primaryKey(),
  groupId: int("groupId").notNull(),
  studentId: int("studentId").notNull(),
  addedBy: int("addedBy").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => ({
  idxGroupId: index("idx_learning_group_members_groupId").on(table.groupId),
  idxStudentId: index("idx_learning_group_members_studentId").on(table.studentId),
}));

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
}, (table) => ({
  idxStudentId: index("idx_class_assignment_submissions_studentId").on(table.studentId),
}));

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
}, (table) => ({
  idxUserId: index("idx_user_policy_consents_userId").on(table.userId),
}));

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
}, (table) => ({
  idxUserId: index("idx_push_subscription_userId").on(table.userId),
}));

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
}, (table) => ({
  idxUserId: index("idx_progress_userId").on(table.userId),
}));

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
}, (table) => ({
  idxUserId: index("idx_quiz_answer_userId").on(table.userId),
}));

export type QuizAnswer = typeof quizAnswer.$inferSelect;
export type InsertQuizAnswer = typeof quizAnswer.$inferInsert;

// 학습자가 명시적으로 요청한 문장 맞춤 피드백을 재사용하여 동일 문장의 AI 재호출을 줄입니다.
export const sentenceFeedbackCache = mysqlTable("sentence_feedback_cache", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  quizId: int("quizId").notNull(),
  courseType: mysqlEnum("courseType", ["elementary", "middle_high", "high_univ", "general_adult"]).notNull(),
  requestHash: varchar("requestHash", { length: 64 }).notNull().unique(),
  sourceSentence: text("sourceSentence").notNull(),
  studentSentence: text("studentSentence").notNull(),
  feedbackJson: text("feedbackJson").notNull(),
  modelId: varchar("modelId", { length: 128 }),
  expiresAt: timestamp("expiresAt").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type SentenceFeedbackCache = typeof sentenceFeedbackCache.$inferSelect;
export type InsertSentenceFeedbackCache = typeof sentenceFeedbackCache.$inferInsert;

// 서버가 검증한 학습 도구 수행 결과만 뱃지 수여 근거로 사용합니다.
export const learningToolAttempts = mysqlTable("learning_tool_attempts", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  questionBankId: int("questionBankId").notNull(),
  courseType: mysqlEnum("courseType", ["elementary", "middle_high", "high_univ", "general_adult"]).notNull(),
  toolType: mysqlEnum("toolType", ["quiz", "reordering", "summary"]).notNull(),
  score: int("score").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => ({
  idxUserId: index("idx_learning_tool_attempts_userId").on(table.userId),
}));

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
}, (table) => ({
  idxUserId: index("idx_certificate_userId").on(table.userId),
}));

// 수료증 보관 이미지. PDF는 발급 순간에만 브라우저에서 만들어 내려받게 하고, 서버에는 압축 이미지(WebP/JPEG)만 보관한다.
export const certificateArchives = mysqlTable("certificate_archives", {
  id: int("id").autoincrement().primaryKey(),
  certificateId: int("certificateId").notNull().unique(),
  mimeType: varchar("mimeType", { length: 32 }).notNull(),
  bytes: int("bytes").notNull(),
  imageData: mediumtext("imageData").notNull(), // base64
  createdBy: int("createdBy").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
export type CertificateArchive = typeof certificateArchives.$inferSelect;

export type Certificate = typeof certificate.$inferSelect;
export type InsertCertificate = typeof certificate.$inferInsert;

// 학생 논술 제출 테이블
export const essaySubmission = mysqlTable("essay_submission", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  curriculumId: int("curriculumId"),
  title: varchar("title", { length: 255 }).notNull(),
  content: text("content").notNull(),
  clientId: varchar("clientId", { length: 80 }).unique(),
  syncRevision: int("syncRevision").default(0).notNull(),
  aiFeedbackId: int("aiFeedbackId"),
  status: mysqlEnum("status", ["draft", "submitted", "reviewed"]).default("draft").notNull(),
  submittedAt: timestamp("submittedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => ({
  idxUserId: index("idx_essay_submission_userId").on(table.userId),
}));

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
}, (table) => ({
  idxEssayId: index("idx_teacher_feedback_essayId").on(table.essayId),
  idxTeacherId: index("idx_teacher_feedback_teacherId").on(table.teacherId),
}));

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
}, (table) => ({
  idxEssayId: index("idx_teacher_ai_drafts_essayId").on(table.essayId),
}));

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
}, (table) => ({
  idxUserId: index("idx_ai_auto_feedback_userId").on(table.userId),
}));

export type AIAutoFeedback = typeof aiAutoFeedback.$inferSelect;
export type InsertAIAutoFeedback = typeof aiAutoFeedback.$inferInsert;

// 상용 첨삭 모델 운영 설정: API 키는 암호화된 값만 저장한다.
export const evaluationModelConfigs = mysqlTable("evaluation_model_configs", {
  id: int("id").autoincrement().primaryKey(),
  modelId: varchar("modelId", { length: 160 }).notNull(),
  endpoint: varchar("endpoint", { length: 1024 }).notNull(),
  allowedDomainsJson: text("allowedDomainsJson").notNull(),
  encryptedApiKey: text("encryptedApiKey").notNull(),
  timeoutMs: int("timeoutMs").default(15000).notNull(),
  isActive: int("isActive").default(1).notNull(),
  createdBy: int("createdBy").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type EvaluationModelConfig = typeof evaluationModelConfigs.$inferSelect;
export type InsertEvaluationModelConfig = typeof evaluationModelConfigs.$inferInsert;

// 첨삭 실행 메타데이터·검수 및 이의제기의 기준이 되는 불변 기록이다.
export const writingEvaluationRecords = mysqlTable("writing_evaluation_records", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  feedbackId: int("feedbackId"),
  modelId: varchar("modelId", { length: 160 }).notNull(),
  correctionStatus: mysqlEnum("correctionStatus", ["completed", "fallback", "failed"]).notNull(),
  fallbackUsed: int("fallbackUsed").default(0).notNull(),
  providerError: varchar("providerError", { length: 512 }),
  latencyMs: int("latencyMs").default(0).notNull(),
  tokenUsage: int("tokenUsage").default(0).notNull(),
  estimatedCostMicrousd: int("estimatedCostMicrousd").default(0).notNull(),
  confidence: decimal("confidence", { precision: 5, scale: 4 }),
  heuristicOverallScore: int("heuristicOverallScore"),
  modelOverallScore: int("modelOverallScore"),
  sourceVerificationFailed: int("sourceVerificationFailed").default(0).notNull(),
  resultJson: text("resultJson").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type WritingEvaluationRecord = typeof writingEvaluationRecords.$inferSelect;
export type InsertWritingEvaluationRecord = typeof writingEvaluationRecords.$inferInsert;

// 원문을 저장하지 않는 모델 운영 모니터링 로그다.
export const evaluationModelOperations = mysqlTable("evaluation_model_operations", {
  id: int("id").autoincrement().primaryKey(),
  modelId: varchar("modelId", { length: 160 }).notNull(),
  status: mysqlEnum("status", ["completed", "fallback", "failed"]).notNull(),
  latencyMs: int("latencyMs").default(0).notNull(),
  tokenUsage: int("tokenUsage").default(0).notNull(),
  estimatedCostMicrousd: int("estimatedCostMicrousd").default(0).notNull(),
  errorSummary: varchar("errorSummary", { length: 512 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type EvaluationModelOperation = typeof evaluationModelOperations.$inferSelect;
export type InsertEvaluationModelOperation = typeof evaluationModelOperations.$inferInsert;

export const evaluationReviewQueue = mysqlTable("evaluation_review_queue", {
  id: int("id").autoincrement().primaryKey(),
  evaluationRecordId: int("evaluationRecordId").notNull(),
  userId: int("userId").notNull(),
  reasonsJson: text("reasonsJson").notNull(),
  status: mysqlEnum("status", ["open", "reviewing", "resolved"]).default("open").notNull(),
  assignedAdminId: int("assignedAdminId"),
  resolutionNote: text("resolutionNote"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  resolvedAt: timestamp("resolvedAt"),
});

export type EvaluationReviewQueueItem = typeof evaluationReviewQueue.$inferSelect;
export type InsertEvaluationReviewQueueItem = typeof evaluationReviewQueue.$inferInsert;

export const evaluationAppeals = mysqlTable("evaluation_appeals", {
  id: int("id").autoincrement().primaryKey(),
  evaluationRecordId: int("evaluationRecordId").notNull(),
  userId: int("userId").notNull(),
  reason: text("reason").notNull(),
  requestedAction: varchar("requestedAction", { length: 64 }).notNull(),
  status: mysqlEnum("status", ["submitted", "under_review", "accepted", "rejected", "resolved"]).default("submitted").notNull(),
  adminId: int("adminId"),
  adminNote: text("adminNote"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type EvaluationAppeal = typeof evaluationAppeals.$inferSelect;
export type InsertEvaluationAppeal = typeof evaluationAppeals.$inferInsert;

// AI 사용량 및 일일 쿼터 로그 테이블
export const aiUsageLogs = mysqlTable("ai_usage_logs", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  actionType: varchar("actionType", { length: 50 }).notNull(), // 'essay_feedback', 'sentence_quiz', etc.
  tokensUsed: int("tokensUsed").default(0).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => ({
  idxUserIdCreatedAt: index("idx_ai_usage_logs_userId_createdAt").on(table.userId, table.createdAt),
}));

export type AIUsageLog = typeof aiUsageLogs.$inferSelect;
export type InsertAIUsageLog = typeof aiUsageLogs.$inferInsert;

// 비로그인 샘플 체험 AI 첨삭 남용 방지용 익명 카운터 (개인 학습 기록과 분리, 세션당/IP당 한도 확인용)
export const sampleAiUsageLog = mysqlTable("sample_ai_usage_log", {
  id: int("id").autoincrement().primaryKey(),
  sessionToken: varchar("sessionToken", { length: 64 }).notNull(),
  ipHash: varchar("ipHash", { length: 64 }).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type SampleAiUsageLog = typeof sampleAiUsageLog.$inferSelect;
export type InsertSampleAiUsageLog = typeof sampleAiUsageLog.$inferInsert;

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
}, (table) => ({
  idxCourseType: index("idx_dynamic_curriculum_courseType").on(table.courseType),
}));

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

// 관리자 지정 워크북 연결: 레슨별 추가 이론과 고정 기출문제를 자동 기준 또는 선택 목록으로 연결한다.
export const workbookLessonConnections = mysqlTable("workbook_lesson_connections", {
  id: int("id").autoincrement().primaryKey(),
  courseType: mysqlEnum("courseType", ["elementary", "middle_high", "high_univ", "general_adult"]).notNull(),
  lessonLevel: int("lessonLevel").notNull(),
  lessonIndex: int("lessonIndex").notNull(),
  connectionMode: mysqlEnum("connectionMode", ["automatic", "manual"]).default("automatic").notNull(),
  theoryContentIdsJson: text("theoryContentIdsJson").notNull(),
  workbookQuestionIdsJson: text("workbookQuestionIdsJson").notNull(),
  updatedByUserId: int("updatedByUserId").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type WorkbookLessonConnection = typeof workbookLessonConnections.$inferSelect;
export type InsertWorkbookLessonConnection = typeof workbookLessonConnections.$inferInsert;

// 학습도구 뱃지 테이블
export const userBadges = mysqlTable("user_badges", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  courseType: varchar("courseType", { length: 64 }).notNull(), // elementary, middle_high, high_univ, general_adult
  badgeType: varchar("badgeType", { length: 64 }).notNull(), // summary, reordering, quiz, topic_wizard, thesis_checklist
  badgeName: varchar("badgeName", { length: 128 }).notNull(),
  earnedAt: timestamp("earnedAt").defaultNow().notNull(),
}, (table) => ({
  idxUserId: index("idx_user_badges_userId").on(table.userId),
}));

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
}, (table) => ({
  idxCourseType: index("idx_question_bank_courseType").on(table.courseType),
}));

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
}, (table) => ({
  idxUserId: index("idx_question_bookmarks_userId").on(table.userId),
}));

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
}, (table) => ({
  idxCourseType: index("idx_curriculum_workbook_questions_courseType").on(table.courseType),
}));

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
}, (table) => ({
  idxUserId: index("idx_curriculum_workbook_answers_userId").on(table.userId),
}));

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
}, (table) => ({
  idxUserId: index("idx_workbook_mistakes_userId").on(table.userId),
}));

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
}, (table) => ({
  idxUserId: index("idx_learning_tool_mistakes_userId").on(table.userId),
}));

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
}, (table) => ({
  idxUserId: index("idx_app_notifications_userId").on(table.userId),
}));

export type AppNotification = typeof appNotifications.$inferSelect;
export type InsertAppNotification = typeof appNotifications.$inferInsert;

// ========== 결제·이용권 ==========
// 결제 주문. provider가 "mock"이면 실제 결제가 아닌 임시(테스트) 결제다(isTest=1). 실제 결제 연동 뒤에는 provider만 바뀐다.
export const paymentOrders = mysqlTable("payment_orders", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  planKey: varchar("planKey", { length: 40 }).notNull(),
  amountKrw: int("amountKrw").notNull(),
  currency: varchar("currency", { length: 8 }).default("KRW").notNull(),
  status: mysqlEnum("status", ["pending", "paid", "failed", "cancelled", "refunded"]).default("pending").notNull(),
  provider: varchar("provider", { length: 32 }).notNull(),
  providerOrderId: varchar("providerOrderId", { length: 80 }).notNull().unique(),
  providerPaymentKey: varchar("providerPaymentKey", { length: 200 }),
  isTest: int("isTest").default(0).notNull(),
  failureReason: varchar("failureReason", { length: 255 }),
  paidAt: timestamp("paidAt"),
  refundedAt: timestamp("refundedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type PaymentOrder = typeof paymentOrders.$inferSelect;
export type InsertPaymentOrder = typeof paymentOrders.$inferInsert;

// 이용권. 결제가 확정되면 만들어지고, 기간(currentPeriodEnd) 안에서만 유효하다.
export const subscriptions = mysqlTable("subscriptions", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  planKey: varchar("planKey", { length: 40 }).notNull(),
  status: mysqlEnum("status", ["active", "cancelled", "expired"]).default("active").notNull(),
  currentPeriodStart: timestamp("currentPeriodStart").notNull(),
  currentPeriodEnd: timestamp("currentPeriodEnd").notNull(),
  /** 결제 시점의 AI 평가 한도(요금제가 나중에 바뀌어도 이미 결제한 이용권의 한도는 유지) */
  aiEvaluationsLimit: int("aiEvaluationsLimit").notNull(),
  /** package: 결제 후 '유료 이용 시작'을 눌러야 기간이 시작되는 30일 상품 / addon: 구매일부터 기간이 시작되는 추가권 */
  kind: varchar("kind", { length: 16 }).default("package").notNull(),
  /** 이용 시작 시 기간 계산에 쓰는 일수(결제 시점의 상품 정의를 보존) */
  periodDays: int("periodDays").default(30).notNull(),
  /** 1이면 결제는 끝났지만 이용자가 아직 '유료 이용 시작'을 누르지 않은 상태(기간·AI 횟수가 시작되지 않음) */
  awaitingStart: int("awaitingStart").default(0).notNull(),
  orderId: int("orderId"),
  cancelledAt: timestamp("cancelledAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => ({
  idxUserId: index("idx_subscriptions_userId").on(table.userId),
}));

// 교사 첨삭지도권(횟수권). 일반 첨삭 1종을 1·3·5회분으로 판매하고, 이용권 결제자가 구매한다.
// 신청 1건이 권에서 1회를 차감하고, 전달 전에 취소하면 횟수가 돌아온다. 교사 지급은 계약급여로 따로 집행하므로 정산과 연결하지 않는다.
export const teacherFeedbackPasses = mysqlTable("teacher_feedback_passes", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  productKey: varchar("productKey", { length: 40 }).notNull(), // tf_pass_1 | tf_pass_3 | tf_pass_5
  /** 구매한 총 횟수와 사용한 횟수(결제 시점의 상품 정의를 보존) */
  sessions: int("sessions").notNull(),
  sessionsUsed: int("sessionsUsed").default(0).notNull(),
  priceKrw: int("priceKrw").notNull(),
  orderId: int("orderId").notNull(),
  status: mysqlEnum("status", ["active", "refunded"]).default("active").notNull(),
  /** 구매일부터 유효기간이 끝나는 시각. 지나면 남은 횟수로 새 신청을 할 수 없다(미사용 잔액의 환급 신청은 가능) */
  expiresAt: timestamp("expiresAt").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => ({
  idxUserId: index("idx_tf_passes_userId").on(table.userId),
  idxOrderId: index("idx_tf_passes_orderId").on(table.orderId),
}));

export type TeacherFeedbackPass = typeof teacherFeedbackPasses.$inferSelect;

// 교사 첨삭 신청. 첨삭지도권 1회를 차감해 만든다.
// paid(신청 완료, 교사 대기) → in_progress(교사 작업 중) → delivered(결과 전달) / cancelled(전달 전 취소, 횟수 복원) / refunded(관리자 환불).
export const teacherFeedbackRequests = mysqlTable("teacher_feedback_requests", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  essayId: int("essayId").notNull(),
  /** 차감한 첨삭지도권 */
  passId: int("passId").notNull(),
  /** 신청 시점에 배정된 담당 교사 */
  teacherId: int("teacherId").notNull(),
  status: mysqlEnum("status", ["paid", "in_progress", "delivered", "cancelled", "refunded"]).default("paid").notNull(),
  /** 완료 예정일: 신청한 날부터 영업일 기준으로 계산해 신청 전에 안내하고, 지나면 학생이 취소·대기를 선택할 수 있다 */
  dueAt: timestamp("dueAt").notNull(),
  deliveredAt: timestamp("deliveredAt"),
  teacherFeedbackId: int("teacherFeedbackId"),
  reworkCount: int("reworkCount").default(0).notNull(),
  reworkNote: text("reworkNote"),
  cancelledAt: timestamp("cancelledAt"),
  cancelReason: varchar("cancelReason", { length: 255 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => ({
  idxUserId: index("idx_tf_requests_userId").on(table.userId),
  idxTeacherStatus: index("idx_tf_requests_teacherId_status").on(table.teacherId, table.status),
  idxEssayId: index("idx_tf_requests_essayId").on(table.essayId),
  idxPassId: index("idx_tf_requests_passId").on(table.passId),
}));

export type TeacherFeedbackRequest = typeof teacherFeedbackRequests.$inferSelect;

export type Subscription = typeof subscriptions.$inferSelect;
export type InsertSubscription = typeof subscriptions.$inferInsert;

// ========== 교사 정산 ==========
// 첨삭 활동 유형별 건당 단가(원). 행이 없는 유형은 shared/settlement.ts의 기본 단가를 쓴다.
export const teacherSettlementRates = mysqlTable("teacher_settlement_rates", {
  id: int("id").autoincrement().primaryKey(),
  activityType: varchar("activityType", { length: 40 }).notNull().unique(),
  unitAmountKrw: int("unitAmountKrw").notNull(),
  updatedBy: int("updatedBy"),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type TeacherSettlementRate = typeof teacherSettlementRates.$inferSelect;

// 교사별·월별 정산서. draft(산출 중, 다시 산출 가능) → confirmed(확정, 항목·단가 고정) → paid(지급 완료).
export const teacherSettlements = mysqlTable("teacher_settlements", {
  id: int("id").autoincrement().primaryKey(),
  teacherId: int("teacherId").notNull(),
  periodMonth: varchar("periodMonth", { length: 7 }).notNull(), // YYYY-MM
  itemsJson: text("itemsJson").notNull(),
  grossKrw: int("grossKrw").notNull(),
  withholdingPct: varchar("withholdingPct", { length: 8 }).notNull(),
  withholdingKrw: int("withholdingKrw").notNull(),
  netKrw: int("netKrw").notNull(),
  status: mysqlEnum("status", ["draft", "confirmed", "paid"]).default("draft").notNull(),
  note: text("note"),
  confirmedBy: int("confirmedBy"),
  confirmedAt: timestamp("confirmedAt"),
  paidBy: int("paidBy"),
  paidAt: timestamp("paidAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => ({
  teacherMonthUnique: uniqueIndex("uq_teacher_settlements_teacher_month").on(table.teacherId, table.periodMonth),
}));

export type TeacherSettlement = typeof teacherSettlements.$inferSelect;
export type InsertTeacherSettlement = typeof teacherSettlements.$inferInsert;

// ========== 기관 계약·정산 제외 ==========
// 학교·기관 계약. 기간(periodStart~periodEnd, 끝은 포함하지 않음) 안에서만 유효하고, 세 가지 예산(토큰 = 서비스 이용 횟수)을 가진다.
//  - human: 교사 첨삭·과제 채점·워크북 첨삭 1건 / ai: AI 평가 1회(성공한 것) / management: 출결 기록·공지·과제 생성 1건
// used 값에는 예약(진행 중)한 횟수가 포함되며, 실패하면 되돌린다. 한도를 넘는 차감은 조건부 갱신으로 막는다.
export const institutionContracts = mysqlTable("institution_contracts", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 160 }).notNull(),
  contractCode: varchar("contractCode", { length: 80 }).notNull().unique(),
  periodStart: timestamp("periodStart").notNull(),
  periodEnd: timestamp("periodEnd").notNull(),
  status: mysqlEnum("status", ["draft", "active", "suspended", "closed"]).default("draft").notNull(),
  humanLimit: int("humanLimit").default(0).notNull(),
  aiLimit: int("aiLimit").default(0).notNull(),
  managementLimit: int("managementLimit").default(0).notNull(),
  humanUsed: int("humanUsed").default(0).notNull(),
  aiUsed: int("aiUsed").default(0).notNull(),
  managementUsed: int("managementUsed").default(0).notNull(),
  // 이용 방식: quota(횟수제) / period(기간제: 계약 기간 동안 횟수 제한 없음, 횟수는 기록만).
  usageMode: mysqlEnum("usageMode", ["quota", "period"]).default("quota").notNull(),
  // 횟수제에서 예산을 모두 쓴 뒤: block(차단) / warn(계속 이용, 초과분 기록).
  overageAction: mysqlEnum("overageAction", ["block", "warn"]).default("block").notNull(),
  memo: varchar("memo", { length: 500 }),
  createdBy: int("createdBy").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type InstitutionContract = typeof institutionContracts.$inferSelect;

// 기관 소속 회원(회원 단위 정산 제외). 학생이면 그 학생에 대한 교사의 모든 첨삭이, 교사이면 그 교사의 모든 활동이 개별 정산에서 제외된다.
// contractId가 있으면 그 계약이 이 학생의 AI 평가 비용을 부담한다(없으면 정산 제외만 하고 이용 자격은 주지 않는다).
export const institutionMembers = mysqlTable("institution_members", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  contractId: int("contractId"),
  excludeIndividualSettlement: int("excludeIndividualSettlement").default(1).notNull(),
  reason: varchar("reason", { length: 500 }).notNull(),
  createdBy: int("createdBy").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  endedAt: timestamp("endedAt"),
});

export type InstitutionMember = typeof institutionMembers.$inferSelect;

// 계약 예산 사용 장부. 같은 출처(source)는 한 번만 차감한다. 실패한 예약은 released로 남겨 감사에 쓴다.
export const institutionUsage = mysqlTable("institution_usage", {
  id: int("id").autoincrement().primaryKey(),
  contractId: int("contractId").notNull(),
  budgetType: mysqlEnum("budgetType", ["human", "ai", "management"]).notNull(),
  actorId: int("actorId").notNull(),
  studentId: int("studentId"),
  groupId: int("groupId"),
  sourceType: varchar("sourceType", { length: 40 }),
  sourceId: int("sourceId"),
  status: mysqlEnum("status", ["consumed", "released"]).default("consumed").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => ({
  sourceUnique: uniqueIndex("uq_institution_usage_source").on(table.budgetType, table.sourceType, table.sourceId),
}));

export type InstitutionUsage = typeof institutionUsage.$inferSelect;

// 교사 활동의 정산 대상 여부를 활동이 처음 완료된 시점의 정책으로 고정해 기록한다(이후 계약·소속이 바뀌어도 과거 활동의 해석은 바뀌지 않는다).
// 정산에서 제외되는 경우: automaticExclusion이 none이 아니거나 manualExcluded=1.
export const teacherActivityAccounting = mysqlTable("teacher_activity_accounting", {
  id: int("id").autoincrement().primaryKey(),
  activityType: varchar("activityType", { length: 40 }).notNull(),
  sourceId: int("sourceId").notNull(),
  teacherId: int("teacherId").notNull(),
  studentId: int("studentId").notNull(),
  groupId: int("groupId"),
  contractId: int("contractId"),
  occurredAt: timestamp("occurredAt").notNull(),
  automaticExclusion: mysqlEnum("automaticExclusion", ["none", "institution_contract", "institution_member", "teacher_member"]).default("none").notNull(),
  manualExcluded: int("manualExcluded").default(0).notNull(),
  manualExclusionReason: varchar("manualExclusionReason", { length: 500 }),
  manualExcludedBy: int("manualExcludedBy"),
  manualExcludedAt: timestamp("manualExcludedAt"),
  policySnapshotJson: text("policySnapshotJson").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => ({
  sourceUnique: uniqueIndex("uq_teacher_activity_source").on(table.activityType, table.sourceId),
}));

export type TeacherActivityAccounting = typeof teacherActivityAccounting.$inferSelect;

// 계약·반·소속·정산 제외 변경 이력(누가 언제 무엇을 왜 바꿨는지).
export const institutionAuditLogs = mysqlTable("institution_audit_logs", {
  id: int("id").autoincrement().primaryKey(),
  actorId: int("actorId").notNull(),
  action: varchar("action", { length: 64 }).notNull(),
  targetType: varchar("targetType", { length: 40 }).notNull(),
  targetId: int("targetId").notNull(),
  reason: varchar("reason", { length: 500 }).notNull(),
  detailJson: text("detailJson"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
