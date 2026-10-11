import { TRPCError } from "@trpc/server";
import {
  isCourseType,
  isLearnerAccount,
  parseCourseTypeFromUserTag,
  type CourseType,
} from "../shared/course";
import { getQuestionBankItemById } from "./db";
type Viewer = { role: string; tag?: string | null };
export function requireLearnerCourse(user: Viewer): CourseType {
  if (!isLearnerAccount(user))
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "학습자 계정만 자신의 과정 학습을 진행할 수 있습니다.",
    });
  const course = parseCourseTypeFromUserTag(user.tag);
  if (!course)
    throw new TRPCError({
      code: "PRECONDITION_FAILED",
      message: "먼저 마이페이지에서 학습 과정을 선택해 주세요.",
    });
  return course;
}
export function studentQuestionCourse(
  user: Viewer | null | undefined
): CourseType | undefined {
  return user && isLearnerAccount(user)
    ? requireLearnerCourse(user)
    : undefined;
}
export function resolveQuestionBankCourse(
  user: Viewer,
  requested?: string
): CourseType | undefined {
  if (
    user.role !== "admin" &&
    user.role !== "teacher" &&
    !isLearnerAccount(user)
  )
    throw new TRPCError({
      code: "FORBIDDEN",
      message:
        "학부모는 연결된 학생의 학습 기록을 학부모 화면에서 확인해 주세요.",
    });
  const enrolled = studentQuestionCourse(user);
  if (requested !== undefined && !isCourseType(requested))
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "유효한 학습 과정을 선택해 주세요.",
    });
  if (enrolled && requested !== undefined && requested !== enrolled)
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "가입한 과정의 학습 자료만 이용할 수 있습니다.",
    });
  return enrolled ?? (requested as CourseType | undefined);
}
export async function assertQuestionBankItemAccess(
  user: Viewer,
  questionId: number,
  expectedTool?: string
) {
  const course = resolveQuestionBankCourse(user);
  const item = await getQuestionBankItemById(questionId);
  if (
    !item ||
    item.isActive !== 1 ||
    (course && item.courseType !== course) ||
    (expectedTool && item.toolType !== expectedTool)
  )
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "가입한 과정의 공개 문항만 이용할 수 있습니다.",
    });
  return item;
}
