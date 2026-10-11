import { describe, expect, it, vi } from "vitest";
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
  it("기존 contentData 필드명과 한 단계 중첩된 응답도 공통 DTO로 정규화한다", () => {
    const legacy = content("MIDDLE_HIGH", "SUMMARY", {
      prompt: "학교 휴대전화 사용의 장단점을 요약하십시오.",
      answer_explanation: "쟁점과 조건을 빠뜨리지 않고 요약했는지 확인한다.",
      learningObjective: "핵심 주장과 조건을 구분한다.",
      modelAnswer: "편의와 학습권을 함께 고려해야 한다.",
    });
    delete (legacy as Record<string, unknown>).question;
    delete (legacy as Record<string, unknown>).explanation;
    delete (legacy as Record<string, unknown>).learning_objective;
    delete (legacy as Record<string, unknown>).model_answer;
    const [item] = mapGeneratedItemsToQuestionBank(
      { items: [{ title: "휴대전화 사용 요약", contentData: { contentData: legacy } }] },
      { course: "MIDDLE_HIGH", tool_type: "SUMMARY", theory_category: "C04", difficulty: 3, question_count: 1, topic: "AUTO" },
    );
    expect(item.qaStatus).toBe("passed");
    expect(JSON.parse(item.contentData)).toMatchObject({
      question: legacy.prompt,
      explanation: legacy.answer_explanation,
      learning_objective: legacy.learningObjective,
      model_answer: legacy.modelAnswer,
    });
  });
  it("AI가 body·answerExplanation·learning_goal 레거시 필드로 반환해도 저장용 필드로 정규화한다", () => {
    const legacy = content("MIDDLE_HIGH", "SUMMARY", {
      body: "학교 휴대전화 사용의 장단점을 비교해 요약하십시오.",
      answerExplanation: "편의와 학습권이라는 두 쟁점을 함께 확인한다.",
      learning_goal: "핵심 주장과 조건을 구분해 요약한다.",
    });
    delete (legacy as Record<string, unknown>).question;
    delete (legacy as Record<string, unknown>).prompt;
    delete (legacy as Record<string, unknown>).explanation;
    delete (legacy as Record<string, unknown>).learning_objective;
    const [item] = mapGeneratedItemsToQuestionBank(
      { items: [{ title: "휴대전화 요약", contentData: { contentData: legacy } }] },
      { course: "MIDDLE_HIGH", tool_type: "SUMMARY", theory_category: "C04", difficulty: 3, question_count: 1, topic: "AUTO" },
    );
    expect(item.qaStatus).toBe("passed");
    expect(JSON.parse(item.contentData)).toMatchObject({ question: legacy.body, explanation: legacy.answerExplanation, learning_objective: legacy.learning_goal });
  });

  // ===== 아래는 local branch 고유 기능: 사람 검수 체크리스트·정답 패턴 추측 방지 QA (2026-08-19 merge 시 이식) =====
  it("필수 필드가 없는 AI 문항은 예외 대신 QA 차단으로 반환하며 정상 문항을 버리지 않는다", () => {
    const mapped = mapGeneratedItemsToQuestionBank({ items: [
      { title: "불완전한 생성 문항", contentData: { question: "", explanation: "" } },
      { title: "휴대전화 사용 요약", contentData: content("MIDDLE_HIGH", "SUMMARY") },
    ] }, { course: "MIDDLE_HIGH", tool_type: "SUMMARY" });
    expect(mapped).toHaveLength(2);
    expect(mapped[0].qaStatus).toBe("blocked");
    expect(mapped[0].qaIssues).toEqual(expect.arrayContaining([
      "missing_question_or_passage", "missing_explanation", "missing_learning_objective",
    ]));
    expect(JSON.parse(mapped[0].contentData).learning_objective).toBe("");
    expect(mapped[1].qaStatus).toBe("passed");
  });
  it("잘못된 난이도 metrics도 해당 문항의 QA 차단으로 반환한다", () => {
    const [item] = mapGeneratedItemsToQuestionBank({ items: [{
      title: "휴대전화 사용 요약", contentData: content("MIDDLE_HIGH", "SUMMARY", { difficulty_metrics: { reasoning_depth: 9 } }),
    }] }, { course: "MIDDLE_HIGH", tool_type: "SUMMARY" });
    expect(item.qaStatus).toBe("blocked");
    expect(item.qaIssues).toContain("difficulty_metrics_failed");
  });
  it("contentData 밖의 공통 필드와 문자열 중첩을 보존한다", () => {
    const payload = content("MIDDLE_HIGH", "SUMMARY");
    const { question, explanation, learning_objective, ...nested } = payload;
    const [item] = mapGeneratedItemsToQuestionBank({ items: [{
      title: "휴대전화 사용 요약", difficulty: "medium", question, explanation, learning_objective,
      contentData: JSON.stringify({ contentData: nested }),
    }] }, { course: "MIDDLE_HIGH", tool_type: "SUMMARY" });
    expect(item.qaStatus).toBe("passed");
    expect(JSON.parse(item.contentData)).toMatchObject({ question, explanation, learning_objective, difficulty: 3 });
  });
  it.each(["PARAGRAPH_REORDERING", "TOPIC_WIZARD", "CHECKLIST"] as const)("%s는 도구 고유 정답 구조가 있으면 객관식 정답 필드를 요구하지 않는다", tool => {
    const payload = content("MIDDLE_HIGH", tool);
    delete (payload as Record<string, unknown>).correct_answer;
    delete (payload as Record<string, unknown>).model_answer;
    const [item] = mapGeneratedItemsToQuestionBank({ items: [{ title: "논술 적용 연습", contentData: payload }] }, { course: "MIDDLE_HIGH", tool_type: tool });
    expect(item.qaStatus).toBe("passed");
  });
  it("AI 호출에 내부 필수 필드가 명시된 strict JSON schema를 전달한다", async () => {
    const llm = vi.fn(async () => ({ choices: [{ message: { content: JSON.stringify({ items: [{ title: "휴대전화 사용 요약", contentData: content("MIDDLE_HIGH", "SUMMARY") }] }) } }] }) as any);
    await generateQuestionBankItems({ course: "MIDDLE_HIGH", tool_type: "SUMMARY" }, { llm });
    const format = llm.mock.calls[0][0].responseFormat;
    expect(format.json_schema.strict).toBe(true);
    const schema = format.json_schema.schema.properties.items.items.properties.contentData;
    expect(schema.required).toEqual(expect.arrayContaining(["question", "explanation", "learning_objective", "difficulty_metrics", "passage", "model_answer"]));
    expect(schema.additionalProperties).toBe(false);
  });

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
