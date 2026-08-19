import { describe, expect, it } from "vitest";
import { TOPIC_CATEGORY_GUIDANCE, findConflictingTopicCategories, getTopicCategoryGuidance } from "./topicCategoryGuidance";

describe("카테고리 연동 주제 안내", () => {
  it("모든 카테고리에 고유한 주제 예시와 핵심어를 제공한다", () => {
    expect(Object.keys(TOPIC_CATEGORY_GUIDANCE)).toHaveLength(8);
    for (const category of Object.keys(TOPIC_CATEGORY_GUIDANCE)) {
      const guidance = getTopicCategoryGuidance(category);
      expect(guidance?.example.length).toBeGreaterThan(15);
      expect(guidance?.keywords.length).toBeGreaterThan(3);
    }
  });

  it("선택 카테고리와 다른 영역의 명백한 핵심어를 감지한다", () => {
    expect(findConflictingTopicCategories("환경 문제", "학생의 시험 평가 방식을 바꾸어야 할까?")).toContain("교육");
    expect(findConflictingTopicCategories("교육", "학교에서 생성형 AI 사용 기준은 어떻게 마련해야 할까?")).toEqual([]);
  });

  it("새로운 표현처럼 중립적인 주제는 임의로 차단하지 않는다", () => {
    expect(findConflictingTopicCategories("문화", "공유 공간의 이용 규칙은 어떻게 정할까?")).toEqual([]);
  });
});
