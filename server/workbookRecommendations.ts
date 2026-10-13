import type { CourseType } from "../shared/course";

type Candidate = { id: number; courseType: string; level: number; lessonIndex: number; questionNumber: number };

/** 오답과 기본 심화 추천을 같은 과정 안에서만 고른다. 해당 과정이 비면 다른 과정으로 대체하지 않는다. */
export function selectWorkbookRecommendations<T extends Candidate>(questions: T[], mistakeIds: readonly number[], course?: CourseType): T[] {
  const candidates = questions.filter(q => !course || q.courseType === course);
  const mistakeSet = new Set(mistakeIds);
  const priority = (q: Candidate) => mistakeSet.has(q.id) ? 0 : q.level === 2 ? 1 : 2;
  return [...candidates].sort((a, b) => priority(a) - priority(b) || a.level - b.level || a.lessonIndex - b.lessonIndex || a.questionNumber - b.questionNumber || a.id - b.id).slice(0, 5);
}
