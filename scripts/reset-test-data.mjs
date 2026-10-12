// 테스트로 쌓인 학습현황·글·첨삭·AI 사용 기록·결제/이용권 데이터를 전체 계정에 대해 비운다.
//
// 지우지 않는 것: users(계정), 학부모-자녀 연결(parent_student_links), 커리큘럼·문제은행·이론 콘텐츠, 승인된 글쓰기 예시, 약관·정책·사이트 설정,
//                 관리자 감사 로그, 기관 계약·구성원, 학급 구조(그룹·구성원·과제 자체).
//
// 사용법:
//   node scripts/reset-test-data.mjs                                   점검만(각 테이블의 행 수 출력, DB 변경 없음)
//   node scripts/reset-test-data.mjs --apply --confirm=reset-test-data  실제로 삭제(되돌릴 수 없음)
//
// ⚠ .env의 DATABASE_URL이 운영 DB를 가리키면 운영 데이터가 지워진다. 실행 전에 TiDB Cloud에서 백업/내보내기를 해 두세요.
// 한 트랜잭션으로 지우므로 중간에 실패하면 아무것도 지워지지 않는다. DB 접속 정보는 출력하지 않는다.
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import mysql from "mysql2/promise";

const GROUPS = [
  {
    name: "학습현황",
    tables: [
      "progress",
      "quiz_answer",
      "sentence_feedback_cache",
      "learning_tool_attempts",
      "lesson_theory_progress",
      "curriculum_workbook_answers",
      "workbook_mistakes",
      "learning_tool_mistakes",
      "ai_lesson_guide_histories",
      "user_badges",
      "question_bookmarks",
      "question_feedbacks",
      "workbook_teacher_feedback",
      "certificate",
      "certificate_archives",
      "certificate_approval_requests",
    ],
  },
  {
    name: "글·첨삭·AI 사용 기록",
    tables: [
      "essay_submission",
      "teacher_feedback",
      "feedback_comment",
      // 삭제한 첨삭·글에 달린 별점·후기와 학부모 코멘트가 남으면 관리자 교사 평점 집계와 학생 화면에 지운 글의 기록이 계속 보인다.
      "teacher_feedback_ratings",
      "parent_comments",
      "ai_auto_feedback",
      "writing_evaluation_records",
      "evaluation_review_queue",
      "evaluation_appeals",
      "ai_usage_logs",
      "sample_ai_usage_log",
      "teacher_ai_drafts",
      "teacher_ai_draft_revisions",
      "class_assignment_submissions",
      "class_assignment_ai_feedbacks",
      "class_attendance",
      "app_notifications",
    ],
  },
  {
    name: "결제·이용권·첨삭지도권·정산 통계",
    tables: [
      "payment_orders",
      "subscriptions",
      "teacher_feedback_passes",
      "teacher_feedback_requests",
      "teacher_settlements",
      "teacher_activity_accounting",
      "institution_usage",
    ],
  },
];

const apply = process.argv.includes("--apply");
const confirmed = process.argv.includes("--confirm=reset-test-data");

function loadEnvFile() {
  try {
    for (const line of readFileSync(resolve(".env"), "utf8").split(/\r?\n/)) {
      const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
      if (match && process.env[match[1]] === undefined) process.env[match[1]] = match[2].replace(/^["']|["']$/g, "");
    }
  } catch {
    // .env가 없으면 현재 환경 변수만 쓴다.
  }
}
loadEnvFile();

if (apply && !confirmed) {
  console.error("실제 삭제에는 --confirm=reset-test-data 도 함께 필요합니다. 아무것도 지우지 않았습니다.");
  process.exit(1);
}
if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL이 없습니다(.env 또는 환경 변수).");
  process.exit(1);
}

const connection = await mysql.createConnection(process.env.DATABASE_URL);
try {
  const [[{ db }]] = await connection.query("SELECT DATABASE() AS db");
  console.log(`대상 DB: ${db}`);
  const [existing] = await connection.query("SELECT table_name AS name FROM information_schema.tables WHERE table_schema = DATABASE()");
  const existingNames = new Set(existing.map((row) => row.name ?? row.NAME ?? row.TABLE_NAME));

  const plan = [];
  for (const group of GROUPS) {
    console.log(`\n[${group.name}]`);
    for (const table of group.tables) {
      if (!existingNames.has(table)) {
        console.log(`  - ${table}: 테이블 없음(건너뜀)`);
        continue;
      }
      const [[{ total }]] = await connection.query(`SELECT COUNT(*) AS total FROM \`${table}\``);
      plan.push({ table, total: Number(total) });
      console.log(`  - ${table}: ${Number(total)}행`);
    }
  }
  const [[{ users }]] = await connection.query("SELECT COUNT(*) AS users FROM `users`");
  const sum = plan.reduce((acc, item) => acc + item.total, 0);
  console.log(`\n합계 ${sum}행 삭제 대상. 계정(users) ${Number(users)}개는 그대로 남습니다.`);

  if (!apply) {
    console.log("점검만 했습니다. 지우려면: node scripts/reset-test-data.mjs --apply --confirm=reset-test-data");
    process.exit(0);
  }

  await connection.beginTransaction();
  try {
    for (const { table, total } of plan) {
      if (total > 0) await connection.query(`DELETE FROM \`${table}\``);
    }
    await connection.commit();
  } catch (error) {
    await connection.rollback();
    throw error;
  }
  console.log("\n삭제를 마쳤습니다. 이어서 같은 명령을 --apply 없이 다시 실행해 모든 행이 0인지 확인하세요.");
} finally {
  await connection.end();
}
