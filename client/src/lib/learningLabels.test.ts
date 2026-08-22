import { describe, expect, it } from "vitest";
import { formatLearningCourse, formatLearningDifficulty, formatLearningTool } from "./learningLabels";

describe("학습자용 표기", () => {
  it("과정과 도구의 내부 코드를 읽기 쉬운 학습자용 명칭으로 변환한다", () => {
    expect(formatLearningCourse("general_adult")).toBe("일반/직장인");
    expect(formatLearningTool("quiz")).toBe("문장 교정");
    expect(formatLearningTool("topic_wizard")).toBe("주제 설정");
  });

  it("정의되지 않은 내부 값은 안전한 일반 명칭으로 대체한다", () => {
    expect(formatLearningCourse("UNKNOWN_COURSE")).toBe("논술 과정");
    expect(formatLearningTool("unknown_tool")).toBe("논술 연습");
    expect(formatLearningDifficulty("unknown")).toBe("표준");
  });
});
