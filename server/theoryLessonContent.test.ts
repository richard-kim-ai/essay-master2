import { describe, expect, it } from "vitest";
import {
  THEORY_LESSON_CONTENT_SCOPE,
  THEORY_LESSON_MASTER_PROMPT,
  THEORY_LESSON_SEED_ITEM_COUNT,
  buildTheoryLessonSeedItems,
  buildTheoryLessonUserPrompt,
  theoryLessonRequestSchema,
} from "./theoryLessonContent";

describe("theory lesson content generator", () => {
  it("builds a short user prompt separated from the master prompt", () => {
    const prompt = buildTheoryLessonUserPrompt({
      course: "MIDDLE_HIGH",
      theory_category: "C01",
      theory_subcategory: "삭제",
      lesson_level: 2,
      content_count: 5,
      example_mode: "TEXTBOOK_PLUS_NEW",
      context: "AUTO",
    });

    expect(prompt).toContain("course=MIDDLE_HIGH");
    expect(prompt).toContain("content_scope=THEORY_LESSON");
    expect(prompt.length).toBeLessThan(220);
    expect(THEORY_LESSON_MASTER_PROMPT).toContain("This generator is not the question-bank generator");
  });

  it("validates generator request parameters", () => {
    expect(() => theoryLessonRequestSchema.parse({
      course: "MIDDLE_HIGH",
      theory_category: "C01",
      lesson_level: 6,
    })).toThrow();
  });

  it("creates separated seed coverage for every course and core theory area", () => {
    const items = buildTheoryLessonSeedItems();
    const courses = new Set(items.map((item) => item.courseType));
    const categories = new Set(items.map((item) => item.theoryCategory));

    expect(items).toHaveLength(THEORY_LESSON_SEED_ITEM_COUNT);
    expect(courses).toEqual(new Set(["elementary", "middle_high", "high_univ", "general_adult"]));
    expect(categories).toEqual(new Set(["A01", "A02", "A03", "A04-01", "A04-05", "B01", "B04", "B07", "C01", "C02", "C04", "D03"]));

    for (const item of items) {
      const content = JSON.parse(item.contentData);
      expect(content.content_scope).toBe(THEORY_LESSON_CONTENT_SCOPE);
      expect(content.textbook_anchor.text.length).toBeLessThanOrEqual(80);
      expect(content.textbook_similar_example.label).toBe("유사 예시");
      expect(item.contentData).not.toContain("question_bank");
    }
  });
});
