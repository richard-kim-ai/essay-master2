// 학습자에게 내려주는 문항에서 정답 키를 제거한다.
// 정답·해설·정답 순서는 서버가 제출을 판정한 결과(quiz.submitAnswer, questionBank.reorderingSubmit, 워크북 제출)로만 돌려준다.
// 교사·관리자는 문항 검수를 위해 원본 그대로 본다.

const ANSWER_KEYS = ["answer", "correct_answer", "correctAnswer", "explanation", "model_answer", "modelAnswer", "reference_answer", "referenceAnswer"] as const;

type QuestionRow = { contentData: string; [key: string]: unknown };

/** 정답이 드러나는 키를 지우고, 단락 재구성은 정답 순서 표시를 없애고 단락을 섞는다. 해석할 수 없는 내용은 비워 정답이 새지 않게 한다. */
export function stripAnswerKeys(contentData: string, random: () => number = Math.random): string {
  let parsed: unknown;
  try {
    parsed = JSON.parse(contentData);
  } catch {
    return "{}";
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return "{}";
  const content: Record<string, unknown> = { ...(parsed as Record<string, unknown>) };
  for (const key of ANSWER_KEYS) delete content[key];
  if (Array.isArray(content.paragraphs)) {
    const paragraphs = content.paragraphs.map((item) => {
      if (!item || typeof item !== "object") return item;
      const { correctOrder: _correctOrder, ...rest } = item as Record<string, unknown>;
      return rest;
    });
    // 저장 순서가 곧 정답 순서일 수 있어 섞어서 내려준다.
    for (let index = paragraphs.length - 1; index > 0; index -= 1) {
      const swap = Math.floor(random() * (index + 1));
      [paragraphs[index], paragraphs[swap]] = [paragraphs[swap], paragraphs[index]];
    }
    content.paragraphs = paragraphs;
  }
  return JSON.stringify(content);
}

export function canSeeAnswerKeys(user: { role?: string } | null | undefined): boolean {
  return user?.role === "admin" || user?.role === "teacher";
}

export function toLearnerQuestion<T extends QuestionRow>(row: T, user: { role?: string } | null | undefined): T {
  if (canSeeAnswerKeys(user)) return row;
  return { ...row, contentData: stripAnswerKeys(row.contentData) };
}

export function toLearnerQuestions<T extends QuestionRow>(rows: T[], user: { role?: string } | null | undefined): T[] {
  return canSeeAnswerKeys(user) ? rows : rows.map((row) => toLearnerQuestion(row, user));
}

/** 워크북 문항(정답·해설 열) 학습자용. 서술형의 채점 핵심(correctAnswer)도 숨긴다. */
export function toLearnerWorkbookQuestion<T extends { correctAnswer?: unknown; explanation?: unknown }>(row: T, user: { role?: string } | null | undefined): T {
  if (canSeeAnswerKeys(user)) return row;
  return { ...row, correctAnswer: "", explanation: "" };
}
