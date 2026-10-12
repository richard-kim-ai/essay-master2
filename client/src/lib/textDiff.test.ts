import { describe, expect, it } from "vitest";
import { diffTexts } from "./textDiff";

describe("diffTexts", () => {
  it("같은 글이면 변경이 없다", () => {
    const result = diffTexts("기술은 교육을 바꾼다.\n둘째 문단이다.", "기술은 교육을 바꾼다.\n둘째 문단이다.");
    expect(result.identical).toBe(true);
    expect(result.changes).toEqual([]);
    expect(result.changedPercent).toBe(0);
  });

  it("바뀐 표현은 원문 쪽 삭제와 첨삭 쪽 추가가 한 묶음(바꿈)으로 번호가 붙는다", () => {
    const result = diffTexts("기술은 교육을 매우 바꾼다.", "기술은 교육을 크게 바꾼다.");
    expect(result.changes).toEqual([{ id: 1, kind: "replace", before: "매우", after: "크게" }]);
    expect(result.addedWords).toBe(1);
    expect(result.removedWords).toBe(1);
    const marked = result.ops.filter((op) => op.type !== "equal");
    expect(marked.map((op) => [op.type, op.changeId])).toEqual([["delete", 1], ["insert", 1]]);
  });

  it("추가만 된 부분과 삭제만 된 부분을 구분한다", () => {
    const added = diffTexts("나는 학교에 간다.", "나는 매일 학교에 간다.");
    expect(added.changes).toEqual([{ id: 1, kind: "insert", before: "", after: "매일" }]);
    const removed = diffTexts("나는 매일 학교에 간다.", "나는 학교에 간다.");
    expect(removed.changes).toEqual([{ id: 1, kind: "delete", before: "매일", after: "" }]);
  });

  it("원문 다른 곳에 같은 단어가 있어도 바뀐 자리는 표시한다(예전 단어 집합 비교의 허점)", () => {
    // 첨삭 답안의 '교육은'은 원문에 이미 있는 단어지만 두 번째 자리에 새로 들어왔다.
    const result = diffTexts("교육은 중요하다. 기술은 빠르다.", "교육은 중요하다. 교육은 빠르다.");
    expect(result.changes).toEqual([{ id: 1, kind: "replace", before: "기술은", after: "교육은" }]);
  });

  it("떨어진 수정은 각각 번호를 매기고, 표시 순서는 삭제 다음 추가이다", () => {
    const result = diffTexts("가 나 다 라 마 바", "가 A 다 라 B 바");
    expect(result.changes.map((change) => [change.id, change.before, change.after])).toEqual([[1, "나", "A"], [2, "마", "B"]]);
    expect(result.ops.filter((op) => op.type !== "equal").map((op) => `${op.type}${op.changeId}`)).toEqual(["delete1", "insert1", "delete2", "insert2"]);
  });

  it("줄바꿈과 공백을 보존해 원문·첨삭 답안을 그대로 다시 이어 붙일 수 있다", () => {
    const original = "첫 줄입니다.\n둘째 줄에서 오류가 있다.\n\n셋째 문단.";
    const revised = "첫 줄입니다.\n둘째 줄에서 오류를 고쳤다.\n\n셋째 문단.";
    const result = diffTexts(original, revised);
    const rebuiltOriginal = result.ops.filter((op) => op.type !== "insert").map((op) => op.before).join("");
    const rebuiltRevised = result.ops.filter((op) => op.type !== "delete").map((op) => op.after).join("");
    expect(rebuiltOriginal).toBe(original);
    expect(rebuiltRevised).toBe(revised);
  });

  it("원문이 비어 있어도 오류 없이 전부 추가로 본다", () => {
    const result = diffTexts("", "새로 쓴 글");
    expect(result.changes).toHaveLength(1);
    expect(result.changes[0].kind).toBe("insert");
    expect(result.changedPercent).toBe(0);
  });

  it("아주 긴 글도 시간 안에 계산한다(약 3천 단어)", () => {
    const words = Array.from({ length: 3000 }, (_, index) => `단어${index}`);
    const revisedWords = words.map((word, index) => (index % 100 === 0 ? `${word}수정` : word));
    const started = Date.now();
    const result = diffTexts(words.join(" "), revisedWords.join(" "));
    expect(Date.now() - started).toBeLessThan(3000);
    expect(result.changes).toHaveLength(30);
  });
});
