import fs from "node:fs/promises";
import mysql from "mysql2/promise";

const [csvPath] = process.argv.slice(2);

if (!csvPath) {
  throw new Error("사용법: node scripts/import-question-bank-csv.mjs <csv-파일-경로>");
}

function parseCsvRows(source) {
  const rows = [];
  let row = [];
  let field = "";
  let quoted = false;

  for (let index = 0; index < source.length; index += 1) {
    const character = source[index];
    const next = source[index + 1];

    if (character === '"') {
      if (!quoted && field.length === 0) {
        quoted = true;
      } else if (quoted && next === '"') {
        field += '"';
        index += 1;
      } else if (quoted && (next === "," || next === "\r" || next === "\n" || next === undefined)) {
        quoted = false;
      } else {
        field += character;
      }
    } else if (character === "," && !quoted) {
      row.push(field.trim());
      field = "";
    } else if ((character === "\r" || character === "\n") && !quoted) {
      if (character === "\r" && next === "\n") index += 1;
      row.push(field.trim());
      if (row.length > 1 || row[0] !== "") rows.push(row);
      row = [];
      field = "";
    } else {
      field += character;
    }
  }

  if (field !== "" || row.length > 0) {
    row.push(field.trim());
    rows.push(row);
  }

  return rows;
}

const source = await fs.readFile(csvPath, "utf8");
const rows = parseCsvRows(source);
const header = rows[0].map((column) => column.replace(/^\uFEFF/, "").trim());
const indexes = Object.fromEntries(header.map((column, index) => [column, index]));
const required = ["id", "courseType", "toolType", "title", "contentData", "difficulty"];

for (const column of required) {
  if (indexes[column] === undefined) throw new Error(`필수 CSV 열이 없습니다: ${column}`);
}

const trailingColumnCount = header.length - indexes.difficulty;
const validCourses = new Set(["elementary", "middle_high", "high_univ", "general_adult"]);
const validDifficulties = new Set(["easy", "medium", "hard"]);
const items = [];
const failures = [];

for (let rowNumber = 1; rowNumber < rows.length; rowNumber += 1) {
  const row = rows[rowNumber];
  try {
    const difficultyIndex = row.length - trailingColumnCount;
    const contentData = row.slice(indexes.contentData, difficultyIndex).join(",");
    const parsedContent = JSON.parse(contentData);
    const item = {
      id: Number(row[indexes.id]),
      courseType: row[indexes.courseType],
      toolType: row[indexes.toolType],
      title: row[indexes.title],
      contentData: JSON.stringify(parsedContent),
      difficulty: row[difficultyIndex],
    };

    if (!Number.isInteger(item.id) || item.id <= 0) throw new Error("유효하지 않은 ID");
    if (!validCourses.has(item.courseType)) throw new Error(`유효하지 않은 과정: ${item.courseType}`);
    if (!validDifficulties.has(item.difficulty)) item.difficulty = "medium";
    if (!item.toolType || !item.title) throw new Error("학습 도구 또는 제목이 비어 있음");
    items.push(item);
  } catch (error) {
    failures.push({ row: rowNumber + 1, reason: error instanceof Error ? error.message : "알 수 없는 형식 오류" });
  }
}

if (items.length === 0) throw new Error(`반영 가능한 문항이 없습니다. 형식 오류 ${failures.length}건`);

const connection = await mysql.createConnection(process.env.DATABASE_URL);
let created = 0;
let updated = 0;

try {
  for (const item of items) {
    const [result] = await connection.execute(
      `INSERT INTO question_bank (id, courseType, toolType, title, contentData, difficulty, isActive)
       VALUES (?, ?, ?, ?, ?, ?, 1)
       ON DUPLICATE KEY UPDATE
         courseType = VALUES(courseType),
         toolType = VALUES(toolType),
         title = VALUES(title),
         contentData = VALUES(contentData),
         difficulty = VALUES(difficulty),
         isActive = 1,
         updatedAt = NOW()`,
      [item.id, item.courseType, item.toolType, item.title, item.contentData, item.difficulty],
    );
    if (result.affectedRows === 1) created += 1;
    else updated += 1;
  }

  const [countRows] = await connection.execute("SELECT COUNT(*) AS questionCount FROM question_bank");
  console.log(JSON.stringify({ totalRows: rows.length - 1, created, updated, failed: failures.length, questionCount: countRows[0].questionCount, failures }, null, 2));
} finally {
  await connection.end();
}
