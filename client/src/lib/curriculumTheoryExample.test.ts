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

  it.each([
    {
      courseLabel: "고교/대입",
      contentData: {
        course: "HIGH_ADMISSION",
        core_concept: "제시문은 공통 쟁점과 입장 차이를 근거와 함께 비교해야 합니다.",
        textbook_similar_example: { label: "제시문 비교 예문", text: "A는 기술 확산의 효율을, B는 알고리즘 편향의 위험을 강조한다." },
        wrong_example: "두 제시문은 기술 발전에 대해 다른 의견을 말한다.",
        improved_example: "A와 B는 기술 발전의 편익을 인정하지만, B는 편향 통제 장치가 선행되어야 한다고 본다.",
      },
    },
    {
      courseLabel: "일반/직장인",
      contentData: {
        course: "GENERAL_WORK",
        core_concept: "보고서는 결론과 의사결정 요청을 먼저 제시한 뒤 근거를 간결하게 배치해야 합니다.",
        textbook_similar_example: { label: "업무 보고 예문", text: "이번 주 매출은 목표 대비 8% 낮아, 다음 주 프로모션 예산 증액 승인이 필요합니다." },
        wrong_example: "이번 주에 여러 일이 있었는데 매출이 조금 낮았고 검토가 필요할 것 같습니다.",
        improved_example: "이번 주 매출은 목표보다 8% 낮았습니다. 다음 주 프로모션 예산 증액 승인을 요청드립니다.",
      },
    },
  ])("$courseLabel 콘텐츠의 생성 예문과 개선 예를 보존한다", ({ contentData }) => {
    const example = parseCurriculumTheoryExample(JSON.stringify(contentData));

    expect(example?.exampleText).toBe(contentData.textbook_similar_example.text);
    expect(example?.wrongExample).toBe(contentData.wrong_example);
    expect(example?.improvedExample).toBe(contentData.improved_example);
  });
});
