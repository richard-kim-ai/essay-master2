// drizzle/ 마이그레이션 SQL 한 개를 .env의 DATABASE_URL 대상 DB에 적용한다(새 테이블 추가용).
//
// 사용법:  node scripts/apply-migration.mjs drizzle/0049_billing_and_settlement.sql          (적용 계획만 출력)
//          node scripts/apply-migration.mjs drizzle/0049_billing_and_settlement.sql --apply  (실제 적용)
//
// - CREATE TABLE 과 ALTER TABLE ... ADD <컬럼> 만 처리한다. 이미 있는 테이블·컬럼은 건너뛴다(여러 번 실행해도 안전).
// - 데이터를 지우거나 바꾸는 문장(DROP·MODIFY·DELETE·UPDATE 등)이 들어 있으면 실행하지 않고 멈춘다.
// - DB 접속 정보는 출력하지 않는다.
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import mysql from "mysql2/promise";

const [, , fileArg, ...flags] = process.argv;
const apply = flags.includes("--apply");
if (!fileArg) {
  console.error("사용법: node scripts/apply-migration.mjs <drizzle/NNNN_name.sql> [--apply]");
  process.exit(1);
}

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

const sql = readFileSync(resolve(fileArg), "utf8");
const statements = sql.split("--> statement-breakpoint").map((statement) => statement.trim()).filter(Boolean);
const isCreateTable = (statement) => /^CREATE TABLE/i.test(statement);
// ALTER는 "컬럼 하나 추가" 한 가지만 허용한다(쉼표로 이어진 다른 ALTER·변경 절이나 추가 문장이 붙어 있으면 거절).
const isAddColumn = (statement) =>
  /^ALTER TABLE `[^`]+` ADD `[^`]+` [^;]*;?$/i.test(statement) &&
  (statement.match(/\bALTER\b/gi) ?? []).length === 1 &&
  !/,\s*(ADD|ALTER|DROP|MODIFY|CHANGE|RENAME)\b/i.test(statement) &&
  !/\b(DROP|MODIFY|CHANGE|RENAME)\b/i.test(statement);
const forbidden = statements.filter((statement) => !isCreateTable(statement) && !isAddColumn(statement));
if (forbidden.length > 0) {
  console.error("허용되지 않은 문장이 있어 중단합니다(CREATE TABLE·ADD 컬럼만 허용, 수동 검토 필요):");
  for (const statement of forbidden) console.error(" -", statement.split("\n")[0]);
  process.exit(1);
}

const connection = await mysql.createConnection(databaseUrl);
try {
  const [rows] = await connection.query("SELECT DATABASE() AS db");
  console.log(`대상 DB: ${rows[0].db}`);
  let created = 0;
  for (const statement of statements) {
    let label;
    let exists;
    if (isCreateTable(statement)) {
      const table = statement.match(/CREATE TABLE `([^`]+)`/i)?.[1];
      label = `테이블 ${table}`;
      [exists] = await connection.query("SELECT 1 FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name = ?", [table]);
    } else {
      const [, table, column] = statement.match(/^ALTER TABLE `([^`]+)` ADD `([^`]+)`/i);
      label = `컬럼 ${table}.${column}`;
      [exists] = await connection.query("SELECT 1 FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = ? AND column_name = ?", [table, column]);
    }
    if (exists.length > 0) {
      console.log(`건너뜀(이미 있음): ${label}`);
      continue;
    }
    if (!apply) {
      console.log(`생성 예정: ${label}`);
      continue;
    }
    await connection.query(statement);
    console.log(`생성됨: ${label}`);
    created += 1;
  }
  console.log(apply ? `완료: ${created}개 항목 적용` : "계획만 출력했습니다. 실제 적용은 --apply 를 붙여 다시 실행하세요.");
} finally {
  await connection.end();
}
