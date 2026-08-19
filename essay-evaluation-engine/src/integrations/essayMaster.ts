import { createEssayEvaluationEngine } from "../index";
import { essayMasterRubric } from "../rubrics";
import type { EssayEvaluationInput } from "../types";

export type EssayMasterEvaluationRequest = {
  questionId?: number;
  courseType?: string;
  prompt: string;
  userAnswer: string;
};

export async function evaluateForEssayMaster(request: EssayMasterEvaluationRequest) {
  const engine = createEssayEvaluationEngine({
    rubric: essayMasterRubric,
    modules: {
      ruleBaseline: true,
      llmRubric: false,
      modelServer: false,
      selfConsistency: true,
    },
  });

  const input: EssayEvaluationInput = {
    language: "ko",
    taskType: request.courseType === "general_adult" ? "business_writing" : "essay_master",
    prompt: request.prompt,
    essay: request.userAnswer,
    metadata: { questionId: request.questionId, courseType: request.courseType },
  };

  return await engine.evaluate(input);
}

