import type { EssayEvaluationInput, EssayEvaluationResult, EvaluationRubric } from "../types";

export type LlmRubricProvider = {
  id: string;
  evaluateWithRubric(input: EssayEvaluationInput, rubric: EvaluationRubric): Promise<EssayEvaluationResult>;
};

export function buildRubricEvaluationPrompt(input: EssayEvaluationInput, rubric: EvaluationRubric) {
  return {
    system: [
      "You are an expert writing assessment engine.",
      "Evaluate only against the supplied rubric.",
      "Return valid JSON only. Do not invent facts.",
      "For Korean essays, feedback must be natural Korean and must distinguish grammar, clarity, logic, and structure.",
    ].join("\n"),
    user: JSON.stringify({
      task: input.taskType,
      language: input.language,
      prompt: input.prompt,
      essay: input.essay,
      rubric,
      output_schema: {
        totalScore: "number",
        confidence: "number 0-1",
        criterionScores: "array",
        findings: "array",
        overallFeedback: "string",
      },
    }),
  };
}

