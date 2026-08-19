import { extractWritingFeatures } from "./features";
import type { CriterionScore, EssayEvaluationInput, EssayEvaluationResult, EvaluationRubric } from "../types";

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function scoreCriterion(criterionId: string, input: EssayEvaluationInput, maxScore: number) {
  const f = extractWritingFeatures(input);
  const lengthScore = clamp(f.charCount / 600, 0.2, 1);
  const paragraphScore = clamp(f.paragraphCount / 3, 0.3, 1);
  const evidenceScore = clamp(f.evidenceMarkerCount / 2, 0.2, 1);
  const connectiveScore = clamp(f.connectiveCount / 4, 0.2, 1);
  const conclusionScore = clamp(f.conclusionMarkerCount, 0.3, 1);

  const ratios: Record<string, number> = {
    claim: Math.max(conclusionScore, 0.45),
    evidence: evidenceScore,
    organization: (paragraphScore + connectiveScore) / 2,
    expression: clamp(1 - Math.max(0, f.avgSentenceLength - 90) / 140, 0.35, 1),
    task_fit: input.essay.length > 0 ? lengthScore : 0,
    task_understanding: lengthScore,
    content: (lengthScore + evidenceScore) / 2,
    grammar: clamp(1 - Math.max(0, f.avgSentenceLength - 100) / 160, 0.35, 1),
    vocabulary: clamp(f.wordLikeCount / 450, 0.25, 1),
    coherence: connectiveScore,
    creativity: clamp((f.evidenceMarkerCount + f.counterargumentMarkerCount) / 4, 0.25, 1),
    task_response: lengthScore,
    lexical: clamp(f.wordLikeCount / 500, 0.25, 1),
  };

  return Math.round(clamp((ratios[criterionId] ?? 0.6) * maxScore, 0, maxScore) * 10) / 10;
}

export async function runRuleBaseline(input: EssayEvaluationInput, rubric: EvaluationRubric): Promise<Partial<EssayEvaluationResult>> {
  const features = extractWritingFeatures(input);
  const criterionScores: CriterionScore[] = rubric.criteria.map(criterion => {
    const score = scoreCriterion(criterion.id, input, criterion.scale.max);
    return {
      criterionId: criterion.id,
      score,
      maxScore: criterion.scale.max,
      confidence: 0.46,
      evidence: [
        `문장 수 ${features.sentenceCount}`,
        `문단 수 ${features.paragraphCount}`,
        `근거 표지 ${features.evidenceMarkerCount}`,
      ],
      feedback: `${criterion.label}은(는) 자동 기초 분석 기준으로 ${score}/${criterion.scale.max} 수준입니다.`,
    };
  });

  const totalScore = criterionScores.reduce((sum, score, index) => {
    const criterion = rubric.criteria[index];
    return sum + (score.score / score.maxScore) * criterion.weight * rubric.totalScale.max;
  }, 0);

  return {
    rubricId: rubric.id,
    totalScore: Math.round(totalScore),
    maxScore: rubric.totalScale.max,
    normalizedScore: Math.round((totalScore / rubric.totalScale.max) * 100),
    confidence: 0.46,
    criterionScores,
    features,
    findings: [
      {
        type: "strength",
        message: features.evidenceMarkerCount > 0 ? "근거를 제시하려는 표지가 확인됩니다." : "기본 글 구조 분석이 완료되었습니다.",
      },
      {
        type: features.paragraphCount < 2 ? "weakness" : "strength",
        criterionId: "organization",
        message: features.paragraphCount < 2 ? "문단 구분을 늘리면 구조 평가가 안정됩니다." : "문단 구분이 확인됩니다.",
      },
    ],
    overallFeedback: "규칙 기반 1차 평가입니다. 운영 환경에서는 LLM 루브릭 평가와 모델 서버 점수를 함께 합성하는 것을 권장합니다.",
    modelTraces: [{ moduleId: "rule_baseline", score: Math.round(totalScore), confidence: 0.46 }],
  };
}

