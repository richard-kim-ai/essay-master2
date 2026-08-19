export type WorkbookCourseType = "elementary" | "middle_high" | "high_univ" | "general_adult";

const WORKBOOK_RETURN_PATTERN = /^\/workbook\/(elementary|middle_high|high_univ|general_adult)\/([1-9]\d*)(?:\?lesson=(\d+))?$/;

function isWorkbookCourseType(value: string): value is WorkbookCourseType {
  return ["elementary", "middle_high", "high_univ", "general_adult"].includes(value);
}

export function buildWorkbookReturnPath(courseType: string, level: number, lessonIndex: number) {
  if (!isWorkbookCourseType(courseType) || !Number.isInteger(level) || level < 1 || !Number.isInteger(lessonIndex) || lessonIndex < 0) return null;
  return `/workbook/${courseType}/${level}?lesson=${lessonIndex}`;
}

export function buildToolPathWithWorkbookReturn(toolPath: "/topic-wizard" | "/thesis-checklist", returnPath: string | null) {
  return returnPath ? `${toolPath}?return_to=${encodeURIComponent(returnPath)}` : toolPath;
}

export function getWorkbookReturnPath(search: string) {
  const returnPath = new URLSearchParams(search).get("return_to");
  return returnPath && WORKBOOK_RETURN_PATTERN.test(returnPath) ? returnPath : null;
}

export function getInitialWorkbookLesson(search: string) {
  const lesson = new URLSearchParams(search).get("lesson");
  if (!lesson || !/^\d+$/.test(lesson)) return 0;
  return Number(lesson);
}
