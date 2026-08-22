import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { WorkbookQuestionCard } from "./WorkbookQuestionCard";

describe("WorkbookQuestionCard", () => {
  it("renders the complete objective card with a concise label, answer status, explanation, and practice area", () => {
    const html = renderToStaticMarkup(<WorkbookQuestionCard questionType="objective" prompt="가장 적절한 문장을 고르세요." explanation="주장과 근거의 연결을 확인하세요." result={{ isCorrect: 1, score: 100, aiFeedback: "정답입니다." }}><div>선택지 영역</div></WorkbookQuestionCard>);
    expect(html).toContain("선택형");
    expect(html).toContain("정답 (100점)");
    expect(html).toContain("선택지 영역");
    expect(html).toContain("해설: 주장과 근거의 연결을 확인하세요.");
    expect(html).not.toContain("실전 기출문제");
  });

  it("renders the complete subjective card with the evaluation summary, criteria, and improvement guidance", () => {
    const html = renderToStaticMarkup(<WorkbookQuestionCard questionType="subjective" prompt="근거를 들어 의견을 작성하세요." explanation="" result={{ isCorrect: 0, score: 82, aiFeedback: "", evaluation: { verdict: "adequate", summary: "주장과 근거의 연결이 적절합니다.", characterCount: 284, validReasonCount: 2, criteria: [{ key: "claim", label: "주장", score: 16, maxScore: 20, explanation: "입장이 분명합니다.", quote: "필요하다" }], priorityImprovements: ["근거를 더 구체화하세요."], isOnTopic: true, hasClearClaim: true, hasComparativeAnalysis: false, missingRequirements: ["비교 관점을 보완하세요."] } }}><textarea aria-label="답안 작성" /></WorkbookQuestionCard>);
    expect(html).toContain("서술형 실습");
    expect(html).toContain("평가 점수: 82/100점");
    expect(html).toContain("AI 근거 기반 서술형 평가");
    expect(html).toContain("근거 인용: 필요하다");
    expect(html).toContain("근거를 더 구체화하세요.");
    expect(html).toContain("비교 관점을 보완하세요.");
  });
});
