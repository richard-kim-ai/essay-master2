import fs from "node:fs";
import mysql from "mysql2/promise";

const csvPath = process.argv[2];
if (!csvPath) throw new Error("CSV 파일 경로를 전달해야 합니다.");
if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL이 설정되어 있지 않습니다.");

function parseCsv(text) {
  const records = [];
  let row = [];
  let field = "";
  let quoted = false;
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    const next = text[index + 1];
    if (quoted) {
      if (char === '"' && next === '"') { field += '"'; index += 1; }
      else if (char === '"') quoted = false;
      else field += char;
      continue;
    }
    if (char === '"') { quoted = true; continue; }
    if (char === ',') { row.push(field); field = ""; continue; }
    if (char === "\n" || char === "\r") {
      if (char === "\r" && next === "\n") index += 1;
      row.push(field); field = "";
      if (row.some((value) => value.length > 0)) records.push(row);
      row = [];
      continue;
    }
    field += char;
  }
  if (field.length || row.length) { row.push(field); records.push(row); }
  return records;
}

function loadAndValidateCsv(path) {
  const [headerRow, ...rows] = parseCsv(fs.readFileSync(path, "utf8"));
  const headers = headerRow.map((header) => header.replace(/^\uFEFF/, ""));
  const getIndex = (name) => headers.indexOf(name);
  const required = ["courseType", "toolType", "title", "contentData", "difficulty", "isActive"];
  const missing = required.filter((name) => getIndex(name) < 0);
  if (missing.length) throw new Error(`필수 CSV 컬럼이 없습니다: ${missing.join(", ")}`);
  const courses = new Set(["elementary", "middle_high", "high_univ", "general_adult"]);
  const tools = new Set(["quiz", "reordering", "summary", "topic_wizard", "thesis_checklist"]);
  const difficulties = new Set(["easy", "medium", "hard"]);
  const seen = new Set();
  const records = rows.map((row, offset) => {
    const rowNumber = offset + 2;
    if (row.length !== headers.length) throw new Error(`${rowNumber}행의 컬럼 수가 일치하지 않습니다.`);
    const record = Object.fromEntries(headers.map((header, index) => [header, row[index] ?? ""]));
    if (!courses.has(record.courseType)) throw new Error(`${rowNumber}행의 과정 값이 올바르지 않습니다.`);
    if (!tools.has(record.toolType)) throw new Error(`${rowNumber}행의 학습 도구 값이 올바르지 않습니다.`);
    if (!difficulties.has(record.difficulty)) throw new Error(`${rowNumber}행의 난이도 값이 올바르지 않습니다.`);
    if (!new Set(["0", "1"]).has(record.isActive)) throw new Error(`${rowNumber}행의 활성 상태 값이 올바르지 않습니다.`);
    if (!record.title.trim()) throw new Error(`${rowNumber}행의 제목이 비어 있습니다.`);
    try { JSON.parse(record.contentData); } catch { throw new Error(`${rowNumber}행 contentData가 유효한 JSON이 아닙니다.`); }
    const businessKey = `${record.courseType}::${record.toolType}::${record.title.trim()}`;
    if (seen.has(businessKey)) throw new Error(`${rowNumber}행에 중복된 과정·도구·제목 조합이 있습니다.`);
    seen.add(businessKey);
    return record;
  });
  if (records.length !== 200) throw new Error(`전면 교체 CSV는 200개 문항이어야 합니다. 현재 ${records.length}개입니다.`);
  return records;
}

const records = loadAndValidateCsv(csvPath);
const connection = await mysql.createConnection(process.env.DATABASE_URL);
try {
  const [existingActiveRows] = await connection.query("SELECT id FROM question_bank WHERE isActive = 1 ORDER BY id");
  const previousActiveIds = existingActiveRows.map((row) => row.id);
  await connection.beginTransaction();
  await connection.query("UPDATE question_bank SET isActive = 0 WHERE isActive = 1");
  let firstInsertedId = null;
  for (let start = 0; start < records.length; start += 25) {
    const batch = records.slice(start, start + 25).map((record) => [
      record.courseType,
      record.toolType,
      record.title.trim(),
      record.contentData,
      record.difficulty,
      Number(record.isActive),
    ]);
    const [result] = await connection.query(
      "INSERT INTO question_bank (courseType, toolType, title, contentData, difficulty, isActive) VALUES ?",
      [batch],
    );
    if (firstInsertedId === null) firstInsertedId = Number(result.insertId);
  }
  const [activeCounts] = await connection.query(
    "SELECT courseType, toolType, COUNT(*) AS count FROM question_bank WHERE isActive = 1 GROUP BY courseType, toolType ORDER BY courseType, toolType",
  );
  const totalActive = activeCounts.reduce((total, row) => total + Number(row.count), 0);
  if (totalActive !== 200 || activeCounts.length !== 20 || activeCounts.some((row) => Number(row.count) !== 10)) {
    throw new Error("반영 후 활성 문항 수 또는 과정·도구별 분포가 예상과 다릅니다.");
  }
  const details = JSON.stringify({
    sourceFile: csvPath,
    replacedAt: new Date().toISOString(),
    previousActiveIds,
    newQuestionIdRange: [firstInsertedId, firstInsertedId + records.length - 1],
    importedRows: records.length,
    activeCounts,
  });
  await connection.query(
    "INSERT INTO question_bank_operation_logs (actionType, actorName, details) VALUES (?, ?, ?)",
    ["full_csv_replacement", "system:csv-replacement", details],
  );
  await connection.commit();
  console.log(JSON.stringify({ success: true, previousActiveCount: previousActiveIds.length, importedRows: records.length, newQuestionIdRange: [firstInsertedId, firstInsertedId + records.length - 1], activeCounts }, null, 2));
} catch (error) {
  await connection.rollback();
  throw error;
} finally {
  connection.destroy();
}
