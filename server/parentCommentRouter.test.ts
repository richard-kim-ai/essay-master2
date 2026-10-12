import { beforeEach, describe, expect, it, vi } from "vitest";
import { TRPCError } from "@trpc/server";

vi.mock("./db", async (importOriginal) => ({
  ...(await importOriginal<typeof import("./db")>()),
  getLinkedStudentsForParent: vi.fn(),
  getEssaySubmissionById: vi.fn(),
  getUserById: vi.fn(),
}));
vi.mock("./parentCommentDb", async (importOriginal) => ({
  ...(await importOriginal<typeof import("./parentCommentDb")>()),
  assertCommentableEssay: vi.fn(),
  addParentComment: vi.fn(async () => undefined),
  listParentCommentsForEssay: vi.fn(async () => []),
}));

import * as db from "./db";
import { addParentComment, assertCommentableEssay, listParentCommentsForEssay } from "./parentCommentDb";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

type TestUser = Record<string, unknown> & { id: number };
function callerFor(user: TestUser | null) {
  const ctx = {
    user: user && { openId: `u-${user.id}`, email: `u${user.id}@example.com`, name: `사용자${user.id}`, loginMethod: "email", role: "user", createdAt: new Date(), updatedAt: new Date(), lastSignedIn: new Date(), ...user },
    req: { protocol: "https", headers: {} } as any,
    res: { clearCookie: vi.fn(), cookie: vi.fn() } as any,
  } as unknown as TrpcContext;
  return appRouter.createCaller(ctx);
}

const parent: TestUser = { id: 30, role: "user", tag: "학부모", name: "홍서방" };
const otherParent: TestUser = { id: 31, role: "user", tag: "학부모" };
const student: TestUser = { id: 28, role: "user", tag: "고등/대입" };
const otherStudent: TestUser = { id: 29, role: "user", tag: "고등/대입" };
const teacher: TestUser = { id: 40, role: "teacher", teacherStatus: "approved" };
const otherTeacher: TestUser = { id: 41, role: "teacher", teacherStatus: "approved" };
const admin: TestUser = { id: 1, role: "admin" };

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(db.getLinkedStudentsForParent).mockImplementation(async (parentId: number) => (parentId === 30 ? [{ id: 28, name: "홍길동" }] : []) as any);
  vi.mocked(db.getEssaySubmissionById).mockResolvedValue({ id: 5, userId: 28, title: "교육과 기술", status: "submitted" } as any);
  vi.mocked(db.getUserById).mockResolvedValue({ id: 28, teacherId: 40 } as any);
  vi.mocked(assertCommentableEssay).mockResolvedValue("교육과 기술");
});

describe("parent.addComment — 코멘트는 자녀가 제출한 글에만", () => {
  it("연결된 자녀의 글을 고르면 글과 연결해 저장한다(글 제목은 알림에 쓰인다)", async () => {
    await expect(callerFor(parent).parent.addComment({ studentId: 28, essayId: 5, comment: "  잘 썼어  " })).resolves.toBe(true);
    expect(assertCommentableEssay).toHaveBeenCalledWith(28, 5);
    expect(addParentComment).toHaveBeenCalledWith(expect.objectContaining({ studentId: 28, parentId: 30, essayId: 5, essayTitle: "교육과 기술", comment: "잘 썼어" }));
  });

  it("글(essayId) 없이는 보낼 수 없다", async () => {
    await expect(callerFor(parent).parent.addComment({ studentId: 28, comment: "응원해" } as any)).rejects.toThrow();
    expect(addParentComment).not.toHaveBeenCalled();
  });

  it("자녀가 제출하지 않은 글(초안·남의 글·삭제된 글)이면 저장하지 않는다", async () => {
    vi.mocked(assertCommentableEssay).mockRejectedValue(new TRPCError({ code: "BAD_REQUEST", message: "자녀가 제출한 글에만 코멘트를 남길 수 있습니다." }));
    await expect(callerFor(parent).parent.addComment({ studentId: 28, essayId: 99, comment: "응원해" })).rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect(addParentComment).not.toHaveBeenCalled();
  });

  it("연결되지 않은 학생, 학부모가 아닌 계정(학생·교사·관리자)은 코멘트를 남길 수 없다", async () => {
    await expect(callerFor(otherParent).parent.addComment({ studentId: 28, essayId: 5, comment: "응원해" })).rejects.toMatchObject({ code: "FORBIDDEN" });
    for (const user of [student, teacher, admin]) {
      await expect(callerFor(user).parent.addComment({ studentId: 28, essayId: 5, comment: "응원해" })).rejects.toMatchObject({ code: "FORBIDDEN" });
    }
    expect(addParentComment).not.toHaveBeenCalled();
  });

  it("빈 코멘트와 1000자를 넘는 코멘트는 받지 않는다", async () => {
    await expect(callerFor(parent).parent.addComment({ studentId: 28, essayId: 5, comment: "   " })).rejects.toThrow();
    await expect(callerFor(parent).parent.addComment({ studentId: 28, essayId: 5, comment: "가".repeat(1001) })).rejects.toThrow();
  });
});

describe("parent.commentsForEssay — 글에 연결된 코멘트를 볼 수 있는 사람", () => {
  it("글을 쓴 학생, 연결된 학부모, 담당 교사, 관리자는 볼 수 있다", async () => {
    for (const user of [student, parent, teacher, admin]) {
      await expect(callerFor(user).parent.commentsForEssay({ essayId: 5 })).resolves.toEqual([]);
    }
    expect(listParentCommentsForEssay).toHaveBeenCalledTimes(4);
  });

  it("다른 학생, 연결되지 않은 학부모, 담당이 아닌 교사는 볼 수 없다", async () => {
    for (const user of [otherStudent, otherParent, otherTeacher]) {
      await expect(callerFor(user).parent.commentsForEssay({ essayId: 5 })).rejects.toMatchObject({ code: "FORBIDDEN" });
    }
    expect(listParentCommentsForEssay).not.toHaveBeenCalled();
  });

  it("없는 글이면 NOT_FOUND, 로그인하지 않으면 UNAUTHORIZED", async () => {
    vi.mocked(db.getEssaySubmissionById).mockResolvedValue(undefined as any);
    await expect(callerFor(student).parent.commentsForEssay({ essayId: 5 })).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(callerFor(null).parent.commentsForEssay({ essayId: 5 })).rejects.toMatchObject({ code: "UNAUTHORIZED" });
  });
});

describe("parent.myComments", () => {
  it("학부모·교사·관리자에게는 빈 목록이다(받는 쪽은 학생이다)", async () => {
    for (const user of [parent, teacher, admin]) expect(await callerFor(user).parent.myComments()).toEqual([]);
  });
});
