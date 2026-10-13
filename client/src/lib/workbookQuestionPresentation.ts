export function getWorkbookQuestionTypeLabel(questionType: string) {
  return questionType === "objective" ? "선택형" : "서술형 실습";
}
