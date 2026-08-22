import type { CourseType } from "@shared/course";

export const ADMIN_PREVIEW_COURSE_KEY = "essaymaster-admin-preview-course";
export const ADMIN_PREVIEW_COURSES: Array<{ value: CourseType; label: string }> = [
  { value: "elementary", label: "초등 논술" },
  { value: "middle_high", label: "중고등 논술" },
  { value: "high_univ", label: "고등/대입 논술" },
  { value: "general_adult", label: "일반/직장인 논술" },
];

export function readAdminPreviewCourse(): CourseType {
  if (typeof window === "undefined") return "elementary";
  const stored = window.localStorage.getItem(ADMIN_PREVIEW_COURSE_KEY);
  return ADMIN_PREVIEW_COURSES.some((course) => course.value === stored) ? stored as CourseType : "elementary";
}

export function saveAdminPreviewCourse(courseType: CourseType) {
  window.localStorage.setItem(ADMIN_PREVIEW_COURSE_KEY, courseType);
}
