import { afterEach, describe, expect, it, vi } from "vitest";
import { getHumanEvaluationQualityMetrics } from "./evaluationMetrics";
import { validateExternalEvaluationEndpoint } from "./evaluationModelRegistry";
import { evaluateWritingHeuristic, evaluateWritingWithExternalModel, getHumanReviewReasons } from "./writingCorrectionEngine";
import { simulateEvaluationLearning, summarizeSimulationQuality } from "./writingEvaluationSimulation";
import { evaluateWritingWithLLM } from "./writingEvaluationEngine";
import { invokeLLM } from "./_core/llm";

vi.mock("./_core/llm", () => ({ invokeLLM: vi.fn() }));

const request = { essayTitle: "학교 급식", essayContent: "학교 급식은 학생 건강에 중요하다. 따라서 영양 기준을 공개해야 한다.", courseType: "middle_high" as const, level: 1 };
const connection = { modelId: "commercial-test", endpoint: "https://api.example.com/v1/chat/completions", allowedDomains: ["api.example.com"], apiKey: "test-key", timeoutMs: 2000 };

afterEach(() => vi.unstubAllGlobals());

describe("상용 글쓰기 첨삭 엔진", () => {
  it("정상 모델 응답을 문장별 비교와 completed 상태로 정규화한다", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify({ structureScore: 82, logicScore: 81, expressionScore: 84, overallScore: 82, strengths: ["주장이 분명합니다."], weaknesses: ["근거를 보강하세요."], suggestions: ["통계 근거를 추가하세요."], overallComment: "논증 방향이 적절합니다.", revisedEssay: "학교 급식은 학생 건강에 중요하므로 영양 기준을 공개해야 한다.", confidence: 0.86, sentenceCorrections: [{ original: "학교 급식은 학생 건강에 중요하다.", revised: "학교 급식은 학생 건강과 직결된다.", reason: "표현을 더 구체적으로 다듬었습니다.", competency: "expression", status: "changed" }] }) } }], usage: { total_tokens: 321 } }), { status: 200 })));
    const result = await evaluateWritingWithExternalModel(request, connection);
    expect(result.correction_status).toBe("completed");
    expect(result.fallback_used).toBe(false);
    expect(result.sentenceCorrections[0].competency).toBe("expression");
    expect(result.token_usage).toBe(321);
  });

  it("잘못된 JSON 모델 응답은 원문을 보존한 fallback으로 표시한다", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({ choices: [{ message: { content: "not-json" } }] }), { status: 200 })));
    const result = await evaluateWritingWithExternalModel(request, connection);
    expect(result.correction_status).toBe("fallback");
    expect(result.fallback_used).toBe(true);
    expect(result.revisedEssay).toBe(request.essayContent);
    expect(result.provider_error).toBe("PROVIDER_INVALID_JSON");
  });

  it("사설 주소를 외부 첨삭 Endpoint로 사용하지 못하게 막는다", () => {
    expect(validateExternalEvaluationEndpoint("http://api.example.com/v1", ["api.example.com"]).valid).toBe(false);
    expect(validateExternalEvaluationEndpoint("https://127.0.0.1/v1", ["127.0.0.1"]).valid).toBe(false);
    expect(validateExternalEvaluationEndpoint("https://api.example.com/v1", ["api.example.com"]).valid).toBe(true);
  });

  it("저신뢰·폴백·큰 점수 차이는 검수 큐 사유로 분류한다", () => {
    const fallback = evaluateWritingHeuristic(request);
    const reasons = getHumanReviewReasons(fallback, 90, true);
    expect(reasons).toContain("low_confidence");
    expect(reasons).toContain("fallback_used");
    expect(reasons).toContain("source_verification_failed");
  });

  it("배치 시뮬레이션은 기본적으로 비용 없는 휴리스틱을 사용한다", async () => {
    const results = await simulateEvaluationLearning([request]);
    expect(results).toHaveLength(1);
    expect(results[0].model_id).toBe("heuristic");
    expect(results[0].fallback_used).toBe(true);
  });

  it("인간 채점 표본이 있는 시뮬레이션은 공식 지표 여부를 함께 요약한다", () => {
    const metrics = summarizeSimulationQuality([{ ...request, humanScore: 82 }, { ...request, humanScore: 70 }], [81, 72]);
    expect(metrics.sampleCount).toBe(2);
    expect(metrics.isOfficial).toBe(false);
  });
});

describe("인간 채점 품질 지표", () => {
  it("QWK·Pearson·임계값 recall과 표본 부족 경고를 함께 제공한다", () => {
    const metrics = getHumanEvaluationQualityMetrics([{ humanScore: 80, modelScore: 78 }, { humanScore: 60, modelScore: 62 }, { humanScore: 90, modelScore: 88 }]);
    expect(metrics.quadraticWeightedKappa).not.toBeNull();
    expect(metrics.pearsonCorrelation).not.toBeNull();
    expect(metrics.thresholdRecall).toBe(1);
    expect(metrics.isOfficial).toBe(false);
    expect(metrics.sampleWarning).toContain("30건 미만");
  });
});

const semanticRequest = { metadata: { title: "학교 급식", course_type: "middle_high", level: 1 }, task: "학교 급식의 영양 기준 공개 필요성을 주장하시오.", submission: { essay_text: "학교 급식은 학생 건강에 중요하다. 영양 기준을 공개하면 학생과 학부모가 식단을 이해하고 개선점을 제안할 수 있다." } };
const semanticPayload = { engine_version: "1.1", decision: "scored", total_score: 82, level: "우수", dimension_scores: Array.from({ length: 12 }, (_, index) => ({ competency: `competency_${index}`, score: 82, evidence: "답안에서 확인되는 근거입니다." })), strengths: ["주장이 분명합니다."], improvement_points: ["근거를 더 구체화할 수 있습니다."], error_patterns: [], feedback: { summary: "논제에 맞는 주장이 드러납니다.", revision_steps: ["구체적인 자료를 보강하세요."], model_sentence_examples: ["영양 기준을 공개하면 개선 논의가 가능해집니다."] }, next_learning_recommendation: { theory_category: "근거 제시", reason: "주장을 뒷받침하는 근거를 확장해 보세요." } };

describe("Master Prompt 의미론 평가", () => {
  it("정상 JSON 응답을 12개 competency 점수와 피드백으로 정규화한다", async () => {
    vi.mocked(invokeLLM).mockResolvedValueOnce({ choices: [{ message: { content: JSON.stringify(semanticPayload) } }], usage: { total_tokens: 444 } } as never);
    const result = await evaluateWritingWithLLM(semanticRequest);
    expect(result.decision).toBe("scored");
    expect(result.dimension_scores).toHaveLength(12);
    expect(result.fallback_used).toBe(false);
    expect(result.token_usage).toBe(444);
  });

  it("모델이 객체형 competency와 한국어 판정을 반환해도 표준 계약으로 정규화한다", async () => {
    const dimensions = Object.fromEntries(Array.from({ length: 12 }, (_, index) => [
      `competency_${index}`,
      { score: 4, evidence: "답안에서 확인되는 근거입니다." },
    ]));
    vi.mocked(invokeLLM).mockResolvedValueOnce({ choices: [{ message: { content: JSON.stringify({
      engine_version: "Essay Master v1.1", decision: "재작성 요청", total_score: 72, level: "초급",
      dimension_scores: dimensions, strengths: ["주장이 드러납니다."], improvement_points: ["근거를 보강하세요."], error_patterns: [],
      feedback: { summary: "보완할 점이 있습니다.", revision_steps: ["자료를 추가하세요."], model_sentence_examples: ["구체적인 자료를 제시할 수 있습니다."] },
      next_learning_recommendation: { theory_category: "근거 제시", reason: "주장을 뒷받침하는 자료를 확인하세요." },
    }) } }], usage: { total_tokens: 555 } } as never);
    const result = await evaluateWritingWithLLM(semanticRequest);
    expect(result.decision).toBe("revision_requested");
    expect(result.dimension_scores).toHaveLength(12);
    expect(result.dimension_scores[0].score).toBe(80);
    expect(result.fallback_used).toBe(false);
  });

  it("JSON 파싱 실패는 휴리스틱 결과로 폴백한다", async () => {
    vi.mocked(invokeLLM).mockResolvedValueOnce({ choices: [{ message: { content: "not-json" } }] } as never);
    const result = await evaluateWritingWithLLM(semanticRequest);
    expect(result.fallback_used).toBe(true);
    expect(result.provider_error).toContain("Unexpected token");
  });

  it("응답 형식이 맞지 않으면 문제 항목과 받은 키 이름만 사유로 남기고 응답 내용은 남기지 않는다", async () => {
    const wrongShape = { evaluation: "SECRET-본문-내용", strengths: ["좋은 점"], weaknesses: ["아쉬운 점"], score: 70 };
    vi.mocked(invokeLLM).mockResolvedValueOnce({ choices: [{ message: { content: JSON.stringify(wrongShape) } }] } as never);
    const result = await evaluateWritingWithLLM(semanticRequest);
    expect(result.fallback_used).toBe(true);
    expect(result.provider_error).toMatch(/^LLM_INVALID_EVALUATION_CONTRACT \(invalid: /);
    for (const field of ["decision", "total_score", "dimension_scores", "improvement_points", "feedback.summary", "next_learning_recommendation.reason"]) expect(result.provider_error).toContain(field);
    expect(result.provider_error).toContain("received: evaluation, strengths, weaknesses, score");
    expect(result.provider_error).not.toContain("SECRET");
    expect(result.provider_error).not.toContain("좋은 점");
  });

  it("competency 항목 하나만 잘못돼도 몇 번째 항목의 어느 칸인지 알려 준다", async () => {
    const broken = { ...semanticPayload, dimension_scores: semanticPayload.dimension_scores.map((row, index) => (index === 3 ? { ...row, evidence: "" } : row)) };
    vi.mocked(invokeLLM).mockResolvedValueOnce({ choices: [{ message: { content: JSON.stringify(broken) } }] } as never);
    const result = await evaluateWritingWithLLM(semanticRequest);
    expect(result.fallback_used).toBe(true);
    expect(result.provider_error).toContain("dimension_scores[3].evidence");
    expect(result.provider_error).not.toContain("dimension_scores[0]");
  });

  it("짧은 답안은 LLM 호출 없이 held로 반환한다", async () => {
    vi.mocked(invokeLLM).mockClear();
    const result = await evaluateWritingWithLLM({ ...semanticRequest, submission: { essay_text: "짧은 답" } });
    expect(result.decision).toBe("held");
    expect(result.fallback_used).toBe(false);
    expect(invokeLLM).not.toHaveBeenCalled();
  });
});
