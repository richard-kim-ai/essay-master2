import { describe, expect, it } from "vitest";
import { computeLessonProgress, LESSON_COMPLETION_MIN_SCORE } from "./lessonProgress";

describe("computeLessonProgress", () => {
  it("문항이 없으면 완료로 인정하지 않는다(검증할 근거가 없다)", () => {
    expect(computeLessonProgress({ questionIds: [], answers: [] })).toEqual({ score: 0, answeredCount: 0, totalCount: 0, completed: false });
  });

  it("풀지 않은 문항이 있으면 점수가 높아도 완료가 아니다", () => {
    const result = computeLessonProgress({ questionIds: [1, 2, 3], answers: [{ questionId: 1, score: 100 }, { questionId: 2, score: 100 }] });
    expect(result).toMatchObject({ answeredCount: 2, totalCount: 3, score: 67, completed: false });
  });

  it("모든 문항을 풀고 평균이 기준 이상이면 완료다", () => {
    const result = computeLessonProgress({ questionIds: [1, 2], answers: [{ questionId: 1, score: 60 }, { questionId: 2, score: 60 }] });
    expect(result).toMatchObject({ score: LESSON_COMPLETION_MIN_SCORE, completed: true });
  });

  it("모든 문항을 풀어도 평균이 기준 미만이면 완료가 아니다", () => {
    const result = computeLessonProgress({ questionIds: [1, 2], answers: [{ questionId: 1, score: 50 }, { questionId: 2, score: 50 }] });
    expect(result).toMatchObject({ answeredCount: 2, score: 50, completed: false });
  });

  it("같은 문항을 다시 풀면 문항별 최고 점수를 쓴다", () => {
    const result = computeLessonProgress({ questionIds: [1], answers: [{ questionId: 1, score: 20 }, { questionId: 1, score: 90 }, { questionId: 1, score: 40 }] });
    expect(result).toMatchObject({ score: 90, completed: true });
  });

  it("범위를 벗어난 점수와 다른 레벨의 문항 답안은 반영하지 않는다", () => {
    const result = computeLessonProgress({ questionIds: [1], answers: [{ questionId: 1, score: 9999 }, { questionId: 99, score: 100 }] });
    expect(result).toMatchObject({ score: 100, answeredCount: 1, totalCount: 1 });
    const negative = computeLessonProgress({ questionIds: [1], answers: [{ questionId: 1, score: -50 }] });
    expect(negative.score).toBe(0);
  });
});
