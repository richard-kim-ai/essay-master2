import { describe, expect, it } from "vitest";
import { getAccessibleLessonIndex } from "./learningFlow";

describe("자유 레슨 이동", () => {
  it("이전 레슨 완료 상태와 무관하게 요청한 레슨을 선택한다", () => {
    expect(getAccessibleLessonIndex(1, 3)).toBe(1);
    expect(getAccessibleLessonIndex(2, 3)).toBe(2);
  });

  it("레슨 범위 바깥의 이동 요청은 안전하게 보정한다", () => {
    expect(getAccessibleLessonIndex(-1, 3)).toBe(0);
    expect(getAccessibleLessonIndex(9, 3)).toBe(2);
  });
});
