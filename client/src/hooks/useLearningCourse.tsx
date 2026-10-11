import React, {
  createContext,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useState,
} from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/_core/hooks/useAuth";
import {
  getCourseTag,
  isLearnerAccount,
  parseCourseTypeFromUserTag,
  type CourseType,
} from "@shared/course";
import {
  COURSE_CHANGED_EVENT,
  readAdminPreviewCourse,
  saveAdminPreviewCourse,
} from "@/lib/adminPreviewCourse";
export type LearningCourseState = {
  courseType: CourseType | null;
  effectiveCourse: CourseType | null;
  courseLabel: string;
  scopeKey: string;
  loading: boolean;
  ready: boolean;
  isStudent: boolean;
  canSelectCourse: boolean;
  canLearn: boolean;
  canPersist: boolean;
  needsSelection: boolean;
  mode:
    | "loading"
    | "learner"
    | "staff-preview"
    | "public-preview"
    | "course-required"
    | "non-learner";
  setCourseType: (course: CourseType) => void;
};
const Context = createContext<LearningCourseState | null>(null);
function useCourseState(): LearningCourseState {
  const { user, loading } = useAuth();
  const [preview, setPreview] = useState<CourseType>(() =>
    readAdminPreviewCourse(user?.id)
  );
  useEffect(() => {
    setPreview(readAdminPreviewCourse(user?.id));
  }, [user?.id, user?.role]);
  const staff = user?.role === "admin" || user?.role === "teacher";
  useEffect(() => {
    const changed = (e: Event) => {
      const d = (e as CustomEvent).detail;
      if (staff && (!d?.userId || d.userId === user?.id))
        setPreview(readAdminPreviewCourse(user?.id));
    };
    window.addEventListener(COURSE_CHANGED_EVENT, changed);
    window.addEventListener("storage", changed);
    return () => {
      window.removeEventListener(COURSE_CHANGED_EVENT, changed);
      window.removeEventListener("storage", changed);
    };
  }, [user?.id, staff]);
  const isStudent = isLearnerAccount(user);
  const course = loading
    ? null
    : isStudent
      ? parseCourseTypeFromUserTag(user?.tag)
      : staff
        ? preview
        : !user
          ? preview
          : null;
  const mode: LearningCourseState["mode"] = loading
    ? "loading"
    : !user
      ? "public-preview"
      : staff
        ? "staff-preview"
        : isStudent
          ? course
            ? "learner"
            : "course-required"
          : "non-learner";
  return useMemo(
    () => ({
      courseType: course,
      effectiveCourse: course,
      courseLabel: course ? getCourseTag(course) : "과정 선택 필요",
      scopeKey: `${user?.id ?? "guest"}:${user?.role ?? "guest"}:${user?.tag ?? ""}:${mode}:${course ?? "none"}`,
      loading,
      ready: !loading,
      isStudent,
      canSelectCourse: !loading && (staff || !user),
      canLearn: !loading && !!course,
      canPersist: !loading && isStudent && !!course,
      needsSelection: mode === "course-required",
      mode,
      setCourseType: (next: CourseType) => {
        if (staff) {
          saveAdminPreviewCourse(next, user?.id);
          setPreview(next);
        } else if (!user) setPreview(next);
      },
    }),
    [course, loading, isStudent, mode, user?.id, user?.role, user?.tag, staff]
  );
}
/** 각 화면의 과정은 URL·독립 기본값이 아니라 이 계약에서만 가져온다. */
export function useLearningCourse() {
  const shared = useContext(Context);
  const standalone = useCourseState();
  return shared ?? standalone;
}
export function LearningCourseProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const state = useCourseState();
  const queryClient = useQueryClient();
  const [cacheScope, setCacheScope] = useState(state.scopeKey);
  useLayoutEffect(() => {
    if (cacheScope === state.scopeKey) return;
    let alive = true;
    // 인증 결과는 보존하고 이전 신원·역할·과정의 데이터만 폐기한다.
    const protectedQuery = (q: any) =>
      JSON.stringify(q.queryKey[0]) !== JSON.stringify(["auth", "me"]);
    void queryClient.cancelQueries({ predicate: protectedQuery }).then(() => {
      if (!alive) return;
      queryClient.removeQueries({ predicate: protectedQuery });
      queryClient.getMutationCache().clear();
      setCacheScope(state.scopeKey);
    });
    return () => {
      alive = false;
    };
  }, [state.scopeKey, cacheScope, queryClient]);
  return (
    <Context.Provider value={state}>
      {cacheScope === state.scopeKey ? (
        <React.Fragment key={state.scopeKey}>{children}</React.Fragment>
      ) : (
        <div role="status" className="p-8 text-center text-slate-600">
          학습 과정을 확인하고 있습니다.
        </div>
      )}
    </Context.Provider>
  );
}
