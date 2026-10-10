import { describe, expect, it } from "vitest";
import { SAMPLE_COURSE_CONTENT, type SampleCourseKey } from "./sampleCourseContent";

const COURSES = Object.keys(SAMPLE_COURSE_CONTENT) as SampleCourseKey[];

describe("sample course content", () => {
  it("네 과정이 모두 있다", () => {
    expect([...COURSES].sort()).toEqual(["elementary", "general_adult", "high_univ", "middle_high"]);
  });

  it("과정마다 학습 방식 소개, 연습 문제, AI 논제가 서로 달라야 한다", () => {
    const unique = (pick: (key: SampleCourseKey) => string) => new Set(COURSES.map(pick)).size;

    expect(unique((key) => SAMPLE_COURSE_CONTENT[key].audience)).toBe(COURSES.length);
    expect(unique((key) => SAMPLE_COURSE_CONTENT[key].goal)).toBe(COURSES.length);
    expect(unique((key) => SAMPLE_COURSE_CONTENT[key].practice.passage)).toBe(COURSES.length);
    expect(unique((key) => SAMPLE_COURSE_CONTENT[key].practice.question)).toBe(COURSES.length);
    expect(unique((key) => SAMPLE_COURSE_CONTENT[key].aiTask)).toBe(COURSES.length);
    expect(unique((key) => SAMPLE_COURSE_CONTENT[key].levels.map((level) => level.title).join("|"))).toBe(COURSES.length);
  });

  it("연습 문제의 정답 번호가 보기 범위 안에 있고 보기가 중복되지 않는다", () => {
    for (const key of COURSES) {
      const { choices, correctIndex } = SAMPLE_COURSE_CONTENT[key].practice;
      expect(correctIndex).toBeGreaterThanOrEqual(0);
      expect(correctIndex).toBeLessThan(choices.length);
      expect(new Set(choices).size).toBe(choices.length);
    }
  });

  it("AI 논제는 서버 입력 한도(500자) 안에 있다", () => {
    for (const key of COURSES) {
      expect(SAMPLE_COURSE_CONTENT[key].aiTask.length).toBeLessThanOrEqual(500);
    }
  });
});
