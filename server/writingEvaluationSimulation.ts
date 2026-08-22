import { evaluateConfiguredWriting, type StoredEvaluationModelConfig } from "./configuredWritingEvaluation";
import { evaluateWritingHeuristic, type WritingCorrectionRequest } from "./writingCorrectionEngine";
import { getHumanEvaluationQualityMetrics } from "./evaluationMetrics";

export type EvaluationSimulationSample = WritingCorrectionRequest & { humanScore?: number };

export function summarizeSimulationQuality(samples: EvaluationSimulationSample[], modelScores: number[]) {
  const pairs = samples.flatMap((sample, index) => typeof sample.humanScore === "number" && typeof modelScores[index] === "number" ? [{ humanScore: sample.humanScore, modelScore: modelScores[index] }] : []);
  return getHumanEvaluationQualityMetrics(pairs);
}

export async function simulateEvaluationLearning(samples: EvaluationSimulationSample[], options: { use_llm?: boolean; maxConcurrent?: number; config?: StoredEvaluationModelConfig | null } = {}) {
  if (!options.use_llm) return samples.map((sample) => evaluateWritingHeuristic(sample));
  // 비용·속도 보호를 위해 LLM 모드는 의도적으로 한 번에 한 건만 순차 실행한다.
  // maxConcurrent는 운영자가 값을 전달해도 1로 제한되는 안전 상한을 명시적으로 보존한다.
  const maxConcurrent = Math.max(1, Math.min(options.maxConcurrent ?? 1, 1));
  const results = [];
  for (let index = 0; index < samples.length; index += maxConcurrent) {
    results.push(await evaluateConfiguredWriting(samples[index], options.config));
  }
  return results;
}
