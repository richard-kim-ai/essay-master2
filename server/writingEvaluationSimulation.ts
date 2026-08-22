import { evaluateWriting, type EducationLevel, type WritingEvaluationRequest, type WritingType } from "./writingEvaluationEngine";
import { pearsonCorrelation, quadraticWeightedKappa, recallAtThreshold } from "./evaluationMetrics";

export interface StudentEssaySimulationSample {
  sample_id: string;
  learner_id: string;
  essay_text: string;
  previous_score?: number | null;
  human_score?: number | null;
  score_source?: "human" | "ai" | "unknown";
  source?: "essay_submission" | "ai_auto_feedback" | "manual";
}
export interface StudentEssaySimulationRequest {
  metadata: {
    curriculum_code: string;
    theory_category: string;
    education_level: EducationLevel;
    difficulty: number;
    writing_type: WritingType;
  };
  task: {
    prompt: string;
    constraints?: WritingEvaluationRequest["task"]["constraints"];
  };
  samples: StudentEssaySimulationSample[];
}

export function simulateEvaluationLearning(request: StudentEssaySimulationRequest) {
  const evaluations = request.samples.map((sample) => {
    const result = evaluateWriting({
      metadata: {
        ...request.metadata,
        task_id: sample.sample_id,
      },
      task: request.task,
      submission: {
        learner_id: sample.learner_id,
        essay_text: sample.essay_text,
      },
    });

    return {
      sample_id: sample.sample_id,
      learner_id: anonymizeLearnerId(sample.learner_id),
      source: sample.source ?? "manual",
      preview: sample.essay_text.replace(/\s+/g, " ").trim().slice(0, 120),
      previous_score: sample.previous_score ?? null,
      human_score: sample.human_score ?? null,
      score_source: sample.score_source ?? "unknown",
      current_score: result.total_score,
      score_delta:
        typeof sample.previous_score === "number" ? result.total_score - sample.previous_score : null,
      decision: result.decision,
      level: result.level,
      top_error_patterns: result.error_patterns.map((pattern) => pattern.code),
      next_theory_category: result.next_learning_recommendation.theory_category,
      feedback_summary: result.feedback.summary,
    };
  });

  const scored = evaluations.filter((item) => item.decision === "scored" || item.decision === "revision_requested");
  const averageScore = scored.length
    ? Math.round(scored.reduce((sum, item) => sum + item.current_score, 0) / scored.length)
    : 0;
  const patternCounts = countValues(evaluations.flatMap((item) => item.top_error_patterns));
  const recommendationCounts = countValues(evaluations.map((item) => item.next_theory_category));
  const humanCompared = evaluations.filter((item) => typeof item.human_score === "number");
  const actual = humanCompared.map((item) => item.human_score as number);
  const predicted = humanCompared.map((item) => item.current_score);

  return {
    engine_version: "1.1",
    sample_count: evaluations.length,
    scored_count: scored.length,
    average_score: averageScore,
    decision_counts: countValues(evaluations.map((item) => item.decision)),
    recurring_error_patterns: Object.entries(patternCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([code, count]) => ({ code, count })),
    next_learning_distribution: Object.entries(recommendationCounts)
      .sort((a, b) => b[1] - a[1])
      .map(([theory_category, count]) => ({ theory_category, count })),
    calibration_candidates: buildCalibrationCandidates(evaluations),
    quality_metrics: {
      sample_count: humanCompared.length,
      quadratic_weighted_kappa: quadraticWeightedKappa(actual, predicted),
      pearson_correlation: pearsonCorrelation(actual, predicted),
      recall_at_60: recallAtThreshold(actual, predicted, 60),
      note: humanCompared.length < 30 ? "인간 채점 표본이 30개 미만이라 운영 기준으로 사용하지 마세요." : "인간 채점 데이터 기준 비교 지표입니다.",
    },
    evaluations,
  };
}

export function buildSimulationSamplesFromStudentData(input: {
  essaySubmissions?: Array<{ id: number; userId: number; content: string }>;
  aiFeedbacks?: Array<{ id: number; userId: number; essayContent: string; overallScore: number | null }>;
}): StudentEssaySimulationSample[] {
  const fromSubmissions = (input.essaySubmissions ?? []).map((essay) => ({
    sample_id: `essay-${essay.id}`,
    learner_id: String(essay.userId),
    essay_text: essay.content,
    previous_score: null,
    source: "essay_submission" as const,
  }));
  const fromFeedbacks = (input.aiFeedbacks ?? []).map((feedback) => ({
    sample_id: `ai-feedback-${feedback.id}`,
    learner_id: String(feedback.userId),
    essay_text: feedback.essayContent,
    previous_score: feedback.overallScore,
    source: "ai_auto_feedback" as const,
  }));

  return [...fromSubmissions, ...fromFeedbacks].filter((sample) => sample.essay_text.trim().length > 0);
}

function anonymizeLearnerId(value: string) {
  return `learner-${Buffer.from(value).toString("base64url").slice(0, 8)}`;
}

function countValues(values: string[]) {
  return values.reduce<Record<string, number>>((acc, value) => {
    acc[value] = (acc[value] ?? 0) + 1;
    return acc;
  }, {});
}

function buildCalibrationCandidates(
  evaluations: Array<{ sample_id: string; previous_score: number | null; human_score: number | null; score_source: string; current_score: number; score_delta: number | null }>
) {
  return evaluations
    .filter((item) => (typeof item.human_score === "number" && Math.abs(item.current_score - item.human_score) >= 10) || (item.human_score === null && typeof item.score_delta === "number" && Math.abs(item.score_delta) >= 15))
    .map((item) => ({
      sample_id: item.sample_id,
      previous_score: item.previous_score,
      human_score: item.human_score,
      score_source: item.score_source,
      current_score: item.current_score,
      score_delta: item.human_score === null ? item.score_delta : item.current_score - item.human_score,
      reason: item.human_score === null ? "기존 점수와 평가엔진 v1.1 점수 차이가 커서 교사 검토용 보정 후보입니다." : "인간 평가 점수와 평가엔진 v1.1 점수 차이가 커서 보정 검토가 필요합니다.",
    }));
}
