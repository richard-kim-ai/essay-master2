import { describe, expect, it } from "vitest";
import { getTodayAIUsageCount, logAIUsage } from "./db";

describe("하이브리드 AI 쿼터 및 사용량 관리 테스트", () => {
  it("일일 AI 사용량 카운트 및 로깅 함수가 올바르게 정의되어 있다", () => {
    expect(typeof logAIUsage).toBe("function");
    expect(typeof getTodayAIUsageCount).toBe("function");
  });
});
