import { describe, expect, it } from "vitest";
import { buildCourseQuizContent, buildCourseSummaryContent, isLegacyRepeatedLearningContent } from "./learningToolContent";

const courses = ["elementary", "middle_high", "high_univ", "general_adult"] as const;

describe("learning tool content safeguards", () => {
  it("recognizes the retired repeated quiz and summary wording", () => {
    expect(isLegacyRepeatedLearningContent("그래서 이 문제는 매우 중요하고 중요하기 때문에 우리가 꼭 반드시 실천해야 한다.")).toBe(true);
    expect(isLegacyRepeatedLearningContent("구체적인 기준과 보완 장치를 함께 마련해야 한다고 주장한다.")).toBe(true);
    expect(isLegacyRepeatedLearningContent("학생의 근거를 비교해 판단 기준을 세운다.")).toBe(false);
  });

  it("creates course-specific quiz and summary materials without retired wording", () => {
    const quizAnswers = courses.map((course) => buildCourseQuizContent(course, "AI 활용 기준").answer);
    const summaryPrompts = courses.map((course) => buildCourseSummaryContent(course, "AI 활용 기준").prompt);

    expect(new Set(quizAnswers).size).toBe(courses.length);
    expect(new Set(summaryPrompts).size).toBe(courses.length);
    for (const content of [...quizAnswers, ...summaryPrompts]) {
      expect(isLegacyRepeatedLearningContent(content)).toBe(false);
    }
  });
});
