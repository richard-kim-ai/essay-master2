import { beforeEach, describe, expect, it, vi } from "vitest";

// db 모듈의 함수들을 모의하고, select/insert 체인은 호출을 기록하는 가짜 DB로 대신한다.
const fake = vi.hoisted(() => ({
  queue: [] as any[][],
  inserts: [] as any[],
  duplicateSets: [] as any[],
  grants: [] as any[],
  users: [] as any[],
  savedGrants: [] as any[],
  deactivated: [] as number[],
  revoked: [] as Array<[number, boolean]>,
  audits: [] as any[],
  feedback: undefined as any,
  essay: undefined as any,
  targetUser: undefined as any,
}));

vi.mock("./db", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./db")>();
  const chain: any = new Proxy({}, { get(_t, property) { if (property === "then") return (resolve: (value: unknown) => void) => resolve(fake.queue.shift() ?? []); return () => chain; } });
  const insertChain: any = {
    values: (value: unknown) => { fake.inserts.push(value); return insertChain; },
    onDuplicateKeyUpdate: (value: { set: unknown }) => { fake.duplicateSets.push(value.set); return Promise.resolve(); },
  };
  return {
    ...actual,
    getDb: vi.fn(async () => ({ select: () => chain, insert: () => insertChain })),
    getTeacherFeedbackById: vi.fn(async () => fake.feedback),
    getEssaySubmissionById: vi.fn(async () => fake.essay),
    getAllUsersStats: vi.fn(async () => ({ users: fake.users })),
    getTeacherPermissionGrants: vi.fn(async () => fake.grants),
    getUserById: vi.fn(async () => fake.targetUser),
    saveTeacherPermissionGrant: vi.fn(async (input: unknown) => { fake.savedGrants.push(input); }),
    setTeacherPermissionGrantActive: vi.fn(async (id: number) => { fake.deactivated.push(id); return []; }),
    setCertificateApprovalRevoked: vi.fn(async (id: number, revoked: boolean) => { fake.revoked.push([id, revoked]); }),
    createAdminAuditLog: vi.fn(async (input: unknown) => { fake.audits.push(input); }),
  };
});

import { appRouter } from "./routers";
import { getMyTeacherRating, getTeacherRatingDetail, listTeacherRatingOverview, rateTeacherFeedback, summarizeRatings } from "./teacherRatingDb";
import { listCertificateAuthorities, setCertificateAuthority } from "./certificateAuthority";

const student = { id: 21, role: "user" };
const admin = { id: 1, role: "admin" };

beforeEach(() => {
  Object.assign(fake, { queue: [], inserts: [], duplicateSets: [], grants: [], users: [], savedGrants: [], deactivated: [], revoked: [], audits: [], feedback: { id: 40, essayId: 5, teacherId: 9 }, essay: { id: 5, userId: 21 }, targetUser: undefined });
});

describe("별점 요약(summarizeRatings)", () => {
  it("평균(소수 첫째 자리)·개수·별점 분포·낮은 평가(2점 이하) 수를 계산하고, 범위 밖 값은 무시한다", () => {
    const summary = summarizeRatings(9, [{ rating: 5 }, { rating: 4 }, { rating: 4 }, { rating: 2 }, { rating: 1 }, { rating: 9 }]);
    expect(summary).toEqual({ teacherId: 9, average: 3.2, count: 5, distribution: { 1: 1, 2: 1, 3: 0, 4: 2, 5: 1 }, lowCount: 2 });
  });
  it("평가가 없으면 평균은 null이다", () => {
    expect(summarizeRatings(9, [])).toMatchObject({ average: null, count: 0, lowCount: 0 });
  });
});

describe("학생의 교사 평가(rateTeacherFeedback)", () => {
  it("내 글의 교사 첨삭에 별점·후기를 저장하고, 같은 첨삭을 다시 평가하면 고친다(교사는 첨삭에서 가져온다)", async () => {
    const result = await rateTeacherFeedback(student, { feedbackId: 40, rating: 4, review: "  친절했어요  " });
    expect(result).toEqual({ feedbackId: 40, teacherId: 9, rating: 4, review: "친절했어요" });
    expect(fake.inserts[0]).toMatchObject({ feedbackId: 40, essayId: 5, studentId: 21, teacherId: 9, rating: 4, review: "친절했어요" });
    expect(fake.duplicateSets[0]).toMatchObject({ rating: 4, review: "친절했어요" });
  });

  it("후기가 비어 있으면 null로 저장하고, 1000자를 넘으면 자른다", async () => {
    await rateTeacherFeedback(student, { feedbackId: 40, rating: 5, review: "   " });
    expect(fake.inserts[0].review).toBeNull();
    await rateTeacherFeedback(student, { feedbackId: 40, rating: 5, review: "가".repeat(1500) });
    expect(fake.inserts[1].review).toHaveLength(1000);
  });

  it("학생이 아니거나, 별점이 1~5가 아니거나, 남의 글·없는 첨삭이면 거절한다", async () => {
    await expect(rateTeacherFeedback({ id: 9, role: "teacher" }, { feedbackId: 40, rating: 5 })).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(rateTeacherFeedback(student, { feedbackId: 40, rating: 0 })).rejects.toMatchObject({ code: "BAD_REQUEST" });
    await expect(rateTeacherFeedback(student, { feedbackId: 40, rating: 6 })).rejects.toMatchObject({ code: "BAD_REQUEST" });
    await expect(rateTeacherFeedback(student, { feedbackId: 40, rating: 3.5 })).rejects.toMatchObject({ code: "BAD_REQUEST" });
    fake.essay = { id: 5, userId: 99 };
    await expect(rateTeacherFeedback(student, { feedbackId: 40, rating: 5 })).rejects.toMatchObject({ code: "FORBIDDEN" });
    fake.feedback = undefined;
    await expect(rateTeacherFeedback(student, { feedbackId: 40, rating: 5 })).rejects.toMatchObject({ code: "NOT_FOUND" });
    expect(fake.inserts).toHaveLength(0);
  });

  it("내 평가만 돌려준다", async () => {
    fake.queue = [[{ feedbackId: 40, studentId: 21, rating: 4, review: "좋아요", updatedAt: new Date() }]];
    await expect(getMyTeacherRating(student, 40)).resolves.toMatchObject({ rating: 4, review: "좋아요" });
    fake.queue = [[{ feedbackId: 40, studentId: 99, rating: 1, review: "x", updatedAt: new Date() }]];
    await expect(getMyTeacherRating(student, 40)).resolves.toBeNull();
    fake.queue = [[]];
    await expect(getMyTeacherRating(student, 40)).resolves.toBeNull();
  });
});

describe("관리자용 교사 평점", () => {
  it("교사 상세: 평균·분포·낮은 평가 수와 최근 후기를 돌려준다", async () => {
    const at = (day: number) => new Date(Date.UTC(2026, 9, day));
    fake.queue = [[
      { id: 3, rating: 5, review: "최고", createdAt: at(12), essayId: 5, essayTitle: "글 A", studentName: "김학생" },
      { id: 2, rating: 2, review: "아쉬워요", createdAt: at(11), essayId: 6, essayTitle: "글 B", studentName: "이학생" },
    ]];
    const detail = await getTeacherRatingDetail(9, 1);
    expect(detail).toMatchObject({ teacherId: 9, average: 3.5, count: 2, lowCount: 1, distribution: { 2: 1, 5: 1 } });
    expect(detail.reviews).toHaveLength(1);
    expect(detail.reviews[0]).toMatchObject({ review: "최고", studentName: "김학생" });
  });

  it("교사 현황: 평가가 없는 교사도 포함하고, 평균이 낮은 교사를 앞에 정렬하며, 첨삭 수·마지막 평가일을 붙인다", async () => {
    fake.queue = [
      [{ id: 9, name: "김선생", email: "a@example.com", teacherLevel: 1, teacherStatus: "approved" }, { id: 10, name: "박선생", email: "b@example.com", teacherLevel: 2, teacherStatus: "approved" }, { id: 11, name: "신규", email: "c@example.com", teacherLevel: 1, teacherStatus: "approved" }],
      [
        { teacherId: 9, rating: 5, createdAt: new Date("2026-10-10T00:00:00Z") },
        { teacherId: 9, rating: 5, createdAt: new Date("2026-10-12T00:00:00Z") },
        { teacherId: 10, rating: 2, createdAt: new Date("2026-10-11T00:00:00Z") },
      ],
      [{ teacherId: 9, n: 7 }, { teacherId: 10, n: 3 }],
    ];
    const rows = await listTeacherRatingOverview();
    expect(rows.map((row) => row.teacherId)).toEqual([10, 9, 11]);
    expect(rows[0]).toMatchObject({ name: "박선생", average: 2, ratingCount: 1, lowCount: 1, feedbackCount: 3 });
    expect(rows[1]).toMatchObject({ average: 5, feedbackCount: 7, lastRatedAt: new Date("2026-10-12T00:00:00Z") });
    expect(rows[2]).toMatchObject({ average: null, ratingCount: 0, feedbackCount: 0, lastRatedAt: null });
  });

  it("API 권한: 평가는 로그인한 학생, 교사 평점 조회는 관리자만 쓸 수 있다", async () => {
    const guest = appRouter.createCaller({ user: null, req: { headers: {} }, res: {} } as any);
    await expect(guest.teacherFeedback.rate({ feedbackId: 40, rating: 5 })).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    const asStudent = appRouter.createCaller({ user: { id: 21, role: "user" }, req: { headers: {} }, res: {} } as any);
    await expect(asStudent.teacherRating.overview()).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(asStudent.teacherRating.detail({ teacherId: 9 })).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
});

describe("수료증 승인 권한(certificateAuthority)", () => {
  beforeEach(() => {
    fake.users = [
      { id: 1, role: "admin", certificateApprovalRevoked: 0 },
      { id: 2, role: "admin", certificateApprovalRevoked: 1 },
      { id: 9, role: "teacher" },
      { id: 10, role: "teacher" },
      { id: 21, role: "user" },
    ];
    fake.grants = [
      { id: 100, teacherId: 9, scopeType: "organization", canRequestCertificate: 1, canManageProgress: 0, isActive: 1, organizationName: "전체 담당 학생" },
      { id: 101, teacherId: 10, scopeType: "student", studentId: 21, canRequestCertificate: 1, isActive: 1 },
    ];
  });

  it("현황: 관리자는 회수하지 않았으면 가능, 교사는 활성 조직 범위 수료증 권한이 있어야 가능(학생 단위 권한은 제외), 학생은 나오지 않는다", async () => {
    await expect(listCertificateAuthorities()).resolves.toEqual([
      { userId: 1, role: "admin", granted: true },
      { userId: 2, role: "admin", granted: false },
      { userId: 9, role: "teacher", granted: true },
      { userId: 10, role: "teacher", granted: false },
    ]);
  });

  it("교사 부여: 담당 학생 전체 범위의 수료증 권한을 새로 만들고, 이미 있으면 다시 만들지 않는다", async () => {
    fake.targetUser = { id: 10, role: "teacher", teacherStatus: "approved" };
    await setCertificateAuthority(admin, { userId: 10, enabled: true });
    expect(fake.savedGrants[0]).toMatchObject({ teacherId: 10, scopeType: "organization", organizationName: "전체 담당 학생", canRequestCertificate: 1, isActive: 1, grantedBy: 1 });
    fake.savedGrants = [];
    fake.targetUser = { id: 9, role: "teacher", teacherStatus: "approved" };
    await setCertificateAuthority(admin, { userId: 9, enabled: true });
    expect(fake.savedGrants).toHaveLength(0);
  });

  it("교사 회수: 활성 수료증 권한을 끄고, 승인되지 않은 교사에게는 부여할 수 없다", async () => {
    fake.targetUser = { id: 9, role: "teacher", teacherStatus: "approved" };
    await setCertificateAuthority(admin, { userId: 9, enabled: false });
    expect(fake.deactivated).toEqual([100]);
    fake.targetUser = { id: 10, role: "teacher", teacherStatus: "pending" };
    await expect(setCertificateAuthority(admin, { userId: 10, enabled: true })).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });

  it("관리자 복구·회수: 다른 관리자의 최종 승인 권한을 복구하고 감사 로그를 남기며, 승인 가능한 관리자가 남으면 회수할 수 있다", async () => {
    fake.targetUser = { id: 2, role: "admin" };
    await setCertificateAuthority(admin, { userId: 2, enabled: true });
    expect(fake.revoked).toEqual([[2, false]]);
    expect(fake.audits[0]).toMatchObject({ actorId: 1, targetUserId: 2, action: "role_changed", metadata: { type: "certificate_authority", enabled: true, role: "admin" } });

    // 승인 가능한 관리자 1, 3 중 3을 회수해도 1이 남는다.
    fake.users = [{ id: 1, role: "admin", certificateApprovalRevoked: 0 }, { id: 3, role: "admin", certificateApprovalRevoked: 0 }];
    fake.targetUser = { id: 3, role: "admin" };
    await expect(setCertificateAuthority(admin, { userId: 3, enabled: false })).resolves.toMatchObject({ granted: false });
    expect(fake.revoked.at(-1)).toEqual([3, true]);
  });

  it("본인 권한 회수와, 회수하면 승인 가능한 관리자가 한 명도 남지 않는 경우는 막는다", async () => {
    fake.targetUser = { id: 1, role: "admin" };
    await expect(setCertificateAuthority(admin, { userId: 1, enabled: false })).rejects.toMatchObject({ code: "BAD_REQUEST", message: expect.stringContaining("본인") });

    // 관리자 2는 이미 회수된 상태이므로 승인 가능한 관리자는 1뿐이다. 2가 1을 회수하면 아무도 남지 않는다.
    fake.targetUser = { id: 1, role: "admin" };
    await expect(setCertificateAuthority({ id: 2, role: "admin" }, { userId: 1, enabled: false })).rejects.toMatchObject({ code: "BAD_REQUEST", message: expect.stringContaining("한 명 이상") });
    expect(fake.revoked).toHaveLength(0);
  });

  it("관리자가 아니면 부여·회수할 수 없고, 학생 계정은 대상이 될 수 없다", async () => {
    await expect(setCertificateAuthority({ id: 9, role: "teacher" }, { userId: 9, enabled: true })).rejects.toMatchObject({ code: "FORBIDDEN" });
    fake.targetUser = { id: 21, role: "user" };
    await expect(setCertificateAuthority(admin, { userId: 21, enabled: true })).rejects.toMatchObject({ code: "BAD_REQUEST" });
    fake.targetUser = undefined;
    await expect(setCertificateAuthority(admin, { userId: 99, enabled: true })).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("API: 승인 권한을 회수당한 관리자는 수료증을 승인·반려할 수 없고, 비로그인은 부여 API를 쓸 수 없다", async () => {
    const revoked = appRouter.createCaller({ user: { id: 2, role: "admin", certificateApprovalRevoked: 1 }, req: { headers: {} }, res: {} } as any);
    await expect(revoked.admin.resolveCertificateApprovalRequest({ requestId: 1, approved: true })).rejects.toMatchObject({ code: "FORBIDDEN", message: expect.stringContaining("수료증 최종 승인 권한이 없습니다") });
    const guest = appRouter.createCaller({ user: null, req: { headers: {} }, res: {} } as any);
    await expect(guest.admin.setCertificateAuthority({ userId: 9, enabled: true })).rejects.toMatchObject({ code: "UNAUTHORIZED" });
  });
});
