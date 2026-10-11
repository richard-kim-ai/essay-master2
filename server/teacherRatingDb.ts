import { count, desc, eq } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { essaySubmission, teacherFeedback, teacherFeedbackRatings, users } from "../drizzle/schema";
import * as db from "./db";

// 교사 별점·후기. 학생이 받은 교사 첨삭 1건에 별점(1~5)과 후기를 남기고, 관리자가 교사별로 모아 평가·관리한다.

export const RATING_MIN = 1;
export const RATING_MAX = 5;
export const REVIEW_MAX_LENGTH = 1000;
/** 이 점수 이하의 별점은 관리자가 주의 깊게 볼 '낮은 평가'로 센다. */
export const LOW_RATING_THRESHOLD = 2;

export interface TeacherRatingSummary {
  teacherId: number;
  average: number | null;
  count: number;
  /** 별점별 개수(1~5) */
  distribution: Record<1 | 2 | 3 | 4 | 5, number>;
  lowCount: number;
  reviews: Array<{ id: number; rating: number; review: string | null; createdAt: Date; essayId: number; essayTitle: string | null; studentName: string | null }>;
}

const emptyDistribution = (): TeacherRatingSummary["distribution"] => ({ 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 });
const roundOne = (value: number) => Math.round(value * 10) / 10;

export function summarizeRatings(teacherId: number, rows: Array<{ rating: number }>): Omit<TeacherRatingSummary, "reviews"> {
  const distribution = emptyDistribution();
  for (const row of rows) if (row.rating >= RATING_MIN && row.rating <= RATING_MAX) distribution[row.rating as 1 | 2 | 3 | 4 | 5] += 1;
  const valid = rows.filter((row) => row.rating >= RATING_MIN && row.rating <= RATING_MAX);
  return {
    teacherId,
    average: valid.length ? roundOne(valid.reduce((sum, row) => sum + row.rating, 0) / valid.length) : null,
    count: valid.length,
    distribution,
    lowCount: valid.filter((row) => row.rating <= LOW_RATING_THRESHOLD).length,
  };
}

/** 학생이 받은 교사 첨삭에 별점·후기를 남기거나 고친다(첨삭 1건당 1개). */
export async function rateTeacherFeedback(student: { id: number; role: string }, input: { feedbackId: number; rating: number; review?: string | null }) {
  if (student.role !== "user") throw new TRPCError({ code: "FORBIDDEN", message: "첨삭을 받은 학생만 교사를 평가할 수 있습니다." });
  if (!Number.isInteger(input.rating) || input.rating < RATING_MIN || input.rating > RATING_MAX)
    throw new TRPCError({ code: "BAD_REQUEST", message: "별점은 1점부터 5점까지 선택해 주세요." });
  const review = input.review?.trim() ? input.review.trim().slice(0, REVIEW_MAX_LENGTH) : null;

  const feedback = await db.getTeacherFeedbackById(input.feedbackId);
  if (!feedback) throw new TRPCError({ code: "NOT_FOUND", message: "첨삭을 찾을 수 없습니다." });
  const essay = await db.getEssaySubmissionById(feedback.essayId);
  if (!essay || essay.userId !== student.id) throw new TRPCError({ code: "FORBIDDEN", message: "내 글에 등록된 교사 첨삭만 평가할 수 있습니다." });

  const database = await db.getDb();
  if (!database) throw new TRPCError({ code: "SERVICE_UNAVAILABLE", message: "서버에 연결할 수 없습니다." });
  await database
    .insert(teacherFeedbackRatings)
    .values({ feedbackId: feedback.id, essayId: essay.id, studentId: student.id, teacherId: feedback.teacherId, rating: input.rating, review })
    .onDuplicateKeyUpdate({ set: { rating: input.rating, review, updatedAt: new Date() } });
  return { feedbackId: feedback.id, teacherId: feedback.teacherId, rating: input.rating, review };
}

/** 내가 이 첨삭에 남긴 평가(없으면 null). */
export async function getMyTeacherRating(student: { id: number }, feedbackId: number) {
  const database = await db.getDb();
  if (!database) return null;
  const [row] = await database.select().from(teacherFeedbackRatings).where(eq(teacherFeedbackRatings.feedbackId, feedbackId)).limit(1);
  return row && row.studentId === student.id ? { rating: row.rating, review: row.review, updatedAt: row.updatedAt } : null;
}

/** 교사 한 명의 평점 요약과 최근 후기(관리자용). */
export async function getTeacherRatingDetail(teacherId: number, reviewLimit = 30): Promise<TeacherRatingSummary> {
  const database = await db.getDb();
  if (!database) throw new TRPCError({ code: "SERVICE_UNAVAILABLE", message: "서버에 연결할 수 없습니다." });
  const rows = await database
    .select({
      id: teacherFeedbackRatings.id,
      rating: teacherFeedbackRatings.rating,
      review: teacherFeedbackRatings.review,
      createdAt: teacherFeedbackRatings.createdAt,
      essayId: teacherFeedbackRatings.essayId,
      essayTitle: essaySubmission.title,
      studentName: users.name,
    })
    .from(teacherFeedbackRatings)
    .leftJoin(essaySubmission, eq(essaySubmission.id, teacherFeedbackRatings.essayId))
    .leftJoin(users, eq(users.id, teacherFeedbackRatings.studentId))
    .where(eq(teacherFeedbackRatings.teacherId, teacherId))
    .orderBy(desc(teacherFeedbackRatings.createdAt))
    .limit(2000);
  return { ...summarizeRatings(teacherId, rows), reviews: rows.slice(0, reviewLimit) };
}

export interface TeacherRatingOverviewRow {
  teacherId: number;
  name: string | null;
  email: string | null;
  teacherLevel: number | null;
  teacherStatus: string;
  feedbackCount: number;
  ratingCount: number;
  average: number | null;
  lowCount: number;
  lastRatedAt: Date | null;
}

/** 모든 교사의 평점 현황(관리자용). 평가가 없는 교사도 포함하고, 평균이 낮은 순으로 보여 주기 쉽게 정렬한다. */
export async function listTeacherRatingOverview(): Promise<TeacherRatingOverviewRow[]> {
  const database = await db.getDb();
  if (!database) return [];
  const [teachers, ratings, feedbackCounts] = await Promise.all([
    database.select({ id: users.id, name: users.name, email: users.email, teacherLevel: users.teacherLevel, teacherStatus: users.teacherStatus }).from(users).where(eq(users.role, "teacher")),
    database.select({ teacherId: teacherFeedbackRatings.teacherId, rating: teacherFeedbackRatings.rating, createdAt: teacherFeedbackRatings.createdAt }).from(teacherFeedbackRatings).limit(50000),
    database.select({ teacherId: teacherFeedback.teacherId, n: count() }).from(teacherFeedback).groupBy(teacherFeedback.teacherId),
  ]);
  const feedbackByTeacher = new Map(feedbackCounts.map((row) => [row.teacherId, Number(row.n)]));
  const rows = teachers.map((teacher): TeacherRatingOverviewRow => {
    const mine = ratings.filter((rating) => rating.teacherId === teacher.id);
    const summary = summarizeRatings(teacher.id, mine);
    const last = mine.reduce<Date | null>((latest, rating) => (!latest || new Date(rating.createdAt) > latest ? new Date(rating.createdAt) : latest), null);
    return { teacherId: teacher.id, name: teacher.name, email: teacher.email, teacherLevel: teacher.teacherLevel, teacherStatus: teacher.teacherStatus, feedbackCount: feedbackByTeacher.get(teacher.id) ?? 0, ratingCount: summary.count, average: summary.average, lowCount: summary.lowCount, lastRatedAt: last };
  });
  // 평가가 있는 교사를 평균이 낮은 순으로, 평가가 없는 교사는 뒤에 둔다.
  return rows.sort((a, b) => (a.average === null ? 1 : 0) - (b.average === null ? 1 : 0) || (a.average ?? 0) - (b.average ?? 0) || b.ratingCount - a.ratingCount);
}
