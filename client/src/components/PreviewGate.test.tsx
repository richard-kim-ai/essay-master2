import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { Router } from "wouter";
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import PreviewGate from "./PreviewGate";

const page = (name: string) => readFileSync(fileURLToPath(new URL(`../pages/${name}.tsx`, import.meta.url)), "utf8");

describe("비로그인 미리보기 적용 화면", () => {
  it.each(["QuizPage", "ParagraphReordering", "SummaryPractice", "TopicWizard", "ThesisChecklist"])(
    "%s는 로그인 안내로 막지 않고 PreviewGate로 화면을 보여준다",
    (name) => {
      const source = page(name);
      expect(source).toContain("<PreviewGate active={preview}");
      expect(source).not.toMatch(/<LoginRequired\s*\/>/);
      expect(source).not.toContain("로그인 후");
    },
  );

  it.each(["EssayArchive", "MistakeNotebook"])("%s는 DashboardLayout 미리보기를 켜고, 로그인 전에는 서버 조회를 하지 않는다", (name) => {
    const source = page(name);
    expect(source).toMatch(/<DashboardLayout previewTitle="[^"]+">/);
    expect(source).toContain("enabled: !preview");
  });
});

const render = (active: boolean) =>
  renderToStaticMarkup(
    <Router ssrPath="/quiz">
      <PreviewGate active={active} title="AI 문장 교정">
        <button type="button">정답 확인</button>
      </PreviewGate>
    </Router>,
  );

describe("PreviewGate", () => {
  it("로그인하지 않은 상태에서는 화면을 보여주되 클릭·입력을 막는다(inert)", () => {
    const html = render(true);
    expect(html).toContain("정답 확인");
    expect(html).toMatch(/<div[^>]*inert/);
    expect(html).toContain("pointer-events-none");
  });

  it("화면 위에 별도 안내 줄을 두지 않고, 눌렀을 때 뜨는 로그인 팝업만 둔다(헤더에 로그인·회원가입이 있다)", () => {
    const html = render(true);
    expect(html).not.toContain("미리보기 안내");
    expect(html).not.toContain("화면 구성만 둘러볼 수 있습니다");
    expect(html).toContain('data-preview-surface="true"');
  });

  it("로그인한 상태에서는 아무것도 바꾸지 않고 그대로 보여준다", () => {
    const html = render(false);
    expect(html).toContain("정답 확인");
    expect(html).not.toContain("inert");
    expect(html).not.toContain("미리보기");
  });
});
