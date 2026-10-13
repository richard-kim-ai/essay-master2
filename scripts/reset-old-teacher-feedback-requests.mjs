// 예전(건별 결제 버전)의 teacher_feedback_requests 테이블을 치우고 새 구조(첨삭지도권)로 다시 만들 수 있게 한다.
//
// 배경: 0056 마이그레이션이 한 번 건별 결제 구조로 적용된 DB에서는 teacher_feedback_requests가 이미 있어서,
// apply-migration.mjs가 새 테이블 정의를 '건너뜀'으로 처리하고 passId 인덱스에서 실패한다.
// apply-migration.mjs는 DROP을 막아 두었으므로 이 테이블만 따로 정리한다.
//
// 사용법:
//   node scripts/reset-old-teacher-feedback-requests.mjs          (상태만 출력, DB 변경 없음)
//   node scripts/reset-old-teacher-feedback-requests.mjs --apply  (예전 구조이고 행이 0개일 때만 테이블 삭제)
// 삭제한 뒤에는 node scripts/apply-migration.mjs drizzle/0056_teacher_feedback_passes.sql --apply 를 다시 실행한다.
//
// - 테이블에 행이 하나라도 있으면 아무것도 지우지 않고 멈춘다.
// - 이미 새 구조(passId 컬럼 있음)이면 아무것도 하지 않는다.
// - DB 접속 정보는 출력하지 않는다.
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import mysql from "mysql2/promise";

const apply = process.argv.includes("--apply");

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

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  console.error("DATABASE_URL이 없습니다(.env 또는 환경 변수).");
  process.exit(1);
}

const connection = await mysql.createConnection(databaseUrl);
try {
  const [dbRows] = await connection.query("SELECT DATABASE() AS db");
  console.log(`대상 DB: ${dbRows[0].db}`);

  const [columns] = await connection.query(
    "SELECT column_name AS name FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = 'teacher_feedback_requests'",
  );
  if (columns.length === 0) {
    console.log("teacher_feedback_requests 테이블이 없습니다. 정리할 것이 없으니 apply-migration.mjs를 바로 실행하세요.");
    process.exit(0);
  }
  const names = columns.map((column) => column.name ?? column.NAME ?? column.COLUMN_NAME);
  console.log(`컬럼: ${names.join(", ")}`);

  if (names.includes("passId")) {
    console.log("이미 새 구조(passId 컬럼 있음)입니다. 이 스크립트로 할 일이 없습니다.");
    process.exit(0);
  }
  if (!names.includes("productKey")) {
    console.error("예전 건별 버전의 구조가 아닙니다(productKey 컬럼 없음). 안전을 위해 아무것도 하지 않습니다. 수동으로 확인해 주세요.");
    process.exit(1);
  }

  const [[{ total }]] = await connection.query("SELECT COUNT(*) AS total FROM `teacher_feedback_requests`");
  console.log(`예전 구조의 행 수: ${total}`);
  if (Number(total) > 0) {
    console.error("행이 있어서 지우지 않습니다. 이 신청 기록(결제 내역 포함)을 어떻게 처리할지 정한 뒤 수동으로 정리해 주세요.");
    process.exit(1);
  }

  if (!apply) {
    console.log("예전 구조이고 비어 있습니다. 계획만 출력했습니다. 테이블을 삭제하려면 --apply 를 붙여 다시 실행하세요.");
    process.exit(0);
  }
  await connection.query("DROP TABLE `teacher_feedback_requests`");
  console.log("예전 teacher_feedback_requests 테이블을 삭제했습니다.");
  console.log("이어서 실행: node scripts/apply-migration.mjs drizzle/0056_teacher_feedback_passes.sql --apply");
} finally {
  await connection.end();
}
