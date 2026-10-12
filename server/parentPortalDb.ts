import { and, desc, eq, inArray, isNull, ne } from "drizzle-orm";
import { getCourseTag, parseCourseTypeFromUserTag } from "@shared/course";
import { aiAutoFeedback, certificate, essaySubmission, progress, teacherFeedback, writingEvaluationRecords } from "../drizzle/schema";
import { getDb, getStudentClassAssignmentDetails, getUserById } from "./db";
import { getLearningAnalytics, getWeeklyStudySummary } from "./learningAnalyticsDb";
import { listParentCommentsForStudent } from "./parentCommentDb";

// 학부모 포털이 보여 줄 자녀의 학습 현황. 화면이 원본 행을 그대로 받아 임의 값(예: 점수 85점)을 채우지 않도록
// 실제 기록에서 필요한 필드만 골라 내려보낸다. 자녀의 이메일·운영자 메모·작성 중인 초안은 내려보내지 않는다.

const ESSAY_LIMIT = 20;
const ESSAY_CONTENT_LIMIT = 6000;

export async function getParentStudentOverview(studentId: number) {
  const db = await getDb();
  const student = await getUserById(studentId);
  if (!db || !student) return null;

  const courseType = parseCourseTypeFromUserTag(student.tag);
  const [essays, progressRows, certificates, aiRows, analytics, weekly, classAssignments, comments] = await Promise.all([
    // 제출하거나 첨삭을 받은 글만. 작성 중인 초안은 학생만 본다.
    db
      .select({ id: essaySubmission.id, title: essaySubmission.title, content: essaySubmission.content, status: essaySubmission.status, submittedAt: essaySubmission.submittedAt, updatedAt: essaySubmission.updatedAt })
      .from(essaySubmission)
      .where(and(eq(essaySubmission.userId, studentId), isNull(essaySubmission.deletedAt), ne(essaySubmission.status, "draft")))
      .orderBy(desc(essaySubmission.updatedAt))
      .limit(ESSAY_LIMIT),
    db
      .select({ level: progress.level, score: progress.score, completed: progress.completed, completedAt: progress.completedAt, courseType: progress.courseType })
      .from(progress)
      .where(eq(progress.userId, studentId))
      .orderBy(desc(progress.updatedAt)),
    db
      .select({ id: certificate.id, title: certificate.title, certificateType: certificate.certificateType, level: certificate.level, courseType: certificate.courseType, issuedAt: certificate.issuedAt })
      .from(certificate)
      .where(and(eq(certificate.userId, studentId), eq(certificate.status, "active")))
      .orderBy(desc(certificate.issuedAt)),
    db
      .select({ id: aiAutoFeedback.id, title: aiAutoFeedback.essayTitle, overallScore: aiAutoFeedback.overallScore, createdAt: aiAutoFeedback.createdAt, fallbackUsed: writingEvaluationRecords.fallbackUsed })
      .from(aiAutoFeedback)
      .leftJoin(writingEvaluationRecords, eq(writingEvaluationRecords.feedbackId, aiAutoFeedback.id))
      .where(eq(aiAutoFeedback.userId, studentId))
      .orderBy(desc(aiAutoFeedback.createdAt))
      .limit(10),
    getLearningAnalytics(studentId, courseType ?? undefined),
    getWeeklyStudySummary(studentId, courseType ?? undefined),
    getStudentClassAssignmentDetails(studentId),
    listParentCommentsForStudent(studentId, student.adminNotes),
  ]);

  // 글별 교사 첨삭(최신 1건).
  const essayIds = essays.map((essay) => essay.id);
  const teacherRows = essayIds.length
    ? await db
        .select({ essayId: teacherFeedback.essayId, overallScore: teacherFeedback.overallScore, overallComment: teacherFeedback.overallComment, createdAt: teacherFeedback.createdAt })
        .from(teacherFeedback)
        .where(inArray(teacherFeedback.essayId, essayIds))
        .orderBy(desc(teacherFeedback.createdAt))
    : [];
  const latestTeacher = new Map<number, (typeof teacherRows)[number]>();
  for (const row of teacherRows) if (!latestTeacher.has(row.essayId)) latestTeacher.set(row.essayId, row);

  const completed = progressRows.filter((row) => row.completed === 1);
  const lastCompletedAt = completed.map((row) => row.completedAt).filter((value): value is Date => Boolean(value)).sort((a, b) => b.getTime() - a.getTime())[0] ?? null;
  const scores = completed.map((row) => row.score).filter((value): value is number => typeof value === "number" && value > 0);

  return {
    student: {
      id: student.id,
      name: student.name,
      courseType,
      courseLabel: courseType ? getCourseTag(courseType) : null,
      createdAt: student.createdAt,
      lastSignedIn: student.lastSignedIn,
    },
    learning: {
      completedCount: completed.length,
      startedCount: progressRows.length,
      lastCompletedAt,
      averageScore: scores.length ? Math.round(scores.reduce((sum, value) => sum + value, 0) / scores.length) : null,
      recent: completed
        .filter((row) => row.completedAt)
        .sort((a, b) => b.completedAt!.getTime() - a.completedAt!.getTime())
        .slice(0, 8)
        .map((row) => ({ level: row.level, score: row.score && row.score > 0 ? row.score : null, completedAt: row.completedAt })),
    },
    essays: essays.map((essay) => {
      const teacher = latestTeacher.get(essay.id);
      return {
        id: essay.id,
        title: essay.title,
        content: essay.content.slice(0, ESSAY_CONTENT_LIMIT),
        status: essay.status as "submitted" | "reviewed",
        submittedAt: essay.submittedAt,
        updatedAt: essay.updatedAt,
        teacherScore: teacher?.overallScore ?? null,
        teacherComment: teacher?.overallComment ?? null,
        teacherReviewedAt: teacher?.createdAt ?? null,
      };
    }),
    // AI 모델 호출에 실패해 기본 점검으로 대체된 결과는 점수를 보여 주지 않는다.
    aiFeedbacks: aiRows.map((row) => ({ id: row.id, title: row.title, createdAt: row.createdAt, overallScore: row.fallbackUsed ? null : row.overallScore, basicCheckOnly: Boolean(row.fallbackUsed) })),
    certificates,
    classAssignments,
    analytics,
    weekly,
    comments,
  };
}
