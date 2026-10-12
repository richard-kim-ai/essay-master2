import { TRPCError } from "@trpc/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { friendlyLlmErrorMessage, LLM_AUTH_USER_MESSAGE } from "./_core/llmErrors";
import { appRouter } from "./routers";

const RAW = `List LLM models failed: 401 Unauthorized – {"code":16,"message":"there's an issue with your API key"}`;

afterEach(() => vi.restoreAllMocks());

describe("AI 서비스 인증 오류 안내(friendlyLlmErrorMessage)", () => {
  it("API 키 오류(401/403, 키 미설정)는 사용자용 안내로 바꾼다", () => {
    for (const message of [RAW, `LLM invoke failed: 401 Unauthorized – {"code":16}`, "LLM invoke failed: 403 Forbidden – x", "Incorrect API key provided", "OPENAI_API_KEY is not configured"]) {
      expect(friendlyLlmErrorMessage(message), message).toBe(LLM_AUTH_USER_MESSAGE);
    }
  });

  it("다른 오류(5xx·검증 오류 등)와 빈 값은 바꾸지 않는다", () => {
    for (const message of ["LLM invoke failed: 500 Internal Server Error – x", "이메일 또는 비밀번호를 확인해주세요.", "", null, undefined]) {
      expect(friendlyLlmErrorMessage(message as string | null | undefined)).toBeNull();
    }
  });

  it("안내 문구에는 공급자 원문(JSON·키 정보)이 들어 있지 않다", () => {
    expect(LLM_AUTH_USER_MESSAGE).not.toMatch(/401|code|API key|Unauthorized/i);
  });
});

describe("tRPC 오류 응답 포맷", () => {
  const format = (error: TRPCError) => {
    const config = (appRouter as any)._def._config;
    return config.errorFormatter({ shape: { message: error.message, code: -32603, data: { code: error.code } }, error, type: "mutation", path: "quiz.getDetailedSentenceFeedback", input: null, ctx: undefined });
  };

  it("AI 키 오류는 사용자에게 안내 문구만 내려가고 원문은 서버 로그에만 남는다", () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const shape = format(new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: RAW }));
    expect(shape.message).toBe(LLM_AUTH_USER_MESSAGE);
    expect(JSON.stringify(shape)).not.toContain("issue with your API key");
    expect(log).toHaveBeenCalledWith(expect.stringContaining("[LLM]"), RAW);
  });

  it("원인(cause)에 키 오류가 들어 있어도 같은 안내로 바꾼다", () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    const shape = format(new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "맞춤 피드백을 준비하지 못했습니다.", cause: new Error(RAW) }));
    expect(shape.message).toBe(LLM_AUTH_USER_MESSAGE);
  });

  it("그 밖의 오류 메시지는 그대로 둔다", () => {
    const shape = format(new TRPCError({ code: "BAD_REQUEST", message: "문장을 5자 이상 입력해 주세요." }));
    expect(shape.message).toBe("문장을 5자 이상 입력해 주세요.");
  });
});
