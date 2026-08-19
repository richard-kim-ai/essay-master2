import { validateExternalEvaluationEndpoint, type EvaluationModelConnection } from "./evaluationModelRegistry";

export type CorrectionStatus = "completed" | "fallback" | "failed";
export type SentenceCorrection = {
  original: string;
  revised: string;
  reason: string;
  competency: "structure" | "logic" | "expression" | "accuracy" | "economy";
  status: "changed" | "unchanged" | "needs_review";
};

export type WritingCorrectionResult = {
  structureScore: number;
  logicScore: number;
  expressionScore: number;
  overallScore: number;
  strengths: string[];
  weaknesses: string[];
  suggestions: string[];
  overallComment: string;
  revisedEssay: string;
  sentenceCorrections: SentenceCorrection[];
  confidence: number;
  correction_status: CorrectionStatus;
  fallback_used: boolean;
  provider_error: string | null;
  latency_ms: number;
  model_id: string;
  token_usage: number;
  estimated_cost_microusd: number;
};

export type WritingCorrectionRequest = {
  essayContent: string;
  essayTitle: string;
  courseType: "elementary" | "middle_high" | "high_univ" | "general_adult";
  level: number;
  difficultyMode?: "standard" | "advanced";
  sourceVerificationFailed?: boolean;
};

type RawModelResult = {
  structureScore?: unknown;
  logicScore?: unknown;
  expressionScore?: unknown;
  overallScore?: unknown;
  strengths?: unknown;
  weaknesses?: unknown;
  suggestions?: unknown;
  overallComment?: unknown;
  revisedEssay?: unknown;
  sentenceCorrections?: unknown;
  confidence?: unknown;
};

function score(value: unknown) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return null;
  return Math.round(Math.max(0, Math.min(100, parsed)));
}

function stringArray(value: unknown) {
  return Array.isArray(value) && value.every((item) => typeof item === "string") ? value.slice(0, 6) : null;
}

function splitSentences(value: string) {
  return value.split(/(?<=[.!?。])\s+|\n+/).map((sentence) => sentence.trim()).filter(Boolean).slice(0, 30);
}

function buildSentenceFallback(essayContent: string): SentenceCorrection[] {
  return splitSentences(essayContent).map((sentence) => ({
    original: sentence,
    revised: sentence,
    reason: "자동 수정 결과를 확인할 수 없어 원문을 보존했습니다.",
    competency: "expression" as const,
    status: "needs_review" as const,
  }));
}

function sanitizeSentenceCorrections(value: unknown, sourceText: string) {
  if (!Array.isArray(value) || value.length === 0 || value.length > 50) return null;
  const competencyValues = new Set(["structure", "logic", "expression", "accuracy", "economy"]);
  const statusValues = new Set(["changed", "unchanged", "needs_review"]);
  const rows: SentenceCorrection[] = [];
  for (const item of value) {
    if (!item || typeof item !== "object") return null;
    const row = item as Record<string, unknown>;
    if (typeof row.original !== "string" || typeof row.revised !== "string" || typeof row.reason !== "string" || typeof row.competency !== "string" || typeof row.status !== "string") return null;
    if (!row.original.trim() || !sourceText.includes(row.original.trim()) || !competencyValues.has(row.competency) || !statusValues.has(row.status)) return null;
    rows.push({ original: row.original.trim(), revised: row.revised.trim(), reason: row.reason.trim().slice(0, 500), competency: row.competency as SentenceCorrection["competency"], status: row.status as SentenceCorrection["status"] });
  }
  return rows;
}

function parseModelOutput(value: unknown, request: WritingCorrectionRequest) {
  const raw = value as RawModelResult;
  const structureScore = score(raw.structureScore);
  const logicScore = score(raw.logicScore);
  const expressionScore = score(raw.expressionScore);
  const overallScore = score(raw.overallScore);
  const strengths = stringArray(raw.strengths);
  const weaknesses = stringArray(raw.weaknesses);
  const suggestions = stringArray(raw.suggestions);
  const sentenceCorrections = sanitizeSentenceCorrections(raw.sentenceCorrections, request.essayContent);
  const confidence = Number(raw.confidence);
  if (structureScore === null || logicScore === null || expressionScore === null || overallScore === null || !strengths || !weaknesses || !suggestions || typeof raw.overallComment !== "string" || typeof raw.revisedEssay !== "string" || !sentenceCorrections || !Number.isFinite(confidence)) return null;
  return {
    structureScore,
    logicScore,
    expressionScore,
    overallScore,
    strengths,
    weaknesses,
    suggestions,
    overallComment: raw.overallComment.trim(),
    revisedEssay: raw.revisedEssay.trim() || request.essayContent,
    sentenceCorrections,
    confidence: Math.max(0, Math.min(1, confidence)),
  };
}

export function evaluateWritingHeuristic(request: WritingCorrectionRequest): WritingCorrectionResult {
  const text = request.essayContent.trim();
  if (!text) {
    return { structureScore: 0, logicScore: 0, expressionScore: 0, overallScore: 0, strengths: [], weaknesses: ["평가할 답안이 없습니다."], suggestions: ["답안을 작성한 뒤 다시 요청하세요."], overallComment: "답안이 비어 있어 첨삭을 진행하지 못했습니다.", revisedEssay: request.essayContent, sentenceCorrections: [], confidence: 0, correction_status: "failed", fallback_used: true, provider_error: "EMPTY_ESSAY", latency_ms: 0, model_id: "heuristic", token_usage: 0, estimated_cost_microusd: 0 };
  }
  const sentenceCount = splitSentences(text).length;
  const overallScore = Math.min(78, Math.max(35, Math.round(42 + Math.min(text.length, 1000) / 28 + Math.min(sentenceCount, 8) * 2)));
  return { structureScore: Math.max(0, overallScore - 5), logicScore: Math.max(0, overallScore - 3), expressionScore: Math.min(100, overallScore + 2), overallScore, strengths: ["답안의 기본 내용을 작성했습니다."], weaknesses: ["자동 평가를 사용할 수 없어 세부 분석은 검수 대상으로 분류되었습니다."], suggestions: ["주장과 근거의 연결을 한 문단씩 다시 점검하세요."], overallComment: "자동 첨삭을 사용할 수 없어 원문을 보존한 기본 점검 결과입니다.", revisedEssay: text, sentenceCorrections: buildSentenceFallback(text), confidence: 0.25, correction_status: "fallback", fallback_used: true, provider_error: null, latency_ms: 0, model_id: "heuristic", token_usage: 0, estimated_cost_microusd: 0 };
}

function buildSystemPrompt(request: WritingCorrectionRequest) {
  return `당신은 ${request.courseType} 과정 Level ${request.level}의 논술 첨삭 전문가입니다. 학생의 원문 의미와 목소리를 보존하고, 사실을 임의로 추가하지 마세요. 반드시 JSON 객체만 반환하세요. sentenceCorrections는 원문에 실제로 존재하는 문장을 original로 쓰며, original·revised·reason·competency(structure|logic|expression|accuracy|economy)·status(changed|unchanged|needs_review)를 포함합니다. confidence는 0~1입니다.`;
}

export async function evaluateWritingWithExternalModel(request: WritingCorrectionRequest, connection: EvaluationModelConnection): Promise<WritingCorrectionResult> {
  const validated = validateExternalEvaluationEndpoint(connection.endpoint, connection.allowedDomains);
  if (!validated.valid) {
    const fallback = evaluateWritingHeuristic(request);
    return { ...fallback, provider_error: validated.message, model_id: connection.modelId };
  }
  const startedAt = Date.now();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), Math.max(1000, Math.min(connection.timeoutMs, 30000)));
  try {
    const response = await fetch(validated.url.toString(), {
      method: "POST",
      signal: controller.signal,
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${connection.apiKey}` },
      body: JSON.stringify({ model: connection.modelId, messages: [{ role: "system", content: buildSystemPrompt(request) }, { role: "user", content: JSON.stringify({ title: request.essayTitle, essay: request.essayContent, difficulty: request.difficultyMode || "standard" }) }], response_format: { type: "json_object" } }),
    });
    if (!response.ok) throw new Error(`PROVIDER_HTTP_${response.status}`);
    const payload = await response.json() as { choices?: Array<{ message?: { content?: string } }>; usage?: { total_tokens?: number } };
    const content = payload.choices?.[0]?.message?.content;
    if (!content) throw new Error("PROVIDER_EMPTY_RESPONSE");
    let parsed: unknown;
    try { parsed = JSON.parse(content); } catch { throw new Error("PROVIDER_INVALID_JSON"); }
    const normalized = parseModelOutput(parsed, request);
    if (!normalized) throw new Error("PROVIDER_INVALID_CONTRACT");
    const tokenUsage = Math.max(0, Math.round(Number(payload.usage?.total_tokens || 0)));
    return { ...normalized, correction_status: "completed", fallback_used: false, provider_error: null, latency_ms: Date.now() - startedAt, model_id: connection.modelId, token_usage: tokenUsage, estimated_cost_microusd: 0 };
  } catch (error) {
    const fallback = evaluateWritingHeuristic(request);
    const summary = error instanceof Error ? error.message.slice(0, 500) : "PROVIDER_UNKNOWN_ERROR";
    return { ...fallback, provider_error: summary, latency_ms: Date.now() - startedAt, model_id: connection.modelId };
  } finally {
    clearTimeout(timeout);
  }
}

export function getHumanReviewReasons(result: WritingCorrectionResult, heuristicScore?: number, sourceVerificationFailed = false) {
  const reasons: string[] = [];
  if (result.confidence < 0.65) reasons.push("low_confidence");
  if (result.correction_status !== "completed") reasons.push(result.correction_status === "fallback" ? "fallback_used" : "provider_failed");
  if (result.provider_error?.includes("INVALID")) reasons.push("invalid_model_contract");
  if (typeof heuristicScore === "number" && Math.abs(result.overallScore - heuristicScore) >= 25) reasons.push("score_disagreement");
  if (sourceVerificationFailed) reasons.push("source_verification_failed");
  if (result.sentenceCorrections.some((row) => row.original.length > 20 && Math.abs(row.revised.length - row.original.length) / row.original.length > 0.65)) reasons.push("excessive_sentence_change");
  return Array.from(new Set(reasons));
}
