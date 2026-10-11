import { and, desc, eq, gte, inArray } from "drizzle-orm";
import { aiAutoFeedback, writingEvaluationRecords, curriculumWorkbookAnswers, curriculumWorkbookQuestions, essaySubmission, learningToolAttempts, progress, teacherFeedback } from "../drizzle/schema";
import type { CourseType } from "../shared/course";
import { buildLearningAnalytics, buildWeeklySummary, type LearningAnalytics } from "../shared/learningAnalytics";
import { getDb } from "./db";

// 한 학습자의 실제 기록(AI 첨삭·교사 첨삭·학습 도구 결과)을 읽어 능력·성장 분석을 만든다. 읽기 전용.
const PER_SOURCE_LIMIT = 300;

export async function getLearningAnalytics(userId: number, courseType?: CourseType): Promise<LearningAnalytics> {
  const db = await getDb();
  if (!db) return buildLearningAnalytics({ ai: [], teacher: [], tools: [] });

  const aiRowsRaw = await db
    .select({
      fallbackUsed: writingEvaluationRecords.fallbackUsed,
      createdAt: aiAutoFeedback.createdAt,
      overallScore: aiAutoFeedback.overallScore,
      structureScore: aiAutoFeedback.structureScore,
      logicScore: aiAutoFeedback.logicScore,
      expressionScore: aiAutoFeedback.expressionScore,
    })
    .from(aiAutoFeedback)
    .leftJoin(writingEvaluationRecords, eq(writingEvaluationRecords.feedbackId, aiAutoFeedback.id))
    .where(courseType ? and(eq(aiAutoFeedback.userId, userId), eq(aiAutoFeedback.courseType, courseType)) : eq(aiAutoFeedback.userId, userId))
    .orderBy(desc(aiAutoFeedback.createdAt))
    .limit(PER_SOURCE_LIMIT);
  // AI 모델 호출에 실패해 기본 규칙 점검으로 대체된 결과는 실력 분석에 섞지 않는다.
  const aiRows = aiRowsRaw.filter((row) => !row.fallbackUsed);

  // 교사 첨삭은 학생의 글(essay_submission)을 통해 찾는다.
  const essayIds = (await db.select({ id: essaySubmission.id }).from(essaySubmission).where(eq(essaySubmission.userId, userId)).limit(1000)).map((row) => row.id);
  const teacherRows = essayIds.length
    ? await db
        .select({
          createdAt: teacherFeedback.createdAt,
          overallScore: teacherFeedback.overallScore,
          structureScore: teacherFeedback.structureScore,
          logicScore: teacherFeedback.logicScore,
          expressionScore: teacherFeedback.expressionScore,
        })
        .from(teacherFeedback)
        .where(inArray(teacherFeedback.essayId, essayIds))
        .orderBy(desc(teacherFeedback.createdAt))
        .limit(PER_SOURCE_LIMIT)
    : [];

  const toolRows = await db
    .select({ createdAt: learningToolAttempts.createdAt, toolType: learningToolAttempts.toolType, score: learningToolAttempts.score })
    .from(learningToolAttempts)
    .where(courseType ? and(eq(learningToolAttempts.userId, userId), eq(learningToolAttempts.courseType, courseType)) : eq(learningToolAttempts.userId, userId))
    .orderBy(desc(learningToolAttempts.createdAt))
    .limit(PER_SOURCE_LIMIT);

  return buildLearningAnalytics({ ai: aiRows, teacher: teacherRows, tools: toolRows });
}

export async function getWeeklyStudySummary(
  userId: number,
  courseType?: CourseType
) {
  const empty = buildWeeklySummary({ answers: [], tools: [], completions: [] });
  const db = await getDb();
  if (!db) return empty;
  // 최근 14일(이번 주 7일 + 지난주 7일)의 실제 기록으로 계산한다. 학습 시간은 기록이 없어 추정하지 않는다.
  const since = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000);

  const answerWhere = courseType
    ? and(eq(curriculumWorkbookAnswers.userId, userId), gte(curriculumWorkbookAnswers.createdAt, since), eq(curriculumWorkbookQuestions.courseType, courseType))
    : and(eq(curriculumWorkbookAnswers.userId, userId), gte(curriculumWorkbookAnswers.createdAt, since));
  const answers = await db
    .select({ createdAt: curriculumWorkbookAnswers.createdAt, isCorrect: curriculumWorkbookAnswers.isCorrect })
    .from(curriculumWorkbookAnswers)
    .innerJoin(curriculumWorkbookQuestions, eq(curriculumWorkbookQuestions.id, curriculumWorkbookAnswers.questionId))
    .where(answerWhere);

  const tools = await db
    .select({ createdAt: learningToolAttempts.createdAt })
    .from(learningToolAttempts)
    .where(
      courseType
        ? and(eq(learningToolAttempts.userId, userId), gte(learningToolAttempts.createdAt, since), eq(learningToolAttempts.courseType, courseType))
        : and(eq(learningToolAttempts.userId, userId), gte(learningToolAttempts.createdAt, since))
    );

  const completions = await db
    .select({ completedAt: progress.completedAt })
    .from(progress)
    .where(
      courseType
        ? and(eq(progress.userId, userId), gte(progress.completedAt, since), eq(progress.courseType, courseType))
        : and(eq(progress.userId, userId), gte(progress.completedAt, since))
    );

  return buildWeeklySummary({ answers, tools, completions });
}

