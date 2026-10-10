// 레슨 진행 기록은 학생이 보낸 값이 아니라, 서버가 채점해 저장한 워크북 답안으로 계산한다.
// 수료 판정(완료율·평균 점수)이 이 기록을 근거로 하므로, 클라이언트가 점수나 완료 여부를 직접 정할 수 없어야 한다.

// 모듈(레벨) 완료로 인정하는 평균 점수(문항별 최고 점수의 평균).
export const LESSON_COMPLETION_MIN_SCORE = 60;

export type LessonProgressEvidence = {
  /** 이 모듈(과정·레벨)에 속한 워크북 문항 id 전체 */
  questionIds: number[];
  /** 학생의 제출 답안 기록(같은 문항을 여러 번 풀 수 있음) */
  answers: Array<{ questionId: number; score: number | null }>;
};

export type LessonProgressResult = {
  score: number;
  answeredCount: number;
  totalCount: number;
  completed: boolean;
};

/** 문항별 최고 점수(0~100)의 평균을 점수로, 모든 문항을 풀고 기준 점수 이상이면 완료로 계산한다. */
export function computeLessonProgress(evidence: LessonProgressEvidence): LessonProgressResult {
  const totalCount = evidence.questionIds.length;
  if (totalCount === 0) return { score: 0, answeredCount: 0, totalCount: 0, completed: false };

  const best = new Map<number, number>();
  for (const answer of evidence.answers) {
    const score = Math.min(100, Math.max(0, Math.round(Number(answer.score ?? 0))));
    best.set(answer.questionId, Math.max(best.get(answer.questionId) ?? 0, score));
  }

  let answeredCount = 0;
  let sum = 0;
  for (const questionId of evidence.questionIds) {
    if (best.has(questionId)) answeredCount += 1;
    sum += best.get(questionId) ?? 0;
  }
  const score = Math.round(sum / totalCount);
  return { score, answeredCount, totalCount, completed: answeredCount === totalCount && score >= LESSON_COMPLETION_MIN_SCORE };
}
