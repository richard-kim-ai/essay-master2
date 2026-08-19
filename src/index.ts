import { essayMasterRubric } from "./rubrics";
import { runRuleBaseline } from "./modules/ruleBaseline";
import { mergeEvaluationResults } from "./modules/selfConsistency";
import type { EssayEvaluationInput, EssayEvaluationResult, EvaluationRubric } from "./types";

export * from "./types";
export * from "./rubrics";
export * from "./modules/features";
export * from "./modules/ruleBaseline";
export * from "./modules/selfConsistency";
export * from "./modules/calibration";
export * from "./providers/llmRubricProvider";
export * from "./providers/modelServerProvider";
export * from "./datasets/aihub";
export * from "./modelRegistry";

export const ENGINE_VERSION = "0.1.0";

export type EngineConfig = {
  rubric?: EvaluationRubric;
  modules?: {
    ruleBaseline?: boolean;
    llmRubric?: boolean;
    modelServer?: boolean;
    selfConsistency?: boolean;
  };
};

function finalize(result: Partial<EssayEvaluationResult>, rubric: EvaluationRubric): EssayEvaluationResult {
  return {
    engineVersion: ENGINE_VERSION,
    rubricId: result.rubricId ?? rubric.id,
    totalScore: result.totalScore ?? 0,
    maxScore: result.maxScore ?? rubric.totalScale.max,
    normalizedScore: result.normalizedScore ?? 0,
    confidence: result.confidence ?? 0,
    criterionScores: result.criterionScores ?? [],
    features: result.features ?? {
      charCount: 0,
      wordLikeCount: 0,
      sentenceCount: 0,
      paragraphCount: 0,
      avgSentenceLength: 0,
      connectiveCount: 0,
      evidenceMarkerCount: 0,
      counterargumentMarkerCount: 0,
      conclusionMarkerCount: 0,
      questionRestatementScore: 0,
    },
    findings: result.findings ?? [],
    overallFeedback: result.overallFeedback ?? "",
    modelTraces: result.modelTraces ?? [],
  };
}

export function createEssayEvaluationEngine(config: EngineConfig = {}) {
  const rubric = config.rubric ?? essayMasterRubric;
  const modules = {
    ruleBaseline: true,
    llmRubric: false,
    modelServer: false,
    selfConsistency: true,
    ...config.modules,
  };

  return {
    async evaluate(input: EssayEvaluationInput): Promise<EssayEvaluationResult> {
      const partials: EssayEvaluationResult[] = [];

      if (modules.ruleBaseline) {
        partials.push(finalize(await runRuleBaseline(input, input.rubric ?? rubric), input.rubric ?? rubric));
      }

      if (partials.length === 0) {
        throw new Error("No evaluation modules are enabled");
      }

      return modules.selfConsistency && partials.length > 1
        ? mergeEvaluationResults(partials)
        : partials[0];
    },
  };
}
