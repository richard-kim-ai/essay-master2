import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { EvaluationLoadingState } from "./EvaluationLoadingState";

describe("EvaluationLoadingState", () => {
  it("현재 평가 단계를 안내하고 접근 가능한 진행 상태를 렌더링한다", () => {
    const html = renderToStaticMarkup(<EvaluationLoadingState step={1} />);
    expect(html).toContain("AI가 답안을 차분히 읽고 있어요");
    expect(html).toContain("논제와 주장의 연결을 분석하고 있어요");
    expect(html).toContain("role=\"status\"");
    expect(html).toContain("aria-busy=\"true\"");
    expect(html).toContain("평가 진행률 42%");
    expect(html).toContain("답안 구조를 읽고");
  });

  it("범위를 벗어난 단계도 마지막 단계로 안전하게 고정한다", () => {
    const html = renderToStaticMarkup(<EvaluationLoadingState step={99} />);
    expect(html).toContain("4 / 4");
    expect(html).toContain("결과를 안전하게 저장하고 있어요");
  });
});
