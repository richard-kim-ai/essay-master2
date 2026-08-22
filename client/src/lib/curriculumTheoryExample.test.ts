import { describe, expect, it } from "vitest";
import { parseCurriculumTheoryExample } from "./curriculumTheoryExample";

describe("커리큘럼 이론 예문 변환", () => {
  it("콘텐츠 엔진의 유사 예시와 개선 예를 학습 화면용 데이터로 안전하게 변환한다", () => {
    const example = parseCurriculumTheoryExample(JSON.stringify({
      core_concept: "제시문은 공통 쟁점과 관점 차이를 구분해 읽어야 합니다.",
      textbook_similar_example: { label: "유사 예시", text: "두 제시문은 기술 발전을 다르게 평가한다." },
      wrong_example: "두 글은 모두 기술이 좋다고 말한다.",
      improved_example: "두 글은 기술 발전의 편익에는 동의하지만, 위험을 통제하는 방식에서 입장이 다르다.",
    }));

    expect(example).toMatchObject({
      exampleLabel: "유사 예시",
      exampleText: "두 제시문은 기술 발전을 다르게 평가한다.",
      improvedExample: "두 글은 기술 발전의 편익에는 동의하지만, 위험을 통제하는 방식에서 입장이 다르다.",
    });
  });

  it("잘못된 콘텐츠 데이터는 화면을 중단하지 않고 예문을 생략한다", () => {
    expect(parseCurriculumTheoryExample("not-json")).toBeNull();
    expect(parseCurriculumTheoryExample(JSON.stringify({ core_concept: "개념만 있음" }))).toBeNull();
  });
});
