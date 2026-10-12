import { afterEach, describe, expect, it, vi } from "vitest";
import { AI_COST_PREFIX, drizzleQueryCounter, measureProcedure, recordAiCall, shouldReport } from "./_core/perf";

afterEach(() => vi.restoreAllMocks());

describe("measureProcedure", () => {
  it("요청 안에서 일어난 DB 쿼리 수와 AI 호출·토큰을 합산해 돌려준다", async () => {
    const onFinish = vi.fn();
    const result = await measureProcedure("a.b", "query", async () => {
      drizzleQueryCounter.logQuery();
      drizzleQueryCounter.logQuery();
      recordAiCall(120);
      recordAiCall(undefined);
      recordAiCall(30.4);
      return "ok";
    }, onFinish);
    expect(result).toBe("ok");
    expect(onFinish).toHaveBeenCalledTimes(1);
    expect(onFinish.mock.calls[0][0]).toMatchObject({ queries: 2, aiCalls: 3, aiTokens: 150 });
  });

  it("동시에 실행되는 요청끼리 카운터가 섞이지 않는다", async () => {
    const stats: Record<string, { queries: number; aiTokens: number }> = {};
    const run = (name: string, queries: number, tokens: number, delay: number) =>
      measureProcedure(name, "query", async () => {
        await new Promise(resolve => setTimeout(resolve, delay));
        for (let i = 0; i < queries; i++) drizzleQueryCounter.logQuery();
        recordAiCall(tokens);
      }, s => { stats[name] = s; });
    await Promise.all([run("x", 1, 10, 20), run("y", 3, 99, 5)]);
    expect(stats.x).toMatchObject({ queries: 1, aiTokens: 10 });
    expect(stats.y).toMatchObject({ queries: 3, aiTokens: 99 });
  });

  it("요청 밖에서 부른 카운터는 아무 일도 하지 않고, 오류가 나도 집계 콜백은 호출된다", async () => {
    expect(() => { drizzleQueryCounter.logQuery(); recordAiCall(5); }).not.toThrow();
    const onFinish = vi.fn();
    await expect(measureProcedure("e", "mutation", async () => { recordAiCall(7); throw new Error("boom"); }, onFinish)).rejects.toThrow("boom");
    expect(onFinish.mock.calls[0][0]).toMatchObject({ aiCalls: 1, aiTokens: 7 });
  });

  it("느리거나 쿼리가 많거나 PERF_LOG가 켜진 호출만 로그로 남긴다", () => {
    expect(shouldReport(10, 1, false)).toBe(false);
    expect(shouldReport(5000, 1, false)).toBe(true);
    expect(shouldReport(10, 50, false)).toBe(true);
    expect(shouldReport(10, 1, true)).toBe(true);
  });

  it("AI 비용 기록 접두어는 이용권 차감 기록(essay_feedback 등)과 겹치지 않는다", () => {
    for (const action of ["essay_feedback", "essay_feedback:3", "trial_essay_feedback", "institution_essay_feedback", "writing_evaluation_v1"]) {
      expect(action.startsWith(AI_COST_PREFIX)).toBe(false);
    }
  });
});
