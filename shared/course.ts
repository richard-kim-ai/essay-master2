export const COURSE_TYPES = [
  "elementary",
  "middle_high",
  "high_univ",
  "general_adult",
] as const;
export type CourseType = (typeof COURSE_TYPES)[number];
export const COURSE_OPTIONS: ReadonlyArray<{
  value: CourseType;
  label: string;
}> = [
  { value: "elementary", label: "초등" },
  { value: "middle_high", label: "중고등" },
  { value: "high_univ", label: "고등/대입" },
  { value: "general_adult", label: "일반/직장인" },
];
const courseTagByType = Object.fromEntries(
  COURSE_OPTIONS.map(c => [c.value, c.label])
) as Record<CourseType, string>;
const courseTypeByTag: Record<string, CourseType> = Object.fromEntries(
  COURSE_OPTIONS.map(c => [c.label, c.value])
);
courseTypeByTag["일반"] = "general_adult";
export function isCourseType(value: unknown): value is CourseType {
  return (
    typeof value === "string" && COURSE_TYPES.includes(value as CourseType)
  );
}
/** 가입 과정이 없는 계정·역할 태그는 과정으로 추정하지 않는다. */
export function parseCourseTypeFromUserTag(
  tag?: string | null
): CourseType | null {
  const value = tag?.trim();
  return value && Object.prototype.hasOwnProperty.call(courseTypeByTag, value)
    ? courseTypeByTag[value]
    : null;
}
export function getCourseTag(courseType: CourseType): string {
  return courseTagByType[courseType];
}
/** 레거시 콘텐츠 변환용. 권한과 로그인 화면에서는 nullable parser를 사용한다. */
export function getCourseTypeFromUserTag(tag?: string | null): CourseType {
  return parseCourseTypeFromUserTag(tag) ?? "middle_high";
}
export function isLearnerAccount(
  user?: { role: string; tag?: string | null } | null
) {
  return user?.role === "user" && user.tag !== "학부모";
}
