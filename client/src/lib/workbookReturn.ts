export type WorkbookCourseType =
  | "elementary"
  | "middle_high"
  | "high_univ"
  | "general_adult";

const WORKBOOK_RETURN_PATTERN =
  /^\/workbook\/(elementary|middle_high|high_univ|general_adult)\/([1-9]\d*)(?:\?lesson=(\d+))?$/;

function isWorkbookCourseType(value: string): value is WorkbookCourseType {
  return ["elementary", "middle_high", "high_univ", "general_adult"].includes(
    value
  );
}

export function buildWorkbookReturnPath(
  courseType: string,
  level: number,
  lessonIndex: number
) {
  if (
    !isWorkbookCourseType(courseType) ||
    !Number.isInteger(level) ||
    level < 1 ||
    !Number.isInteger(lessonIndex) ||
    lessonIndex < 0
  )
    return null;
  return `/workbook/${courseType}/${level}?lesson=${lessonIndex}`;
}

export function buildToolPathWithWorkbookReturn(
  toolPath: "/topic-wizard" | "/thesis-checklist",
  returnPath: string | null
) {
  if (!returnPath || !WORKBOOK_RETURN_PATTERN.test(returnPath)) return toolPath;
  return `${toolPath}?${new URLSearchParams({ return_to: returnPath }).toString()}`;
}

/** Passing the current course prevents cross-course return links; omitted keeps the legacy contract. */
export function getWorkbookReturnPath(
  search: string,
  expectedCourseType?: WorkbookCourseType | null
) {
  const returnPath = new URLSearchParams(search).get("return_to");
  const match = returnPath?.match(WORKBOOK_RETURN_PATTERN);
  if (!match) return null;
  if (expectedCourseType !== undefined && match[1] !== expectedCourseType)
    return null;
  return returnPath;
}

export function getInitialWorkbookLesson(search: string) {
  const lesson = new URLSearchParams(search).get("lesson");
  if (!lesson || !/^\d+$/.test(lesson)) return 0;
  return Number(lesson);
}
