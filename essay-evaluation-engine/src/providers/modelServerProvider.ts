import type { EssayEvaluationInput, EssayEvaluationResult, EvaluationRubric } from "../types";

export type ModelServerProviderConfig = {
  id: string;
  endpoint: string;
  modelFamily: "vllm" | "kobert-gru" | "kanana-lora" | "llama-lora" | "custom";
  timeoutMs?: number;
};

export type ModelServerProvider = {
  id: string;
  modelFamily: ModelServerProviderConfig["modelFamily"];
  evaluate(input: EssayEvaluationInput, rubric: EvaluationRubric): Promise<EssayEvaluationResult>;
};

export function createModelServerProvider(config: ModelServerProviderConfig, fetchImpl: typeof fetch = fetch): ModelServerProvider {
  return {
    id: config.id,
    modelFamily: config.modelFamily,
    async evaluate(input, rubric) {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), config.timeoutMs ?? 30000);
      try {
        const response = await fetchImpl(config.endpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ input, rubric }),
          signal: controller.signal,
        });
        if (!response.ok) throw new Error(`Model server failed: ${response.status}`);
        return await response.json() as EssayEvaluationResult;
      } finally {
        clearTimeout(timeout);
      }
    },
  };
}

