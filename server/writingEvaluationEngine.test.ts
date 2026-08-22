import { describe, expect, it } from "vitest";
import { evaluateWriting, getRubricProfile, type WritingEvaluationRequest } from "./writingEvaluationEngine";
import { pearsonCorrelation, quadraticWeightedKappa, recallAtThreshold } from "./evaluationMetrics";

const baseRequest = (overrides: Partial<WritingEvaluationRequest> = {}): WritingEvaluationRequest => ({
  metadata: {
    curriculum_code: "TEST_WRITING",
    theory_category: "claim_evidence_link",
    education_level: "middle_high",
    difficulty: 3,
    writing_type: "ARGUMENTATIVE",
    ...overrides.metadata,
  },
  task: {
    prompt: "청소년의 스마트폰 사용을 제한해야 하는지 논술하시오.",
    ...overrides.task,
  },
  submission: {
    learner_id: "student-1",
    essay_text: "청소년의 스마트폰 사용은 제한해야 한다. 사용 시간이 길어지면 학습과 수면에 영향을 줄 수 있기 때문이다. 예를 들어 학교생활에서 집중력이 낮아질 수 있다. 따라서 시간과 목적을 정해 사용하는 것이 좋다.",
    ...overrides.submission,
  },
});

describe("writingEvaluationEngine v1.1", () => {
  it("calculates human-score quality metrics", () => {
    expect(pearsonCorrelation([20, 50, 80], [20, 55, 75])).toBeGreaterThan(0.9);
    expect(quadraticWeightedKappa([20, 50, 80], [20, 55, 75])).toBeGreaterThan(0.9);
    expect(recallAtThreshold([40, 70, 90], [50, 80, 55], 60)).toBe(0.5);
  });
  it("selects age-appropriate rubric weights", () => {
    expect(getRubricProfile(baseRequest({ metadata: { education_level: "elementary" } })).id).toBe("ELEMENTARY_40_30_30");
    expect(getRubricProfile(baseRequest({ metadata: { education_level: "middle_high" } })).dimensions.map((item) => item.max_score)).toEqual([20, 30, 30, 20]);
    expect(getRubricProfile(baseRequest({ metadata: { education_level: "high_univ" } })).dimensions.map((item) => item.max_score)).toEqual([25, 25, 25, 25]);
  });

  it("uses DBQ source audit and requires human review when required documents are missing", () => {
    const result = evaluateWriting(baseRequest({
      metadata: { assessment_mode: "DBQ" },
      task: {
        assessment_mode: "DBQ",
        source_documents: [
          { source_id: "D1", title: "Document 1", content: "A historical source" },
          { source_id: "D2", title: "Document 2", content: "Another historical source" },
        ],
        constraints: { required_source_ids: ["D1", "D2"], citation_required: true, minimum_source_count: 2 },
      },
      submission: {
        essay_text: "청소년의 스마트폰 사용은 제한해야 한다. 문서 1의 사례는 학습 환경의 변화를 보여 준다. 따라서 제한이 필요하다.",
        source_citations: [{ source_id: "D1" }],
      },
    }));

    expect(result.rubric_profile).toBe("DBQ_TASK_SOURCE_REASONING_25_30_25_20");
    expect(result.evidence_audit.uncited_required_source_ids).toEqual(["D2"]);
    expect(result.validation.human_review_required).toBe(true);
  });

  it("keeps insufficient responses out of summative scoring", () => {
    const result = evaluateWriting(baseRequest({ submission: { essay_text: "모르겠습니다." } }));
    expect(result.decision).toBe("dismissed");
    expect(result.total_score).toBe(0);
    expect(result.validation.human_review_required).toBe(true);
  });
});
