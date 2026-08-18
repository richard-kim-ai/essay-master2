import { z } from "zod";
import { invokeLLM } from "./_core/llm";

export const QUESTION_BANK_MASTER_PROMPT_VERSION = "2026-08-18-taxonomy-a-f-v1";

export const COURSE_MAP = {
  ELEMENTARY: { db: "elementary", label: "초등 논술", defaultDifficulty: 2 },
  MIDDLE_HIGH: { db: "middle_high", label: "중고등 논술", defaultDifficulty: 3 },
  HIGH_ADMISSION: { db: "high_univ", label: "고등/대입 논술", defaultDifficulty: 4 },
  GENERAL_WORK: { db: "general_adult", label: "일반/직장인 논술", defaultDifficulty: 3 },
} as const;
export const TOOL_TYPE_MAP = {
  QUIZ: { db: "quiz", label: "AI 문장 교정 퀴즈" },
  PARAGRAPH_REORDERING: { db: "reordering", label: "단락 재구성" },
  SUMMARY: { db: "summary", label: "요약 연습" },
  TOPIC_WIZARD: { db: "topic_wizard", label: "주제 설정 위저드" },
  CHECKLIST: { db: "thesis_checklist", label: "주제문 체크리스트" },
} as const;
const legacyCourses: Record<string, keyof typeof COURSE_MAP> = { elementary: "ELEMENTARY", middle_high: "MIDDLE_HIGH", high_univ: "HIGH_ADMISSION", general_adult: "GENERAL_WORK" };
const legacyTools: Record<string, keyof typeof TOOL_TYPE_MAP> = { quiz: "QUIZ", reordering: "PARAGRAPH_REORDERING", paragraph_reordering: "PARAGRAPH_REORDERING", summary: "SUMMARY", topic_wizard: "TOPIC_WIZARD", thesis_checklist: "CHECKLIST", checklist: "CHECKLIST" };
const metricsSchema = z.object({ vocabulary_complexity: z.number().int().min(1).max(5), sentence_complexity: z.number().int().min(1).max(5), information_density: z.number().int().min(1).max(5), reasoning_depth: z.number().int().min(1).max(5), error_complexity: z.number().int().min(1).max(5), answer_ambiguity: z.number().int().min(1).max(5), concept_integration: z.number().int().min(1).max(5) });

export const generationRequestSchema = z.object({
  course: z.string().trim().min(1), tool_type: z.string().trim().min(1), theory_category: z.string().trim().min(1).default("AUTO"), difficulty: z.union([z.literal("AUTO"), z.coerce.number().int().min(1).max(5)]).default("AUTO"), question_count: z.coerce.number().int().min(1).max(20).default(3), topic: z.string().trim().min(1).default("AUTO"),
});
export type GenerationRequest = z.infer<typeof generationRequestSchema>;
export type GenerationRequestInput = z.input<typeof generationRequestSchema>;
export type AdaptiveStats = { courseType: string; correctRate?: number; totalAttempts?: number; weakTheoryCategories?: string[] };
export type QuestionBankDTO = { courseType: "elementary" | "middle_high" | "high_univ" | "general_adult"; toolType: "quiz" | "reordering" | "summary" | "topic_wizard" | "thesis_checklist"; title: string; contentData: string; difficulty: "easy" | "medium" | "hard"; isActive: number; qaStatus?: "passed" | "blocked"; qaIssues?: string[]; duplicateScore?: number };

export const QUESTION_BANK_MASTER_PROMPT = `당신은 한국어 논술·글쓰기 전문 문항개발 AI다. 실제 학습자가 풀 수 있는 완전한 문항만 생성하며 placeholder, seed, 개발 테스트 문구, 제목만 있는 문항, 최신 사실의 진위를 정답으로 요구하는 문항, 사족과 반복을 금지한다. 과정은 ELEMENTARY(초등고학년/TOPIK3), MIDDLE_HIGH(중고등/TOPIK4), HIGH_ADMISSION(고등·대입/TOPIK5~6), GENERAL_WORK(일반·직장인/TOPIK6 실무형)이며, 난이도 1~5는 어휘·문장 구조·정보 밀도·추론·오류 복합성·정답 모호성·개념 결합으로 조절한다. theory_category를 실제로 평가한다. 모든 문항에는 question, explanation, learning_objective, difficulty_metrics 7개 값이 필요하다. QUIZ에는 4개 choices와 하나의 correct_answer, PARAGRAPH_REORDERING에는 paragraphs[{id,content,correctOrder}], SUMMARY에는 passage·keyPoints·model_answer, TOPIC_WIZARD에는 guidelines 3개와 sampleOutput, CHECKLIST에는 checklistItems 3개와 passingStandard를 포함한다. JSON만 반환한다.`;
export function loadQuestionBankMasterPrompt() { return QUESTION_BANK_MASTER_PROMPT; }

function course(input: string): keyof typeof COURSE_MAP { const upper = input.trim().toUpperCase(); if (upper in COURSE_MAP) return upper as keyof typeof COURSE_MAP; if (legacyCourses[input.trim()]) return legacyCourses[input.trim()]; throw new Error(`지원하지 않는 과정: ${input}`); }
function tool(input: string): keyof typeof TOOL_TYPE_MAP { const upper = input.trim().toUpperCase(); if (upper in TOOL_TYPE_MAP) return upper as keyof typeof TOOL_TYPE_MAP; if (legacyTools[input.trim()]) return legacyTools[input.trim()]; throw new Error(`지원하지 않는 도구: ${input}`); }
function clean(value: unknown, fallback = "") { return typeof value === "string" && value.trim() ? value.trim() : fallback; }
function parse(raw: unknown): Record<string, any> { const text = typeof raw === "string" ? raw.replace(/```json/gi, "").replace(/```/g, "").trim() : JSON.stringify(raw ?? {}); return JSON.parse(text); }
function normalizeText(value: unknown) { return String(value ?? "").replace(/\s+/g, " ").replace(/[^\w\s가-힣ㄱ-ㅎㅏ-ㅣ]/g, "").trim().toLowerCase(); }
function similarity(a: string, b: string) { const as = new Set(a.split(" ").filter(Boolean)); const bs = new Set(b.split(" ").filter(Boolean)); const aItems = Array.from(as); const bItems = Array.from(bs); return aItems.filter((token) => bs.has(token)).length / (new Set(aItems.concat(bItems)).size || 1); }
function legacyDifficulty(level: number): "easy" | "medium" | "hard" { return level <= 2 ? "easy" : level === 3 ? "medium" : "hard"; }
function defaults(level: number) { return { vocabulary_complexity: level, sentence_complexity: level, information_density: level, reasoning_depth: level, error_complexity: level, answer_ambiguity: Math.max(1, level - 1), concept_integration: level }; }

export function resolveAdaptiveDifficulty(request: GenerationRequest, stats: AdaptiveStats[] = []) {
  if (request.difficulty !== "AUTO") return Number(request.difficulty);
  const current = stats.filter((item) => item.courseType === COURSE_MAP[course(request.course)].db);
  const attempts = current.reduce((sum, item) => sum + (item.totalAttempts ?? 0), 0);
  const base = COURSE_MAP[course(request.course)].defaultDifficulty;
  if (!attempts) return base;
  const average = current.reduce((sum, item) => sum + (item.correctRate ?? 0) * (item.totalAttempts ?? 0), 0) / attempts;
  return average >= 85 ? Math.min(5, base + 1) : average < 65 ? Math.max(1, base - 1) : base;
}
export function buildShortUserPrompt(input: GenerationRequestInput, stats: AdaptiveStats[] = []) { const request = generationRequestSchema.parse(input); return [`course=${course(request.course)}`, `tool_type=${tool(request.tool_type)}`, `theory_category=${request.theory_category}`, `difficulty=${request.difficulty}`, `resolved_difficulty=${resolveAdaptiveDifficulty(request, stats)}`, `question_count=${request.question_count}`, `topic=${request.topic}`, `adaptive_context=${stats.flatMap((item) => item.weakTheoryCategories ?? []).slice(0, 5).join("|") || "NONE"}`].join(" / "); }

function normalizeContent(raw: unknown, request: GenerationRequest, level: number) {
  const source = parse(raw); const targetTool = tool(request.tool_type); const targetCourse = course(request.course);
  const choices = Array.isArray(source.choices) ? source.choices : Array.isArray(source.options) ? source.options : [];
  const paragraphs = Array.isArray(source.paragraphs) ? source.paragraphs.map((item: any, index: number) => ({ id: clean(item?.id, `p${index + 1}`), content: clean(item?.content ?? item), correctOrder: Number(item?.correctOrder ?? index + 1) })) : [];
  const resolvedLevel = Math.max(1, Math.min(5, Number(source.difficulty ?? level)));
  const content = {
    ...source, course: targetCourse, tool_type: targetTool, theory_category: clean(source.theory_category, request.theory_category), difficulty: resolvedLevel, difficulty_metrics: metricsSchema.parse(source.difficulty_metrics ?? defaults(resolvedLevel)),
    question: clean(source.question, clean(source.prompt, clean(source.passage))), passage: clean(source.passage, targetTool === "SUMMARY" ? clean(source.prompt) : ""), explanation: clean(source.explanation), learning_objective: clean(source.learning_objective, `${request.theory_category} 학습 목표를 적용한다.`),
    choices, correct_answer: source.correct_answer ?? source.answer ?? "", model_answer: clean(source.model_answer, clean(source.modelAnswer)), prompt: clean(source.prompt, targetTool === "SUMMARY" ? clean(source.passage) : clean(source.question)), options: choices, answer: clean(source.answer, typeof source.correct_answer === "string" ? source.correct_answer : ""), modelAnswer: clean(source.modelAnswer, clean(source.model_answer)),
    paragraphs, keyPoints: Array.isArray(source.keyPoints) ? source.keyPoints : [], guidelines: Array.isArray(source.guidelines) ? source.guidelines : [], checklistItems: Array.isArray(source.checklistItems) ? source.checklistItems : [], master_prompt_version: QUESTION_BANK_MASTER_PROMPT_VERSION,
  };
  if (!content.question || !content.explanation || !content.learning_objective) throw new Error("필수 문항 본문·해설·학습 목표가 없습니다.");
  return content;
}

export function qaQuestionItem(item: Pick<QuestionBankDTO, "courseType" | "toolType" | "title" | "contentData" | "difficulty" | "isActive">, existingItems: Array<{ title: string; contentData: string }> = []) {
  const issues: string[] = []; let content: Record<string, any>;
  try { content = parse(item.contentData); } catch { return { passed: false, issues: ["malformed_json"], duplicateScore: 0 }; }
  const textSource = `${item.title} ${content.question ?? content.prompt ?? ""} ${content.passage ?? ""} ${content.explanation ?? ""}`;
  if (["placeholder", "seed", "심화 문제 #", "문항 #", "실전 학습 문항입니다", "보기 1: 올바른 문장 구조"].some((value) => textSource.toLowerCase().includes(value.toLowerCase()))) issues.push("placeholder_blocked");
  if (!clean(content.question, clean(content.prompt, clean(content.passage)))) issues.push("missing_question_or_passage");
  if (!clean(content.explanation)) issues.push("missing_explanation");
  if (!content.correct_answer && !content.answer && !content.model_answer && !content.modelAnswer && !content.evaluation_criteria) issues.push("missing_answer_or_rubric");
  const type = tool(item.toolType); const choices = Array.isArray(content.choices) ? content.choices : content.options; const answer = content.correct_answer ?? content.answer;
  if (type === "QUIZ" && (!Array.isArray(choices) || choices.length !== 4 || !answer || choices.filter((choice: unknown) => normalizeText(choice) === normalizeText(answer)).length !== 1)) issues.push("quiz_structure_failed");
  if (type === "PARAGRAPH_REORDERING") { const paragraphs = Array.isArray(content.paragraphs) ? content.paragraphs : []; const orders = paragraphs.map((paragraph: any) => Number(paragraph.correctOrder)); if (paragraphs.length < 3 || paragraphs.some((paragraph: any) => !clean(paragraph.id) || !clean(paragraph.content)) || new Set(orders).size !== paragraphs.length || orders.slice().sort((a: number, b: number) => a - b).some((value: number, index: number) => value !== index + 1)) issues.push("reordering_structure_failed"); }
  if (type === "SUMMARY" && (!clean(content.passage, clean(content.prompt)) || !clean(content.model_answer, clean(content.modelAnswer)))) issues.push("summary_structure_failed");
  if (type === "TOPIC_WIZARD" && (!Array.isArray(content.guidelines) || content.guidelines.length < 3)) issues.push("topic_wizard_structure_failed");
  if (type === "CHECKLIST" && (!Array.isArray(content.checklistItems) || content.checklistItems.length < 3)) issues.push("checklist_structure_failed");
  if (content.difficulty_metrics && !metricsSchema.safeParse(content.difficulty_metrics).success) issues.push("difficulty_metrics_failed");
  const normalized = normalizeText(textSource); const duplicateScore = Math.max(0, ...existingItems.map((existing) => { try { const previous = parse(existing.contentData); return similarity(normalized, normalizeText(`${existing.title} ${previous.question ?? previous.prompt ?? ""} ${previous.passage ?? ""}`)); } catch { return similarity(normalized, normalizeText(`${existing.title} ${existing.contentData}`)); } }));
  if (duplicateScore >= 0.72) issues.push("duplicate_blocked"); return { passed: issues.length === 0, issues, duplicateScore };
}

export function mapGeneratedItemsToQuestionBank(raw: unknown, input: GenerationRequestInput, existingItems: Array<{ title: string; contentData: string }> = [], stats: AdaptiveStats[] = []) {
  const request = generationRequestSchema.parse(input); const parsed = z.object({ items: z.array(z.object({ title: z.string().trim().min(3), difficulty: z.enum(["easy", "medium", "hard"]).optional(), contentData: z.unknown() })).min(1) }).parse(Array.isArray(raw) ? { items: raw } : raw); const resolved = resolveAdaptiveDifficulty(request, stats); const result: QuestionBankDTO[] = [];
  for (const source of parsed.items) { const content = normalizeContent(source.contentData, request, resolved); const dto: QuestionBankDTO = { courseType: COURSE_MAP[course(request.course)].db, toolType: TOOL_TYPE_MAP[tool(request.tool_type)].db, title: source.title, contentData: JSON.stringify(content), difficulty: source.difficulty ?? legacyDifficulty(content.difficulty), isActive: 1 }; const qa = qaQuestionItem(dto, existingItems.concat(result)); result.push({ ...dto, qaStatus: qa.passed ? "passed" : "blocked", qaIssues: qa.issues, duplicateScore: qa.duplicateScore }); }
  return result;
}

export async function generateQuestionBankItems(input: GenerationRequestInput, options: { existingItems?: Array<{ title: string; contentData: string }>; adaptiveStats?: AdaptiveStats[]; llm?: typeof invokeLLM } = {}) {
  const request = generationRequestSchema.parse(input);
  const response = await (options.llm ?? invokeLLM)({
    messages: [
      { role: "system", content: loadQuestionBankMasterPrompt() },
      { role: "user", content: buildShortUserPrompt(request, options.adaptiveStats ?? []) },
    ],
    responseFormat: {
      type: "json_schema",
      json_schema: {
        name: "essay_master_question_generation",
        strict: false,
        schema: {
          type: "object",
          additionalProperties: false,
          required: ["items"],
          properties: {
            items: {
              type: "array",
              minItems: 1,
              maxItems: 20,
              items: {
                type: "object",
                additionalProperties: true,
                required: ["title", "contentData"],
                properties: {
                  title: { type: "string" },
                  difficulty: { type: "string", enum: ["easy", "medium", "hard"] },
                  contentData: { type: "object", additionalProperties: true },
                },
              },
            },
          },
        },
      },
    },
  });
  const text = response.choices?.[0]?.message?.content; if (typeof text !== "string" || !text.trim()) throw new Error("AI 문항 생성 응답이 비어 있습니다."); return mapGeneratedItemsToQuestionBank(parse(text), request, options.existingItems ?? [], options.adaptiveStats ?? []);
}
