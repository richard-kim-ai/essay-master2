export const COURSE_TYPES = ["elementary", "middle_high", "high_univ", "general_adult"] as const;

export type CourseType = (typeof COURSE_TYPES)[number];

export const COURSE_OPTIONS: ReadonlyArray<{ value: CourseType; label: string }> = [
  { value: "elementary", label: "초등" },
  { value: "middle_high", label: "중고등" },
  { value: "high_univ", label: "고등/대입" },
  { value: "general_adult", label: "일반/직장인" },
];

const courseTagByType: Record<CourseType, string> = Object.fromEntries(
  COURSE_OPTIONS.map((course) => [course.value, course.label]),
) as Record<CourseType, string>;

const courseTypeByTag: Record<string, CourseType> = Object.fromEntries(
  COURSE_OPTIONS.map((course) => [course.label, course.value]),
) as Record<string, CourseType>;

// 기존 가입자에게 저장된 축약 태그도 새 과정 구분과 동일하게 해석합니다.
courseTypeByTag["일반"] = "general_adult";

export function getCourseTag(courseType: CourseType): string {
  return courseTagByType[courseType];
}

export function getCourseTypeFromUserTag(tag?: string | null): CourseType {
  return tag && courseTypeByTag[tag] ? courseTypeByTag[tag] : "middle_high";
}
