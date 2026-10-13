import { AsyncLocalStorage } from "node:async_hooks";

// 요청(tRPC 프로시저) 하나가 DB 쿼리를 몇 번, 얼마나 오래 썼는지 센다.
// 값(쿼리 인자·개인정보)은 기록하지 않고 프로시저 이름·시간·쿼리 수만 남긴다.
type PerfStore = { queries: number; aiCalls: number; aiTokens: number };
export type ProcedureStats = { durationMs: number; queries: number; aiCalls: number; aiTokens: number };

/** 사용 기록에서 AI 호출 비용(토큰) 집계 행을 구분하는 접두어. 이용권 차감 기록과 섞이지 않는다. */
export const AI_COST_PREFIX = "ai_cost:";

/** invokeLLM이 응답을 받을 때 호출한다. 현재 요청이 있으면 그 요청의 AI 호출 수와 토큰을 올린다. */
export function recordAiCall(totalTokens: number | undefined) {
  const store = storage.getStore();
  if (!store) return;
  store.aiCalls += 1;
  store.aiTokens += Math.max(0, Math.round(Number(totalTokens ?? 0)));
}
const storage = new AsyncLocalStorage<PerfStore>();

export const SLOW_PROCEDURE_MS = Number(process.env.PERF_SLOW_MS ?? 1500);
export const MANY_QUERIES = Number(process.env.PERF_MANY_QUERIES ?? 12);

/** PERF_LOG=1이면 모든 프로시저를, 아니면 느리거나 쿼리가 많은 프로시저만 출력한다. */
export function shouldReport(durationMs: number, queries: number, verbose = process.env.PERF_LOG === "1") {
  return verbose || durationMs >= SLOW_PROCEDURE_MS || queries >= MANY_QUERIES;
}

/** drizzle logger — 쿼리 한 건마다 현재 요청의 카운터를 올린다. */
export const drizzleQueryCounter = {
  logQuery() {
    const store = storage.getStore();
    if (store) store.queries += 1;
  },
};

export async function measureProcedure<T>(path: string, type: string, run: () => Promise<T>, onFinish?: (stats: ProcedureStats) => void): Promise<T> {
  const store: PerfStore = { queries: 0, aiCalls: 0, aiTokens: 0 };
  const startedAt = Date.now();
  try {
    return await storage.run(store, run);
  } finally {
    const durationMs = Date.now() - startedAt;
    if (shouldReport(durationMs, store.queries)) {
      console.log(`[perf] ${type} ${path} ${durationMs}ms, DB 쿼리 ${store.queries}건`);
    }
    onFinish?.({ durationMs, ...store });
  }
}
