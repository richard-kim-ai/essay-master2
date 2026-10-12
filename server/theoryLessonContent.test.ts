import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("./_core/llm", () => ({
  invokeLLM: vi.fn(),
  listLLMModels: vi.fn(),
}));

import { invokeLLM, listLLMModels } from "./_core/llm";
import {
  THEORY_LESSON_CONTENT_SCOPE,
  THEORY_LESSON_DATA_VERSION,
  THEORY_LESSON_MASTER_PROMPT,
  buildTheoryLessonSeedItems,
  buildTheoryLessonUserPrompt,
  generateTheoryLessonDrafts,
  qaTheoryLessonCandidate,
  theoryLessonRequestSchema,
} from "./theoryLessonContent";

const validGeneratedItem = {
  title: "학교생활 글의 중심 생각 유지하기",
  theory_subcategory: "통일성과 일관성",
  core_concept:
    "통일성은 한 단락의 모든 문장이 하나의 중심 생각을 함께 뒷받침하도록 만드는 글쓰기 원리이다.",
  textbook_anchor: {
    kind: "교재 원리",
    text: "한 단락에는 하나의 중심 생각을 두고 모든 문장을 연결한다.",
  },
  "신규 유사 예시":
    "학급 규칙을 설명할 때 규칙의 이유와 효과를 같은 방향으로 이어 쓴다.",
  wrong_example: "학급 규칙은 필요하다. 나는 어제 좋아하는 영화를 보았다.",
  improved_example: "학급 규칙은 서로의 학습 시간을 지키기 위해 필요하다.",
  in_lesson_check: {
    question: "중심 생각과 관련 없는 문장을 고르세요.",
    answer: "좋아하는 영화 이야기",
  },
  answer_feedback:
    "중심 생각과 직접 연결되는 근거만 남기면 단락의 통일성이 높아집니다.",
  next_step:
    "단락 재구성 활동에서 중심 문장과 뒷받침 문장을 다시 배열해 보세요.",
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(listLLMModels).mockResolvedValue({
    object: "list",
    data: [
      { id: "gpt-5-mini", object: "model", created: 0, owned_by: "openai" },
      { id: "gpt-5", object: "model", created: 0, owned_by: "openai" },
    ],
  });
});

describe("lesson_theory_content 기본 이론 데이터", () => {
  it("4개 과정과 4개 핵심 이론 단원으로 16개 콘텐츠를 제공한다", () => {
    const items = buildTheoryLessonSeedItems();
    expect(items).toHaveLength(16);
    for (const courseType of [
      "elementary",
      "middle_high",
      "high_univ",
      "general_adult",
    ]) {
      expect(items.filter(item => item.courseType === courseType)).toHaveLength(
        4
      );
    }
    expect(
      new Set(
        items.map(
          item =>
            `${item.courseType}:${item.theoryCategory}:${item.lessonLevel}`
        )
      ).size
    ).toBe(16);
  });

  it("모든 콘텐츠를 THEORY_LESSON 범위로 명시하고 question_bank 평가 문항을 포함하지 않는다", () => {
    for (const item of buildTheoryLessonSeedItems()) {
      const content = JSON.parse(item.contentData);
      expect(content.content_scope).toBe(THEORY_LESSON_CONTENT_SCOPE);
      expect(content.data_version).toBe(THEORY_LESSON_DATA_VERSION);
      expect(content.core_concept).toBeTruthy();
      expect(content.textbook_anchor?.text).toBeTruthy();
      expect(content.in_lesson_check?.question).toBeTruthy();
      expect(content).not.toHaveProperty("toolType");
      expect(content).not.toHaveProperty("correct_answer");
    }
  });

  it("고교/대입과 일반/직장인 콘텐츠에는 강의 진행용 실제형 지문과 확인문항을 제공한다", () => {
    const advancedItems = buildTheoryLessonSeedItems().filter(item =>
      ["high_univ", "general_adult"].includes(item.courseType)
    );
    expect(advancedItems).toHaveLength(8);
    for (const item of advancedItems) {
      const content = JSON.parse(item.contentData);
      expect(content.lesson_passage?.text.length).toBeGreaterThan(80);
      expect(content.lesson_passage?.tasks.length).toBeGreaterThan(0);
      expect(content.lesson_passage?.model_answer).toBeTruthy();
      expect(content.lecture_practice_items.length).toBeGreaterThanOrEqual(2);
      expect(content.source_boundary).toContain("재구성");
    }
  });

  it("이론 생성용 짧은 입력은 과정·분류·레슨 범위만 포함하며 유효하지 않은 요청을 차단한다", () => {
    const prompt = buildTheoryLessonUserPrompt({
      course: "MIDDLE_HIGH",
      theory_category: "C01",
      lesson_level: 2,
      content_count: 3,
    });
    expect(prompt).toContain("course=MIDDLE_HIGH");
    expect(prompt).toContain("content_scope=THEORY_LESSON");
    expect(() =>
      theoryLessonRequestSchema.parse({
        course: "MIDDLE_HIGH",
        theory_category: "",
        lesson_level: 0,
      })
    ).toThrow();
    expect(THEORY_LESSON_MASTER_PROMPT).toContain(
      "question_bank의 랜덤 평가 문항이 아니라"
    );
  });

  it("AI 이론 초안은 필수 구조·교재와 유사 예시 경계·개선 예의 차이를 QA한다", () => {
    const [seed] = buildTheoryLessonSeedItems();
    expect(qaTheoryLessonCandidate({ ...seed, qaIssues: [] })).toEqual([]);
    const invalid = qaTheoryLessonCandidate({
      ...seed,
      title: "test",
      contentData: JSON.stringify({ core_concept: "짧음" }),
      qaIssues: [],
    });
    expect(invalid.length).toBeGreaterThan(0);
  });

  it("빈 본문 다음 모델의 텍스트 블록으로 복구하고 레거시 유사 예시를 정규화한다", async () => {
    vi.mocked(invokeLLM)
      .mockResolvedValueOnce({
        id: "first",
        created: 0,
        model: "gpt-5-mini",
        choices: [
          {
            index: 0,
            message: { role: "assistant", content: "" },
            finish_reason: "stop",
          },
        ],
      })
      .mockResolvedValueOnce({
        id: "second",
        created: 0,
        model: "gpt-5",
        choices: [
          {
            index: 0,
            message: {
              role: "assistant",
              content: [
                {
                  type: "text",
                  text: JSON.stringify({ items: [validGeneratedItem] }),
                },
              ],
            },
            finish_reason: "stop",
          },
        ],
      } as any);

    const result = await generateTheoryLessonDrafts({
      course: "MIDDLE_HIGH",
      theory_category: "B04",
      theory_subcategory: "통일성과 일관성",
      lesson_level: 2,
      content_count: 1,
      example_mode: "TEXTBOOK_PLUS_NEW",
      context: "학교생활",
    });

    expect(result.modelId).toBe("gpt-5");
    expect(result.items).toHaveLength(1);
    expect(result.items[0].qaIssues).toEqual([]);
    const content = JSON.parse(result.items[0].contentData);
    expect(content.textbook_similar_example).toEqual({
      label: "유사 예시",
      text: validGeneratedItem["신규 유사 예시"],
    });
    expect(content.source_boundary).toContain("교재 원리");
    expect(invokeLLM).toHaveBeenCalledTimes(2);
    for (const call of vi.mocked(invokeLLM).mock.calls) {
      expect(call[0]?.responseFormat).toEqual({ type: "json_object" });
    }
  });
});
