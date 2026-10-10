import { beforeEach, describe, expect, it, vi } from "vitest";

// 회원 유형별 접근 제어와 학습 기록 무결성 시나리오. DB는 필요한 함수만 대체한다.
vi.mock("./db", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./db")>();
  return {
    ...actual,
    getEssaySubmissionById: vi.fn(),
    getUserById: vi.fn(),
    updateEssaySubmission: vi.fn(),
    getTeacherFeedbackById: vi.fn(),
    getTeacherFeedbackByEssay: vi.fn(),
    getFeedbackCommentsByFeedback: vi.fn(),
    createTeacherFeedback: vi.fn(),
    updateTeacherFeedback: vi.fn(),
    createFeedbackComment: vi.fn(),
    recordLessonProgress: vi.fn(),
    issueCertificate: vi.fn(),
  };
});
vi.mock("./_core/notification", () => ({ notifyOwner: vi.fn() }));

import * as db from "./db";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

type TestUser = Partial<NonNullable<TrpcContext["user"]>> & { id: number };

function callerFor(user: TestUser | null) {
  const ctx = {
    user: user && { openId: `u-${user.id}`, email: `u${user.id}@example.com`, name: `사용자${user.id}`, loginMethod: "email", role: "user", createdAt: new Date(), updatedAt: new Date(), lastSignedIn: new Date(), ...user },
    req: { protocol: "https", headers: {} } as any,
    res: { clearCookie: vi.fn() } as any,
  } as unknown as TrpcContext;
  return appRouter.createCaller(ctx);
}

const owner: TestUser = { id: 10, role: "user", tag: "중고등" };
const otherStudent: TestUser = { id: 11, role: "user", tag: "중고등" };
const assignedTeacher: TestUser = { id: 20, role: "teacher", teacherStatus: "approved" };
const otherTeacher: TestUser = { id: 21, role: "teacher", teacherStatus: "approved" };
const pendingTeacher: TestUser = { id: 20, role: "teacher", teacherStatus: "pending" };
const admin: TestUser = { id: 1, role: "admin" };

const essay = { id: 5, userId: 10, title: "내 글", content: "본문", status: "submitted" };
const feedback = { id: 7, essayId: 5, teacherId: 20 };

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(db.getEssaySubmissionById).mockResolvedValue(essay as any);
  vi.mocked(db.getUserById).mockResolvedValue({ id: 10, teacherId: 20 } as any);
  vi.mocked(db.getTeacherFeedbackById).mockResolvedValue(feedback as any);
  vi.mocked(db.getTeacherFeedbackByEssay).mockResolvedValue(undefined);
  vi.mocked(db.getFeedbackCommentsByFeedback).mockResolvedValue([]);
  vi.mocked(db.createTeacherFeedback).mockResolvedValue({ insertId: 1 } as any);
});

describe("제출 글(essaySubmission) 접근", () => {
  it("글 주인·배정 교사·관리자만 글을 열 수 있다", async () => {
    await expect(callerFor(owner).essaySubmission.getById(5)).resolves.toMatchObject({ id: 5 });
    await expect(callerFor(assignedTeacher).essaySubmission.getById(5)).resolves.toMatchObject({ id: 5 });
    await expect(callerFor(admin).essaySubmission.getById(5)).resolves.toMatchObject({ id: 5 });
  });

  it("다른 학생·담당이 아닌 교사·승인 전 교사는 남의 글을 열 수 없다", async () => {
    for (const user of [otherStudent, otherTeacher, pendingTeacher]) {
      await expect(callerFor(user).essaySubmission.getById(5)).rejects.toMatchObject({ code: "FORBIDDEN" });
    }
  });

  it("비로그인은 글을 열 수 없다", async () => {
    await expect(callerFor(null).essaySubmission.getById(5)).rejects.toMatchObject({ code: "UNAUTHORIZED" });
  });

  it("다른 학생은 남의 글을 고칠 수 없다", async () => {
    await expect(callerFor(otherStudent).essaySubmission.update({ id: 5, content: "덮어쓰기" })).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(db.updateEssaySubmission).not.toHaveBeenCalled();
  });

  it("글 주인은 고칠 수 있지만, 교사 채점이 끝난 글은 고칠 수 없다", async () => {
    await callerFor(owner).essaySubmission.update({ id: 5, content: "수정" });
    expect(db.updateEssaySubmission).toHaveBeenCalledWith(5, expect.objectContaining({ content: "수정" }));

    vi.mocked(db.getEssaySubmissionById).mockResolvedValue({ ...essay, status: "reviewed" } as any);
    await expect(callerFor(owner).essaySubmission.update({ id: 5, content: "채점 후 수정" })).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("학생이 글 상태를 채점 완료(reviewed)로 바꿀 수 없다", async () => {
    await expect(callerFor(owner).essaySubmission.update({ id: 5, status: "reviewed" as any })).rejects.toThrow();
  });
});

describe("교사 첨삭(teacherFeedback) 접근", () => {
  it("비로그인은 첨삭과 코멘트를 읽을 수 없다", async () => {
    await expect(callerFor(null).teacherFeedback.getByEssay(5)).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    await expect(callerFor(null).teacherFeedback.getComments(7)).rejects.toMatchObject({ code: "UNAUTHORIZED" });
  });

  it("글 주인과 배정 교사는 첨삭을 읽고, 다른 학생은 읽을 수 없다", async () => {
    await expect(callerFor(owner).teacherFeedback.getByEssay(5)).resolves.toBeUndefined();
    await expect(callerFor(assignedTeacher).teacherFeedback.getComments(7)).resolves.toEqual([]);
    await expect(callerFor(otherStudent).teacherFeedback.getByEssay(5)).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(callerFor(otherStudent).teacherFeedback.getComments(7)).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("학생은 교사 첨삭을 만들거나 고치거나 코멘트를 달 수 없다(점수 조작 차단)", async () => {
    await expect(callerFor(owner).teacherFeedback.create({ essayId: 5, overallScore: 100 })).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(callerFor(owner).teacherFeedback.update({ id: 7, overallScore: 100 })).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(callerFor(owner).teacherFeedback.addComment({ feedbackId: 7, lineNumber: 0, startIndex: 0, endIndex: 1, comment: "좋아요", commentType: "other" })).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(db.createTeacherFeedback).not.toHaveBeenCalled();
    expect(db.updateTeacherFeedback).not.toHaveBeenCalled();
    expect(db.createFeedbackComment).not.toHaveBeenCalled();
  });

  it("담당이 아닌 교사와 승인 전 교사는 첨삭할 수 없고, 배정 교사는 할 수 있다", async () => {
    await expect(callerFor(otherTeacher).teacherFeedback.update({ id: 7, overallScore: 90 })).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(callerFor(pendingTeacher).teacherFeedback.create({ essayId: 5, overallScore: 90 })).rejects.toMatchObject({ code: "FORBIDDEN" });
    await callerFor(assignedTeacher).teacherFeedback.create({ essayId: 5, overallScore: 90, overallComment: "논거가 좋습니다." });
    expect(db.createTeacherFeedback).toHaveBeenCalledWith(expect.objectContaining({ essayId: 5, teacherId: 20, overallScore: 90 }));
  });

  it("점수는 0~100 정수만 받고, 같은 글에 첨삭을 중복 생성할 수 없다", async () => {
    await expect(callerFor(assignedTeacher).teacherFeedback.create({ essayId: 5, overallScore: 1000 })).rejects.toThrow();
    vi.mocked(db.getTeacherFeedbackByEssay).mockResolvedValue(feedback as any);
    await expect(callerFor(assignedTeacher).teacherFeedback.create({ essayId: 5, overallScore: 80 })).rejects.toMatchObject({ code: "CONFLICT" });
  });
});

describe("학습 진행(progress)과 수료증(certificate)", () => {
  it("비로그인은 진행을 저장할 수 없다", async () => {
    await expect(callerFor(null).progress.upsert({ courseType: "middle_high", level: 1 })).rejects.toMatchObject({ code: "UNAUTHORIZED" });
  });

  it("학생이 점수·완료 여부를 보내도 서버는 받지 않고 서버 계산(recordLessonProgress)만 쓴다", async () => {
    vi.mocked(db.recordLessonProgress).mockResolvedValue({ curriculumId: 3, level: 2, score: 40, completed: false, answeredCount: 1, totalCount: 3 });
    const forged = { courseType: "middle_high", level: 2, score: 100, completed: 1 } as any;
    await expect(callerFor(owner).progress.upsert(forged)).resolves.toMatchObject({ completed: false, score: 40 });
    expect(db.recordLessonProgress).toHaveBeenCalledWith(expect.objectContaining({ id: 10 }), 2);
    expect(vi.mocked(db.recordLessonProgress).mock.calls[0]).toHaveLength(2);
  });

  it("가입 과정이 아닌 다른 과정, 관리자·교사·학부모 계정은 진행을 기록하지 않는다", async () => {
    await expect(callerFor(owner).progress.upsert({ courseType: "elementary", level: 1 })).resolves.toBeNull();
    await expect(callerFor(admin).progress.upsert({ courseType: "middle_high", level: 1 })).resolves.toBeNull();
    await expect(callerFor(assignedTeacher).progress.upsert({ courseType: "middle_high", level: 1 })).resolves.toBeNull();
    await expect(callerFor({ id: 12, role: "user", tag: "학부모" }).progress.upsert({ courseType: "middle_high", level: 1 })).resolves.toBeNull();
    expect(db.recordLessonProgress).not.toHaveBeenCalled();
  });

  it("수료증 신청은 학습자만, 레벨은 1~20 범위만 받고, 파일 주소(pdfUrl)는 클라이언트에서 받지 않는다", async () => {
    vi.mocked(db.issueCertificate).mockResolvedValue({ insertId: 1 } as any);
    await expect(callerFor(owner).certificate.issue({ courseType: "middle_high", level: 99, certificateType: "level_certificate" })).rejects.toThrow();
    await expect(callerFor({ id: 12, role: "user", tag: "학부모" }).certificate.issue({ courseType: "middle_high", level: 1, certificateType: "level_certificate" })).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(callerFor(assignedTeacher).certificate.issue({ courseType: "middle_high", level: 1, certificateType: "level_certificate" })).rejects.toMatchObject({ code: "FORBIDDEN" });

    await callerFor(owner).certificate.issue({ courseType: "middle_high", level: 1, certificateType: "level_certificate", pdfUrl: "https://evil.example/fake.pdf" } as any);
    const issued = vi.mocked(db.issueCertificate).mock.calls[0][0] as Record<string, unknown>;
    expect(issued).not.toHaveProperty("pdfUrl");
    expect(issued).toMatchObject({ userId: 10, courseType: "middle_high", level: 1 });
  });
});
