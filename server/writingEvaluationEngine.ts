export const evaluationEngineVersion = "1.1" as const;

export type EvaluationDecision = "scored" | "revision_requested" | "held" | "dismissed";
export type EducationLevel = "elementary" | "middle_high" | "high_univ" | "general_adult";
export type WritingType = "ARGUMENTATIVE" | "EXPLANATORY" | "REFLECTIVE" | "SUMMARY" | "CREATIVE";
export type AssessmentMode = "FREE_WRITING" | "ARGUMENTATIVE" | "DBQ" | "ANALYTICAL" | "IB_PERSONAL_SOCIETY" | "IB_SCIENCE";

export interface SourceDocument {
  source_id: string;
  title?: string;
  content: string;
  author_or_origin?: string;
  perspective?: string;
}

export interface WritingEvaluationRequest {
  metadata: {
    task_id?: string;
    curriculum_code: string;
    theory_category: string;
    education_level: EducationLevel;
    difficulty: number;
    writing_type: WritingType;
    assessment_mode?: AssessmentMode;
    rubric_profile?: string;
    subject?: string;
  };
  task: {
    prompt: string;
    assessment_mode?: AssessmentMode;
    constraints?: {
      min_chars?: number;
      max_chars?: number;
      required_elements?: string[];
      required_source_ids?: string[];
      citation_required?: boolean;
      minimum_source_count?: number;
    };
    source_documents?: SourceDocument[];
  };
  submission: {
    learner_id: string;
    essay_text: string;
    source_citations?: Array<{ source_id: string; excerpt?: string }>;
  };
}

export interface RubricDimension {
  dimension: string;
  competencies: string[];
  max_score: number;
}

export interface WritingEvaluationResult {
  engine_version: typeof evaluationEngineVersion;
  rubric_profile: string;
  decision: EvaluationDecision;
  total_score: number;
  level: string;
  dimension_scores: Array<RubricDimension & {
    score: number;
    evidence: string[];
    comment: string;
    confidence: "low" | "medium" | "high";
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
  evidence_audit: {
    source_count: number;
    cited_source_ids: string[];
    uncited_required_source_ids: string[];
    citation_required: boolean;
    source_use_score: number;
  };
  validation: {
    human_review_required: boolean;
    uncertainty: "low" | "medium" | "high";
    reasons: string[];
  };
  next_learning_recommendation: {
    theory_category: string;
    reason: string;
  };
}

const RUBRICS: Record<string, { id: string; dimensions: RubricDimension[] }> = {
  elementary: {
    id: "ELEMENTARY_40_30_30",
    dimensions: [
      { dimension: "내용의 풍부성", competencies: ["central_idea", "personal_detail", "experience_reflection"], max_score: 40 },
      { dimension: "글의 짜임", competencies: ["beginning_middle_end", "organization", "coherence"], max_score: 30 },
      { dimension: "표현과 맞춤법", competencies: ["sentence_expression", "language_conventions"], max_score: 30 },
    ],
  },
  middle_high: {
    id: "MIDDLE_20_30_30_20",
    dimensions: [
      { dimension: "주제의 명료성", competencies: ["central_claim", "task_understanding"], max_score: 20 },
      { dimension: "논리적 구성", competencies: ["macro_structure", "paragraphing", "coherence"], max_score: 30 },
      { dimension: "근거의 적절성", competencies: ["evidence_use", "claim_evidence_link", "logical_inference"], max_score: 30 },
      { dimension: "표현의 정확성", competencies: ["sentence_expression", "language_conventions"], max_score: 20 },
    ],
  },
  high_univ: {
    id: "HIGH_ANALYTICAL_25_25_25_25",
    dimensions: [
      { dimension: "내용 및 분석", competencies: ["task_understanding", "central_claim", "analysis"], max_score: 25 },
      { dimension: "증거 활용", competencies: ["evidence_use", "claim_evidence_link", "source_use"], max_score: 25 },
      { dimension: "구성 및 스타일", competencies: ["macro_structure", "coherence", "formal_style"], max_score: 25 },
      { dimension: "규칙 숙달도", competencies: ["language_conventions", "sentence_expression"], max_score: 25 },
    ],
  },
  general_adult: {
    id: "ADULT_PRACTICAL_25_25_25_25",
    dimensions: [
      { dimension: "목적과 핵심 메시지", competencies: ["task_understanding", "central_claim"], max_score: 25 },
      { dimension: "근거와 대안", competencies: ["evidence_use", "logical_inference", "solution"], max_score: 25 },
      { dimension: "구성 및 전달", competencies: ["macro_structure", "coherence", "audience_awareness"], max_score: 25 },
      { dimension: "표현 정확성", competencies: ["sentence_expression", "language_conventions"], max_score: 25 },
    ],
  },
  dbq: {
    id: "DBQ_TASK_SOURCE_REASONING_25_30_25_20",
    dimensions: [
      { dimension: "과제 및 역사적 맥락", competencies: ["task_understanding", "contextualization"], max_score: 25 },
      { dimension: "문서·출처 증거 활용", competencies: ["source_use", "citation", "perspective"], max_score: 30 },
      { dimension: "분석 및 논증", competencies: ["central_claim", "logical_inference", "outside_knowledge"], max_score: 25 },
      { dimension: "구성 및 결론", competencies: ["macro_structure", "coherence", "conclusion"], max_score: 20 },
    ],
  },
  analytical: {
    id: "ANALYTICAL_CONTENT_EVIDENCE_STYLE_CONVENTIONS",
    dimensions: [
      { dimension: "내용 및 분석", competencies: ["central_claim", "analysis", "task_understanding"], max_score: 25 },
      { dimension: "증거 활용 능력", competencies: ["evidence_use", "source_use", "claim_evidence_link"], max_score: 25 },
      { dimension: "일관성·구성·스타일", competencies: ["macro_structure", "coherence", "formal_style"], max_score: 25 },
      { dimension: "규칙 숙달도", competencies: ["language_conventions", "sentence_expression"], max_score: 25 },
    ],
  },
  ib_personal_society: {
    id: "IB_PERSONAL_SOCIETY_KNOWLEDGE_INQUIRY_COMMUNICATION_CRITICAL",
    dimensions: [
      { dimension: "지식과 이해", competencies: ["content_knowledge", "discipline_terms", "conceptual_understanding"], max_score: 25 },
      { dimension: "조사", competencies: ["research_question", "research_process", "source_evaluation"], max_score: 25 },
      { dimension: "의사소통", competencies: ["communication", "organization", "citation"], max_score: 25 },
      { dimension: "비판적 사고", competencies: ["analysis", "perspective", "evidence_based_conclusion"], max_score: 25 },
    ],
  },
  ib_science: {
    id: "IB_SCIENCE_KNOWLEDGE_INQUIRY_DATA_IMPACT",
    dimensions: [
      { dimension: "지식과 이해", competencies: ["content_knowledge", "discipline_terms", "conceptual_understanding"], max_score: 25 },
      { dimension: "탐구와 설계", competencies: ["research_question", "variables", "methodology"], max_score: 25 },
      { dimension: "자료 처리와 평가", competencies: ["data_presentation", "data_analysis", "limitations", "improvement"], max_score: 25 },
      { dimension: "과학적 영향 성찰", competencies: ["social_impact", "environmental_impact", "ethical_reasoning", "perspective"], max_score: 25 },
    ],
  },
};

export function getRubricProfile(request: WritingEvaluationRequest) {
  const mode = request.metadata.assessment_mode ?? request.task.assessment_mode;
  if (request.metadata.rubric_profile && RUBRICS[request.metadata.rubric_profile]) return RUBRICS[request.metadata.rubric_profile];
  if (mode === "DBQ") return RUBRICS.dbq;
  if (mode === "ANALYTICAL") return RUBRICS.analytical;
  if (mode === "IB_PERSONAL_SOCIETY") return RUBRICS.ib_personal_society;
  if (mode === "IB_SCIENCE") return RUBRICS.ib_science;
  return RUBRICS[request.metadata.education_level];
}

export function evaluateWriting(request: WritingEvaluationRequest): WritingEvaluationResult {
  validateEvaluationRequest(request);
  const profile = getRubricProfile(request);
  const essay = normalize(request.submission.essay_text);
  const sentences = splitSentences(essay);
  const paragraphs = request.submission.essay_text.split(/\n\s*\n/).map((item) => item.trim()).filter(Boolean);
  const mode = request.metadata.assessment_mode ?? request.task.assessment_mode ?? "FREE_WRITING";
  const decision = decideEvaluationState(essay, request.task.prompt, request.task.constraints?.min_chars);
  if (decision !== "scored") return buildNonScoredResult(request, profile.id, decision);

  const features = analyzeWriting(request, essay, sentences, paragraphs, mode);
  const dimensionScores = profile.dimensions.map((dimension) => scoreDimension(dimension, features, request));
  const totalScore = dimensionScores.reduce((sum, item) => sum + item.score, 0);
  const errors = detectErrorPatterns(features, mode);
  const weak = [...dimensionScores].sort((a, b) => a.score / a.max_score - b.score / b.max_score)[0];
  const sourceAudit = buildEvidenceAudit(request, features);
  const validation = buildValidation(features, sourceAudit, mode, dimensionScores, request.task.constraints?.minimum_source_count);
  const finalDecision = request.task.constraints?.min_chars && essay.length < request.task.constraints.min_chars * 0.45
    ? "revision_requested"
    : "scored";

  return {
    engine_version: evaluationEngineVersion,
    rubric_profile: profile.id,
    decision: finalDecision,
    total_score: totalScore,
    level: levelForScore(totalScore),
    dimension_scores: dimensionScores,
    strengths: buildStrengths(features),
    improvement_points: buildImprovementPoints(errors),
    error_patterns: errors,
    feedback: {
      summary: buildFeedbackSummary(totalScore, errors),
      revision_steps: buildRevisionSteps(errors, paragraphs.length, mode),
      model_sentence_examples: ["이 근거가 왜 주장을 뒷받침하는지 설명하고, 자료의 한계나 다른 관점도 함께 제시해 보세요."],
    },
    evidence_audit: sourceAudit,
    validation,
    next_learning_recommendation: {
      theory_category: weak?.competencies[0] ?? request.metadata.theory_category,
      reason: `${weak?.dimension ?? "평가"} 영역이 현재 글의 우선 보완 지점입니다.`,
    },
  };
}

type WritingFeatures = {
  essay: string;
  sentences: string[];
  paragraphs: string[];
  mode: AssessmentMode;
  hasClaim: boolean;
  hasReason: boolean;
  hasEvidence: boolean;
  hasCounterargument: boolean;
  hasConclusion: boolean;
  hasCoherence: boolean;
  hasResearchQuestion: boolean;
  hasVariables: boolean;
  hasData: boolean;
  hasImpact: boolean;
  sourceIds: string[];
  citedSourceIds: string[];
  sourceUseScore: number;
  promptMatchRatio: number;
};

function analyzeWriting(request: WritingEvaluationRequest, essay: string, sentences: string[], paragraphs: string[], mode: AssessmentMode): WritingFeatures {
  const sourceIds = (request.task.source_documents ?? []).map((source) => source.source_id);
  const citedSourceIds = unique([
    ...((request.submission.source_citations ?? []).map((citation) => citation.source_id)),
    ...(sourceIds.filter((id) => new RegExp(`(?:문서|자료|출처|source)\\s*${escapeRegExp(id)}`, "i").test(essay))),
  ]);
  return {
    essay,
    sentences,
    paragraphs,
    mode,
    hasClaim: detectClaim(essay),
    hasReason: includesAny(essay, ["왜냐하면", "때문", "이유", "따라서", "근거", "이유는"]),
    hasEvidence: includesAny(essay, ["예를 들어", "사례", "경험", "자료", "통계", "연구", "인용", "문서", "출처", "실험"]),
    hasCounterargument: includesAny(essay, ["물론", "반면", "하지만", "그러나", "다른 관점", "반대 의견", "한계"]),
    hasConclusion: includesAny(essay, ["결론적으로", "따라서", "결국", "이상으로", "종합하면"]),
    hasCoherence: includesAny(essay, ["먼저", "또한", "그러나", "하지만", "따라서", "결론적으로", "반면"]),
    hasResearchQuestion: /연구s*질문|탐구s*질문|무엇이|어떻게|왜/.test(essay),
    hasVariables: /독립s*변인|종속s*변인|통제s*변인|변인/.test(essay),
    hasData: /표|그래프|수치|데이터|측정|평균|비율|결과/.test(essay),
    hasImpact: /사회|환경|윤리|책임|영향|지속s*가능/.test(essay),
    sourceIds,
    citedSourceIds,
    sourceUseScore: sourceIds.length ? Math.round((citedSourceIds.length / sourceIds.length) * 100) : (includesAny(essay, ["사례", "자료", "경험", "연구"]) ? 65 : 20),
    promptMatchRatio: calculatePromptMatchRatio(request.task.prompt, essay),
  };
}

function scoreDimension(dimension: RubricDimension, features: WritingFeatures, request: WritingEvaluationRequest) {
  const competencyScores: Record<string, number> = {
    task_understanding: features.promptMatchRatio,
    central_idea: features.hasClaim ? 0.8 : 0.3,
    central_claim: features.hasClaim ? 0.82 : 0.25,
    personal_detail: Math.min(1, (features.hasEvidence ? 0.55 : 0.2) + (features.essay.length > 250 ? 0.35 : 0)),
    experience_reflection: features.hasReason ? 0.75 : 0.25,
    beginning_middle_end: features.paragraphs.length >= 3 ? 0.9 : 0.45,
    macro_structure: Math.min(1, (features.paragraphs.length >= 3 ? 0.65 : 0.35) + (features.hasConclusion ? 0.25 : 0)),
    paragraphing: features.paragraphs.length >= 3 ? 0.9 : 0.45,
    coherence: features.hasCoherence ? 0.78 : 0.38,
    evidence_use: features.hasEvidence ? 0.72 : 0.2,
    claim_evidence_link: features.hasReason && features.hasEvidence ? 0.75 : 0.3,
    logical_inference: features.hasReason && features.hasConclusion ? 0.75 : 0.35,
    language_conventions: expressionRatio(features.sentences, features.essay.length),
    sentence_expression: expressionRatio(features.sentences, features.essay.length),
    source_use: features.sourceUseScore / 100,
    citation: features.sourceIds.length ? features.sourceUseScore / 100 : 0.3,
    perspective: features.hasCounterargument ? 0.8 : 0.35,
    analysis: features.hasReason && features.hasEvidence ? 0.7 : 0.3,
    conclusion: features.hasConclusion ? 0.85 : 0.3,
    formal_style: features.essay.length > 120 ? 0.78 : 0.45,
    research_question: features.hasResearchQuestion ? 0.8 : 0.25,
    research_process: features.hasEvidence ? 0.65 : 0.2,
    source_evaluation: features.hasCounterargument ? 0.65 : 0.25,
    communication: features.hasCoherence ? 0.8 : 0.4,
    evidence_based_conclusion: features.hasEvidence && features.hasConclusion ? 0.8 : 0.3,
    content_knowledge: features.hasEvidence ? 0.68 : 0.3,
    discipline_terms: request.metadata.subject && features.hasEvidence ? 0.7 : 0.3,
    conceptual_understanding: features.hasReason ? 0.7 : 0.3,
    variables: features.hasVariables ? 0.8 : 0.2,
    methodology: features.hasVariables && features.hasReason ? 0.7 : 0.25,
    data_presentation: features.hasData ? 0.8 : 0.2,
    data_analysis: features.hasData && features.hasReason ? 0.7 : 0.25,
    limitations: features.hasCounterargument ? 0.7 : 0.2,
    improvement: features.hasCounterargument ? 0.65 : 0.2,
    social_impact: features.hasImpact ? 0.75 : 0.2,
    environmental_impact: /환경|생태|기후/.test(features.essay) ? 0.75 : 0.2,
    ethical_reasoning: /윤리|책임|공정|권리/.test(features.essay) ? 0.75 : 0.2,
    audience_awareness: features.hasClaim ? 0.7 : 0.35,
    solution: features.hasReason && features.hasConclusion ? 0.7 : 0.25,
  };
  const ratio = dimension.competencies.reduce((sum, competency) => sum + (competencyScores[competency] ?? 0.3), 0) / dimension.competencies.length;
  const evidence = buildDimensionEvidence(dimension, features);
  return { ...dimension, score: Math.max(0, Math.min(dimension.max_score, Math.round(dimension.max_score * ratio))), evidence, comment: `${dimension.dimension} 기준의 핵심 요소 ${dimension.competencies.join(", ")}를 확인했습니다.`, confidence: features.essay.length >= 240 ? "medium" as const : "low" as const };
}

function buildDimensionEvidence(dimension: RubricDimension, features: WritingFeatures) {
  const evidence = [`문장 ${features.sentences.length}개, 문단 ${features.paragraphs.length}개`];
  if (dimension.competencies.includes("source_use")) evidence.push(`인용·참조 자료 ${features.citedSourceIds.length}/${features.sourceIds.length}개 확인`);
  if (dimension.competencies.includes("central_claim")) evidence.push(features.hasClaim ? "중심 주장 표현 확인" : "명시적 중심 주장 미확인");
  if (dimension.competencies.includes("conclusion")) evidence.push(features.hasConclusion ? "결론 표현 확인" : "결론 표현 미확인");
  return evidence;
}

function buildEvidenceAudit(request: WritingEvaluationRequest, features: WritingFeatures): WritingEvaluationResult["evidence_audit"] {
  const required = request.task.constraints?.required_source_ids ?? [];
  return {
    source_count: features.sourceIds.length,
    cited_source_ids: features.citedSourceIds,
    uncited_required_source_ids: required.filter((id) => !features.citedSourceIds.includes(id)),
    citation_required: Boolean(request.task.constraints?.citation_required),
    source_use_score: features.sourceUseScore,
  };
}

function buildValidation(features: WritingFeatures, audit: WritingEvaluationResult["evidence_audit"], mode: AssessmentMode, dimensions: WritingEvaluationResult["dimension_scores"], minimumSourceCount?: number): WritingEvaluationResult["validation"] {
  const reasons: string[] = [];
  if (features.essay.length < 180) reasons.push("평가 텍스트가 짧아 신뢰도가 낮습니다.");
  if (mode === "DBQ" && audit.uncited_required_source_ids.length > 0) reasons.push("필수 문서가 충분히 인용되지 않았습니다.");
  if (typeof minimumSourceCount === "number" && audit.cited_source_ids.length < minimumSourceCount) reasons.push(`최소 ${minimumSourceCount}개 자료를 활용해야 합니다.`);
  if (mode === "IB_SCIENCE" && !features.hasData) reasons.push("자료 처리나 데이터 근거가 확인되지 않았습니다.");
  if (dimensions.some((dimension) => dimension.confidence === "low")) reasons.push("일부 차원의 근거가 제한적입니다.");
  return { human_review_required: reasons.length > 0 || audit.citation_required && audit.source_use_score < 60, uncertainty: reasons.length >= 2 ? "high" : reasons.length ? "medium" : "low", reasons };
}

function detectErrorPatterns(features: WritingFeatures, mode: AssessmentMode): WritingEvaluationResult["error_patterns"] {
  const patterns: WritingEvaluationResult["error_patterns"] = [];
  if (!features.hasClaim) patterns.push(pattern("CLAIM_UNCLEAR", "high", "중심 주장 보완 지적", "글 전체를 이끄는 중심 주장이 분명하지 않습니다.", "중심 주장을 확인할 수 있는 표현이 부족합니다."));
  if (!features.hasReason) patterns.push(pattern("REASON_WEAK", "medium", "이유·추론 보완 지적", "주장을 뒷받침하는 이유와 추론이 부족합니다.", "이유 또는 인과 설명이 부족합니다."));
  if (!features.hasEvidence) patterns.push(pattern("EVIDENCE_THIN", "medium", "근거 보완 지적", "구체적 사례·자료·관찰 근거가 부족합니다.", "근거를 확인할 수 있는 자료 표현이 부족합니다."));
  if (features.hasEvidence && !features.hasReason) patterns.push(pattern("ARG_LINK_WEAK", "medium", "주장-근거 연결 보완 지적", "근거가 왜 주장을 뒷받침하는지 설명이 부족합니다.", "근거 뒤의 해석 문장이 약합니다."));
  if (["DBQ", "ANALYTICAL", "IB_PERSONAL_SOCIETY", "IB_SCIENCE"].includes(mode) && !features.hasCounterargument) patterns.push(pattern("PERSPECTIVE_LIMITED", "medium", "관점·한계 보완 지적", "다른 관점이나 자료의 한계를 검토하지 않았습니다.", "반론·한계·관점 전환 표현이 부족합니다."));
  if (!features.hasConclusion && mode !== "FREE_WRITING") patterns.push(pattern("CONCLUSION_MISSING", "low", "결론 보완 지적", "분석을 정리하는 결론이 분명하지 않습니다.", "결론 표현이 확인되지 않았습니다."));
  return patterns.slice(0, 6);
}

function buildStrengths(features: WritingFeatures) {
  return [
    features.hasClaim ? "중심 생각 또는 주장이 확인됩니다." : "",
    features.hasEvidence ? "사례·자료·경험을 활용하려는 시도가 있습니다." : "",
    features.hasCoherence ? "문장과 문단을 연결하는 표현이 사용되었습니다." : "",
    features.hasConclusion ? "글을 정리하는 결론이 있습니다." : "",
  ].filter(Boolean).slice(0, 3);
}

function buildImprovementPoints(errors: WritingEvaluationResult["error_patterns"]) {
  return errors.map((error) => error.message).slice(0, 4);
}

function buildFeedbackSummary(score: number, errors: WritingEvaluationResult["error_patterns"]) {
  return errors.length ? `현재 점수는 ${score}점이며, ${errors[0].label}부터 보완하면 글의 설득력이 높아집니다.` : `현재 점수는 ${score}점이며, 핵심 주장과 근거의 연결이 안정적으로 드러납니다.`;
}

function buildRevisionSteps(errors: WritingEvaluationResult["error_patterns"], paragraphCount: number, mode: AssessmentMode) {
  const steps = errors.slice(0, 3).map((error) => error.message);
  if (paragraphCount < 3 && mode !== "FREE_WRITING") steps.push("서론·전개·정리의 역할이 드러나도록 문단을 나누세요.");
  return steps.length ? steps : ["가장 중요한 근거를 한 가지 골라 그 근거가 주장을 뒷받침하는 이유를 한 문장으로 덧붙이세요."];
}

function decideEvaluationState(essay: string, prompt: string, minChars?: number): EvaluationDecision {
  if (essay.length < 20) return "dismissed";
  if (minChars && essay.length < minChars * 0.25) return "held";
  if (calculatePromptMatchRatio(prompt, essay) < 0.08) return "held";
  return "scored";
}

function buildNonScoredResult(request: WritingEvaluationRequest, rubricProfile: string, decision: EvaluationDecision): WritingEvaluationResult {
  return {
    engine_version: evaluationEngineVersion,
    rubric_profile: rubricProfile,
    decision,
    total_score: 0,
    level: "평가 보류",
    dimension_scores: [],
    strengths: [],
    improvement_points: [decision === "dismissed" ? "평가할 수 있는 글의 분량이 부족합니다." : "논제와의 관련성을 확인할 수 있도록 글을 보완해 주세요."],
    error_patterns: [pattern("INSUFFICIENT_RESPONSE", "high", "평가 보류", "현재 답안만으로는 신뢰할 만한 평가가 어렵습니다.", "분량 또는 논제 관련성이 부족합니다.")],
    feedback: { summary: "현재 답안은 신뢰할 만한 점수 산출보다 재작성 안내가 우선입니다.", revision_steps: ["논제에 대한 중심 생각과 이유를 포함해 내용을 보완해 주세요."], model_sentence_examples: [] },
    evidence_audit: { source_count: request.task.source_documents?.length ?? 0, cited_source_ids: [], uncited_required_source_ids: request.task.constraints?.required_source_ids ?? [], citation_required: Boolean(request.task.constraints?.citation_required), source_use_score: 0 },
    validation: { human_review_required: true, uncertainty: "high", reasons: ["평가 입력이 충분하지 않습니다."] },
    next_learning_recommendation: { theory_category: request.metadata.theory_category, reason: "평가 가능한 분량과 논제 관련성을 먼저 확보해야 합니다." },
  };
}

function validateEvaluationRequest(request: WritingEvaluationRequest) {
  if (!request.metadata?.curriculum_code) throw new Error("metadata.curriculum_code is required");
  if (!request.metadata?.theory_category) throw new Error("metadata.theory_category is required");
  if (!request.metadata?.education_level) throw new Error("metadata.education_level is required");
  if (!request.task?.prompt) throw new Error("task.prompt is required");
  if (!request.submission?.learner_id) throw new Error("submission.learner_id is required");
  if (!request.submission?.essay_text) throw new Error("submission.essay_text is required");
  if (request.task.constraints?.required_source_ids?.some((id) => !(request.task.source_documents ?? []).some((source) => source.source_id === id))) throw new Error("required_source_ids must exist in source_documents");
}

function normalize(value: string) { return value.replace(/\s+/g, " ").trim(); }

function splitSentences(value: string) { return value.split(/(?<=[.!?。！？])\s+|(?<=다\.)\s+|(?<=요\.)\s+/).map((sentence) => sentence.trim()).filter(Boolean); }

function detectClaim(value: string) { return /생각|주장|해야|필요|옳|반대|찬성|결론|따라서|라고 본다|라고 할 수/.test(value); }

function includesAny(value: string, markers: string[]) { return markers.some((marker) => value.includes(marker)); }

function calculatePromptMatchRatio(prompt: string, essay: string) {
  const terms = prompt.replace(/[^0-9A-Za-z가-힣ㄱ-ㅎㅏ-ㅣ\s]/g, " ").split(/\s+/).filter((term) => term.length >= 2).filter((term) => !["논술하시오", "대해", "자신의", "생각을"].includes(term)).slice(0, 8);
  if (!terms.length) return 0.7;
  return terms.filter((term) => essay.includes(term)).length / terms.length;
}

function expressionRatio(sentences: string[], charCount: number) {
  if (!sentences.length) return 0.25;
  const avgLength = charCount / sentences.length;
  if (avgLength > 180 || avgLength < 10) return 0.58;
  return 0.82;
}

function pattern(code: string, severity: "low" | "medium" | "high", label: string, message: string, evidence: string) { return { code, severity, label, message, evidence }; }

function levelForScore(score: number) { if (score >= 85) return "탁월"; if (score >= 70) return "성취"; if (score >= 55) return "발전 중"; return "기초 보완"; }

function escapeRegExp(value: string) { return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"); }

function unique(values: string[]) { return Array.from(new Set(values)); }
