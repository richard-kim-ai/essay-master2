import { decryptSecret } from "./security";
import { evaluateWritingHeuristic, evaluateWritingWithExternalModel, type WritingCorrectionRequest } from "./writingCorrectionEngine";

export type StoredEvaluationModelConfig = {
  modelId: string;
  endpoint: string;
  allowedDomainsJson: string;
  encryptedApiKey: string;
  timeoutMs: number;
  isActive: number;
};

export async function evaluateConfiguredWriting(request: WritingCorrectionRequest, config?: StoredEvaluationModelConfig | null) {
  if (!config || config.isActive !== 1) {
    const fallback = evaluateWritingHeuristic(request);
    return { ...fallback, provider_error: "NO_ACTIVE_EVALUATION_MODEL", model_id: "heuristic" };
  }
  try {
    const allowedDomains = JSON.parse(config.allowedDomainsJson);
    if (!Array.isArray(allowedDomains)) throw new Error("INVALID_ALLOWED_DOMAINS");
    return await evaluateWritingWithExternalModel(request, { modelId: config.modelId, endpoint: config.endpoint, allowedDomains: allowedDomains.filter((value): value is string => typeof value === "string"), apiKey: decryptSecret(config.encryptedApiKey), timeoutMs: config.timeoutMs });
  } catch (error) {
    const fallback = evaluateWritingHeuristic(request);
    return { ...fallback, provider_error: error instanceof Error ? error.message.slice(0, 500) : "MODEL_CONFIGURATION_ERROR", model_id: config.modelId };
  }
}
