import { describe, expect, it } from "vitest";
import { COURSE_REORDERING_QUESTIONS, toReorderingContent } from "./reorderingQuestionBank";

describe("과정별 단락 재구성 문제은행 v2", () => {
  it("각 과정에 제목과 제시문이 중복되지 않는 10개의 드래그 문항을 제공한다", () => {
    for (const questions of Object.values(COURSE_REORDERING_QUESTIONS)) {
      expect(questions).toHaveLength(10);
      expect(new Set(questions.map((question) => question.title)).size).toBe(10);
      expect(new Set(questions.map((question) => question.paragraphs.join("|"))).size).toBe(10);
      questions.forEach((question) => expect(question.paragraphs.length).toBeGreaterThanOrEqual(4));
    }
  });

  it("과정 목적에 맞는 난이도 분포를 유지한다", () => {
    const elementary = COURSE_REORDERING_QUESTIONS.elementary;
    const middleHigh = COURSE_REORDERING_QUESTIONS.middle_high;
    const highUniv = COURSE_REORDERING_QUESTIONS.high_univ;
    const adult = COURSE_REORDERING_QUESTIONS.general_adult;

    expect(elementary.filter((question) => question.difficulty === "easy")).toHaveLength(4);
    expect(middleHigh.filter((question) => question.difficulty === "hard")).toHaveLength(4);
    expect(highUniv.filter((question) => question.difficulty === "hard")).toHaveLength(8);
    expect(adult.filter((question) => question.difficulty === "hard")).toHaveLength(5);
  });

  it("모든 문항을 문단 카드·정답 순서·난이도 메타데이터가 있는 실습 JSON으로 변환한다", () => {
    const content = JSON.parse(toReorderingContent(COURSE_REORDERING_QUESTIONS.high_univ[0]));
    expect(content.reorderingVersion).toBe("v2");
    expect(content.paragraphs).toHaveLength(5);
    expect(content.paragraphs.map((paragraph: { correctOrder: number }) => paragraph.correctOrder)).toEqual([1, 2, 3, 4, 5]);
    expect(content.difficultyProfile.learningFocus).toContain("비교");
  });
});
