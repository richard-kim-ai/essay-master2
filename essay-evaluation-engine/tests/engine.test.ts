import { describe, expect, it } from "vitest";
import {
  applyLinearCalibration,
  createEssayEvaluationEngine,
  essayMasterRubric,
  extractWritingFeatures,
  findModelDescriptors,
  fitLinearCalibration,
  normalizeAihubScore,
} from "../src";

describe("essay evaluation engine", () => {
  it("extracts Korean writing features", () => {
    const features = extractWritingFeatures({
      language: "ko",
      taskType: "essay_master",
      prompt: "학교 내 휴대전화 사용에 대한 견해를 쓰시오.",
      essay: "학교 안 휴대전화 사용은 장점과 단점이 있다. 예를 들어 정보 검색에는 도움이 된다.\n\n그러나 수업 집중을 해칠 수 있다. 따라서 공동 규칙이 필요하다.",
    });

    expect(features.sentenceCount).toBeGreaterThanOrEqual(3);
    expect(features.paragraphCount).toBe(2);
    expect(features.evidenceMarkerCount).toBeGreaterThan(0);
  });

  it("evaluates an essay with the default Essay Master rubric", async () => {
    const engine = createEssayEvaluationEngine({ rubric: essayMasterRubric });
    const result = await engine.evaluate({
      language: "ko",
      taskType: "essay_master",
      prompt: "학교 내 휴대전화 사용에 대한 견해를 쓰시오.",
      essay: "학교 안 휴대전화 사용은 정보 검색을 도울 수 있다. 예를 들어 모르는 낱말을 바로 확인할 수 있다.\n\n그러나 수업 중 알림과 게임은 집중을 방해한다. 따라서 학교는 완전 금지보다 수업 목적 사용과 쉬는 시간 사용을 구분하는 공동 규칙을 정해야 한다.",
    });

    expect(result.rubricId).toBe("essay_master_korean_v1");
    expect(result.totalScore).toBeGreaterThan(0);
    expect(result.criterionScores.length).toBe(essayMasterRubric.criteria.length);
  });

  it("normalizes AIHub style scores", () => {
    expect(normalizeAihubScore(4, 5, 100)).toBe(80);
    expect(normalizeAihubScore(7, 5, 100)).toBe(100);
  });

  it("finds Korean model adapters by task", () => {
    const models = findModelDescriptors({ language: "ko", taskType: "korean_school_essay" });

    expect(models.length).toBeGreaterThanOrEqual(3);
    expect(models.some((model) => model.id === "korean-vllm-eight-trait")).toBe(true);
  });

  it("fits a simple human-score calibration curve", () => {
    const calibration = fitLinearCalibration([
      { rawScore: 50, humanScore: 55 },
      { rawScore: 80, humanScore: 76 },
      { rawScore: 90, humanScore: 88 },
    ]);

    expect(applyLinearCalibration(80, calibration, 0, 100)).toBeGreaterThan(70);
    expect(applyLinearCalibration(120, calibration, 0, 100)).toBeLessThanOrEqual(100);
  });
});
