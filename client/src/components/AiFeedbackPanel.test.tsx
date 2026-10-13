import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("wouter", () => ({ Link: ({ href, children }: any) => <a href={href}>{children}</a> }));

import AiFeedbackPanel from "./AiFeedbackPanel";

const ESSAY = "시간 선택권이 있다 그리고 시간 선택권이 있다는 매우 필요한 일이다.";
const ok = (overrides: Record<string, unknown> = {}) => ({
  id: 9,
  overallScore: 78,
  structureScore: 70,
  logicScore: 80,
  expressionScore: 84,
  overallComment: "주장은 분명하지만 같은 표현이 반복됩니다.",
  strengths: ["주장이 분명합니다"],
  weaknesses: ["같은 표현이 반복됩니다"],
  suggestions: ["반복되는 문장을 하나로 줄이세요"],
  revisedEssay: "시간 선택권은 매우 필요한 일이다.",
  sentenceCorrections: [{ original: "시간 선택권이 있다 그리고 시간 선택권이 있다는 매우 필요한 일이다.", revised: "시간 선택권은 매우 필요한 일이다.", reason: "같은 말이 반복됩니다." }],
  fallback_used: false,
  ...overrides,
});

describe("AI 첨삭 피드백 영역", () => {
  it("정상 첨삭은 'AI 모델 첨삭' 표시, 종합·구조·논리·표현 점수, 잘한 점·보완할 점·고칠 방법, 문장별 교정, 수정 답안과 비교 링크를 보여 준다", () => {
    const html = renderToStaticMarkup(<AiFeedbackPanel ai={ok()} essayContent={ESSAY} />);
    expect(html).toContain("AI 모델 첨삭");
    for (const text of ["종합", "78점", "구조", "70점", "논리", "80점", "표현", "84점"]) expect(html).toContain(text);
    for (const text of ["주장이 분명합니다", "같은 표현이 반복됩니다", "반복되는 문장을 하나로 줄이세요", "잘한 점", "보완할 점", "이렇게 고쳐 보세요"]) expect(html).toContain(text);
    expect(html).toContain('data-testid="ai-corrections"');
    expect(html).toContain("문장별 교정 (1곳)");
    expect(html).toContain("같은 말이 반복됩니다.");
    expect(html).toContain('data-testid="ai-revised-essay"');
    expect(html).toContain('href="/ai-feedback-compare/9"');
    expect(html).not.toContain('data-testid="ai-fallback-notice"');
  });

  it("AI 모델 연결 실패로 대체된 결과는 '기본 점검 결과'로 구분하고, 항목별 점수·수정 답안 없음과 횟수 미차감을 알리며 다시 요청 버튼을 준다", () => {
    const html = renderToStaticMarkup(<AiFeedbackPanel ai={ok({ fallback_used: true, revisedEssay: ESSAY })} essayContent={ESSAY} onRetry={() => undefined} />);
    expect(html).toContain("기본 점검 결과");
    expect(html).toContain('data-testid="ai-fallback-notice"');
    expect(html).toContain("AI 모델 연결에 실패해 기본 규칙 점검 결과만 제공되었습니다.");
    expect(html).toContain("AI 사용 횟수는 차감되지 않았습니다");
    expect(html).toContain("AI 첨삭 다시 요청");
    expect(html).toContain("기본 점검 점수");
    expect(html).not.toContain("AI 모델 첨삭");
    expect(html).not.toContain('aria-label="점수"');
    expect(html).not.toContain('data-testid="ai-revised-essay"');
  });

  it("저장된 기록의 fallbackUsed 표시와 JSON 문자열 목록(suggestions)도 같은 방식으로 읽는다", () => {
    const html = renderToStaticMarkup(<AiFeedbackPanel ai={ok({ fallback_used: undefined, fallbackUsed: true, suggestions: JSON.stringify(["저장된 제안 하나"]), sentenceCorrections: undefined })} essayContent={ESSAY} />);
    expect(html).toContain("기본 점검 결과");
    expect(html).toContain("저장된 제안 하나");
  });

  it("수정 답안이 원문과 같으면(생성 실패·옛 기록) 수정 답안 영역 대신 안내를 보여 준다", () => {
    const html = renderToStaticMarkup(<AiFeedbackPanel ai={ok({ revisedEssay: ESSAY, sentenceCorrections: [] })} essayContent={ESSAY} />);
    expect(html).toContain('data-testid="ai-no-revision"');
    expect(html).not.toContain('data-testid="ai-revised-essay"');
    expect(html).not.toContain('data-testid="ai-corrections"');
  });

  it("첨삭 결과가 없으면 아무것도 그리지 않는다", () => {
    expect(renderToStaticMarkup(<AiFeedbackPanel ai={null} />)).toBe("");
  });
});
