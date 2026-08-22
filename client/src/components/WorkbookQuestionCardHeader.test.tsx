import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { WorkbookQuestionCardHeader } from "./WorkbookQuestionCardHeader";

describe("WorkbookQuestionCardHeader", () => {
  it("shows a concise activity label without the generated curriculum title while preserving objective scoring", () => {
    const html = renderToStaticMarkup(
      <WorkbookQuestionCardHeader
        questionType="objective"
        prompt="논술문 구조를 가장 잘 설명한 문장을 고르세요."
        result={{ isCorrect: 1, score: 100 }}
      />,
    );

    expect(html).toContain("선택형");
    expect(html).toContain("정답 (100점)");
    expect(html).toContain("논술문 구조를 가장 잘 설명한 문장을 고르세요.");
    expect(html).not.toContain("실전 기출문제");
    expect(html).not.toContain("Level 1");
  });

  it("preserves subjective evaluation scores and prompts after the generated title is hidden", () => {
    const html = renderToStaticMarkup(
      <WorkbookQuestionCardHeader
        questionType="subjective"
        prompt="주장과 근거를 갖춰 의견을 작성하세요."
        result={{ isCorrect: 0, score: 82, evaluation: { verdict: "adequate" } }}
      />,
    );

    expect(html).toContain("서술형 실습");
    expect(html).toContain("평가 점수: 82/100점");
    expect(html).toContain("주장과 근거를 갖춰 의견을 작성하세요.");
  });
});
