import { z } from "zod";
import { invokeLLM } from "./_core/llm";

export const QUESTION_BANK_MASTER_PROMPT_VERSION = "2026-08-18-taxonomy-a-f-v1";

export const COURSE_MAP = {
  ELEMENTARY: { db: "elementary", label: "초등", defaultDifficulty: 2 },
  MIDDLE_HIGH: { db: "middle_high", label: "중고등", defaultDifficulty: 3 },
  HIGH_ADMISSION: { db: "high_univ", label: "고등/대입", defaultDifficulty: 4 },
  GENERAL_WORK: { db: "general_adult", label: "일반/직장인", defaultDifficulty: 3 },
} as const;

export const TOOL_TYPE_MAP = {
  QUIZ: { db: "quiz", label: "AI 문장 퀴즈" },
  PARAGRAPH_REORDERING: { db: "reordering", label: "단락 재구성" },
  SUMMARY: { db: "summary", label: "요약 연습" },
  TOPIC_WIZARD: { db: "topic_wizard", label: "주제 설정 위저드" },
  CHECKLIST: { db: "thesis_checklist", label: "주제문 체크리스트" },
} as const;

const LEGACY_COURSE_TO_CANONICAL: Record<string, keyof typeof COURSE_MAP> = {
  elementary: "ELEMENTARY",
  middle_high: "MIDDLE_HIGH",
  high_univ: "HIGH_ADMISSION",
  general_adult: "GENERAL_WORK",
};

const LEGACY_TOOL_TO_CANONICAL: Record<string, keyof typeof TOOL_TYPE_MAP> = {
  quiz: "QUIZ",
  reordering: "PARAGRAPH_REORDERING",
  paragraph_reordering: "PARAGRAPH_REORDERING",
  summary: "SUMMARY",
  topic_wizard: "TOPIC_WIZARD",
  thesis_checklist: "CHECKLIST",
  checklist: "CHECKLIST",
};

const difficultyMetricSchema = z.object({
  vocabulary_complexity: z.number().int().min(1).max(5),
  sentence_complexity: z.number().int().min(1).max(5),
  information_density: z.number().int().min(1).max(5),
  reasoning_depth: z.number().int().min(1).max(5),
  error_complexity: z.number().int().min(1).max(5),
  answer_ambiguity: z.number().int().min(1).max(5),
  concept_integration: z.number().int().min(1).max(5),
});

const contentDataSchema = z.object({
  course: z.enum(["ELEMENTARY", "MIDDLE_HIGH", "HIGH_ADMISSION", "GENERAL_WORK"]),
  tool_type: z.enum(["QUIZ", "PARAGRAPH_REORDERING", "SUMMARY", "TOPIC_WIZARD", "CHECKLIST"]),
  theory_category: z.string().min(1),
  theory_subcategory: z.string().optional(),
  difficulty: z.number().int().min(1).max(5),
  difficulty_metrics: difficultyMetricSchema,
  question: z.string().min(1),
  passage: z.string().optional().default(""),
  choices: z.array(z.string()).optional().default([]),
  correct_answer: z.union([z.string(), z.array(z.string())]).optional(),
  model_answer: z.string().optional(),
  explanation: z.string().min(1),
  wrong_answer_explanations: z.record(z.string(), z.string()).optional().default({}),
  learning_objective: z.string().min(1),
  evaluation_criteria: z.record(z.string(), z.unknown()).optional().default({}),
  keywords: z.array(z.string()).optional().default([]),
  estimated_time: z.number().int().positive().optional().default(180),
}).passthrough();

const generatedItemSchema = z.object({
  title: z.string().min(3),
  difficulty: z.enum(["easy", "medium", "hard"]).optional(),
  contentData: z.union([z.string(), contentDataSchema]),
}).passthrough();

const llmGenerationResponseSchema = z.object({
  items: z.array(generatedItemSchema).min(1),
});

export const generationRequestSchema = z.object({
  course: z.string(),
  tool_type: z.string(),
  theory_category: z.string().default("AUTO"),
  difficulty: z.union([z.literal("AUTO"), z.coerce.number().int().min(1).max(5)]).default("AUTO"),
  question_count: z.coerce.number().int().min(1).max(20).default(3),
  topic: z.string().trim().min(1).default("AUTO"),
});

export type GenerationRequestInput = z.input<typeof generationRequestSchema>;
export type GenerationRequest = z.infer<typeof generationRequestSchema>;

export type QuestionBankDTO = {
  courseType: "elementary" | "middle_high" | "high_univ" | "general_adult";
  toolType: string;
  title: string;
  contentData: string;
  difficulty: "easy" | "medium" | "hard";
  isActive: number;
  qaStatus?: "passed" | "blocked";
  qaIssues?: string[];
  duplicateScore?: number;
};

export type AdaptiveStats = {
  courseType: string;
  toolType?: string;
  correctRate?: number;
  totalAttempts?: number;
  weakTheoryCategories?: string[];
};

export const QUESTION_BANK_MASTER_PROMPT = `
# Essay Master AI Question Bank MASTER PROMPT

Version: ${QUESTION_BANK_MASTER_PROMPT_VERSION}

You are a Korean essay-writing education item development AI. You create real, complete question-bank items for Essay Master based on the education theory from "논술의 기초".

The System/Master Prompt is the single source of truth. The User Prompt must be short structured parameters only.

## Core Rules

1. Create only complete questions that real learners can solve.
2. Never create placeholders, seed text, test samples, or title-only items.
3. Every item must include a learning objective, answer or scoring criteria, explanation, and QA-ready metadata.
4. Course, tool type, theory category, and difficulty are controlled independently.
5. Difficulty is controlled by vocabulary, sentence structure, information density, reasoning depth, error complexity, answer ambiguity, and concept integration. Do not merely make text longer.
6. Do not repeat the same pattern, passage, wrong answer, explanation, or topic with trivial substitutions.
7. For debatable topics, evaluate writing principles and logical validity. Do not force one ideology as the only correct view.
8. Avoid current-events facts whose truth may change.

## Taxonomy A-F

A. Sentence Writing
- A01 Economy: remove redundancy and wordiness.
- A02 Avoid Repetition: remove or replace repeated words, phrases, particles, endings.
- A03 Clarity: fix ambiguity, modifier scope, word order, vague expressions.
- A04 Accuracy: subject-predicate agreement, connective agreement, honorifics, tense, particles, quotation, conjunction, passive overuse.

B. Paragraph Writing
- B01 Central idea, B02 topic sentence, B03 supporting sentence, B04 unity, B05 coherence/continuity, B06 development method.
- Development methods: deductive, inductive, chronological, spatial, problem-cause-solution, claim-counterclaim-rebuttal.

C. Summary
- C01 Deletion, C02 superordinate substitution, C03 topic sentence selection, C04 topic sentence creation, C05 paragraph function analysis, C06 whole-structure grasp.

D. Topic Setting
- D01 tentative topic, D02 problem specification, D03 true topic, D04 researchability, D05 audience/purpose fit.

E. Thesis Statement
- E01 complete sentence, E02 concrete scope, E03 claim/stance, E04 arguability, E05 appropriate breadth.

F. Logical Writing
- F01 claim-evidence link, F02 comparison/contrast, F03 cause-effect, F04 counterargument handling, F05 conclusion and implication.

## Courses

- ELEMENTARY: upper elementary, TOPIK 3, short sentences, clear causal markers, gentle feedback.
- MIDDLE_HIGH: middle/high school bridge, TOPIK 4, compound sentences, objective explanatory tone.
- HIGH_ADMISSION: high school/admission, TOPIK 5-6, academic vocabulary, rigorous reasoning and source comparison.
- GENERAL_WORK: adults/workers, TOPIK 6 practical, concise business/report style, alternatives and expected effects.

## Tool Types

- QUIZ: passage or sentence, four options, one best answer, plausible distractors, wrong-answer explanations.
- PARAGRAPH_REORDERING: at least three sentence cards, objective ordering logic, correct order.
- SUMMARY: complete passage, core topic, essential information, deletable details, model answer, rubric.
- TOPIC_WIZARD: narrow a tentative topic into a true topic using scope, specificity, arguability, researchability.
- CHECKLIST: evaluate or revise a thesis/plan with concrete checklist criteria and revision activity.

## Difficulty 1-5

- 1 Recognition: one concept, short sentence, one error, direct clue.
- 2 Basic Application: one or two judgment factors, simple comparison and reason.
- 3 Complex Application: two or three error/judgment factors, short paragraph, comparison/analysis.
- 4 Analysis/Inference: paragraph level, higher density, infer central idea, choose best answer.
- 5 Synthesis/Practice: complex passage, grammar+meaning+logic+structure judgment, realistic essay/work application.

Each item must include difficulty_metrics with 1-5 integer values:
vocabulary_complexity, sentence_complexity, information_density, reasoning_depth, error_complexity, answer_ambiguity, concept_integration.

## Adaptive Difficulty

When difficulty=AUTO:
- If recent correct rate is 85% or higher, generate +1 level candidate.
- 65-84%: keep current level.
- 40-64%: keep or provide same-concept -1 support.
- Under 40%: generate -1 level, focusing on one core concept.
- If no learner data is present, use course default difficulty.

## QA Before Output

Block internally and regenerate any item that:
- contains placeholder wording or "문항 #", "보기 1: 올바른 문장 구조", "실전 학습 문항입니다".
- has no real passage/question.
- has multiple correct answers in a single-best quiz.
- lacks answer/scoring criteria or explanation.
- has mismatched course/tool/theory/difficulty.
- duplicates recent item topic, structure, or wording.
- has malformed JSON.

## Required JSON Output

Return JSON object only, no markdown:
{
  "items": [
    {
      "title": "문항 제목",
      "difficulty": "easy|medium|hard",
      "contentData": {
        "course": "ELEMENTARY|MIDDLE_HIGH|HIGH_ADMISSION|GENERAL_WORK",
        "tool_type": "QUIZ|PARAGRAPH_REORDERING|SUMMARY|TOPIC_WIZARD|CHECKLIST",
        "theory_category": "A01|A02|...|F05 or Korean theory name",
        "theory_subcategory": "세부 이론",
        "difficulty": 1,
        "difficulty_metrics": {},
        "question": "학습자에게 보이는 지시문",
        "passage": "문제 지문",
        "choices": [],
        "correct_answer": "정답 또는 핵심 기준",
        "model_answer": "모범답안",
        "explanation": "해설",
        "wrong_answer_explanations": {},
        "learning_objective": "학습 목표",
        "evaluation_criteria": {},
        "keywords": [],
        "estimated_time": 180,
        "quality_checks": {},
        "master_prompt_version": "${QUESTION_BANK_MASTER_PROMPT_VERSION}"
      }
    }
  ]
}
`;

export function loadQuestionBankMasterPrompt() {
  return QUESTION_BANK_MASTER_PROMPT;
}

function normalizeCourse(input: string): keyof typeof COURSE_MAP {
  const key = input.trim().toUpperCase();
  if (key in COURSE_MAP) return key as keyof typeof COURSE_MAP;
  const legacy = LEGACY_COURSE_TO_CANONICAL[input.trim()];
  if (legacy) return legacy;
  throw new Error(`Unsupported course: ${input}`);
}

function normalizeToolType(input: string): keyof typeof TOOL_TYPE_MAP {
  const key = input.trim().toUpperCase();
  if (key in TOOL_TYPE_MAP) return key as keyof typeof TOOL_TYPE_MAP;
  const legacy = LEGACY_TOOL_TO_CANONICAL[input.trim()];
  if (legacy) return legacy;
  throw new Error(`Unsupported tool_type: ${input}`);
}

function legacyDifficulty(level: number): "easy" | "medium" | "hard" {
  if (level <= 2) return "easy";
  if (level === 3) return "medium";
  return "hard";
}

export function resolveAdaptiveDifficulty(request: GenerationRequest, stats: AdaptiveStats[] = []) {
  if (request.difficulty !== "AUTO") return Number(request.difficulty);

  const course = normalizeCourse(request.course);
  const courseDb = COURSE_MAP[course].db;
  const matching = stats.filter(s => s.courseType === courseDb);
  const totalAttempts = matching.reduce((sum, s) => sum + (s.totalAttempts ?? 0), 0);
  const weightedCorrect = matching.reduce((sum, s) => sum + (s.correctRate ?? 0) * (s.totalAttempts ?? 0), 0);
  const base = COURSE_MAP[course].defaultDifficulty;

  if (totalAttempts <= 0) return base;

  const avg = weightedCorrect / totalAttempts;
  if (avg >= 85) return Math.min(5, base + 1);
  if (avg < 40) return Math.max(1, base - 1);
  if (avg < 65) return Math.max(1, base - 1);
  return base;
}

export function buildShortUserPrompt(input: GenerationRequestInput, stats: AdaptiveStats[] = []) {
  const request = generationRequestSchema.parse(input);
  const course = normalizeCourse(request.course);
  const tool = normalizeToolType(request.tool_type);
  const resolvedDifficulty = resolveAdaptiveDifficulty(request, stats);
  const weakAreas = stats.flatMap(s => s.weakTheoryCategories ?? []).slice(0, 5);

  return [
    `course=${course}`,
    `tool_type=${tool}`,
    `theory_category=${request.theory_category}`,
    `difficulty=${request.difficulty}`,
    `resolved_difficulty=${resolvedDifficulty}`,
    `question_count=${request.question_count}`,
    `topic=${request.topic}`,
    `adaptive_context=${weakAreas.length > 0 ? weakAreas.join("|") : "NONE"}`,
  ].join(" / ");
}

const responseJsonSchema = {
  name: "essay_master_question_generation",
  strict: true,
  schema: {
    type: "object",
    additionalProperties: false,
    properties: {
      items: {
        type: "array",
        minItems: 1,
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
    required: ["items"],
  },
};

function parseJsonObject(raw: unknown) {
  const text = typeof raw === "string" ? raw : JSON.stringify(raw ?? "");
  const clean = text.replace(/```json/g, "").replace(/```/g, "").trim();
  return JSON.parse(clean);
}

function normalizeContentData(input: unknown, request: GenerationRequest, resolvedDifficulty: number) {
  const content = typeof input === "string" ? parseJsonObject(input) : input;
  const course = normalizeCourse(request.course);
  const tool = normalizeToolType(request.tool_type);
  const merged = {
    ...(content && typeof content === "object" ? content : {}),
    course,
    tool_type: tool,
    difficulty: Number((content as { difficulty?: unknown })?.difficulty ?? resolvedDifficulty),
    master_prompt_version: QUESTION_BANK_MASTER_PROMPT_VERSION,
  };

  if (!merged.difficulty_metrics) {
    merged.difficulty_metrics = {
      vocabulary_complexity: resolvedDifficulty,
      sentence_complexity: resolvedDifficulty,
      information_density: resolvedDifficulty,
      reasoning_depth: resolvedDifficulty,
      error_complexity: resolvedDifficulty,
      answer_ambiguity: Math.max(1, resolvedDifficulty - 1),
      concept_integration: resolvedDifficulty,
    };
  }

  return contentDataSchema.parse(merged);
}

function normalizeText(value: unknown) {
  return String(value ?? "")
    .replace(/\s+/g, " ")
    .replace(/[^\w\s가-힣ㄱ-ㅎㅏ-ㅣ]/g, "")
    .trim()
    .toLowerCase();
}

function similarity(a: string, b: string) {
  if (!a || !b) return 0;
  const as = new Set(a.split(" ").filter(Boolean));
  const bs = new Set(b.split(" ").filter(Boolean));
  const aTokens = Array.from(as);
  const bTokens = Array.from(bs);
  const intersection = aTokens.filter(token => bs.has(token)).length;
  const union = new Set(aTokens.concat(bTokens)).size || 1;
  return intersection / union;
}

export function qaQuestionItem(item: QuestionBankDTO, existingItems: Array<{ title: string; contentData: string }> = []) {
  const issues: string[] = [];
  const content = parseJsonObject(item.contentData);
  const rawText = `${item.title} ${content.question ?? ""} ${content.passage ?? ""} ${content.explanation ?? ""}`;
  const text = normalizeText(rawText);
  const blockedPatterns = [
    "placeholder",
    "seed",
    "[ELEMENTARY]",
    "[MIDDLE_HIGH]",
    "[HIGH_ADMISSION]",
    "[GENERAL_WORK]",
    "심화 문제 #",
    "문항 #",
    "실전 학습 문항입니다",
    "보기 1 올바른 문장 구조",
    "샘플",
  ];

  if (blockedPatterns.some(pattern => rawText.toLowerCase().includes(pattern.toLowerCase()))) issues.push("placeholder_blocked");
  if (!content.question && !content.passage) issues.push("missing_question_or_passage");
  if (!content.explanation) issues.push("missing_explanation");
  if (!content.correct_answer && !content.model_answer && !content.evaluation_criteria) issues.push("missing_answer_or_rubric");
  if (content.tool_type === "QUIZ" && (!Array.isArray(content.choices) || content.choices.length !== 4)) issues.push("quiz_requires_four_choices");
  if (content.tool_type === "QUIZ" && content.correct_answer && Array.isArray(content.choices)) {
    const correctCount = content.choices.filter((choice: string) => normalizeText(choice) === normalizeText(content.correct_answer)).length;
    if (correctCount !== 1) issues.push("quiz_single_answer_failed");
  }

  const duplicateScore = Math.max(
    0,
    ...existingItems.map(existing => {
      let existingContent = "";
      try {
        const parsed = parseJsonObject(existing.contentData);
        existingContent = `${parsed.question ?? ""} ${parsed.passage ?? ""}`;
      } catch {
        existingContent = existing.contentData;
      }
      return similarity(text, normalizeText(`${existing.title} ${existingContent}`));
    }),
  );
  if (duplicateScore >= 0.72) issues.push("duplicate_blocked");

  return { passed: issues.length === 0, issues, duplicateScore };
}

export function mapGeneratedItemsToQuestionBank(
  raw: unknown,
  input: GenerationRequestInput,
  existingItems: Array<{ title: string; contentData: string }> = [],
  stats: AdaptiveStats[] = [],
) {
  const request = generationRequestSchema.parse(input);
  const course = normalizeCourse(request.course);
  const tool = normalizeToolType(request.tool_type);
  const resolvedDifficulty = resolveAdaptiveDifficulty(request, stats);
  const parsed = llmGenerationResponseSchema.parse(Array.isArray(raw) ? { items: raw } : raw);

  return parsed.items.map(item => {
    const contentData = normalizeContentData(item.contentData, request, resolvedDifficulty);
    const level = Number(contentData.difficulty);
    const dto: QuestionBankDTO = {
      courseType: COURSE_MAP[course].db,
      toolType: TOOL_TYPE_MAP[tool].db,
      title: item.title,
      contentData: JSON.stringify(contentData),
      difficulty: item.difficulty ?? legacyDifficulty(level),
      isActive: 1,
    };
    const qa = qaQuestionItem(dto, existingItems);
    return {
      ...dto,
      qaStatus: qa.passed ? "passed" : "blocked",
      qaIssues: qa.issues,
      duplicateScore: qa.duplicateScore,
    };
  });
}

export async function generateQuestionBankItems(input: GenerationRequestInput, options: {
  existingItems?: Array<{ title: string; contentData: string }>;
  adaptiveStats?: AdaptiveStats[];
  llm?: typeof invokeLLM;
} = {}) {
  const request = generationRequestSchema.parse(input);
  const userPrompt = buildShortUserPrompt(request, options.adaptiveStats ?? []);
  const llm = options.llm ?? invokeLLM;

  const response = await llm({
    messages: [
      { role: "system", content: loadQuestionBankMasterPrompt() },
      { role: "user", content: userPrompt },
    ],
    responseFormat: { type: "json_schema", json_schema: responseJsonSchema },
  });
  const content = response.choices?.[0]?.message?.content ?? "{}";
  const parsed = parseJsonObject(content);
  return mapGeneratedItemsToQuestionBank(parsed, request, options.existingItems ?? [], options.adaptiveStats ?? []);
}
