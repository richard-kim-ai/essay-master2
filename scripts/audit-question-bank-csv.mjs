import fs from "node:fs";

const csvPath = process.argv[2];
if (!csvPath) throw new Error("CSV 파일 경로를 전달해야 합니다.");

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
    if (char === '\n' || char === '\r') {
      if (char === '\r' && next === '\n') index += 1;
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

const raw = fs.readFileSync(csvPath, "utf8");
const [headerRow, ...rows] = parseCsv(raw);
const headers = headerRow.map((header) => header.replace(/^\uFEFF/, ""));
const requiredHeaders = ["id", "courseType", "toolType", "title", "contentData", "difficulty", "isActive"];
const missingHeaders = requiredHeaders.filter((header) => !headers.includes(header));
const indexOf = (name) => headers.indexOf(name);
const report = {
  header: headers,
  totalRows: rows.length,
  missingHeaders,
  columnCountMismatches: [],
  invalidJson: [],
  invalidCourseTypes: [],
  invalidToolTypes: [],
  invalidDifficulty: [],
  invalidActive: [],
  contentCourseMismatch: [],
  contentToolMismatch: [],
  missingContentKeys: [],
  invalidContentShapes: [],
  repeatedLegacyPhrases: [],
  duplicateBusinessKeys: [],
  byCourseAndTool: {},
  contentKeys: {},
};
const validCourses = new Set(["elementary", "middle_high", "high_univ", "general_adult"]);
const validTools = new Set(["quiz", "reordering", "summary", "topic_wizard", "thesis_checklist"]);
const seenBusinessKeys = new Map();
const legacyPhrases = ["그래서 이 문제는 매우 중요하고 중요하기 때문에 우리가 꼭 반드시 실천해야 한다.", "따라서 글쓴이는 장점을 인정하되, 구체적인 기준과 보완 장치를 함께 마련해야 한다고 주장한다.", "사례의 세부 명칭보다 쟁점, 핵심 주장, 조건을 남기는 것이 중요하다."];

rows.forEach((row, rowIndex) => {
  const rowNumber = rowIndex + 2;
  if (row.length !== headers.length) report.columnCountMismatches.push({ rowNumber, actual: row.length });
  const get = (name) => row[indexOf(name)] ?? "";
  const courseType = get("courseType").trim();
  const toolType = get("toolType").trim();
  const title = get("title").trim();
  const difficulty = get("difficulty").trim();
  const isActive = get("isActive").trim();
  const businessKey = `${courseType}::${toolType}::${title}`;
  if (!validCourses.has(courseType)) report.invalidCourseTypes.push({ rowNumber, value: courseType });
  if (!validTools.has(toolType)) report.invalidToolTypes.push({ rowNumber, value: toolType });
  if (!new Set(["easy", "medium", "hard"]).has(difficulty)) report.invalidDifficulty.push({ rowNumber, value: difficulty });
  if (!new Set(["0", "1"]).has(isActive)) report.invalidActive.push({ rowNumber, value: isActive });
  if (seenBusinessKeys.has(businessKey)) report.duplicateBusinessKeys.push({ rowNumber, duplicateOf: seenBusinessKeys.get(businessKey), businessKey });
  else seenBusinessKeys.set(businessKey, rowNumber);
  const group = `${courseType}/${toolType}`;
  report.byCourseAndTool[group] = (report.byCourseAndTool[group] || 0) + 1;
  let content;
  try { content = JSON.parse(get("contentData")); }
  catch { report.invalidJson.push({ rowNumber, title }); return; }
  Object.keys(content).forEach((key) => { report.contentKeys[key] = (report.contentKeys[key] || 0) + 1; });
  if (content.courseType && content.courseType !== courseType) report.contentCourseMismatch.push({ rowNumber, title, csv: courseType, content: content.courseType });
  if (content.toolType && content.toolType !== toolType) report.contentToolMismatch.push({ rowNumber, title, csv: toolType, content: content.toolType });
  const requiredByTool = {
    quiz: ["prompt", "options", "answer", "explanation"],
    reordering: ["prompt", "paragraphs", "explanation"],
    summary: ["prompt", "model_summary", "explanation"],
    topic_wizard: ["prompt", "broad_topic", "materials_to_collect"],
    thesis_checklist: ["prompt", "checklist"],
  };
  const missing = (requiredByTool[toolType] || []).filter((key) => !(key in content));
  if (missing.length) report.missingContentKeys.push({ rowNumber, title, toolType, missing });
  if (toolType === "quiz" && (!Array.isArray(content.options) || content.options.length < 2 || typeof content.answer !== "string")) {
    report.invalidContentShapes.push({ rowNumber, title, toolType, reason: "options 배열 또는 answer 문자열 형식이 올바르지 않습니다." });
  }
  if (toolType === "reordering" && (!Array.isArray(content.paragraphs) || content.paragraphs.length < 3 || content.paragraphs.some((paragraph) => !paragraph || typeof paragraph.id !== "string" || typeof paragraph.content !== "string" || typeof paragraph.correctOrder !== "number"))) {
    report.invalidContentShapes.push({ rowNumber, title, toolType, reason: "paragraphs 배열에 id·content·correctOrder가 필요합니다." });
  }
  if (toolType === "thesis_checklist" && !Array.isArray(content.checklist)) {
    report.invalidContentShapes.push({ rowNumber, title, toolType, reason: "checklist 배열 형식이 필요합니다." });
  }
  const serialized = JSON.stringify(content);
  legacyPhrases.forEach((phrase) => { if (serialized.includes(phrase)) report.repeatedLegacyPhrases.push({ rowNumber, title, phrase }); });
});

console.log(JSON.stringify(report, null, 2));
