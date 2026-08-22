import { describe, expect, it } from "vitest";
import { resolveWorkbookLessonConnection } from "./db";

describe("워크북 레슨 연결 기준", () => {
  const theoryContent = [{ id: 11, title: "이론 1" }, { id: 12, title: "이론 2" }, { id: 13, title: "이론 3" }];
  const workbookQuestions = [{ id: 21, title: "기출 1" }, { id: 22, title: "기출 2" }, { id: 23, title: "기출 3" }];

  it("자동 기준에서는 레슨 순서에 맞는 이론 한 건과 레슨의 고정 기출문제를 사용한다", () => {
    const result = resolveWorkbookLessonConnection({ connectionMode: "automatic", lessonIndex: 1, theoryContent, workbookQuestions, theoryContentIds: [11], workbookQuestionIds: [21] });
    expect(result.theoryContent.map((item) => item.id)).toEqual([12]);
    expect(result.workbookQuestions.map((item) => item.id)).toEqual([21, 22, 23]);
  });

  it("직접 선택 기준에서는 관리자가 고른 이론과 기출문제만 사용한다", () => {
    const result = resolveWorkbookLessonConnection({ connectionMode: "manual", lessonIndex: 0, theoryContent, workbookQuestions, theoryContentIds: [11, 13], workbookQuestionIds: [22] });
    expect(result.theoryContent.map((item) => item.id)).toEqual([11, 13]);
    expect(result.workbookQuestions.map((item) => item.id)).toEqual([22]);
  });
});
