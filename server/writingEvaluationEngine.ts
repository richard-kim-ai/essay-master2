import { invokeLLMText } from "./_core/llmText";
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

// 학생이 개인 맞춤 첨삭에 동의해 metadata.learner_history가 있을 때만 시스템 지시문에 덧붙인다.
const PERSONALIZATION_NOTE = "\nmetadata.learner_history는 동의한 학생의 최근 첨삭 요약이다. 반복되는 약점은 짚고 나아진 점은 인정하되, 점수는 이번 답안의 관찰 근거로만 매기고 과거 기록으로 올리거나 내리지 않는다.";

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
반드시 JSON 객체만 반환하고 다음 필드를 포함한다: engine_version, decision, total_score, level, dimension_scores, strengths, improvement_points, error_patterns, feedback(summary, revision_steps, model_sentence_examples), next_learning_recommendation(theory_category, reason).
decision은 scored, revision_requested, held, dismissed 중 하나의 영문 값으로 반환하고 dimension_scores는 12개 항목의 배열([{competency, score, evidence}])로 반환한다. 각 score와 total_score는 0~100 정수다.`;

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

const DECISION_ALIASES: Record<string, EvaluationDecision> = {
  scored: "scored", "평가 완료": "scored", 완료: "scored", 우수: "scored",
  revision_requested: "revision_requested", "재작성 요청": "revision_requested", "보완 필요": "revision_requested",
  held: "held", "평가 보류": "held", 보류: "held",
  dismissed: "dismissed", 각하: "dismissed",
};

function normalizeScore(value: unknown): number | null {
  const score = Number(value);
  if (!Number.isFinite(score) || score < 0 || score > 100) return null;
  // 일부 모델이 competency만 1~5 루브릭으로 반환하는 경우를 100점 척도로 통일한다.
  return Math.round(score <= 5 ? score * 20 : score);
}

// 형식이 맞지 않으면 어느 항목이 문제인지(항목 이름만, 응답 내용은 제외)를 돌려준다.
type Parsed<T> = { value: T } | { invalid: string };

function normalizeDimensions(value: unknown): Parsed<DimensionScore[]> {
  const rows = Array.isArray(value)
    ? value
    : value && typeof value === "object"
      ? Object.entries(value as Record<string, unknown>).map(([competency, row]) =>
          row && typeof row === "object" ? { competency, ...(row as Record<string, unknown>) } : { competency, score: row },
        )
      : null;
  if (!rows) return { invalid: "dimension_scores(없음 또는 배열·객체 아님)" };
  if (rows.length !== 12) return { invalid: `dimension_scores(${rows.length}개, 12개 필요)` };
  const dimensions: DimensionScore[] = [];
  for (let index = 0; index < rows.length; index += 1) {
    const item = rows[index];
    if (!item || typeof item !== "object") return { invalid: `dimension_scores[${index}](객체 아님)` };
    const row = item as Record<string, unknown>;
    const competency = asText(row.competency);
    const evidence = asText(row.evidence);
    const score = normalizeScore(row.score);
    const missing = [!competency && "competency", !evidence && "evidence", score === null && "score"].filter(Boolean);
    if (missing.length) return { invalid: `dimension_scores[${index}].${missing.join("/")}` };
    dimensions.push({ competency: competency!, score: score!, evidence: evidence! });
  }
  return { value: dimensions };
}

function parseSemanticResult(value: unknown): Parsed<Omit<SemanticWritingEvaluationResult, "fallback_used" | "provider_error" | "token_usage">> {
  if (!value || typeof value !== "object") return { invalid: "응답 전체(객체 아님)" };
  const raw = value as Record<string, unknown>;
  const invalid: string[] = [];
  const decision = DECISION_ALIASES[String(raw.decision).trim()];
  if (!decision) invalid.push("decision");
  const total = normalizeScore(raw.total_score);
  if (total === null) invalid.push("total_score");
  const dimensions = normalizeDimensions(raw.dimension_scores);
  if ("invalid" in dimensions) invalid.push(dimensions.invalid);
  const list = (field: unknown) => Array.isArray(field) && field.every((item) => typeof item === "string") ? field.slice(0, 12) as string[] : null;
  const strengths = list(raw.strengths), improvements = list(raw.improvement_points), errors = list(raw.error_patterns);
  if (!strengths) invalid.push("strengths");
  if (!improvements) invalid.push("improvement_points");
  if (!errors) invalid.push("error_patterns");
  const feedback = raw.feedback as Record<string, unknown> | undefined;
  const recommendation = raw.next_learning_recommendation as Record<string, unknown> | undefined;
  const summary = feedback && asText(feedback.summary);
  const steps = feedback && list(feedback.revision_steps);
  const examples = feedback && list(feedback.model_sentence_examples);
  const category = recommendation && asText(recommendation.theory_category);
  const reason = recommendation && asText(recommendation.reason);
  if (!summary) invalid.push("feedback.summary");
  if (!steps) invalid.push("feedback.revision_steps");
  if (!examples) invalid.push("feedback.model_sentence_examples");
  if (!category) invalid.push("next_learning_recommendation.theory_category");
  if (!reason) invalid.push("next_learning_recommendation.reason");
  if (invalid.length || !decision || total === null || "invalid" in dimensions || !strengths || !improvements || !errors || !summary || !steps || !examples || !category || !reason) return { invalid: invalid.join(", ") };
  return { value: { engine_version: "1.1", decision, total_score: total, level: asText(raw.level) ?? "보통", dimension_scores: dimensions.value, strengths, improvement_points: improvements, error_patterns: errors, feedback: { summary, revision_steps: steps, model_sentence_examples: examples }, next_learning_recommendation: { theory_category: category, reason } } };
}

/** 형식 검사 실패 사유: 문제 항목과 AI가 돌려준 최상위 키 이름(값·본문은 넣지 않는다). */
function contractErrorMessage(invalid: string, value: unknown): string {
  const keys = value && typeof value === "object" && !Array.isArray(value) ? Object.keys(value as object).slice(0, 15).map((key) => key.slice(0, 30)).join(", ") : typeof value;
  return `LLM_INVALID_EVALUATION_CONTRACT (invalid: ${invalid}; received: ${keys})`.slice(0, 450);
}

export async function evaluateWritingWithLLM(request: SemanticEvaluationRequest): Promise<SemanticWritingEvaluationResult> {
  const state = decideEvaluationState(request);
  if (state.decision) return nonScoredResult(state.decision, state.reason ?? "평가를 진행하지 않았습니다.");
  try {
    const { text, totalTokens } = await invokeLLMText({
      messages: [{ role: "system", content: request.metadata.learner_history ? MASTER_PROMPT + PERSONALIZATION_NOTE : MASTER_PROMPT }, { role: "user", content: JSON.stringify({ metadata: request.metadata, task: request.task, submission: request.submission }) }],
      response_format: { type: "json_object" },
    });
    const json = JSON.parse(text);
    const parsed = parseSemanticResult(json);
    if ("invalid" in parsed) throw new Error(contractErrorMessage(parsed.invalid, json));
    return { ...parsed.value, fallback_used: false, provider_error: null, token_usage: totalTokens };
  } catch (error) {
    // 사유 원문은 서버 로그에만 남긴다(사용자에게는 안내 문구로 바꿔 보여 준다).
    console.warn("[AI 평가] 모델 호출 실패 — 기본 점검 결과로 대체:", error instanceof Error ? error.message.slice(0, 450) : error);
    const fallbackRequest: WritingCorrectionRequest = { essayTitle: String(request.metadata.title ?? "논술 답안"), essayContent: request.submission.essay_text, courseType: "general_adult", level: 1 };
    const fallback = evaluateWritingHeuristic(fallbackRequest);
    return {
      engine_version: "1.1", decision: "revision_requested", total_score: fallback.overallScore, level: "보완 필요",
      dimension_scores: [], strengths: fallback.strengths, improvement_points: [...fallback.weaknesses, ...fallback.suggestions], error_patterns: [],
      feedback: { summary: fallback.overallComment, revision_steps: fallback.suggestions, model_sentence_examples: [] },
      next_learning_recommendation: { theory_category: "주장과 근거", reason: "주장과 근거의 연결을 다시 점검해 주세요." }, fallback_used: true,
      provider_error: error instanceof Error ? error.message.slice(0, 450) : "LLM_UNKNOWN_ERROR", token_usage: 0,
    };
  }
}

export { evaluateWritingHeuristic, getHumanReviewReasons };
export { simulateEvaluationLearning } from "./writingEvaluationSimulation";
