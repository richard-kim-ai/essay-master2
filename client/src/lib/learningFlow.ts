export function getAccessibleLessonIndex(requestedIndex: number, lessonCount: number) {
  if (!Number.isInteger(lessonCount) || lessonCount < 1) return 0;
  return Math.min(Math.max(0, requestedIndex), lessonCount - 1);
}
