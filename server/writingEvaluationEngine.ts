import { invokeLLM } from "./_core/llm";
import {
  evaluateWritingHeuristic,
  getHumanReviewReasons,
  type WritingCorrectionRequest,
} from "./writingCorrectionEngine";

export type EvaluationDecision = "scored" | "revision_requested" | "held" | "dismissed";
export type DimensionScore = { competency: string; score: number; evidence: string };
export type SemanticWritingEvaluationResult = {
  engine_version: "1.1";
  decision: EvaluationDecision;
  total_score: number;
  level: string;
  dimension_scores: DimensionScore[];
  strengths: string[];
  improvement_points: string[];
  error_patterns: string[];
  feedback: { summary: string; revision_steps: string[]; model_sentence_examples: string[] };
  next_learning_recommendation: { theory_category: string; reason: string };
  fallback_used: boolean;
  provider_error: string | null;
  token_usage: number;
};

export type SemanticEvaluationRequest = {
  metadata: Record<string, unknown>;
  task: string;
  submission: { essay_text: string };
};

const MASTER_PROMPT = `너는 Essay Master의 독립형 AI 논술·글쓰기 평가엔진 v1.1이다.
문제생성 프롬프트를 참조하거나 추정하지 말고 입력된 메타데이터, 문제, 학생 답안만 사용한다.
강한 제재형 표현을 쓰지 않으며, 표현 오류는 표현 보완 지적으로 작성한다.
형식이나 분량이 부족하면 재작성 요청으로 안내한다. 평가가 불가능한 답안은 평가 보류 또는 각하로 판정한다.
학생의 인격, 능력, 태도를 단정하지 말고 모든 판단에 학생 글에 나타난 관찰 근거를 함께 제시한다.
평가 competency는 task_understanding, central_claim, reasoning_basis, evidence_use, claim_evidence_link, logical_inference, counterargument_response, macro_structure, paragraphing, coherence, sentence_expression, language_conventions이다.
반드시 JSON 객체만 반환하고 다음 필드를 포함한다: engine_version, decision, total_score, level, dimension_scores, strengths, improvement_points, error_patterns, feedback(summary, revision_steps, model_sentence_examples), next_learning_recommendation(theory_category, reason).`;

function nonScoredResult(decision: "held" | "dismissed", reason: string, tokenUsage = 0): SemanticWritingEvaluationResult {
  return {
    engine_version: "1.1", decision, total_score: 0,
    level: decision === "dismissed" ? "각하" : "평가 보류", dimension_scores: [], strengths: [],
    improvement_points: [reason], error_patterns: [],
    feedback: { summary: reason, revision_steps: ["제시된 논제와 관련된 문장을 보완한 뒤 다시 제출해 주세요."], model_sentence_examples: [] },
    next_learning_recommendation: { theory_category: "주장과 근거", reason: "논제에 맞는 답안의 기본 구조를 다시 확인해 주세요." },
    fallback_used: false, provider_error: null, token_usage: tokenUsage,
  };
}

export function decideEvaluationState(request: SemanticEvaluationRequest): { decision?: "held" | "dismissed"; reason?: string } {
  const essay = request.submission.essay_text.trim();
  if (!essay) return { decision: "dismissed", reason: "답안이 비어 있어 평가할 수 없습니다." };
  if (essay.length < 20) return { decision: "held", reason: "답안이 짧아 의미 있는 평가를 보류했습니다." };
  const task = request.task.trim().toLowerCase();
  if (task && task.length >= 8) {
    const taskWords = task.split(/\s+/).filter((word) => word.length >= 2);
    const matched = taskWords.some((word) => essay.toLowerCase().includes(word));
    if (taskWords.length >= 2 && !matched) return { decision: "held", reason: "답안에서 제시된 논제와 연결되는 표현을 확인하기 어렵습니다." };
  }
  return {};
}

function asText(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}
function parseSemanticResult(value: unknown): Omit<SemanticWritingEvaluationResult, "fallback_used" | "provider_error" | "token_usage"> | null {
  if (!value || typeof value !== "object") return null;
  const raw = value as Record<string, unknown>;
  const decision = raw.decision;
  if (!["scored", "revision_requested", "held", "dismissed"].includes(String(decision))) return null;
  const total = Number(raw.total_score);
  if (!Number.isFinite(total) || total < 0 || total > 100) return null;
  if (!Array.isArray(raw.dimension_scores) || raw.dimension_scores.length !== 12) return null;
  const dimensions: DimensionScore[] = [];
  for (const item of raw.dimension_scores) {
    if (!item || typeof item !== "object") return null;
    const row = item as Record<string, unknown>;
    const competency = asText(row.competency);
    const evidence = asText(row.evidence);
    const score = Number(row.score);
    if (!competency || !evidence || !Number.isFinite(score) || score < 0 || score > 100) return null;
    dimensions.push({ competency, score: Math.round(score), evidence });
  }
  const list = (field: unknown) => Array.isArray(field) && field.every((item) => typeof item === "string") ? field.slice(0, 12) as string[] : null;
  const strengths = list(raw.strengths), improvements = list(raw.improvement_points), errors = list(raw.error_patterns);
  const feedback = raw.feedback as Record<string, unknown> | undefined;
  const recommendation = raw.next_learning_recommendation as Record<string, unknown> | undefined;
  const summary = feedback && asText(feedback.summary);
  const steps = feedback && list(feedback.revision_steps);
  const examples = feedback && list(feedback.model_sentence_examples);
  const category = recommendation && asText(recommendation.theory_category);
  const reason = recommendation && asText(recommendation.reason);
  if (!strengths || !improvements || !errors || !summary || !steps || !examples || !category || !reason) return null;
  return { engine_version: "1.1", decision: decision as EvaluationDecision, total_score: Math.round(total), level: asText(raw.level) ?? "보통", dimension_scores: dimensions, strengths, improvement_points: improvements, error_patterns: errors, feedback: { summary, revision_steps: steps, model_sentence_examples: examples }, next_learning_recommendation: { theory_category: category, reason } };
}

export async function evaluateWritingWithLLM(request: SemanticEvaluationRequest): Promise<SemanticWritingEvaluationResult> {
  const state = decideEvaluationState(request);
  if (state.decision) return nonScoredResult(state.decision, state.reason ?? "평가를 진행하지 않았습니다.");
  try {
    const response = await invokeLLM({
      messages: [{ role: "system", content: MASTER_PROMPT }, { role: "user", content: JSON.stringify({ metadata: request.metadata, task: request.task, submission: request.submission }) }],
      response_format: { type: "json_object" },
    });
    const content = response.choices?.[0]?.message?.content;
    if (typeof content !== "string") throw new Error("LLM_EMPTY_RESPONSE");
    const parsed = parseSemanticResult(JSON.parse(content));
    if (!parsed) throw new Error("LLM_INVALID_EVALUATION_CONTRACT");
    return { ...parsed, fallback_used: false, provider_error: null, token_usage: Math.max(0, Math.round(Number(response.usage?.total_tokens ?? 0))) };
  } catch (error) {
    const fallbackRequest: WritingCorrectionRequest = { essayTitle: String(request.metadata.title ?? "논술 답안"), essayContent: request.submission.essay_text, courseType: "general_adult", level: 1 };
    const fallback = evaluateWritingHeuristic(fallbackRequest);
    return {
      engine_version: "1.1", decision: "revision_requested", total_score: fallback.overallScore, level: "보완 필요",
      dimension_scores: [], strengths: fallback.strengths, improvement_points: [...fallback.weaknesses, ...fallback.suggestions], error_patterns: [],
      feedback: { summary: fallback.overallComment, revision_steps: fallback.suggestions, model_sentence_examples: [] },
      next_learning_recommendation: { theory_category: "주장과 근거", reason: "주장과 근거의 연결을 다시 점검해 주세요." }, fallback_used: true,
      provider_error: error instanceof Error ? error.message.slice(0, 300) : "LLM_UNKNOWN_ERROR", token_usage: 0,
    };
  }
}

export { evaluateWritingHeuristic, getHumanReviewReasons };
export { simulateEvaluationLearning } from "./writingEvaluationSimulation";
