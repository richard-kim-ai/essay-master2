import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/components/Navigation", () => ({
  default: () => <nav aria-label="주요 메뉴" />,
}));

vi.mock("wouter", () => ({
  Link: ({ href, children, ...props }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...props}>{children}</a>
  ),
}));

vi.mock("@/lib/trpc", () => ({
  trpc: {
    sampleEvaluation: {
      evaluate: {
        useMutation: () => ({
          mutate: vi.fn(),
          reset: vi.fn(),
          isPending: false,
          isError: false,
          data: undefined,
          error: null,
        }),
      },
    },
  },
}));

import SampleExperience from "./SampleExperience";

describe("Sample experience page", () => {
  it("AI 첨삭 입력 전에 외부 전송과 저장 범위를 고지한다", () => {
    const html = renderToStaticMarkup(<SampleExperience />);

    expect(html).toContain("외부 AI 모델 제공자에게 전송됩니다");
    expect(html).toContain("개인을 알아볼 수 있는 정보는 쓰지 마세요");
    expect(html).toContain("답안과 첨삭 결과는 저장하지 않으며");
  });

  it("처음 선택된 과정의 학습 방식과 논제를 보여준다", () => {
    const html = renderToStaticMarkup(<SampleExperience />);

    expect(html).toContain("초등 논술 학습 방식");
    expect(html).toContain("쉬는 시간에 책을 읽는 것이 좋은지");
    expect(html).not.toContain("지역 농산물");
  });
});
