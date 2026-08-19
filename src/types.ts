export type EvaluationLanguage = "ko" | "en" | "mixed";

export type EvaluationTaskType =
  | "essay_master"
  | "korean_school_essay"
  | "admission_essay"
  | "business_writing"
  | "general_writing"
  | "ielts_task_1"
  | "ielts_task_2";

export type ScoreScale = {
  min: number;
  max: number;
  step?: number;
};

export type RubricCriterion = {
  id: string;
  label: string;
  description: string;
  weight: number;
  scale: ScoreScale;
  anchors: Array<{
    score: number;
    descriptor: string;
  }>;
};

export type EvaluationRubric = {
  id: string;
  label: string;
  language: EvaluationLanguage;
  taskTypes: EvaluationTaskType[];
  totalScale: ScoreScale;
  criteria: RubricCriterion[];
};

export type EssayEvaluationInput = {
  language: EvaluationLanguage;
  taskType: EvaluationTaskType;
  prompt: string;
  essay: string;
  gradeLevel?: string;
  targetBand?: number;
  rubric?: EvaluationRubric;
  metadata?: Record<string, unknown>;
};

export type CriterionScore = {
  criterionId: string;
  score: number;
  maxScore: number;
  confidence: number;
  evidence: string[];
  feedback: string;
};

export type WritingFeatureProfile = {
  charCount: number;
  wordLikeCount: number;
  sentenceCount: number;
  paragraphCount: number;
  avgSentenceLength: number;
  connectiveCount: number;
  evidenceMarkerCount: number;
  counterargumentMarkerCount: number;
  conclusionMarkerCount: number;
  questionRestatementScore: number;
};

export type EvaluationFinding = {
  type: "strength" | "weakness" | "revision" | "risk";
  criterionId?: string;
  message: string;
  evidence?: string;
};

export type EssayEvaluationResult = {
  engineVersion: string;
  rubricId: string;
  totalScore: number;
  maxScore: number;
  normalizedScore: number;
  confidence: number;
  criterionScores: CriterionScore[];
  features: WritingFeatureProfile;
  findings: EvaluationFinding[];
  overallFeedback: string;
  modelTraces: Array<{
    moduleId: string;
    score: number;
    confidence: number;
    latencyMs?: number;
    raw?: unknown;
  }>;
};

export type EvaluationModule = {
  id: string;
  evaluate(input: EssayEvaluationInput, rubric: EvaluationRubric): Promise<Partial<EssayEvaluationResult>>;
};

