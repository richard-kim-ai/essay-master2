import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import {
  COURSE_MAP,
  TOOL_TYPE_MAP,
  buildShortUserPrompt,
  generateQuestionBankItems,
  generationRequestSchema,
  mapGeneratedItemsToQuestionBank,
  qaQuestionItem,
  resolveAdaptiveDifficulty,
} from "./questionGeneration";

function content(course: keyof typeof COURSE_MAP, tool_type: keyof typeof TOOL_TYPE_MAP, overrides: Record<string, unknown> = {}) {
  return {
    course,
    tool_type,
    theory_category: "C04",
    theory_subcategory: "주제문 창출",
    difficulty: 3,
    difficulty_metrics: {
      vocabulary_complexity: 3,
      sentence_complexity: 3,
      information_density: 3,
      reasoning_depth: 3,
      error_complexity: 2,
      answer_ambiguity: 2,
      concept_integration: 3,
    },
    question: "다음 제시문의 핵심 생각을 바탕으로 주제문을 한 문장으로 작성하십시오.",
    passage: "학교 안 휴대전화 사용은 정보 검색을 돕지만 수업 집중을 흐릴 수 있다. 따라서 공동 규칙은 편의와 학습권을 함께 고려해야 한다.",
    choices: tool_type === "QUIZ"
      ? [
          "공동 규칙은 편의와 학습권을 함께 고려해야 한다.",
          "휴대전화는 언제나 금지해야 한다.",
          "휴대전화는 언제나 허용해야 한다.",
          "규칙은 중요하다는 생각이 든다.",
        ]
      : [],
    correct_answer: "공동 규칙은 편의와 학습권을 함께 고려해야 한다.",
    model_answer: "학교 안 휴대전화 사용 규칙은 정보 활용의 편의와 수업 집중이라는 학습권을 함께 고려해 정해야 한다.",
    explanation: "핵심 쟁점 두 가지를 모두 보존하고 하나의 판단으로 정리한 답안이다.",
    wrong_answer_explanations: tool_type === "QUIZ" ? { "규칙은 중요하다는 생각이 든다.": "판단 내용이 구체적이지 않다." } : {},
    learning_objective: "요약 원리 중 주제문 창출을 적용한다.",
    evaluation_criteria: { 핵심보존: "주요 쟁점을 유지한다." },
    keywords: ["휴대전화", "학습권", "주제문"],
    estimated_time: 180,
    ...overrides,
  };
}

describe("question generation service", () => {
  it("maps every course and tool_type combination to backward-compatible question_bank DTOs", () => {
    for (const course of Object.keys(COURSE_MAP) as Array<keyof typeof COURSE_MAP>) {
      for (const tool of Object.keys(TOOL_TYPE_MAP) as Array<keyof typeof TOOL_TYPE_MAP>) {
        const [item] = mapGeneratedItemsToQuestionBank(
          { items: [{ title: `${COURSE_MAP[course].label} ${TOOL_TYPE_MAP[tool].label}`, contentData: content(course, tool) }] },
          { course, tool_type: tool, theory_category: "C04", difficulty: 3, question_count: 1, topic: "AUTO" },
        );

        expect(item.courseType).toBe(COURSE_MAP[course].db);
        expect(item.toolType).toBe(TOOL_TYPE_MAP[tool].db);
        expect(item.difficulty).toBe("medium");
        expect(item.qaStatus).toBe("passed");
      }
    }
  });

  it("rejects invalid input before prompt assembly", () => {
    expect(() => generationRequestSchema.parse({
      course: "MIDDLE_HIGH",
      tool_type: "SUMMARY",
      theory_category: "C04",
      difficulty: 9,
      question_count: 10,
      topic: "AUTO",
    })).toThrow();
  });

  it("builds a short structured user prompt separate from the master prompt", () => {
    const prompt = buildShortUserPrompt({
      course: "MIDDLE_HIGH",
      tool_type: "SUMMARY",
      theory_category: "C04",
      difficulty: 3,
      question_count: 10,
      topic: "AUTO",
    });
    expect(prompt).toContain("course=MIDDLE_HIGH");
    expect(prompt).toContain("tool_type=SUMMARY");
    expect(prompt).toContain("difficulty=3");
    expect(prompt.length).toBeLessThan(180);
  });

  it("surfaces JSON parsing failure from the LLM response", async () => {
    await expect(generateQuestionBankItems(
      { course: "MIDDLE_HIGH", tool_type: "SUMMARY", theory_category: "C04", difficulty: 3, question_count: 1, topic: "AUTO" },
      {
        llm: async () => ({
          id: "test",
          created: 0,
          model: "test",
          choices: [{ index: 0, message: { role: "assistant", content: "{not-json" }, finish_reason: "stop" }],
        }),
      },
    )).rejects.toThrow();
  });

  it("blocks placeholder, multiple-answer, and duplicate items in QA", () => {
    const validDto = {
      courseType: "middle_high" as const,
      toolType: "quiz",
      title: "휴대전화 사용 규칙 주제문 창출",
      contentData: JSON.stringify(content("MIDDLE_HIGH", "QUIZ")),
      difficulty: "medium" as const,
      isActive: 1,
    };

    expect(qaQuestionItem({
      ...validDto,
      title: "[ELEMENTARY] QUIZ 심화 문제 #1",
    }).issues).toContain("placeholder_blocked");

    expect(qaQuestionItem({
      ...validDto,
      contentData: JSON.stringify(content("MIDDLE_HIGH", "QUIZ", {
        choices: [
          "공동 규칙은 편의와 학습권을 함께 고려해야 한다.",
          "공동 규칙은 편의와 학습권을 함께 고려해야 한다.",
          "휴대전화는 언제나 금지해야 한다.",
          "규칙은 중요하다는 생각이 든다.",
        ],
      })),
    }).issues).toContain("quiz_single_answer_failed");

    expect(qaQuestionItem(validDto, [{ title: validDto.title, contentData: validDto.contentData }]).issues).toContain("duplicate_blocked");
  });

  it("resolves AUTO difficulty from recent correct-rate data or course defaults", () => {
    const request = generationRequestSchema.parse({
      course: "MIDDLE_HIGH",
      tool_type: "SUMMARY",
      theory_category: "C04",
      difficulty: "AUTO",
      question_count: 10,
      topic: "AUTO",
    });

    expect(resolveAdaptiveDifficulty(request, [])).toBe(3);
    expect(resolveAdaptiveDifficulty(request, [{ courseType: "middle_high", correctRate: 90, totalAttempts: 10 }])).toBe(4);
    expect(resolveAdaptiveDifficulty(request, [{ courseType: "middle_high", correctRate: 30, totalAttempts: 10 }])).toBe(2);
  });

  it("keeps CSV export and import on the same question_bank columns", () => {
    const adminSource = readFileSync(new URL("../client/src/pages/AdminQuestionBank.tsx", import.meta.url), "utf8");
    expect(adminSource).toContain('["id", "courseType", "toolType", "title", "contentData", "difficulty", "isActive"]');
    expect(adminSource).toContain("parseCsvRows");
    expect(adminSource).toContain("bulkCreateMutation");
  });
});

