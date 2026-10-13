import React, { useState } from "react";
import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import {
  GuardianConsentFields,
  EMPTY_GUARDIAN,
  type GuardianInput,
} from "@/components/GuardianConsentFields";
import { trpc } from "@/lib/trpc";
import { COURSE_OPTIONS, type CourseType } from "@shared/course";

const PENDING_GUARDIAN_LOGIN_PATH = "/login?guardian=pending";

function isEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

/**
 * Blocking course-choice form for an authenticated learner whose tag has no
 * recognized course. It deliberately has no implicit/default course: a user
 * must make one explicit, irreversible selection.
 */
export function CourseEnrollment() {
  const { user, refresh, logout } = useAuth();
  const [courseType, setCourseType] = useState<CourseType | "">("");
  const [birthDate, setBirthDate] = useState("");
  const [guardian, setGuardian] = useState<GuardianInput>(EMPTY_GUARDIAN);
  const [formError, setFormError] = useState<string | null>(null);
  const [pendingNotice, setPendingNotice] = useState(false);

  const chooseCourse = trpc.auth.chooseLearningCourse.useMutation({
    onSuccess: async result => {
      if (result.requiresGuardianConsent) {
        // The server clears the session for a newly pending elementary learner.
        // Clear the client mirror too; refresh must not briefly unlock learner
        // screens while a guardian has not yet approved consent.
        setPendingNotice(true);
        await logout();
        if (typeof window !== "undefined")
          window.location.assign(PENDING_GUARDIAN_LOGIN_PATH);
        return;
      }
      await refresh();
    },
  });

  const elementary = courseType === "elementary";

  function validate() {
    if (!courseType) return "학습할 과정을 선택해 주세요.";
    if (!elementary) return null;
    if (!birthDate) return "초등 과정 학생은 생년월일을 입력해야 합니다.";
    if (!guardian.name.trim() || guardian.name.trim().length < 2)
      return "보호자 성명을 2자 이상 입력해 주세요.";
    if (!isEmail(guardian.email.trim()))
      return "보호자 이메일을 정확히 입력해 주세요.";
    if (
      guardian.email.trim().toLowerCase() === user?.email?.trim().toLowerCase()
    )
      return "보호자 이메일은 학생 이메일과 달라야 합니다.";
    return null;
  }

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const error = validate();
    if (error) {
      setFormError(error);
      return;
    }
    setFormError(null);
    chooseCourse.mutate({
      courseType: courseType as CourseType,
      ...(elementary
        ? {
            birthDate,
            guardian: {
              name: guardian.name.trim(),
              email: guardian.email.trim(),
              relation: guardian.relation,
            },
          }
        : {}),
    });
  }

  const mutationError = chooseCourse.error?.message;

  return (
    <main
      className="mx-auto flex min-h-[60vh] max-w-2xl items-center px-4 py-10 sm:px-6"
      aria-labelledby="course-enrollment-title"
    >
      <section className="w-full rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
        <p className="text-sm font-bold tracking-[0.12em] text-indigo-700">
          LEARNING COURSE
        </p>
        <h1
          id="course-enrollment-title"
          className="mt-2 text-2xl font-black tracking-tight text-slate-950 sm:text-3xl"
        >
          학습 과정을 선택해 주세요
        </h1>
        <p className="mt-3 leading-7 text-slate-600">
          과정에 맞는 커리큘럼과 학습 자료를 준비합니다. 선택을 완료한 뒤에는
          운영팀을 통해서만 변경할 수 있습니다.
        </p>

        {pendingNotice ? (
          <div
            className="mt-6 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-950"
            role="status"
          >
            보호자 동의 요청을 접수했습니다. 보호자 이메일에서 동의를 완료한 후
            다시 로그인해 주세요.
          </div>
        ) : (
          <form className="mt-7 space-y-5" onSubmit={submit} noValidate>
            <label
              className="block text-sm font-semibold text-slate-800"
              htmlFor="learning-course"
            >
              학습 과정
              <select
                id="learning-course"
                aria-describedby="course-selection-help"
                className="mt-2 h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-base text-slate-900 outline-none ring-indigo-500 focus:ring-2"
                value={courseType}
                disabled={chooseCourse.isPending}
                onChange={event => {
                  setCourseType(event.target.value as CourseType | "");
                  setFormError(null);
                }}
              >
                <option value="" disabled>
                  과정을 선택해 주세요
                </option>
                {COURSE_OPTIONS.map(course => (
                  <option key={course.value} value={course.value}>
                    {course.label} 과정
                  </option>
                ))}
              </select>
            </label>
            <p
              id="course-selection-help"
              className="-mt-3 text-xs leading-5 text-slate-500"
            >
              선택한 과정의 자료와 학습 경로가 적용됩니다.
            </p>

            {elementary && (
              <div className="space-y-4">
                <label
                  className="block text-sm font-semibold text-slate-800"
                  htmlFor="elementary-birth-date"
                >
                  학생 생년월일
                  <input
                    id="elementary-birth-date"
                    name="birthDate"
                    type="date"
                    className="mt-2 h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-base text-slate-900 outline-none ring-indigo-500 focus:ring-2"
                    value={birthDate}
                    disabled={chooseCourse.isPending}
                    onChange={event => setBirthDate(event.target.value)}
                    required
                  />
                </label>
                <GuardianConsentFields
                  value={guardian}
                  onChange={setGuardian}
                  disabled={chooseCourse.isPending}
                />
              </div>
            )}

            {(formError || mutationError) && (
              <p
                className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700"
                role="alert"
              >
                {formError || mutationError}
              </p>
            )}

            <Button
              className="h-11 w-full bg-indigo-700 font-bold hover:bg-indigo-800"
              type="submit"
              disabled={chooseCourse.isPending}
            >
              {chooseCourse.isPending
                ? "저장 중…"
                : "이 과정으로 학습 시작하기"}
            </Button>
          </form>
        )}
      </section>
    </main>
  );
}

export { PENDING_GUARDIAN_LOGIN_PATH };
export default CourseEnrollment;
