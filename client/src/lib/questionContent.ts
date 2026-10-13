export const questionCourseLabels: Record<string, string> = {
  elementary: "초등 논술",
  middle_high: "중고등 논술",
  high_univ: "고등·대입 논술",
  general_adult: "일반·직장인 논술",
};
export const questionToolLabels: Record<string, string> = {
  quiz: "AI 문장 퀴즈",
  reordering: "단락 재구성",
  summary: "요약 연습",
  topic_wizard: "주제 설정",
  thesis_checklist: "주제문 점검",
};
export const questionDifficultyLabels: Record<string, string> = {
  easy: "초급",
  medium: "중급",
  hard: "고급",
};
export const questionMetricLabels: Record<string, string> = {
  vocabulary_complexity: "어휘 수준",
  sentence_complexity: "문장 복잡도",
  information_density: "정보 밀도",
  reasoning_depth: "추론 깊이",
  error_complexity: "오류 복합성",
  answer_ambiguity: "정답 모호성",
  concept_integration: "개념 결합",
};

const record = (value: unknown): value is Record<string, any> =>
  !!value && typeof value === "object" && !Array.isArray(value);
function decode(value: unknown): unknown {
  if (typeof value !== "string") return value;
  const text = value
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/, "");
  try {
    return JSON.parse(text);
  } catch {
    return value;
  }
}
export function readQuestionContent(raw: unknown): {
  content: Record<string, any>;
  invalid: boolean;
} {
  let value = decode(raw);
  for (let i = 0; i < 5 && typeof value === "string"; i++) {
    const next = decode(value);
    if (next === value) break;
    value = next;
  }
  if (!record(value)) return { content: {}, invalid: true };
  let content = value;
  for (let i = 0; i < 5; i++) {
    const nested = decode(
      content.contentData ?? content.content ?? content.data
    );
    if (!record(nested)) break;
    const { contentData, content: oldContent, data, ...outer } = content;
    content = { ...outer, ...nested };
  }
  return { content, invalid: false };
}
// 내부 키나 객체를 JSON 문자열로 표시하지 않는다.
export function questionText(value: unknown): string {
  if (typeof value === "string") {
    const decoded = decode(value);
    if (decoded !== value) return questionText(decoded);
    return value
      .replace(/^```[^\n]*\n?/, "")
      .replace(/```$/, "")
      .trim();
  }
  if (Array.isArray(value))
    return value.map(questionText).filter(Boolean).join("\n");
  if (record(value)) {
    for (const key of [
      "text",
      "content",
      "label",
      "question",
      "prompt",
      "title",
      "description",
      "criterion",
    ]) {
      const text = questionText(value[key]);
      if (text) return text;
    }
  }
  return "";
}
export function firstQuestionText(...values: unknown[]): string {
  for (const value of values) {
    const text = questionText(value);
    if (text) return text;
  }
  return "";
}
export function readableQuestionTitle(title: unknown, raw: unknown): string {
  const { content } = readQuestionContent(raw);
  const text = (
    firstQuestionText(title, content.title, content.question, content.prompt) ||
    "제목 없는 문항"
  );
  return text.replace(/\s*[—–|-]?\s*\b(?:ELEMENTARY|MIDDLE_HIGH|HIGH_ADMISSION|GENERAL_WORK)\b/g, "").trim() || "제목 없는 문항";
}
export function questionExcerpt(raw: unknown): string {
  const { content, invalid } = readQuestionContent(raw);
  if (invalid) return "문항 내용을 확인해주세요.";
  return (
    firstQuestionText(
      content.question,
      content.prompt,
      content.passage,
      content.body
    ) || "문항 본문이 없습니다."
  );
}
export function patchQuestionContent(
  raw: string,
  patch: Record<string, unknown>
): string {
  const { content } = readQuestionContent(raw);
  const next = { ...content, ...patch };
  // 편집 후에는 이전 사람 검수 완료 표식을 재사용하지 않는다.
  if (content.generation_origin === "ai_generated" || content.human_review) {
    next.human_review = {
      ...content.human_review,
      status: "pending",
      checklist: {},
      overall_passed: false,
      reviewed_at: null,
    };
  }
  return JSON.stringify(next);
}
