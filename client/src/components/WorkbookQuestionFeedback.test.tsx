import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { WorkbookQuestionFeedback } from "./WorkbookQuestionFeedback";

describe("WorkbookQuestionFeedback", () => {
  it("retains the objective answer state and explanation after a generated title is hidden", () => {
    const html = renderToStaticMarkup(<WorkbookQuestionFeedback questionType="objective" result={{ isCorrect: 1, score: 100, aiFeedback: "정답입니다." }} explanation="주장과 근거의 연결을 확인하세요." />);
    expect(html).toContain("정답입니다.");
    expect(html).toContain("해설: 주장과 근거의 연결을 확인하세요.");
  });

  it("retains subjective evaluation details and AI feedback guidance after a generated title is hidden", () => {
    const html = renderToStaticMarkup(<WorkbookQuestionFeedback questionType="subjective" explanation="" result={{ isCorrect: 0, score: 82, aiFeedback: "", evaluation: { verdict: "adequate", summary: "주장과 근거의 연결이 적절합니다.", characterCount: 284, validReasonCount: 2, criteria: [{ key: "claim", label: "주장", score: 16, maxScore: 20, explanation: "입장이 분명합니다.", quote: "필요하다" }], priorityImprovements: ["근거를 더 구체화하세요."], isOnTopic: true, hasClearClaim: true, hasComparativeAnalysis: false, missingRequirements: ["비교 관점을 보완하세요."] } }} />);
    expect(html).toContain("AI 근거 기반 서술형 평가");
    expect(html).toContain("주장과 근거의 연결이 적절합니다.");
    expect(html).toContain("284자 · 근거 2개");
    expect(html).toContain("근거 인용: 필요하다");
    expect(html).toContain("근거를 더 구체화하세요.");
    expect(html).toContain("비교·분석 보완 필요");
  });
});
