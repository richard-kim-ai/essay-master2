import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const RAW_401 = `LLM invoke failed: 401 Unauthorized – {"code":16,"message":"there's an issue with your API key"}`;

vi.mock("./writingEvaluationEngine", async (importOriginal) => ({
  ...(await importOriginal<typeof import("./writingEvaluationEngine")>()),
  evaluateWritingWithLLM: vi.fn(),
}));
vi.mock("./db", async (importOriginal) => ({ ...(await importOriginal<typeof import("./db")>()), logAIUsage: vi.fn(async () => undefined) }));

import { LLM_AUTH_USER_MESSAGE, LLM_TEMPORARY_USER_MESSAGE, userFacingProviderReason } from "./_core/llmErrors";
import { evaluateWritingWithLLM } from "./writingEvaluationEngine";
import { appRouter } from "./routers";
import { resetRateLimits } from "./rateLimit";
import type { TrpcContext } from "./_core/context";

afterEach(() => vi.restoreAllMocks());

describe("userFacingProviderReason — 화면에 내보낼 AI 사용 불가 사유", () => {
  it("API 키 오류 원문(JSON 포함)은 안내 문구로 바꾼다", () => {
    expect(userFacingProviderReason(RAW_401)).toBe(LLM_AUTH_USER_MESSAGE);
    expect(userFacingProviderReason(`List LLM models failed: 403 Forbidden – x`)).toBe(LLM_AUTH_USER_MESSAGE);
  });

  it("그 밖의 공급자 원문·내부 오류 코드·네트워크 오류는 일시적 응답 불가 안내로 바꾼다", () => {
    for (const raw of ["LLM invoke failed: 500 Internal Server Error – boom", "LLM_EMPTY_RESPONSE", "LLM_EMPTY_RESPONSE (length)", "LLM_INVALID_EVALUATION_CONTRACT", "NO_ACTIVE_EVALUATION_MODEL", "fetch failed", "connect ECONNREFUSED 1.2.3.4:443", '{"error":"x"}']) {
      expect(userFacingProviderReason(raw), raw).toBe(LLM_TEMPORARY_USER_MESSAGE);
    }
  });

  it("사람이 읽을 수 있는 문구는 그대로 두고, 비어 있으면 null이다", () => {
    expect(userFacingProviderReason("모델 응답 형식이 올바르지 않습니다.")).toBe("모델 응답 형식이 올바르지 않습니다.");
    expect(userFacingProviderReason(null)).toBeNull();
    expect(userFacingProviderReason("")).toBeNull();
  });

  it("안내 문구에는 상태 코드·JSON·키 정보가 없다", () => {
    for (const message of [LLM_AUTH_USER_MESSAGE, LLM_TEMPORARY_USER_MESSAGE]) expect(message).not.toMatch(/401|403|500|code|API key|Unauthorized|\{/i);
  });
});

type TestUser = Record<string, unknown> & { id: number };
const callerFor = (user: TestUser) =>
  appRouter.createCaller({
    user: { openId: `u-${user.id}`, email: `u${user.id}@example.com`, name: `사용자${user.id}`, loginMethod: "email", role: "user", createdAt: new Date(), updatedAt: new Date(), lastSignedIn: new Date(), ...user },
    req: { protocol: "https", headers: {} } as any,
    res: { clearCookie: vi.fn(), cookie: vi.fn() } as any,
  } as unknown as TrpcContext);

describe("평가 결과 응답 — 공급자 원문이 사용자에게 가지 않는다", () => {
  beforeEach(() => resetRateLimits());

  it("AI 모델 호출이 실패해 기본 점검으로 대체된 결과의 provider_error는 안내 문구로 바뀐다", async () => {
    vi.mocked(evaluateWritingWithLLM).mockResolvedValue({ decision: "revision_requested", total_score: 55, fallback_used: true, provider_error: RAW_401, token_usage: 0 } as never);
    const input = { metadata: {}, task: "논제", submission: { essay_text: "본문입니다." } };
    for (const procedure of ["evaluate", "evaluateAndCorrect", "reevaluate"] as const) {
      const result = await callerFor({ id: 1, role: "admin" }).writingEvaluationEngine[procedure](input as never);
      expect(result.provider_error, procedure).toBe(LLM_AUTH_USER_MESSAGE);
      expect(JSON.stringify(result)).not.toContain("API key");
      expect(JSON.stringify(result)).not.toContain("401");
    }
  });

  it("정상 결과(사유 없음)는 그대로 돌려준다", async () => {
    vi.mocked(evaluateWritingWithLLM).mockResolvedValue({ decision: "scored", total_score: 80, fallback_used: false, provider_error: null, token_usage: 10 } as never);
    const result = await callerFor({ id: 1, role: "admin" }).writingEvaluationEngine.evaluate({ metadata: {}, task: "논제", submission: { essay_text: "본문입니다." } } as never);
    expect(result).toMatchObject({ total_score: 80, provider_error: null });
  });
});

describe("AI 서비스 호출 재시도 규칙", () => {
  const load = async () => {
    vi.resetModules();
    process.env.BUILT_IN_FORGE_API_KEY = "test-key";
    process.env.BUILT_IN_FORGE_API_URL = "https://llm.example.test";
    return import("./_core/llm");
  };
  const response = (status: number, body = "{}") => new Response(body, { status, statusText: status === 401 ? "Unauthorized" : "Error" });

  it("키 오류(401)는 다시 시도하지 않고 바로 실패한다(대기 시간 없음)", async () => {
    const fetchMock = vi.fn(async () => response(401, '{"code":16}'));
    vi.stubGlobal("fetch", fetchMock);
    const { invokeLLM } = await load();
    const startedAt = Date.now();
    await expect(invokeLLM({ messages: [{ role: "user", content: "x" }] })).rejects.toThrow("LLM invoke failed: 401");
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(Date.now() - startedAt).toBeLessThan(1000);
    vi.unstubAllGlobals();
  });

  it("잘못된 요청(400)·권한 없음(403)·없음(404)도 재시도하지 않는다", async () => {
    for (const status of [400, 403, 404]) {
      const fetchMock = vi.fn(async () => response(status));
      vi.stubGlobal("fetch", fetchMock);
      const { invokeLLM } = await load();
      await expect(invokeLLM({ messages: [{ role: "user", content: "x" }] })).rejects.toThrow(`LLM invoke failed: ${status}`);
      expect(fetchMock, String(status)).toHaveBeenCalledTimes(1);
    }
    vi.unstubAllGlobals();
  });

  it("서버 오류(500)는 재시도한 뒤 성공하면 결과를 돌려준다", async () => {
    const ok = { choices: [{ message: { content: "{}" } }], usage: { total_tokens: 3 } };
    const fetchMock = vi.fn().mockResolvedValueOnce(response(500)).mockResolvedValueOnce(new Response(JSON.stringify(ok), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    const { invokeLLM } = await load();
    const result = await invokeLLM({ messages: [{ role: "user", content: "x" }] });
    expect(result.choices[0].message.content).toBe("{}");
    expect(fetchMock).toHaveBeenCalledTimes(2);
    vi.unstubAllGlobals();
  }, 20000);
});
