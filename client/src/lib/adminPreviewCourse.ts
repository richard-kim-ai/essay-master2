import { isCourseType, type CourseType } from "@shared/course";
export const ADMIN_PREVIEW_COURSE_KEY = "essaymaster-admin-preview-course";
export const COURSE_CHANGED_EVENT = "essaymaster-learning-course-changed";
export const ADMIN_PREVIEW_COURSES: Array<{
  value: CourseType;
  label: string;
}> = [
  { value: "elementary", label: "초등 논술" },
  { value: "middle_high", label: "중고등 논술" },
  { value: "high_univ", label: "고등/대입 논술" },
  { value: "general_adult", label: "일반/직장인 논술" },
];
export function readAdminPreviewCourse(userId?: number): CourseType {
  if (typeof window === "undefined") return "elementary";
  try {
    const stored = localStorage.getItem(
      userId
        ? `${ADMIN_PREVIEW_COURSE_KEY}:${userId}`
        : ADMIN_PREVIEW_COURSE_KEY
    );
    return isCourseType(stored) ? stored : "elementary";
  } catch {
    return "elementary";
  }
}
export function saveAdminPreviewCourse(
  courseType: CourseType,
  userId?: number
) {
  if (!isCourseType(courseType)) return;
  try {
    localStorage.setItem(
      userId
        ? `${ADMIN_PREVIEW_COURSE_KEY}:${userId}`
        : ADMIN_PREVIEW_COURSE_KEY,
      courseType
    );
  } catch {}
  window.dispatchEvent(
    new CustomEvent(COURSE_CHANGED_EVENT, { detail: { courseType, userId } })
  );
}
