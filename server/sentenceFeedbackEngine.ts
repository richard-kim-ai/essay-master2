import { invokeLLM, listLLMModels } from "./_core/llm";
import type { CourseType } from "@shared/course";
import { getOrComputeCached } from "./runtimeEfficiency";

export type DetailedSentenceFeedback = {
  overallScore: number;
  economyScore: number;
  clarityScore: number;
  accuracyScore: number;
  strengths: string[];
  improvements: string[];
  feedback: string;
  revisedSentence: string;
};

const feedbackSchema = {
  type: "object",
  properties: {
    overallScore: { type: "integer", minimum: 0, maximum: 100 },
    economyScore: { type: "integer", minimum: 0, maximum: 100 },
    clarityScore: { type: "integer", minimum: 0, maximum: 100 },
    accuracyScore: { type: "integer", minimum: 0, maximum: 100 },
    strengths: { type: "array", items: { type: "string" }, minItems: 1, maxItems: 2 },
    improvements: { type: "array", items: { type: "string" }, minItems: 1, maxItems: 2 },
    feedback: { type: "string", minLength: 20, maxLength: 700 },
    revisedSentence: { type: "string", minLength: 2, maxLength: 1000 },
  },
  required: ["overallScore", "economyScore", "clarityScore", "accuracyScore", "strengths", "improvements", "feedback", "revisedSentence"],
  additionalProperties: false,
} as const;

let selectedModel: { id: string | null; expiresAt: number } | null = null;

async function getEfficientFeedbackModel() {
  if (selectedModel && selectedModel.expiresAt > Date.now()) return selectedModel.id;
  const { data } = await listLLMModels();
  const id = ["gpt-5-mini", "claude-haiku-4-5", "gemini-3-flash-preview"].find((candidate) => data.some((model) => model.id === candidate)) ?? data[0]?.id ?? null;
  selectedModel = { id, expiresAt: Date.now() + 6 * 60 * 60 * 1000 };
  return id;
}

function courseAudience(courseType: CourseType) {
  return {
    elementary: "초등 학습자",
    middle_high: "중·고등 학습자",
    high_univ: "고등·대입 학습자",
    general_adult: "일반·직장인 학습자",
  }[courseType];
}

export async function generateDetailedSentenceFeedback(input: { courseType: CourseType; sourceSentence: string; studentSentence: string; questionTitle?: string }) {
  const cacheKey = `sentence-feedback:model:${input.courseType}:${input.sourceSentence}:${input.studentSentence}`;
  const result = await getOrComputeCached(cacheKey, 5 * 60 * 1000, async () => {
    const modelId = await getEfficientFeedbackModel();
    const response = await invokeLLM({
      model: modelId ?? undefined,
      messages: [
        { role: "system", content: "당신은 논술 문장 교정 코치입니다. 학생이 직접 작성한 한 문장을 분석합니다. 원문의 의도를 보존하고, 점수만 제시하지 말고 좋은 점 1~2개, 고칠 부분 1~2개, 실행 가능한 설명, 개선 문장 1개를 제시하세요. 교사 최종 첨삭이나 장기 학습 모델을 대체한다고 말하지 마세요. 반드시 JSON 스키마만 따르세요." },
        { role: "user", content: `과정: ${courseAudience(input.courseType)}\n문항: ${input.questionTitle || "문장 교정"}\n제시 문장: ${input.sourceSentence}\n학생 작성 문장: ${input.studentSentence}\n\n학생 문장을 중심으로 경제성·명료성·정확성을 평가하세요. 제시문을 그대로 복사하지 말고, 학생의 문장이 더 나아진 지점과 다음 수정 한 가지를 구체적으로 설명하세요.` },
      ],
      responseFormat: { type: "json_schema", json_schema: { name: "detailed_sentence_feedback", strict: true, schema: feedbackSchema } },
    });
    const raw = response.choices?.[0]?.message?.content;
    if (typeof raw !== "string" || !raw.trim()) throw new Error("AI 문장 피드백 응답이 비어 있습니다.");
    const feedback = JSON.parse(raw) as DetailedSentenceFeedback;
    const scoreKeys = [feedback.overallScore, feedback.economyScore, feedback.clarityScore, feedback.accuracyScore];
    if (scoreKeys.some((score) => !Number.isInteger(score) || score < 0 || score > 100)) throw new Error("AI 문장 피드백 점수 범위가 올바르지 않습니다.");
    if (!Array.isArray(feedback.strengths) || !Array.isArray(feedback.improvements) || !feedback.revisedSentence.trim()) throw new Error("AI 문장 피드백 구조가 올바르지 않습니다.");
    return { feedback, modelId };
  });
  return { ...result.value, memoryCacheHit: result.cacheHit };
}
