// @vitest-environment jsdom
import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import QuestionContentReview, {
  QuestionContentEditor,
  QuestionContentView,
} from "./QuestionContentReview";
import {
  readQuestionContent,
  readableQuestionTitle,
  questionExcerpt,
  patchQuestionContent,
} from "@/lib/questionContent";

const content = {
  question: "휴대전화 사용 규칙의 핵심 주장을 요약하시오.",
  passage: "학교 휴대전화 규칙은 편의와 학습권을 함께 고려해야 한다.",
  explanation: "두 쟁점과 조건을 함께 살핀다.",
  learning_objective: "주장과 근거를 구분한다.",
  choices: [
    "양쪽을 고려한다.",
    "모두 금지한다.",
    "모두 허용한다.",
    "규칙을 없앤다.",
  ],
  correct_answer: "양쪽을 고려한다.",
  paragraphs: [
    { id: "p1", content: "먼저 문제를 확인한다.", correctOrder: 2 },
    { id: "p2", content: "근거를 살펴본다.", correctOrder: 1 },
    { id: "p3", content: "결론을 제시한다.", correctOrder: 3 },
  ],
  keyPoints: ["편의", "학습권", "공동 규칙"],
  model_answer: "편의와 학습권을 함께 고려한 규칙이 필요하다.",
  guidelines: ["범위를 좁힌다.", "주장을 정한다.", "근거를 찾는다."],
  sampleOutput: {
    title: "학교 휴대전화 규칙",
    stance: "공동 규칙이 필요하다.",
    mainArgument: "편의와 학습권을 함께 보장한다.",
  },
  checklistItems: ["주장이 있는가?", "근거가 있는가?", "범위가 적절한가?"],
  passingStandard: "세 조건을 충족한다.",
  generation_origin: "ai_generated",
  human_review: {
    overall_passed: true,
    checklist: { content_matches_theory: true },
  },
  internal_secret_note: "표시하면 안 되는 내부 메타데이터",
};
let root: Root;
let host: HTMLDivElement;
async function render(node: React.ReactNode) {
  await act(async () => root.render(node));
}
async function change(label: string, value: string) {
  const input = host.querySelector(
    `[aria-label="${label}"]`
  ) as HTMLTextAreaElement;
  await act(async () => {
    Object.getOwnPropertyDescriptor(
      HTMLTextAreaElement.prototype,
      "value"
    )!.set!.call(input, value);
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });
}
describe("문항 읽기형 검토 화면", () => {
  beforeEach(() => {
    (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
    host = document.createElement("div");
    document.body.append(host);
    root = createRoot(host);
  });
  afterEach(async () => {
    await act(async () => root.unmount());
    host.remove();
  });
  it.each([
    "quiz",
    "reordering",
    "summary",
    "topic_wizard",
    "thesis_checklist",
  ])("%s 문항을 코드가 아닌 읽기형 내용으로 보여준다", async toolType => {
    await render(
      <QuestionContentView
        contentData={JSON.stringify(content)}
        toolType={toolType}
      />
    );
    expect(host.textContent).toContain(content.question);
    expect(host.textContent).toContain(content.explanation);
    expect(host.textContent).toContain(content.learning_objective);
    expect(host.textContent).not.toContain('"question":');
    expect(host.textContent).not.toContain("internal_secret_note");
    expect(host.textContent).not.toContain(content.internal_secret_note);
    if (toolType === "quiz") expect(host.textContent).toContain("정답");
    if (toolType === "reordering")
      expect(host.textContent).toContain("단락 2 → 단락 1 → 단락 3");
    if (toolType === "summary")
      expect(host.textContent).toContain(content.model_answer);
    if (toolType === "topic_wizard")
      expect(host.textContent).toContain(content.sampleOutput.mainArgument);
    if (toolType === "thesis_checklist")
      expect(host.textContent).toContain(content.passingStandard);
  });
  it("중첩 JSON과 코드 형태 제목을 내용으로 풀고 목록에는 본문만 보여준다", () => {
    const raw = JSON.stringify({ contentData: JSON.stringify(content) });
    expect(readQuestionContent(raw).content.question).toBe(content.question);
    expect(
      readableQuestionTitle(JSON.stringify({ title: "한국어 문항 제목" }), raw)
    ).toBe("한국어 문항 제목");
    expect(questionExcerpt(raw)).toBe(content.question);
    expect(readQuestionContent("{broken").invalid).toBe(true);
    expect(readableQuestionTitle("주제문 점검 — GENERAL_WORK", raw)).toBe("주제문 점검");
  });
  it("잘못된 JSON은 원본 코드 대신 안내를 표시한다", async () => {
    await render(<QuestionContentView contentData="{broken" toolType="quiz" />);
    expect(host.querySelector('[role="alert"]')).not.toBeNull();
    expect(host.textContent).not.toContain("{broken");
  });
  it("기본 미리보기에는 본문 편집 코드가 없고 수정 버튼으로 일반 폼을 연다", async () => {
    await render(
      <QuestionContentReview
        contentData={JSON.stringify(content)}
        toolType="summary"
        onChange={() => {}}
      />
    );
    expect(host.querySelector("textarea")).toBeNull();
    await act(async () =>
      Array.from(host.querySelectorAll("button"))
        .find(b => b.textContent === "문항 수정")!
        .click()
    );
    expect(host.querySelector('[aria-label="모범 답안"]')).not.toBeNull();
    expect(host.querySelector('[aria-label="문항 본문"]')).not.toBeNull();
  });
  it("폼 수정은 관련 본문만 바꾸고 메타데이터를 보존하며 이전 검수 결과를 초기화한다", async () => {
    let next = "";
    await render(
      <QuestionContentEditor
        contentData={JSON.stringify(content)}
        toolType="summary"
        onChange={value => {
          next = value;
        }}
      />
    );
    await change("해설", "수정한 한국어 해설");
    const parsed = JSON.parse(next);
    expect(parsed.explanation).toBe("수정한 한국어 해설");
    expect(parsed.internal_secret_note).toBe(content.internal_secret_note);
    expect(parsed.human_review.overall_passed).toBe(false);
    expect(parsed.human_review.checklist).toEqual({});
    expect(
      JSON.parse(
        patchQuestionContent(JSON.stringify(content), { question: "새 문항" })
      ).question
    ).toBe("새 문항");
  });
});
