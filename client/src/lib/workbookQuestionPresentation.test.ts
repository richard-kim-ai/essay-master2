import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { getWorkbookQuestionTypeLabel } from "./workbookQuestionPresentation";

const workbookSource = readFileSync(new URL("../pages/Workbook.tsx", import.meta.url), "utf8");

describe("workbook question presentation", () => {
  it("uses concise learning activity labels without generated question numbering", () => {
    expect(getWorkbookQuestionTypeLabel("objective")).toBe("선택형");
    expect(getWorkbookQuestionTypeLabel("subjective")).toBe("서술형 실습");
    expect(getWorkbookQuestionTypeLabel("objective")).not.toContain("#");
    expect(getWorkbookQuestionTypeLabel("subjective")).not.toContain("#");
  });

  it("does not render the generated database title on learner workbook question cards", () => {
    expect(workbookSource).toContain("<WorkbookQuestionCard key={q.id} questionType={q.questionType} prompt={q.prompt} explanation={q.explanation} result={res}>");
    expect(workbookSource).not.toContain("{q.title}");
    expect(workbookSource).not.toContain("기출문제 #{qIdx + 1}");
  });
});
