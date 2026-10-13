import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("./_core/llm", () => ({ invokeLLM: vi.fn() }));

import { invokeLLM } from "./_core/llm";
import { parseRevision, reviseEssayWithLLM } from "./essayRevisionEngine";

const ESSAY = "시간 선택권이 있다 그리고 시간 선택권이 있다는 매우 필요한 일이다. 노동자는 일할 시간을 고를 수 있어야 한다.";
const reply = (payload: unknown, usage = 120) => ({ choices: [{ message: { content: typeof payload === "string" ? payload : JSON.stringify(payload) } }], usage: { total_tokens: usage } });

beforeEach(() => vi.mocked(invokeLLM).mockReset());

describe("수정 답안 검증(parseRevision)", () => {
  const revised = "시간 선택권은 매우 필요한 일이다. 노동자는 일할 시간을 고를 수 있어야 한다.";

  it("정상 응답은 수정본과 원문에 실제로 있는 문장의 교정만 남긴다", () => {
    const result = parseRevision(JSON.stringify({
      revisedEssay: revised,
      corrections: [
        { original: "시간 선택권이 있다 그리고 시간 선택권이 있다는 매우 필요한 일이다.", revised: "시간 선택권은 매우 필요한 일이다.", reason: "같은 말이 반복됩니다.", competency: "economy" },
        { original: "원문에 없는 문장입니다.", revised: "아무거나", reason: "지어낸 교정", competency: "logic" },
        { original: "노동자는 일할 시간을 고를 수 있어야 한다.", revised: "노동자는 일할 시간을 고를 수 있어야 한다.", reason: "바뀐 것이 없음", competency: "expression" },
      ],
    }), ESSAY);
    expect(result?.revisedEssay).toBe(revised);
    expect(result?.corrections).toEqual([{ original: "시간 선택권이 있다 그리고 시간 선택권이 있다는 매우 필요한 일이다.", revised: "시간 선택권은 매우 필요한 일이다.", reason: "같은 말이 반복됩니다.", competency: "economy", status: "changed" }]);
  });

  it("JSON이 아니거나 수정본이 비었거나 길이가 원문과 너무 다르면 버린다(내용을 지우거나 새로 쓴 응답)", () => {
    expect(parseRevision("죄송합니다", ESSAY)).toBeNull();
    expect(parseRevision(JSON.stringify({ revisedEssay: "", corrections: [] }), ESSAY)).toBeNull();
    expect(parseRevision(JSON.stringify({ revisedEssay: "짧다", corrections: [] }), ESSAY)).toBeNull();
    expect(parseRevision(JSON.stringify({ revisedEssay: ESSAY.repeat(3), corrections: [] }), ESSAY)).toBeNull();
  });

  it("알 수 없는 영역은 expression으로 보정하고 교정은 최대 8개까지만 둔다", () => {
    const corrections = Array.from({ length: 12 }, (_, index) => ({ original: "노동자는 일할", revised: `노동자는 자신이 일할 ${index}`, reason: "더 구체적으로", competency: "unknown" }));
    const result = parseRevision(JSON.stringify({ revisedEssay: revised, corrections }), ESSAY);
    expect(result?.corrections).toHaveLength(8);
    expect(result?.corrections[0].competency).toBe("expression");
  });
});

describe("수정 답안 생성(reviseEssayWithLLM)", () => {
  const request = { essayTitle: "시간 선택권", essayContent: ESSAY, courseType: "middle_high" as const, weaknesses: ["같은 표현이 반복됩니다"] };

  it("AI에게 원문과 보완점을 JSON으로 보내고 검증을 통과한 수정본과 토큰 사용량을 돌려준다", async () => {
    vi.mocked(invokeLLM).mockResolvedValue(reply({ revisedEssay: "시간 선택권은 매우 필요한 일이다. 노동자는 일할 시간을 고를 수 있어야 한다.", corrections: [] }, 321) as any);
    const result = await reviseEssayWithLLM(request);
    expect(result).toMatchObject({ revisedEssay: expect.stringContaining("시간 선택권은"), tokenUsage: 321 });
    const call = vi.mocked(invokeLLM).mock.calls[0][0];
    expect(call.response_format).toEqual({ type: "json_object" });
    const user = JSON.parse(String(call.messages[1].content));
    expect(user).toMatchObject({ 독자: "중·고등학생", 원문: ESSAY, 먼저_고칠_보완점: ["같은 표현이 반복됩니다"] });
  });

  it("AI 호출이 실패하거나(키 오류 등) 응답이 잘못되면 예외 없이 null을 돌려준다", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    vi.mocked(invokeLLM).mockRejectedValue(new Error("LLM invoke failed: 401 Unauthorized"));
    await expect(reviseEssayWithLLM(request)).resolves.toBeNull();
    vi.mocked(invokeLLM).mockResolvedValue(reply("JSON 아님") as any);
    await expect(reviseEssayWithLLM(request)).resolves.toBeNull();
    warn.mockRestore();
  });
});
