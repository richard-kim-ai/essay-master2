import { z } from "zod";
import { invokeLLM, listLLMModels } from "./_core/llm";

export const THEORY_LESSON_MASTER_PROMPT_VERSION = "2026-08-18-theory-lesson-v1";
export const THEORY_LESSON_CONTENT_SCOPE = "THEORY_LESSON" as const;

export const theoryLessonRequestSchema = z.object({
  course: z.enum(["ELEMENTARY", "MIDDLE_HIGH", "HIGH_ADMISSION", "GENERAL_WORK"]),
  theory_category: z.string().trim().min(1),
  theory_subcategory: z.string().trim().min(1).default("AUTO"),
  lesson_level: z.coerce.number().int().min(1).max(5).default(1),
  content_count: z.coerce.number().int().min(1).max(20).default(3),
  example_mode: z.enum(["TEXTBOOK_SIMILAR", "TEXTBOOK_PLUS_NEW"]).default("TEXTBOOK_PLUS_NEW"),
  context: z.string().trim().min(1).default("AUTO"),
});
export type TheoryLessonRequestInput = z.input<typeof theoryLessonRequestSchema>;

export type TheoryLessonSeedItem = {
  courseType: "elementary" | "middle_high" | "high_univ" | "general_adult";
  lessonLevel: number;
  theoryCategory: string;
  theorySubcategory: string;
  exampleMode: "TEXTBOOK_SIMILAR" | "TEXTBOOK_PLUS_NEW";
  title: string;
  contentData: string;
  sourceNote: string;
  isActive: number;
};

export const THEORY_LESSON_MASTER_PROMPT = `당신은 한국어 논술·글쓰기 이론 수업 설계자다. 이 출력은 question_bank의 랜덤 평가 문항이 아니라 content_scope="THEORY_LESSON"인 레슨 이론 콘텐츠다. 모든 단원은 core_concept, 교재 원리 또는 짧은 재구성(textbook_anchor), 신규 유사 예시, wrong_example, improved_example, in_lesson_check, answer_feedback, next_step을 포함한다. 교재의 긴 원문을 복제하지 않고 출처 기반 재구성은 '교재 원리' 또는 '교재식 짧은 예시', 새로운 문장은 '유사 예시'로 구분한다. 과정별 맥락은 초등=생활·학급, 중고등=진로·미디어·공동체, 고등/대입=사회·과학·윤리, 일반/직장인=보고·회의·제안·고객 소통이다. JSON만 반환한다.`;

export function buildTheoryLessonUserPrompt(input: TheoryLessonRequestInput) {
  const request = theoryLessonRequestSchema.parse(input);
  return [`course=${request.course}`, `theory_category=${request.theory_category}`, `theory_subcategory=${request.theory_subcategory}`, `lesson_level=${request.lesson_level}`, `content_count=${request.content_count}`, `example_mode=${request.example_mode}`, `context=${request.context}`, `content_scope=${THEORY_LESSON_CONTENT_SCOPE}`].join(" / ");
}

const profiles = {
  elementary: { course: "ELEMENTARY", level: 1, audience: "학교, 가족, 친구, 생활 규칙을 중심으로 짧은 문장과 직접 피드백을 사용한다.", topics: ["학급 청소", "학급 도서관", "운동장 약속", "반려동물"] },
  middle_high: { course: "MIDDLE_HIGH", level: 2, audience: "학교생활, 진로, 미디어, 공동체 문제를 소재로 원인과 결과를 분명히 드러낸다.", topics: ["학교 축제 안내", "진로 동아리", "미디어 사용", "교내 휴대전화"] },
  high_univ: { course: "HIGH_ADMISSION", level: 3, audience: "사회, 과학, 윤리 쟁점을 다루며 제시문 분석과 비판적 판단을 요구한다.", topics: ["AI 추천 알고리즘", "기후 정책", "과학 기술 윤리", "플랫폼 노동"] },
  general_adult: { course: "GENERAL_WORK", level: 2, audience: "업무보고, 회의, 제안, 이메일 맥락에서 간결성과 실행 가능성을 강조한다.", topics: ["회의 결과 보고", "신규 제안서", "고객 응대 기록", "원격 근무"] },
} as const;

const units = [
  { category: "A01", subcategory: "경제성", title: "필요한 만큼만 쓰기", concept: "경제성은 필요한 만큼의 말만 사용해 뜻을 정확하고 간결하게 전하는 원리이다.", anchor: "의미가 중복되는 말과 불필요한 문장 성분을 줄인다.", wrong: (topic: string) => `${topic}은 꼭 반드시 다시 한번 확인해야 할 중요한 일이다.`, improved: (topic: string) => `${topic}은 반드시 확인해야 할 일이다.`, check: "'꼭 반드시 다시 한번 확인하다'에서 줄일 수 있는 표현은 무엇인가요?", answer: "꼭/반드시 중 하나와 다시 한번 중 불필요한 반복을 줄인다.", next: "반복되는 단어와 구절을 다루는 동어 반복 회피로 연결한다." },
  { category: "B04", subcategory: "통일성과 일관성", title: "한 단락에 하나의 중심 생각", concept: "단락은 하나의 중심 생각과 이를 뒷받침하는 문장으로 이루어져야 한다.", anchor: "한 단락에는 반드시 하나의 중심 생각만을 다룬다.", wrong: (topic: string) => `${topic}은 규칙이 필요하다. 나는 어제 점심에 떡볶이를 먹었다. 규칙을 지키면 갈등이 줄어든다.`, improved: (topic: string) => `${topic}은 규칙이 필요하다. 이용 기준을 정하면 갈등이 줄어든다.`, check: "잘못된 예에서 중심 생각과 관련 없는 문장을 고르세요.", answer: "나는 어제 점심에 떡볶이를 먹었다.", next: "소주제문과 뒷받침 문장의 관계를 확인한 뒤 단락 재구성으로 연습한다." },
  { category: "C01", subcategory: "삭제와 핵심 보존", title: "요약할 때 버릴 것과 남길 것", concept: "요약은 글의 중심 내용을 보존하면서 사소한 설명, 반복, 지나친 예시를 삭제하는 활동이다.", anchor: "사소하거나 불필요한 내용, 반복되는 내용은 삭제한다.", wrong: (topic: string) => `${topic} 안내문은 파란색 종이에 붙었고 글씨가 컸으며 여러 사람이 보았다.`, improved: (topic: string) => `${topic} 안내문은 모두가 지켜야 할 약속의 이유와 내용을 제시했다.`, check: "요약에서 삭제해도 되는 정보는 무엇인가요?", answer: "색깔이나 위치처럼 핵심 주장 이해에 꼭 필요하지 않은 세부 정보.", next: "하위 내용을 상위어로 묶는 상위어 대치로 이동한다." },
  { category: "D03", subcategory: "참주제와 주제문", title: "넓은 소재를 쓸 수 있는 주장으로 좁히기", concept: "가주제는 넓은 소재이고 참주제는 글쓴이의 구체적인 태도와 판단이 담긴 좁은 주제이다.", anchor: "철학 → 철학과 현실의 관계", wrong: (topic: string) => `${topic}에 대하여`, improved: (topic: string) => `${topic}은 권리와 공동체 책임을 함께 고려해 정해야 한다.`, check: "두 문장 중 논술 주제문으로 더 적절한 것은 무엇인가요?", answer: "글쓴이의 판단이 드러나는 완전한 문장이다.", next: "주제 설정 위저드에서 가주제를 참주제로 좁히고 근거를 붙인다." },
] as const;

export function buildTheoryLessonSeedItems(): TheoryLessonSeedItem[] {
  return Object.entries(profiles).flatMap(([courseType, profile]) => units.map((unit, index) => {
    const topic = profile.topics[index];
    const title = `${topic}: ${unit.title}`;
    return {
      courseType: courseType as TheoryLessonSeedItem["courseType"], lessonLevel: profile.level, theoryCategory: unit.category, theorySubcategory: unit.subcategory, exampleMode: "TEXTBOOK_PLUS_NEW", title,
      contentData: JSON.stringify({ content_scope: THEORY_LESSON_CONTENT_SCOPE, master_prompt_version: THEORY_LESSON_MASTER_PROMPT_VERSION, course: profile.course, theory_category: unit.category, theory_subcategory: unit.subcategory, lesson_level: profile.level, title, core_concept: unit.concept, textbook_anchor: { kind: "교재 원리", text: unit.anchor }, textbook_similar_example: { label: "유사 예시", text: `${topic}에서 원리를 적용해 문장을 고쳐 봅시다.` }, wrong_example: unit.wrong(topic), improved_example: unit.improved(topic), in_lesson_check: { question: unit.check, answer: unit.answer }, answer_feedback: "핵심 개념과 예문을 함께 확인한 뒤 직접 고쳐 보세요.", next_step: unit.next, audience_adjustment: profile.audience, source_boundary: "교재의 용어와 이론 구조를 따르며, 긴 원문은 재구성하고 신규 문장은 유사 예시로 표시한다." }),
      sourceNote: `논술의 기초 ${unit.subcategory} 원리 기반 재구성`, isActive: 1,
    };
  }));
}

const theoryPayloadSchema = z.object({
  core_concept: z.string().trim().min(24),
  textbook_anchor: z.object({ kind: z.string().trim().min(2), text: z.string().trim().min(12) }),
  textbook_similar_example: z.object({ label: z.string().trim().min(2), text: z.string().trim().min(12) }),
  wrong_example: z.string().trim().min(8),
  improved_example: z.string().trim().min(8),
  in_lesson_check: z.object({ question: z.string().trim().min(8), answer: z.string().trim().min(4) }),
  answer_feedback: z.string().trim().min(8),
  next_step: z.string().trim().min(8),
  source_boundary: z.string().trim().min(12),
});

export type TheoryLessonDraftCandidate = {
  courseType: TheoryLessonSeedItem["courseType"];
  lessonLevel: number;
  theoryCategory: string;
  theorySubcategory: string;
  exampleMode: TheoryLessonSeedItem["exampleMode"];
  title: string;
  contentData: string;
  sourceNote: string;
  qaIssues: string[];
};

const courseTypeMap = {
  ELEMENTARY: "elementary",
  MIDDLE_HIGH: "middle_high",
  HIGH_ADMISSION: "high_univ",
  GENERAL_WORK: "general_adult",
} as const;

const generatedTheorySchema = {
  type: "object",
  properties: {
    items: {
      type: "array",
      minItems: 1,
      maxItems: 6,
      items: {
        type: "object",
        properties: {
          title: { type: "string" },
          theory_subcategory: { type: "string" },
          core_concept: { type: "string" },
          textbook_anchor: { type: "object", properties: { kind: { type: "string" }, text: { type: "string" } }, required: ["kind", "text"], additionalProperties: false },
          textbook_similar_example: { type: "object", properties: { label: { type: "string" }, text: { type: "string" } }, required: ["label", "text"], additionalProperties: false },
          wrong_example: { type: "string" },
          improved_example: { type: "string" },
          in_lesson_check: { type: "object", properties: { question: { type: "string" }, answer: { type: "string" } }, required: ["question", "answer"], additionalProperties: false },
          answer_feedback: { type: "string" },
          next_step: { type: "string" },
          source_boundary: { type: "string" },
        },
        required: ["title", "theory_subcategory", "core_concept", "textbook_anchor", "textbook_similar_example", "wrong_example", "improved_example", "in_lesson_check", "answer_feedback", "next_step", "source_boundary"],
        additionalProperties: false,
      },
    },
  },
  required: ["items"],
  additionalProperties: false,
} as const;

export function qaTheoryLessonCandidate(candidate: TheoryLessonDraftCandidate) {
  const issues: string[] = [];
  if (!candidate.title || candidate.title.trim().length < 4) issues.push("제목은 4자 이상이어야 합니다.");
  if (/placeholder|seed|test|테스트 문항/i.test(candidate.title)) issues.push("제목에 개발용 표현을 사용할 수 없습니다.");
  try {
    const content = theoryPayloadSchema.parse(JSON.parse(candidate.contentData));
    if (content.wrong_example === content.improved_example) issues.push("바꿔 볼 문장과 개선 예는 서로 달라야 합니다.");
    if (!content.source_boundary.includes("교재") && !content.source_boundary.includes("유사")) issues.push("출처·유사 예시 구분 안내가 필요합니다.");
  } catch (error) {
    issues.push(error instanceof Error ? `이론 콘텐츠 구조가 유효하지 않습니다: ${error.message}` : "이론 콘텐츠 구조가 유효하지 않습니다.");
  }
  return issues;
}

export async function generateTheoryLessonDrafts(input: TheoryLessonRequestInput): Promise<{ modelId: string | null; items: TheoryLessonDraftCandidate[] }> {
  const request = theoryLessonRequestSchema.parse(input);
  const requestedCount = Math.min(6, request.content_count);
  const { data: models } = await listLLMModels();
  const modelId = ["gpt-5-mini", "claude-haiku-4-5", "gemini-3-flash-preview"].find((candidate) => models.some((model) => model.id === candidate)) ?? models[0]?.id ?? null;
  const response = await invokeLLM({
    model: modelId ?? undefined,
    messages: [
      { role: "system", content: THEORY_LESSON_MASTER_PROMPT },
      { role: "user", content: `${buildTheoryLessonUserPrompt({ ...request, content_count: requestedCount })}\n\n각 결과는 하나의 독립 이론 레슨입니다. 실제 출처의 긴 문장을 복제하지 말고, 교재 원리와 새 유사 예시를 구분하세요. 모든 확인문제는 학습자가 즉시 답할 수 있도록 명료하게 작성하세요.` },
    ],
    responseFormat: {
      type: "json_schema",
      json_schema: { name: "lesson_theory_draft", strict: true, schema: generatedTheorySchema },
    },
  });
  const raw = response.choices?.[0]?.message?.content;
  if (typeof raw !== "string" || !raw.trim()) throw new Error("AI 이론 콘텐츠 응답이 비어 있습니다.");
  const parsed = JSON.parse(raw) as { items?: unknown[] };
  if (!Array.isArray(parsed.items) || parsed.items.length !== requestedCount) throw new Error("AI가 요청한 개수와 다른 이론 콘텐츠를 반환했습니다.");
  const courseType = courseTypeMap[request.course];
  const items = parsed.items.map((item, index) => {
    const candidate = item as Record<string, unknown>;
    const payload = theoryPayloadSchema.parse({
      core_concept: candidate.core_concept,
      textbook_anchor: candidate.textbook_anchor,
      textbook_similar_example: candidate.textbook_similar_example,
      wrong_example: candidate.wrong_example,
      improved_example: candidate.improved_example,
      in_lesson_check: candidate.in_lesson_check,
      answer_feedback: candidate.answer_feedback,
      next_step: candidate.next_step,
      source_boundary: candidate.source_boundary,
    });
    const draft: TheoryLessonDraftCandidate = {
      courseType,
      lessonLevel: request.lesson_level,
      theoryCategory: request.theory_category,
      theorySubcategory: typeof candidate.theory_subcategory === "string" ? candidate.theory_subcategory.trim() : request.theory_subcategory,
      exampleMode: request.example_mode,
      title: typeof candidate.title === "string" ? candidate.title.trim() : `이론 레슨 ${index + 1}`,
      contentData: JSON.stringify({ content_scope: THEORY_LESSON_CONTENT_SCOPE, master_prompt_version: THEORY_LESSON_MASTER_PROMPT_VERSION, course: request.course, theory_category: request.theory_category, theory_subcategory: candidate.theory_subcategory, lesson_level: request.lesson_level, ...payload }),
      sourceNote: "AI 생성 이론 콘텐츠 · 관리자 승인 필요",
      qaIssues: [],
    };
    return { ...draft, qaIssues: qaTheoryLessonCandidate(draft) };
  });
  return { modelId, items };
}
