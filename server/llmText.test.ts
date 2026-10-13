import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("./_core/llm", () => ({ invokeLLM: vi.fn(), listLLMModels: vi.fn() }));

import { invokeLLM, listLLMModels } from "./_core/llm";
import { invokeLLMText, llmResponseText, resetLlmModelCache, TEXT_GENERATION_MAX_TOKENS } from "./_core/llmText";

const reply = (content: unknown, tokens = 10, finish = "stop") => ({ choices: [{ message: { content }, finish_reason: finish }], usage: { total_tokens: tokens } }) as never;
const models = (...ids: string[]) => ({ object: "list", data: ids.map(id => ({ id, object: "model", created: 0, owned_by: "x" })) }) as never;

beforeEach(() => {
  vi.mocked(invokeLLM).mockReset();
  vi.mocked(listLLMModels).mockReset();
  resetLlmModelCache();
});

describe("llmResponseText", () => {
  it("문자열·조각 배열 content에서 텍스트를 꺼내고 비면 빈 문자열을 돌려준다", () => {
    expect(llmResponseText(reply(" {\"a\":1} "))).toBe('{"a":1}');
    expect(llmResponseText(reply([{ type: "text", text: "가" }, { type: "text", text: "나" }]))).toBe("가나");
    expect(llmResponseText(reply(null))).toBe("");
    expect(llmResponseText(undefined)).toBe("");
  });
});

describe("invokeLLMText", () => {
  it("첫 모델이 빈 응답이면 다음 모델로 넘어가고 토큰을 합산한다", async () => {
    vi.mocked(listLLMModels).mockResolvedValue(models("gpt-5-mini", "gpt-5"));
    vi.mocked(invokeLLM).mockResolvedValueOnce(reply(null, 5, "length")).mockResolvedValueOnce(reply("{\"ok\":true}", 20));
    const result = await invokeLLMText({ messages: [{ role: "user", content: "x" }] });
    expect(result).toEqual({ text: '{"ok":true}', model: "gpt-5", totalTokens: 25 });
    expect(vi.mocked(invokeLLM).mock.calls.map(call => call[0].model)).toEqual(["gpt-5-mini", "gpt-5"]);
    expect(vi.mocked(invokeLLM).mock.calls.map(call => call[0].max_tokens)).toEqual([4500, 4500]);
  });

  it("의미론 첨삭 후보 모델에 충분한 JSON 출력 토큰 상한을 전달한다", async () => {
    vi.mocked(listLLMModels).mockResolvedValue(models("gpt-5-mini", "gpt-5", "claude-haiku-4-5"));
    vi.mocked(invokeLLM).mockResolvedValue(reply('{"ok":true}', 12));
    await invokeLLMText({ messages: [] });
    expect(vi.mocked(invokeLLM).mock.calls[0][0].max_tokens).toBe(TEXT_GENERATION_MAX_TOKENS["gpt-5-mini"]);
  });

  it("모든 모델이 비면 LLM_EMPTY_RESPONSE 오류를 던진다", async () => {
    vi.mocked(listLLMModels).mockResolvedValue(models("gpt-5-mini"));
    vi.mocked(invokeLLM).mockResolvedValue(reply("", 0, "length"));
    await expect(invokeLLMText({ messages: [] })).rejects.toThrow("LLM_EMPTY_RESPONSE (length)");
  });

  it("모델 목록을 못 받으면 모델을 지정하지 않고 한 번만 호출한다", async () => {
    vi.mocked(listLLMModels).mockRejectedValue(new Error("network"));
    vi.mocked(invokeLLM).mockResolvedValue(reply("본문"));
    const result = await invokeLLMText({ messages: [] });
    expect(result.model).toBeNull();
    expect(invokeLLM).toHaveBeenCalledTimes(1);
    expect(vi.mocked(invokeLLM).mock.calls[0][0]).not.toHaveProperty("model");
  });

  it("선호 모델이 목록에 없으면 목록의 첫 모델을 쓴다", async () => {
    vi.mocked(listLLMModels).mockResolvedValue(models("other-model"));
    vi.mocked(invokeLLM).mockResolvedValue(reply("본문"));
    await invokeLLMText({ messages: [] });
    expect(vi.mocked(invokeLLM).mock.calls[0][0].model).toBe("other-model");
  });

  it("인증 오류는 다른 모델을 시도하지 않고 그대로 던진다", async () => {
    vi.mocked(listLLMModels).mockResolvedValue(models("gpt-5-mini", "gpt-5"));
    vi.mocked(invokeLLM).mockRejectedValue(new Error("LLM invoke failed: 401"));
    await expect(invokeLLMText({ messages: [] })).rejects.toThrow("401");
    expect(invokeLLM).toHaveBeenCalledTimes(1);
  });
});
