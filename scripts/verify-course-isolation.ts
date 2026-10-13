import { appRouter } from "../server/routers";
import { COURSE_OPTIONS, getCourseTag } from "../shared/course";
import type { TrpcContext } from "../server/_core/context";
import mysql from "mysql2/promise";

// Only read procedures run. These synthetic callers do not create accounts, answers or progress.
async function main() {
  let checks = 0;
  for (const [i, course] of COURSE_OPTIONS.entries()) {
    const caller = appRouter.createCaller({
      user: {
        id: 998800 + i,
        openId: "read-only-course-audit",
        role: "user",
        tag: getCourseTag(course.value),
        name: "검증",
        emailVerifiedAt: new Date(),
        createdAt: new Date(),
      },
      req: { headers: {}, protocol: "https" },
      res: { clearCookie() {} },
    } as unknown as TrpcContext);
    const rows = await caller.questionBank.list({ courseType: course.value });
    if (!rows.every(row => row.courseType === course.value))
      throw new Error(`문항 과정 혼합: ${course.value}`);
    checks++;
    const recommended = await caller.curriculum.getRecommendedQuestions({
      courseType: course.value,
    });
    if (
      !recommended.every(
        row =>
          row.courseType === course.value &&
          !row.correctAnswer &&
          !row.explanation
      )
    )
      throw new Error(`추천 과정·정답 노출: ${course.value}`);
    checks++;
    const progress = await caller.progress.getByUser();
    if (!progress.every(row => row.courseType === course.value))
      throw new Error(`진도 과정 혼합: ${course.value}`);
    checks++;
    await caller.curriculum.getWeeklySummary();
    checks++;
    for (const other of COURSE_OPTIONS.filter(c => c.value !== course.value)) {
      for (const call of [
        () => caller.questionBank.list({ courseType: other.value }),
        () =>
          caller.curriculum.getRecommendedQuestions({
            courseType: other.value,
          }),
        () =>
          caller.curriculum.getWorkbookLessonBundle({
            courseType: other.value,
            level: 1,
            lessonIndex: 0,
          }),
      ]) {
        try {
          await call();
          throw new Error("다른 과정 우회 허용");
        } catch (error) {
          if ((error as { code?: string }).code !== "FORBIDDEN") throw error;
          checks++;
        }
      }
    }
    console.log(
      JSON.stringify({
        course: course.value,
        questions: rows.length,
        recommended: recommended.length,
        onlyOwnCourse: true,
      })
    );
  }
  const connection = await mysql.createConnection(process.env.DATABASE_URL!);
  try {
    const [columns] = await connection.query(
      "SELECT COLUMN_NAME,COLUMN_DEFAULT FROM information_schema.columns WHERE table_schema=DATABASE() AND ((table_name='users' AND column_name='tag') OR (table_name='progress' AND column_name IN ('courseType','curriculumSource','level')))"
    );
    console.log(JSON.stringify({ checks, columns }));
  } finally {
    await connection.end();
  }
}
main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error);
    process.exit(1);
  });
