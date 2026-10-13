import { describe, expect, it } from "vitest";
import { AI_COST_ASSUMPTIONS, describeAiCost, estimateAiCostKrw, formatKrw } from "../shared/aiCost";

describe("AI 비용 추정", () => {
  it("100만 토큰은 gpt-5-mini 정가·환율 가정으로 출력 비중별 원화 범위가 된다", () => {
    const estimate = estimateAiCostKrw(1_000_000);
    // 입력 $0.25·출력 $2.00, 환율 1,400원: 출력 30% → 1,085원, 50% → 1,575원, 70% → 2,065원.
    expect(estimate.low).toBeCloseTo(1085, 6);
    expect(estimate.mid).toBeCloseTo(1575, 6);
    expect(estimate.high).toBeCloseTo(2065, 6);
    expect(AI_COST_ASSUMPTIONS.krwPerUsd).toBe(1400);
  });

  it("첨삭 1회(약 1.64만 토큰)는 약 26원(18~34원)이다", () => {
    expect(describeAiCost(estimateAiCostKrw(16_352))).toBe("약 26원 (18~34원)");
  });

  it("토큰이 없거나 잘못된 값이면 0원이고, 범위는 낮음 ≤ 중간 ≤ 높음 순서다", () => {
    for (const bad of [0, -5, Number.NaN, Number.POSITIVE_INFINITY]) expect(estimateAiCostKrw(bad)).toEqual({ low: 0, mid: 0, high: 0 });
    const { low, mid, high } = estimateAiCostKrw(75_282);
    expect(low).toBeLessThanOrEqual(mid);
    expect(mid).toBeLessThanOrEqual(high);
  });

  it("금액 표시: 1원 미만은 소수 한 자리, 그 이상은 정수와 천 단위 구분", () => {
    expect(formatKrw(0)).toBe("0원");
    expect(formatKrw(0.34)).toBe("0.3원");
    expect(formatKrw(25.75)).toBe("26원");
    expect(formatKrw(12345.4)).toBe("12,345원");
  });
});
