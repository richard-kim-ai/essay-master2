import { afterEach, describe, expect, it, vi } from "vitest";
import { getHumanEvaluationQualityMetrics } from "./evaluationMetrics";
import { validateExternalEvaluationEndpoint } from "./evaluationModelRegistry";
import { evaluateWritingHeuristic, evaluateWritingWithExternalModel, getHumanReviewReasons } from "./writingCorrectionEngine";
import { simulateEvaluationLearning, summarizeSimulationQuality } from "./writingEvaluationSimulation";

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
