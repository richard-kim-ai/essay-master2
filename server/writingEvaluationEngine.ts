export const evaluationEngineVersion = "1.0.0" as const;

export type EvaluationDecision = "scored" | "revision_requested" | "held" | "dismissed";
export type EducationLevel = "elementary" | "middle_high" | "high_univ" | "general_adult";
export type WritingType = "ARGUMENTATIVE" | "EXPLANATORY" | "REFLECTIVE" | "SUMMARY" | "CREATIVE";

export interface WritingEvaluationRequest {
  metadata: {
    task_id?: string;
    curriculum_code: string;
    theory_category: string;
    education_level: EducationLevel;
    difficulty: number;
    writing_type: WritingType;
  };
  task: {
    prompt: string;
    constraints?: {
      min_chars?: number;
      max_chars?: number;
      required_elements?: string[];
    };
  };
  submission: {
    learner_id: string;
    essay_text: string;
  };
}

export interface WritingEvaluationResult {
  engine_version: typeof evaluationEngineVersion;
  decision: EvaluationDecision;
  total_score: number;
  level: string;
  dimension_scores: Array<{
    dimension: string;
    competencies: string[];
    score: number;
    max_score: number;
    evidence: string[];
    comment: string;
  }>;
  strengths: string[];
  improvement_points: string[];
  error_patterns: Array<{
    code: string;
    severity: "low" | "medium" | "high";
    label: string;
    message: string;
    evidence: string;
  }>;
  feedback: {
    summary: string;
    revision_steps: string[];
    model_sentence_examples: string[];
  };
  next_learning_recommendation: {
    theory_category: string;
    reason: string;
  };
}

const dimensions = [
  { dimension: "과제·논제 이해", competencies: ["task_understanding"], maxScore: 10 },
  { dimension: "내용·사고력", competencies: ["central_claim", "reasoning_basis"], maxScore: 15 },
  { dimension: "주장·논증", competencies: ["evidence_use", "claim_evidence_link", "logical_inference"], maxScore: 25 },
  { dimension: "반론·비판", competencies: ["counterargument_response"], maxScore: 10 },
  { dimension: "구성·문단", competencies: ["macro_structure", "paragraphing"], maxScore: 15 },
  { dimension: "연결·일관성", competencies: ["coherence"], maxScore: 10 },
  { dimension: "표현·언어규범", competencies: ["sentence_expression", "language_conventions"], maxScore: 15 },
] as const;

const reasonMarkers = ["왜냐하면", "때문", "이유", "따라서", "그래서"];
const evidenceMarkers = ["예를 들어", "사례", "경험", "자료", "통계", "연구", "친구", "학교"];
const counterMarkers = ["물론", "반면", "하지만", "그러나", "다른 의견", "반대"];
const coherenceMarkers = ["먼저", "또한", "그러나", "하지만", "따라서", "그래서", "결론적으로"];

export function evaluateWriting(request: WritingEvaluationRequest): WritingEvaluationResult {
  validateEvaluationRequest(request);

  const essay = normalize(request.submission.essay_text);
  const sentences = splitSentences(essay);
  const paragraphs = request.submission.essay_text
    .split(/\n\s*\n/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean);

  const decision = decideEvaluationState(essay, request.task.prompt);
  if (decision !== "scored") {
    return buildNonScoredResult(request, decision);
  }

  const hasClaim = /생각합니다|주장합니다|해야 합니다|필요합니다|옳습니다|반대합니다|찬성합니다/.test(essay);
  const hasReason = includesAny(essay, reasonMarkers);
  const hasEvidence = includesAny(essay, evidenceMarkers);
  const hasCounterargument = includesAny(essay, counterMarkers);
  const hasCoherence = includesAny(essay, coherenceMarkers);
  const minChars = request.task.constraints?.min_chars ?? 0;
  const lengthRatio = minChars > 0 ? Math.min(essay.length / minChars, 1) : Math.min(essay.length / 600, 1);
  const promptMatchRatio = calculatePromptMatchRatio(request.task.prompt, essay);

  const dimensionScores = [
    buildDimensionScore(0, Math.max(0.45, promptMatchRatio * 0.8 + lengthRatio * 0.2), [`문제 핵심어 반영률이 약 ${Math.round(promptMatchRatio * 100)}%입니다.`], "논제가 묻는 대상과 조건을 기준으로 평가했습니다."),
    buildDimensionScore(1, (hasClaim ? 0.45 : 0.15) + (hasReason ? 0.35 : 0.1) + lengthRatio * 0.2, [hasClaim ? "중심 주장으로 볼 수 있는 표현이 있습니다." : "중심 주장이 분명하지 않습니다."], "중심생각과 이유의 분리 여부를 확인했습니다."),
    buildDimensionScore(2, (hasEvidence ? 0.32 : 0.08) + (hasReason ? 0.23 : 0.08) + (hasArgumentLink(essay) ? 0.3 : 0.1) + lengthRatio * 0.15, [hasEvidence ? "사례 또는 자료형 근거가 확인됩니다." : "구체적 근거가 부족합니다."], "근거 자체와 주장-근거 연결 설명을 함께 보았습니다."),
    buildDimensionScore(3, hasCounterargument ? 0.75 : 0.3, [hasCounterargument ? "반론 또는 제한 조건을 언급했습니다." : "반론이나 다른 관점 검토가 부족합니다."], "반론 제시와 재반박 가능성을 확인했습니다."),
    buildDimensionScore(4, Math.min(1, (paragraphs.length >= 3 ? 0.55 : paragraphs.length === 2 ? 0.42 : 0.25) + Math.min(sentences.length / 7, 1) * 0.25 + lengthRatio * 0.2), [`문단 ${paragraphs.length}개, 문장 ${sentences.length}개입니다.`], "전체 구조와 문단 역할을 평가했습니다."),
    buildDimensionScore(5, (hasCoherence ? 0.7 : 0.38) + Math.min(sentences.length / 8, 1) * 0.25, [hasCoherence ? "연결 표현이 확인됩니다." : "문장과 문단을 잇는 표현이 부족합니다."], "연결어와 관점 유지 여부를 확인했습니다."),
    buildDimensionScore(6, expressionRatio(sentences, essay.length), [`평균 문장 길이는 약 ${sentences.length ? Math.round(essay.length / sentences.length) : essay.length}자입니다.`], "문장 표현과 기본 언어규범을 평가했습니다."),
  ];

  const errorPatterns = detectErrorPatterns({ hasClaim, hasReason, hasEvidence, hasCounterargument, paragraphs, essay });
  const totalScore = dimensionScores.reduce((sum, score) => sum + score.score, 0);
  const weakest = [...dimensionScores].sort((a, b) => a.score / a.max_score - b.score / b.max_score)[0];

  return {
    engine_version: evaluationEngineVersion,
    decision: minChars > 0 && essay.length < minChars * 0.45 ? "revision_requested" : "scored",
    total_score: totalScore,
    level: levelForScore(totalScore),
    dimension_scores: dimensionScores,
    strengths: buildStrengths({ hasClaim, hasReason, hasEvidence, hasCounterargument, hasCoherence }),
    improvement_points: buildImprovementPoints(errorPatterns),
    error_patterns: errorPatterns,
    feedback: {
      summary: buildFeedbackSummary(totalScore, errorPatterns),
      revision_steps: buildRevisionSteps(errorPatterns, paragraphs.length),
      model_sentence_examples: [
        "이 근거는 문제가 단순한 개인 선택이 아니라 생활 습관과 학습 환경 전체에 영향을 준다는 점을 보여 준다.",
      ],
    },
    next_learning_recommendation: {
      theory_category: weakest.competencies.includes("claim_evidence_link")
        ? "claim_evidence_link"
        : weakest.competencies[0] ?? request.metadata.theory_category,
      reason: `${weakest.dimension} 영역이 현재 글의 우선 보완 지점입니다.`,
    },
  };
}

function validateEvaluationRequest(request: WritingEvaluationRequest) {
  if (!request.metadata?.curriculum_code) throw new Error("metadata.curriculum_code is required");
  if (!request.metadata?.theory_category) throw new Error("metadata.theory_category is required");
  if (!request.metadata?.education_level) throw new Error("metadata.education_level is required");
  if (!request.task?.prompt) throw new Error("task.prompt is required");
  if (!request.submission?.learner_id) throw new Error("submission.learner_id is required");
  if (!request.submission?.essay_text) throw new Error("submission.essay_text is required");
}

function normalize(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

function splitSentences(value: string) {
  return value
    .split(/(?<=[.!?。！？])\s+|(?<=다\.)\s+|(?<=요\.)\s+/)
    .map((sentence) => sentence.trim())
    .filter(Boolean);
}

function includesAny(value: string, markers: string[]) {
  return markers.some((marker) => value.includes(marker));
}

function hasArgumentLink(value: string) {
  return /보여|의미|따라서|그러므로|때문에|뒷받침/.test(value);
}

function decideEvaluationState(essay: string, prompt: string): EvaluationDecision {
  if (essay.length < 20) return "dismissed";
  if (essay.length < 80) return "held";
  if (calculatePromptMatchRatio(prompt, essay) < 0.08) return "held";
  return "scored";
}

function calculatePromptMatchRatio(prompt: string, essay: string) {
  const terms = prompt
    .replace(/[^0-9A-Za-z가-힣ㄱ-ㅎㅏ-ㅣ\s]/g, " ")
    .split(/\s+/)
    .filter((term) => term.length >= 2)
    .slice(0, 8);
  if (terms.length === 0) return 0.7;
  return terms.filter((term) => essay.includes(term)).length / terms.length;
}

function buildDimensionScore(index: number, ratio: number, evidence: string[], comment: string) {
  const dimension = dimensions[index];
  return {
    dimension: dimension.dimension,
    competencies: [...dimension.competencies],
    score: Math.max(0, Math.min(dimension.maxScore, Math.round(dimension.maxScore * ratio))),
    max_score: dimension.maxScore,
    evidence,
    comment,
  };
}

function expressionRatio(sentences: string[], charCount: number) {
  if (sentences.length === 0) return 0.25;
  const avgLength = charCount / sentences.length;
  if (avgLength > 140) return 0.58;
  if (avgLength < 12) return 0.65;
  return 0.86;
}

function detectErrorPatterns(input: {
  hasClaim: boolean;
  hasReason: boolean;
  hasEvidence: boolean;
  hasCounterargument: boolean;
  paragraphs: string[];
  essay: string;
}): WritingEvaluationResult["error_patterns"] {
  const patterns: WritingEvaluationResult["error_patterns"] = [];
  if (!input.hasClaim) patterns.push(pattern("CLAIM_UNCLEAR", "high", "중심 주장 보완 지적", "글 전체를 이끄는 중심 주장이 분명하지 않습니다.", "주장 표현이 명시적으로 확인되지 않았습니다."));
  if (!input.hasReason) patterns.push(pattern("REASON_WEAK", "medium", "이유 보완 지적", "주장을 뒷받침하는 이유가 부족합니다.", "이유를 나타내는 표현이 부족합니다."));
  if (!input.hasEvidence) patterns.push(pattern("EVIDENCE_THIN", "medium", "근거 보완 지적", "구체적 사례나 자료가 부족합니다.", "사례, 자료, 경험 표현이 확인되지 않았습니다."));
  if (input.hasEvidence && !hasArgumentLink(input.essay)) patterns.push(pattern("ARG_LINK_WEAK", "medium", "주장-근거 연결 보완 지적", "근거가 왜 주장을 뒷받침하는지 설명이 부족합니다.", "근거 뒤 해석 문장이 약합니다."));
  if (!input.hasCounterargument) patterns.push(pattern("NO_COUNTERARGUMENT", "medium", "반론 보완 지적", "다른 관점이나 예상 반론을 검토하지 않았습니다.", "반론 표지가 확인되지 않았습니다."));
  if (input.paragraphs.length < 3) patterns.push(pattern("PARAGRAPH_MIXED", "low", "문단 보완 지적", "문단 구분이 부족해 구조가 덜 선명합니다.", `문단 수: ${input.paragraphs.length}`));
  return patterns.slice(0, 5);
}

function pattern(code: string, severity: "low" | "medium" | "high", label: string, message: string, evidence: string) {
  return { code, severity, label, message, evidence };
}

function buildNonScoredResult(request: WritingEvaluationRequest, decision: EvaluationDecision): WritingEvaluationResult {
  const dismissed = decision === "dismissed";
  return {
    engine_version: evaluationEngineVersion,
    decision,
    total_score: 0,
    level: dismissed ? "각하" : "평가 보류",
    dimension_scores: dimensions.map((dimension) => ({
      dimension: dimension.dimension,
      competencies: [...dimension.competencies],
      score: 0,
      max_score: dimension.maxScore,
      evidence: [dismissed ? "답안이 너무 짧아 평가 대상으로 보기 어렵습니다." : "논제 관련성 또는 평가 가능 분량이 부족합니다."],
      comment: dismissed ? "재작성 요청 후 다시 평가하세요." : "평가 보류 후 답안을 보완하도록 안내하세요.",
    })),
    strengths: [],
    improvement_points: [dismissed ? "답안을 완성된 문단 형태로 다시 작성해야 합니다." : "논제와 직접 관련된 주장, 이유, 근거를 추가해야 합니다."],
    error_patterns: [
      pattern(dismissed ? "DISMISSED_TOO_SHORT" : "HELD_LOW_RELEVANCE", "high", dismissed ? "각하" : "평가 보류", dismissed ? "평가 가능한 답안 분량이 아닙니다." : "논제 관련성 또는 평가 가능성이 낮습니다.", request.submission.essay_text.slice(0, 80)),
    ],
    feedback: {
      summary: dismissed ? "현재 답안은 각하 대상입니다. 한 문단 이상의 완성된 글로 다시 작성해야 합니다." : "현재 답안은 평가 보류 상태입니다. 논제와 연결되는 주장, 이유, 근거를 보완하세요.",
      revision_steps: ["중심 주장을 한 문장으로 쓰세요.", "주장을 뒷받침하는 이유와 근거를 각각 한 문장 이상 추가하세요."],
      model_sentence_examples: ["저는 이 문제에 대해 ~해야 한다고 생각합니다. 왜냐하면 ~이기 때문입니다."],
    },
    next_learning_recommendation: {
      theory_category: request.metadata.theory_category,
      reason: "완성된 답안 작성 후 세부 competency 평가를 진행할 수 있습니다.",
    },
  };
}

function levelForScore(score: number) {
  if (score >= 90) return "우수";
  if (score >= 75) return "보통";
  if (score >= 60) return "기초";
  return "보완 필요";
}

function buildStrengths(input: {
  hasClaim: boolean;
  hasReason: boolean;
  hasEvidence: boolean;
  hasCounterargument: boolean;
  hasCoherence: boolean;
}) {
  const strengths: string[] = [];
  if (input.hasClaim) strengths.push("중심 주장이 드러납니다.");
  if (input.hasReason) strengths.push("이유를 제시하려는 시도가 있습니다.");
  if (input.hasEvidence) strengths.push("사례나 자료형 근거를 사용했습니다.");
  if (input.hasCounterargument) strengths.push("다른 관점을 일부 고려했습니다.");
  if (input.hasCoherence) strengths.push("연결 표현으로 흐름을 만들었습니다.");
  return strengths.length ? strengths : ["논제와 관련된 글을 작성하려는 기본 시도가 있습니다."];
}

function buildImprovementPoints(patterns: WritingEvaluationResult["error_patterns"]) {
  return patterns.map((item) => item.message);
}

function buildFeedbackSummary(score: number, patterns: WritingEvaluationResult["error_patterns"]) {
  if (score >= 85) return "글의 기본 완성도가 높습니다. 근거 해석과 반론 처리를 더 정교하게 다듬으면 좋습니다.";
  if (patterns.some((item) => item.code === "CLAIM_UNCLEAR")) return "먼저 중심 주장을 한 문장으로 분명히 세우는 연습이 필요합니다.";
  return "글의 방향은 잡혀 있습니다. 주장, 근거, 연결 설명을 더 분명히 하면 설득력이 높아집니다.";
}

function buildRevisionSteps(patterns: WritingEvaluationResult["error_patterns"], paragraphCount: number) {
  const steps: string[] = [];
  if (patterns.some((item) => item.code === "CLAIM_UNCLEAR")) steps.push("첫 문단에 자신의 입장을 한 문장으로 추가하세요.");
  if (patterns.some((item) => item.code === "EVIDENCE_THIN")) steps.push("이유마다 사례, 자료, 경험 중 하나를 근거로 붙이세요.");
  if (patterns.some((item) => item.code === "ARG_LINK_WEAK")) steps.push("근거 뒤에 그 근거가 왜 주장을 뒷받침하는지 설명하세요.");
  if (patterns.some((item) => item.code === "NO_COUNTERARGUMENT")) steps.push("반대 의견을 한 문장으로 소개하고 그 한계를 설명하세요.");
  if (paragraphCount < 3) steps.push("서론, 본론, 결론이 보이도록 3문단 이상으로 나누세요.");
  return steps.length ? steps : ["각 문단의 첫 문장에 중심 내용을 분명히 쓰세요."];
}
