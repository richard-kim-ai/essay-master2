import { beforeEach, describe, expect, it, vi } from "vitest";

// select는 미리 넣어 둔 결과를 차례로 돌려주는 가짜 DB(listEssaysForReview와 대시보드가 같은 큐를 쓴다).
const fake = vi.hoisted(() => ({ queue: [] as any[][] }));
vi.mock("./db", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./db")>();
  const chain: any = new Proxy(
    {},
    {
      get(_target, property) {
        if (property === "then") return (resolve: (value: unknown) => void) => resolve(fake.queue.shift() ?? []);
        return () => chain;
      },
    }
  );
  return { ...actual, getDb: vi.fn(async () => ({ select: () => chain })) };
});

import { appRouter } from "./routers";
import { getTeacherFeedbackDashboard } from "./teacherDashboardDb";
import { selectManagedStudentIds } from "./teacherStudents";

const NOW = new Date("2026-10-14T03:00:00Z").getTime();
const day = (daysAgo: number) => new Date(NOW - daysAgo * 24 * 60 * 60 * 1000);
const teacher = { id: 9, role: "teacher", teacherStatus: "approved" };

beforeEach(() => {
  fake.queue = [];
});

describe("지도 학생 선별(selectManagedStudentIds)", () => {
  const users = [
    { id: 1, role: "user", tag: "중고등", teacherId: 9 }, // 담당 교사로만 연결(권한 없음)
    { id: 2, role: "user", tag: "초등", teacherId: null }, // 학생 단위 권한만
    { id: 3, role: "user", tag: "중고등", teacherId: 9 }, // 연결 + 권한
    { id: 4, role: "user", tag: "중고등", teacherId: 77 }, // 다른 교사의 학생
    { id: 5, role: "user", tag: "학부모", teacherId: 9 }, // 학부모는 제외
    { id: 6, role: "teacher", tag: "교사", teacherId: 9 }, // 학습자가 아님
  ];
  const grants = [
    { scopeType: "student", studentId: 2, canManageProgress: 1 },
    { scopeType: "student", studentId: 3, canManageProgress: 1 },
    { scopeType: "organization", studentId: null, canManageProgress: 1 },
  ];

  it("담당 교사로 연결만 된 학생도(권한이 없어도) 지도 학생으로 세고, 연결·권한 관계를 구분한다", () => {
    const result = selectManagedStudentIds(users, grants, 9);
    expect([...result.entries()]).toEqual([[1, "assigned"], [2, "granted"], [3, "both"]]);
  });

  it("권한도 연결도 없으면 0명이고, 부여받은 권한이 있으면 연결이 없어도 센다", () => {
    expect(selectManagedStudentIds(users, [], 123).size).toBe(0);
    expect(selectManagedStudentIds(users, grants, 123).size).toBe(2); // 학생 단위 권한을 받은 2, 3
  });
});

describe("교사 첨삭 현황(getTeacherFeedbackDashboard)", () => {
  it("승인된 교사만 볼 수 있다", async () => {
    await expect(getTeacherFeedbackDashboard({ id: 1, role: "admin" })).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(getTeacherFeedbackDashboard({ id: 3, role: "teacher", teacherStatus: "pending" })).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(appRouter.createCaller({ user: null, req: { headers: {} }, res: {} } as any).teacherOperations.feedbackDashboard()).rejects.toMatchObject({ code: "UNAUTHORIZED" });
  });

  it("대기·작업 중·기한 경과·완료 수와 평균 점수, 최근 첨삭 목록을 실제 기록으로 계산한다", async () => {
    fake.queue = [
      // listEssaysForReview: 글 목록 → 첨삭 → 신청
      [
        { essayId: 1, title: "대기 글", status: "submitted", submittedAt: day(1), updatedAt: day(1), aiFeedbackId: null, content: "본문", studentId: 21, studentName: "김학생", studentEmail: "s@example.com" },
        { essayId: 2, title: "작업 중 글", status: "submitted", submittedAt: day(2), updatedAt: day(2), aiFeedbackId: null, content: "본문", studentId: 22, studentName: "이학생", studentEmail: "t@example.com" },
        { essayId: 3, title: "기한 지난 글", status: "submitted", submittedAt: day(9), updatedAt: day(9), aiFeedbackId: null, content: "본문", studentId: 23, studentName: "박학생", studentEmail: "p@example.com" },
        { essayId: 4, title: "완료 글", status: "reviewed", submittedAt: day(20), updatedAt: day(20), aiFeedbackId: null, content: "본문", studentId: 21, studentName: "김학생", studentEmail: "s@example.com" },
      ],
      [{ essayId: 4, id: 40, teacherId: 9, updatedAt: day(3), overallScore: 80 }],
      [
        { essayId: 2, status: "in_progress", dueAt: day(-2), createdAt: day(2) },
        { essayId: 3, status: "paid", dueAt: day(1), createdAt: day(9) },
      ],
      // 내가 등록한 첨삭(최신순)
      [
        { feedbackId: 40, essayId: 4, overallScore: 80, createdAt: day(3), essayTitle: "완료 글", studentName: "김학생", studentEmail: "s@example.com" },
        { feedbackId: 30, essayId: 8, overallScore: 60, createdAt: day(10), essayTitle: "지난 글", studentName: "이학생", studentEmail: "t@example.com" },
        { feedbackId: 20, essayId: 7, overallScore: null, createdAt: day(60), essayTitle: "오래된 글", studentName: "박학생", studentEmail: "p@example.com" },
      ],
    ];
    const result = await getTeacherFeedbackDashboard(teacher, NOW);
    expect(result.summary).toEqual({ waiting: 3, inProgress: 1, overdue: 1, completedTotal: 3, completedLast30Days: 2, averageScore: 70 });
    expect(result.recent.map((row) => row.feedbackId)).toEqual([40, 30, 20]);
    expect(result.recent[0]).toMatchObject({ essayTitle: "완료 글", studentName: "김학생", overallScore: 80 });
  });

  it("글도 첨삭도 없으면 모두 0이고 평균 점수는 null이다", async () => {
    fake.queue = [[], []]; // 글 목록(없음 → 이후 조회 생략), 내 첨삭(없음)
    const result = await getTeacherFeedbackDashboard(teacher, NOW);
    expect(result.summary).toEqual({ waiting: 0, inProgress: 0, overdue: 0, completedTotal: 0, completedLast30Days: 0, averageScore: null });
    expect(result.recent).toEqual([]);
  });
});
