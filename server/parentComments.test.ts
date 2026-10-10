import { describe, expect, it } from "vitest";
import { keepParentCommentsOnly } from "./db";

describe("keepParentCommentsOnly", () => {
  it("운영자 내부 메모는 숨기고 학부모 코멘트 줄만 남긴다", () => {
    const notes = [
      "관리자 메모: 결제 문의 있음",
      "[학부모 코멘트(김학부모)] 이번 주 과제를 확인했습니다. (2026. 10. 11.)",
      "[교사 메모] 보충 수업 필요",
    ].join("\n");

    expect(keepParentCommentsOnly(notes)).toBe("[학부모 코멘트(김학부모)] 이번 주 과제를 확인했습니다. (2026. 10. 11.)");
  });

  it("학부모 코멘트가 없거나 메모가 비어 있으면 null을 반환한다", () => {
    expect(keepParentCommentsOnly("관리자 메모만 있음")).toBeNull();
    expect(keepParentCommentsOnly("")).toBeNull();
    expect(keepParentCommentsOnly(null)).toBeNull();
    expect(keepParentCommentsOnly(undefined)).toBeNull();
  });
});
