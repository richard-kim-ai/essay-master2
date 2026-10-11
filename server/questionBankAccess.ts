import { TRPCError } from "@trpc/server";
import { getCourseTypeFromUserTag } from "../shared/course";
import { getQuestionBankItemById } from "./db";

type Viewer = { role: string; tag?: string | null };

export function studentQuestionCourse(user: Viewer | null | undefined) {
  return user?.role === "user" && user.tag !== "학부모"
    ? getCourseTypeFromUserTag(user.tag)
    : undefined;
}

export function resolveQuestionBankCourse(user: Viewer, requested?: string) {
  const enrolled = studentQuestionCourse(user);
  if (enrolled && requested !== undefined && requested !== enrolled) {
    throw new TRPCError({ code: "FORBIDDEN", message: "가입한 과정의 아카이브만 이용할 수 있습니다." });
  }
  return enrolled ?? requested;
}

export async function assertQuestionBankItemAccess(user: Viewer, questionId: number) {
  const course = studentQuestionCourse(user);
  if (!course) return;
  const item = await getQuestionBankItemById(questionId);
  // 다른 과정의 문항 존재 여부·본문도 제공하지 않는다.
  if (!item || item.courseType !== course || item.isActive !== 1) {
    throw new TRPCError({ code: "FORBIDDEN", message: "가입한 과정의 공개 문항만 이용할 수 있습니다." });
  }
}
