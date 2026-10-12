import { desc, eq } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { essaySubmission, teacherFeedback, users } from "../drizzle/schema";
import { getDb } from "./db";
import { listEssaysForReview } from "./essayWorkspace";

// 교사 마이페이지의 '첨삭 현황': 내가 맡은 글의 진행 상태와 내가 한 첨삭의 최근 목록. 읽기 전용.
const DAY_MS = 24 * 60 * 60 * 1000;
const MY_FEEDBACK_LIMIT = 200;
const RECENT_COUNT = 20;

export interface TeacherFeedbackDashboard {
  summary: {
    /** 담당 학생이 제출했고 아직 첨삭하지 않은 글 */
    waiting: number;
    /** 그중 첨삭 신청이 작업 중(in_progress)인 글 */
    inProgress: number;
    /** 완료 예정일이 지났는데 아직 전달하지 못한 신청 */
    overdue: number;
    /** 내가 지금까지 등록한 첨삭 수 */
    completedTotal: number;
    completedLast30Days: number;
    /** 내 첨삭 점수 평균(점수가 있는 첨삭만, 없으면 null) */
    averageScore: number | null;
  };
  recent: Array<{
    feedbackId: number;
    essayId: number;
    essayTitle: string;
    studentName: string | null;
    studentEmail: string | null;
    overallScore: number | null;
    createdAt: Date;
  }>;
}

export async function getTeacherFeedbackDashboard(
  viewer: { id: number; role: string; teacherStatus?: string | null },
  now: number = Date.now()
): Promise<TeacherFeedbackDashboard> {
  if (viewer.role !== "teacher" || viewer.teacherStatus !== "approved")
    throw new TRPCError({ code: "FORBIDDEN", message: "승인된 첨삭교사 권한이 필요합니다." });
  const db = await getDb();
  if (!db) throw new TRPCError({ code: "SERVICE_UNAVAILABLE", message: "서버에 연결할 수 없습니다." });

  // 담당 학생이 제출한 글(대기·완료)과 최근 첨삭 신청 상태
  const assigned = await listEssaysForReview(viewer, { status: "all" });
  const waitingRows = assigned.filter((row) => !row.hasTeacherFeedback);
  const open = (row: (typeof assigned)[number]) => row.requestStatus === "paid" || row.requestStatus === "in_progress";

  // 내가 등록한 첨삭(최신순)
  const mine = await db
    .select({
      feedbackId: teacherFeedback.id,
      essayId: teacherFeedback.essayId,
      overallScore: teacherFeedback.overallScore,
      createdAt: teacherFeedback.createdAt,
      essayTitle: essaySubmission.title,
      studentName: users.name,
      studentEmail: users.email,
    })
    .from(teacherFeedback)
    .innerJoin(essaySubmission, eq(essaySubmission.id, teacherFeedback.essayId))
    .innerJoin(users, eq(users.id, essaySubmission.userId))
    .where(eq(teacherFeedback.teacherId, viewer.id))
    .orderBy(desc(teacherFeedback.createdAt))
    .limit(MY_FEEDBACK_LIMIT);

  const scores = mine.map((row) => row.overallScore).filter((score): score is number => typeof score === "number");
  return {
    summary: {
      waiting: waitingRows.length,
      inProgress: waitingRows.filter((row) => row.requestStatus === "in_progress").length,
      overdue: assigned.filter((row) => open(row) && row.requestDueAt && new Date(row.requestDueAt).getTime() < now).length,
      completedTotal: mine.length,
      completedLast30Days: mine.filter((row) => now - new Date(row.createdAt).getTime() <= 30 * DAY_MS).length,
      averageScore: scores.length ? Math.round(scores.reduce((sum, score) => sum + score, 0) / scores.length) : null,
    },
    recent: mine.slice(0, RECENT_COUNT),
  };
}
