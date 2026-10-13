// @vitest-environment jsdom
import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ rows: [] as any[], isLoading: false }));

vi.mock("@/lib/trpc", () => ({
  trpc: { admin: { aiUsageSummary: { useQuery: () => ({ data: mocks.rows, isLoading: mocks.isLoading }) } } },
}));

import AiUsageSummary from "./AiUsageSummary";

const date = new Date("2026-10-13T17:40:00Z");
let container: HTMLDivElement;
let root: Root;
beforeEach(() => {
  (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  mocks.isLoading = false;
  mocks.rows = [
    { feature: "aiAutoFeedback.create", calls: 6, tokens: 75282, users: 1, lastAt: date },
    { feature: "questionBank.gradeEssay", calls: 1, tokens: 1000, users: 1, lastAt: date },
  ];
});
afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

describe("관리자 AI 토큰 사용량 — 추정 비용", () => {
  it("기능별 추정 비용(원)과 합계를 토큰 옆에 보여 준다", () => {
    act(() => root.render(<AiUsageSummary />));
    const costs = Array.from(container.querySelectorAll('[data-testid="ai-usage-row-cost"]')).map((el) => el.textContent);
    expect(costs).toEqual(["약 119원 (82~155원)", "약 2원 (1~2원)"]);
    expect(container.querySelector('[data-testid="ai-usage-total-tokens"]')!.textContent).toBe("76,282");
    expect(container.querySelector('[data-testid="ai-usage-total-cost"]')!.textContent).toBe("약 120원 (83~158원)");
  });

  it("추정에 쓴 모델·단가·환율 가정과 실제 청구액과 다를 수 있다는 안내를 보여 준다", () => {
    act(() => root.render(<AiUsageSummary />));
    const note = container.querySelector('[data-testid="ai-usage-cost-note"]')!.textContent!;
    for (const text of ["gpt-5-mini", "1,400원/$", "30~70%", "청구액과 다를 수 있으며", "Manus 플랫폼 크레딧"]) expect(note).toContain(text);
  });

  it("기록이 없으면 비용 표와 안내 없이 빈 상태만 보여 준다", () => {
    mocks.rows = [];
    act(() => root.render(<AiUsageSummary />));
    expect(container.querySelector('[data-testid="ai-usage-empty"]')).not.toBeNull();
    expect(container.querySelector('[data-testid="ai-usage-cost-note"]')).toBeNull();
  });
});
