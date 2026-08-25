import { describe, expect, it } from "vitest";
import { COURSE_MAP, TOOL_TYPE_MAP, HUMAN_REVIEW_ITEMS, buildShortUserPrompt, generateQuestionBankItems, generationRequestSchema, mapGeneratedItemsToQuestionBank, qaQuestionItem, resolveAdaptiveDifficulty } from "./questionGeneration";

function content(course: keyof typeof COURSE_MAP, tool: keyof typeof TOOL_TYPE_MAP, overrides: Record<string, unknown> = {}) {
  return {
    course, tool_type: tool, theory_category: "C04", difficulty: 3,
    difficulty_metrics: { vocabulary_complexity: 3, sentence_complexity: 3, information_density: 3, reasoning_depth: 3, error_complexity: 2, answer_ambiguity: 2, concept_integration: 3 },
    question: "다음 제시문을 읽고 핵심 생각을 한 문장으로 정리하십시오.",
    passage: "학교 안 휴대전화 사용은 정보 검색을 돕지만 수업 집중을 흐릴 수 있다. 공동 규칙은 편의와 학습권을 함께 고려해야 한다.",
    explanation: "핵심 쟁점 두 가지를 보존해 하나의 판단으로 정리한다.", learning_objective: "요약의 주제문 창출 원리를 적용한다.",
    correct_answer: "공동 규칙은 편의와 학습권을 함께 고려해야 한다.", model_answer: "학교 휴대전화 규칙은 정보 활용의 편의와 수업 집중이라는 학습권을 함께 고려해 정해야 한다.",
    choices: ["공동 규칙은 편의와 학습권을 함께 고려해야 한다.", "휴대전화는 상황과 관계없이 항상 금지해야 한다.", "휴대전화는 상황과 관계없이 항상 허용해야 한다.", "규칙보다는 학생 각자의 판단에 맡기는 것이 낫다."],
    paragraphs: [{ id: "p1", content: "학교 구성원은 문제의 영향을 살핀다.", correctOrder: 1 }, { id: "p2", content: "그 뒤 공동 규칙의 기준을 정한다.", correctOrder: 2 }, { id: "p3", content: "마지막으로 실천 방법을 합의한다.", correctOrder: 3 }],
    keyPoints: ["정보 활용", "수업 집중", "공동 규칙"], guidelines: ["범위를 좁힌다.", "논증 가능성을 확인한다.", "자료를 찾을 수 있는지 점검한다."],
    sampleOutput: { title: "학교 휴대전화 규칙", stance: "공동 기준이 필요하다" }, checklistItems: ["완전한 문장인가?", "주장이 분명한가?", "논증 범위가 적절한가?"], passingStandard: "세 항목 중 두 항목 이상을 충족하고 수정 방향을 제시한다.",
    generation_origin: "ai_generated",
    human_review: { status: "passed", checklist: Object.fromEntries(HUMAN_REVIEW_ITEMS.map((item) => [item, true])), overall_passed: true },
    ...overrides,
  };
}

describe("공통 문항 생성·QA 엔진", () => {
  it("모든 과정·도구 조합을 기존 question_bank DTO와 학습 도구 호환 JSON으로 변환한다", () => {
    for (const course of Object.keys(COURSE_MAP) as Array<keyof typeof COURSE_MAP>) {
      for (const tool of Object.keys(TOOL_TYPE_MAP) as Array<keyof typeof TOOL_TYPE_MAP>) {
        const [item] = mapGeneratedItemsToQuestionBank({ items: [{ title: `${COURSE_MAP[course].label} ${TOOL_TYPE_MAP[tool].label} 실전 연습`, contentData: content(course, tool) }] }, { course, tool_type: tool, theory_category: "C04", difficulty: 3, question_count: 1, topic: "AUTO" });
        expect(item.courseType).toBe(COURSE_MAP[course].db); expect(item.toolType).toBe(TOOL_TYPE_MAP[tool].db); expect(item.qaStatus).toBe("passed");
      }
    }
  });
  it("잘못된 난이도와 빈 생성 입력을 프롬프트 조립 전에 차단한다", () => {
    expect(() => generationRequestSchema.parse({ course: "MIDDLE_HIGH", tool_type: "SUMMARY", difficulty: 9 })).toThrow();
    expect(() => generationRequestSchema.parse({ course: "", tool_type: "SUMMARY" })).toThrow();
  });
  it("placeholder·중복·객관식 복수 정답을 QA에서 차단한다", () => {
    const valid = { courseType: "middle_high" as const, toolType: "quiz" as const, title: "학교 휴대전화 규칙", contentData: JSON.stringify(content("MIDDLE_HIGH", "QUIZ")), difficulty: "medium" as const, isActive: 1 };
    expect(qaQuestionItem({ ...valid, title: "심화 문제 #1" }).issues).toContain("placeholder_blocked");
    expect(qaQuestionItem({ ...valid, contentData: JSON.stringify(content("MIDDLE_HIGH", "QUIZ", { choices: ["정답", "정답", "오답 1", "오답 2"], correct_answer: "정답" })) }).issues).toContain("quiz_structure_failed");
    expect(qaQuestionItem(valid, [{ title: valid.title, contentData: valid.contentData }]).issues).toContain("duplicate_blocked");
  });
  it("짧은 사용자 프롬프트와 AUTO 난이도를 과정 수행 통계로 조절한다", () => {
    const prompt = buildShortUserPrompt({ course: "MIDDLE_HIGH", tool_type: "SUMMARY", theory_category: "C04", difficulty: 3, question_count: 10, topic: "AUTO" });
    expect(prompt).toContain("course=MIDDLE_HIGH"); expect(prompt.length).toBeLessThan(220);
    const request = generationRequestSchema.parse({ course: "MIDDLE_HIGH", tool_type: "SUMMARY", difficulty: "AUTO" });
    expect(resolveAdaptiveDifficulty(request, [{ courseType: "middle_high", correctRate: 90, totalAttempts: 10 }])).toBe(4);
  });
  it("손상된 AI JSON 응답을 저장 전 차단한다", async () => {
    await expect(generateQuestionBankItems({ course: "MIDDLE_HIGH", tool_type: "SUMMARY", theory_category: "C04", difficulty: 3, question_count: 1, topic: "AUTO" }, { llm: async () => ({ id: "test", created: 0, model: "test", choices: [{ index: 0, message: { role: "assistant", content: "{not-json" }, finish_reason: "stop" }] }) as any })).rejects.toThrow();
  });

  // ===== 아래는 local branch 고유 기능: 사람 검수 체크리스트·정답 패턴 추측 방지 QA (2026-08-19 merge 시 이식) =====
  it("사람 검수(human_review)가 완료되지 않은 AI 생성 문항은 human_review_required로 차단한다", () => {
    const valid = { courseType: "middle_high" as const, toolType: "quiz" as const, title: "학교 휴대전화 규칙", contentData: JSON.stringify(content("MIDDLE_HIGH", "QUIZ")), difficulty: "medium" as const, isActive: 1 };
    expect(qaQuestionItem(valid).issues).not.toContain("human_review_required");
    const pending = { ...valid, contentData: JSON.stringify(content("MIDDLE_HIGH", "QUIZ", { human_review: { status: "pending", checklist: {}, overall_passed: false } })) };
    expect(qaQuestionItem(pending).issues).toContain("human_review_required");
  });
  it("정답 선택지가 다른 선택지보다 눈에 띄게 길면 choice_length_bias로 표시한다", () => {
    const valid = { courseType: "middle_high" as const, toolType: "quiz" as const, title: "학교 휴대전화 규칙", difficulty: "medium" as const, isActive: 1,
      contentData: JSON.stringify(content("MIDDLE_HIGH", "QUIZ", {
        choices: ["휴대전화 금지", "항상 허용", "규칙은 필요", "학교 안 휴대전화 사용 규칙은 정보 검색의 편의와 수업 집중이라는 학습권을 함께 고려해 정해야 한다."],
        correct_answer: "학교 안 휴대전화 사용 규칙은 정보 검색의 편의와 수업 집중이라는 학습권을 함께 고려해 정해야 한다.",
      })) };
    expect(qaQuestionItem(valid).issues).toContain("choice_length_bias");
  });
  it("한 배치에서 생성된 QUIZ 문항들의 정답 위치가 모두 같으면 answer_position_pattern으로 차단한다", () => {
    const mapped = mapGeneratedItemsToQuestionBank(
      {
        items: [1, 2, 3].map((index) => ({
          title: `학교 휴대전화 규칙 퀴즈 ${index}`,
          contentData: content("MIDDLE_HIGH", "QUIZ", {
            choices: ["공동 규칙은 편의와 학습권을 함께 고려해야 한다.", "휴대전화는 언제나 금지해야 한다.", "휴대전화는 언제나 허용해야 한다.", "규칙은 중요하다는 생각이 든다."],
            correct_answer: "공동 규칙은 편의와 학습권을 함께 고려해야 한다.",
          }),
        })),
      },
      { course: "MIDDLE_HIGH", tool_type: "QUIZ", theory_category: "A03", difficulty: 3, question_count: 3, topic: "AUTO" },
    );
    expect(mapped.every((item) => item.qaIssues?.includes("answer_position_pattern"))).toBe(true);
  });
});
