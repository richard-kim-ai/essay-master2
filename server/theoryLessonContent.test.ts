import { describe, expect, it } from "vitest";
import { THEORY_LESSON_CONTENT_SCOPE, THEORY_LESSON_DATA_VERSION, THEORY_LESSON_MASTER_PROMPT, buildTheoryLessonSeedItems, buildTheoryLessonUserPrompt, qaTheoryLessonCandidate, theoryLessonRequestSchema } from "./theoryLessonContent";

describe("lesson_theory_content 기본 이론 데이터", () => {
  it("4개 과정과 4개 핵심 이론 단원으로 16개 콘텐츠를 제공한다", () => {
    const items = buildTheoryLessonSeedItems();
    expect(items).toHaveLength(16);
    for (const courseType of ["elementary", "middle_high", "high_univ", "general_adult"]) {
      expect(items.filter((item) => item.courseType === courseType)).toHaveLength(4);
    }
    expect(new Set(items.map((item) => `${item.courseType}:${item.theoryCategory}:${item.lessonLevel}`)).size).toBe(16);
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
    const advancedItems = buildTheoryLessonSeedItems().filter((item) => ["high_univ", "general_adult"].includes(item.courseType));
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
    const prompt = buildTheoryLessonUserPrompt({ course: "MIDDLE_HIGH", theory_category: "C01", lesson_level: 2, content_count: 3 });
    expect(prompt).toContain("course=MIDDLE_HIGH");
    expect(prompt).toContain("content_scope=THEORY_LESSON");
    expect(() => theoryLessonRequestSchema.parse({ course: "MIDDLE_HIGH", theory_category: "", lesson_level: 0 })).toThrow();
    expect(THEORY_LESSON_MASTER_PROMPT).toContain("question_bank의 랜덤 평가 문항이 아니라");
  });

  it("AI 이론 초안은 필수 구조·교재와 유사 예시 경계·개선 예의 차이를 QA한다", () => {
    const [seed] = buildTheoryLessonSeedItems();
    expect(qaTheoryLessonCandidate({ ...seed, qaIssues: [] })).toEqual([]);
    const invalid = qaTheoryLessonCandidate({ ...seed, title: "test", contentData: JSON.stringify({ core_concept: "짧음" }), qaIssues: [] });
    expect(invalid.length).toBeGreaterThan(0);
  });
});
