import { describe, expect, it } from "vitest";
import { stripAnswerKeys, toLearnerQuestion, toLearnerQuestions, toLearnerWorkbookQuestion } from "./learnerQuestionView";

const quiz = JSON.stringify({ prompt: "문장을 고르세요", options: ["가", "나", "다", "라"], answer: "나", explanation: "나가 맞다", correct_answer: "나" });
const reordering = JSON.stringify({
  prompt: "순서를 맞추세요",
  paragraphs: [{ id: "p1", content: "첫째", correctOrder: 1 }, { id: "p2", content: "둘째", correctOrder: 2 }, { id: "p3", content: "셋째", correctOrder: 3 }],
  answer: "p1-p2-p3",
  explanation: "시간 순서",
});

describe("학습자용 문항에서 정답 키 제거", () => {
  it("퀴즈의 정답·해설을 지우고 문제와 선택지는 남긴다", () => {
    const parsed = JSON.parse(stripAnswerKeys(quiz));
    expect(parsed).toEqual({ prompt: "문장을 고르세요", options: ["가", "나", "다", "라"] });
    expect(stripAnswerKeys(quiz)).not.toContain("나가 맞다");
  });

  it("단락 재구성의 정답 순서와 정답 문자열을 지우고 단락을 섞는다", () => {
    const parsed = JSON.parse(stripAnswerKeys(reordering, () => 0));
    expect(parsed.answer).toBeUndefined();
    expect(parsed.explanation).toBeUndefined();
    expect(parsed.paragraphs.every((paragraph: Record<string, unknown>) => !("correctOrder" in paragraph))).toBe(true);
    // random()이 항상 0이면 마지막부터 앞으로 교환되어 저장 순서와 달라진다.
    expect(parsed.paragraphs.map((paragraph: { id: string }) => paragraph.id)).not.toEqual(["p1", "p2", "p3"]);
    expect(parsed.paragraphs.map((paragraph: { id: string }) => paragraph.id).sort()).toEqual(["p1", "p2", "p3"]);
  });

  it("해석할 수 없는 내용은 빈 내용으로 바꿔 정답이 새지 않게 한다", () => {
    expect(stripAnswerKeys("not json")).toBe("{}");
    expect(stripAnswerKeys("[1,2]")).toBe("{}");
    expect(stripAnswerKeys("null")).toBe("{}");
  });

  it("학습자·학부모·비로그인에게는 제거하고 교사·관리자에게는 원본을 준다", () => {
    const row = { id: 1, contentData: quiz };
    for (const user of [{ role: "user" }, { role: "parent" }, null, undefined]) {
      expect(toLearnerQuestion(row, user).contentData).not.toContain("answer");
    }
    expect(toLearnerQuestion(row, { role: "admin" })).toBe(row);
    expect(toLearnerQuestions([row], { role: "teacher" })[0]).toBe(row);
    expect(toLearnerQuestions([row], { role: "user" })[0].contentData).not.toContain("explanation");
  });

  it("워크북 문항은 정답·해설 열을 비운다(교사·관리자 제외)", () => {
    const question = { id: 3, prompt: "문제", correctAnswer: "정답", explanation: "해설" };
    expect(toLearnerWorkbookQuestion(question, { role: "user" })).toEqual({ id: 3, prompt: "문제", correctAnswer: "", explanation: "" });
    expect(toLearnerWorkbookQuestion(question, { role: "admin" })).toBe(question);
  });
});
