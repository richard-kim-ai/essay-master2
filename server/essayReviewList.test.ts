import { beforeEach, describe, expect, it, vi } from "vitest";

// db.select()...가 await될 때 미리 넣어 둔 결과를 차례로 돌려주는 가짜 체인.
const fake = vi.hoisted(() => ({ queue: [] as any[][], calls: 0 }));
vi.mock("./db", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./db")>();
  const chain: any = new Proxy(
    {},
    {
      get(_target, property) {
        if (property === "then") {
          return (resolve: (value: unknown) => void) => {
            fake.calls += 1;
            resolve(fake.queue.shift() ?? []);
          };
        }
        return () => chain;
      },
    }
  );
  return { ...actual, getDb: vi.fn(async () => ({ select: () => chain })) };
});

import { appRouter } from "./routers";
import { listEssaysForReview } from "./essayWorkspace";

const admin = { id: 1, role: "admin" };
const teacher = { id: 9, role: "teacher", teacherStatus: "approved" };
const caller = (user: any) => appRouter.createCaller({ user, req: { headers: {} }, res: {} } as any);

const essayRow = (overrides: Record<string, unknown> = {}) => ({
  essayId: 5,
  title: "교육과 기술",
  status: "submitted",
  submittedAt: new Date("2026-10-10T01:00:00Z"),
  updatedAt: new Date("2026-10-10T01:00:00Z"),
  aiFeedbackId: null,
  content: "기술은   교육을\n바꾼다. ".repeat(40),
  studentId: 21,
  studentName: "김학생",
  studentEmail: "s@example.com",
  ...overrides,
});

beforeEach(() => {
  fake.queue = [];
  fake.calls = 0;
});

describe("교사·관리자용 학생 글 목록(listEssaysForReview)", () => {
  it("학생·미승인 교사는 볼 수 없고 DB도 조회하지 않는다", async () => {
    await expect(listEssaysForReview({ id: 3, role: "user" })).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(listEssaysForReview({ id: 4, role: "teacher", teacherStatus: "pending" })).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(fake.calls).toBe(0);
  });

  it("API는 비로그인을 막고 학생에게도 FORBIDDEN을 돌려준다", async () => {
    await expect(caller(null).essaySubmission.reviewList()).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    await expect(caller({ id: 3, role: "user" }).essaySubmission.reviewList()).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("글이 없으면 빈 목록을 돌려주고 첨삭·신청을 더 조회하지 않는다", async () => {
    fake.queue = [[]];
    await expect(listEssaysForReview(admin)).resolves.toEqual([]);
    expect(fake.calls).toBe(1);
  });

  it("글마다 학생 정보·본문 미리보기·첨삭 여부·가장 최근 첨삭 신청을 합쳐 돌려준다(본문 전체는 내려주지 않는다)", async () => {
    const newest = new Date("2026-10-12T00:00:00Z");
    fake.queue = [
      [essayRow(), essayRow({ essayId: 6, title: "환경", status: "reviewed", studentId: 22, studentName: "이학생", studentEmail: "t@example.com" })],
      [{ essayId: 6, id: 40, teacherId: 9, updatedAt: new Date(), overallScore: 88 }],
      // 신청은 최신순 정렬로 오므로 첫 행이 가장 최근이다.
      [
        { essayId: 5, status: "in_progress", dueAt: newest, createdAt: new Date("2026-10-11T00:00:00Z") },
        { essayId: 5, status: "cancelled", dueAt: new Date("2026-10-01T00:00:00Z"), createdAt: new Date("2026-10-01T00:00:00Z") },
      ],
    ];
    const rows = await listEssaysForReview(teacher, { status: "all" });
    expect(rows).toHaveLength(2);
    const [first, second] = rows;
    expect(first).toMatchObject({ essayId: 5, studentName: "김학생", hasTeacherFeedback: false, requestStatus: "in_progress", requestDueAt: newest });
    expect(first.preview.length).toBeLessThanOrEqual(140);
    expect(first.preview).not.toMatch(/\s{2,}|\n/);
    expect(first).not.toHaveProperty("content");
    expect(second).toMatchObject({ essayId: 6, hasTeacherFeedback: true, teacherFeedbackScore: 88, requestStatus: null, requestDueAt: null });
  });

  it("제목·학생 이름·이메일로 검색한다", async () => {
    const rows = () => [essayRow(), essayRow({ essayId: 6, title: "환경", studentName: "이학생", studentEmail: "t@example.com" })];
    fake.queue = [rows(), [], []];
    expect((await listEssaysForReview(admin, { search: "환경" })).map((row) => row.essayId)).toEqual([6]);
    fake.queue = [rows(), [], []];
    expect((await listEssaysForReview(admin, { search: "S@EXAMPLE" })).map((row) => row.essayId)).toEqual([5]);
    fake.queue = [rows(), [], []];
    expect((await listEssaysForReview(admin, { search: "없는검색어" }))).toEqual([]);
  });
});
