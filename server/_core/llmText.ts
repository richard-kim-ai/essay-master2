import { invokeLLM, listLLMModels, type InvokeParams, type InvokeResult } from "./llm";

// 모델이 content를 비우거나(null) 조각 배열로 돌려줘도 텍스트를 꺼낸다.
export function llmResponseText(response: InvokeResult | undefined): string {
  const content = response?.choices?.[0]?.message?.content;
  if (typeof content === "string") return content.trim();
  if (Array.isArray(content)) {
    return content
      .flatMap(part => (part?.type === "text" && typeof part.text === "string" ? [part.text] : []))
      .join("")
      .trim();
  }
  return "";
}

// 기본 모델이 빈 응답을 주는 일이 있어 이론 콘텐츠(theoryLessonContent)와 같은 순서로 모델을 지정해 시도한다.
export const TEXT_GENERATION_MODELS = ["gpt-5-mini", "gpt-5", "claude-haiku-4-5"] as const;

const MODEL_LIST_TTL_MS = 10 * 60 * 1000;
let modelListCache: { at: number; ids: string[] } | null = null;

async function availableModelIds(): Promise<string[]> {
  if (modelListCache && Date.now() - modelListCache.at < MODEL_LIST_TTL_MS) return modelListCache.ids;
  const ids = (await listLLMModels()).data.map(model => model.id);
  modelListCache = { at: Date.now(), ids };
  return ids;
}

export function resetLlmModelCache() {
  modelListCache = null;
}

/** 후보 모델 순서를 정한다. 모델 목록을 못 받으면 모델을 지정하지 않은 기본 호출 한 번만 시도한다. */
async function candidateModels(): Promise<Array<string | undefined>> {
  try {
    const ids = await availableModelIds();
    const preferred = TEXT_GENERATION_MODELS.filter(candidate => ids.includes(candidate)) as string[];
    if (preferred.length) return preferred;
    return ids[0] ? [ids[0]] : [undefined];
  } catch {
    return [undefined];
  }
}

export type LlmTextResult = { text: string; model: string | null; totalTokens: number };

/**
 * 텍스트(JSON 문자열 포함) 응답을 받는다. 응답이 비면 다음 모델로 넘어가고, 모두 비면 LLM_EMPTY_RESPONSE 오류를 던진다.
 * 인증·네트워크 오류는 다른 모델로 바꿔도 소용없으므로 그대로 던진다.
 */
export async function invokeLLMText(params: Omit<InvokeParams, "model">): Promise<LlmTextResult> {
  let totalTokens = 0;
  let lastFinishReason: string | null = null;
  for (const model of await candidateModels()) {
    const response = await invokeLLM(model ? { ...params, model } : params);
    totalTokens += Math.max(0, Math.round(Number(response?.usage?.total_tokens ?? 0)));
    const text = llmResponseText(response);
    if (text) return { text, model: model ?? null, totalTokens };
    lastFinishReason = response?.choices?.[0]?.finish_reason ?? null;
    console.warn("[llm] empty response", { requestedModel: model ?? null, responseModel: response?.model ?? null, finishReason: lastFinishReason });
  }
  throw new Error(lastFinishReason ? `LLM_EMPTY_RESPONSE (${lastFinishReason})` : "LLM_EMPTY_RESPONSE");
}
