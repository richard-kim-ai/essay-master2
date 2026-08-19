import { evaluateWriting, type WritingEvaluationRequest, type WritingEvaluationResult } from "./writingEvaluationEngine";
import { getActiveEvaluationModel, type EvaluationModelProfile } from "./evaluationModelRegistry";

type ConfiguredEvaluation = {
  evaluation: WritingEvaluationResult;
  modelId: string;
  fallback: boolean;
};

function looksLikeEvaluation(value: unknown): value is WritingEvaluationResult {
  const item = value as Partial<WritingEvaluationResult> | null;
  return Boolean(item && item.engine_version === "1.1" && typeof item.total_score === "number" && Array.isArray(item.dimension_scores) && item.validation);
}

async function evaluateWithRemoteModel(request: WritingEvaluationRequest, model: EvaluationModelProfile): Promise<WritingEvaluationResult> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30_000);
  try {
    const response = await fetch(model.endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...(model.model ? { "X-Evaluation-Model": model.model } : {}) },
      body: JSON.stringify({ request, model: model.model || undefined }),
      signal: controller.signal,
    });
    if (!response.ok) throw new Error(`Evaluation model returned ${response.status}`);
    const payload = await response.json() as { evaluation?: unknown } | unknown;
    const evaluation = payload && typeof payload === "object" && "evaluation" in payload ? payload.evaluation : payload;
    if (!looksLikeEvaluation(evaluation)) throw new Error("Evaluation model returned an invalid result");
    return evaluation;
  } finally {
    clearTimeout(timeout);
  }
}

export async function evaluateWritingWithConfiguredModel(request: WritingEvaluationRequest): Promise<ConfiguredEvaluation> {
  const model = await getActiveEvaluationModel();
  if (!model) return { evaluation: evaluateWriting(request), modelId: "rule-baseline", fallback: false };
  try {
    return { evaluation: await evaluateWithRemoteModel(request, model), modelId: model.id, fallback: false };
  } catch (error) {
    console.warn(`[writing-evaluation] ${model.id} failed; using rule baseline`, error);
    return { evaluation: evaluateWriting(request), modelId: "rule-baseline", fallback: true };
  }
}
