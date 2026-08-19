import type { EssayEvaluationResult } from "../types";

function median(values: number[]) {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

export function mergeEvaluationResults(results: EssayEvaluationResult[]): EssayEvaluationResult {
  if (results.length === 0) throw new Error("At least one evaluation result is required");
  const base = results[0];
  const scores = results.map(result => result.totalScore);
  const finalScore = Math.round(median(scores));
  const variance = scores.reduce((sum, score) => sum + Math.pow(score - finalScore, 2), 0) / scores.length;
  const agreementConfidence = Math.max(0.35, Math.min(0.95, 1 - Math.sqrt(variance) / Math.max(1, base.maxScore)));

  return {
    ...base,
    totalScore: finalScore,
    normalizedScore: Math.round((finalScore / base.maxScore) * 100),
    confidence: Math.round(agreementConfidence * 100) / 100,
    findings: results.flatMap(result => result.findings).slice(0, 8),
    modelTraces: results.flatMap(result => result.modelTraces),
    overallFeedback: base.overallFeedback,
  };
}

