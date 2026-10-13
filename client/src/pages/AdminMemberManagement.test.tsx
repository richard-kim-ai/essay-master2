// @vitest-environment jsdom
import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const mocks = vi.hoisted(() => ({
  member: null as any,
  authorities: [] as any[],
  setAuthority: vi.fn(),
  detail: null as any,
  profile: { teacherId: 9, assignedStudents: 3, feedbackCount: 12 } as any,
  users: [] as any[],
  ratings: [] as any[],
  parentLinks: { linked: [], requests: [] } as any,
}));

vi.mock("@/_core/hooks/useAuth", () => ({ useAuth: () => ({ user: { id: 1, role: "admin" }, loading: false }) }));
vi.mock("wouter", () => ({ useParams: () => ({ id: String(mocks.member?.user?.id ?? 9) }), Link: ({ href, children }: any) => <a href={href}>{children}</a> }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() } }));
vi.mock("@/lib/trpc", () => {
  const invalidate = { invalidate: vi.fn() };
  const mutation = () => ({ useMutation: () => ({ mutate: vi.fn(), isPending: false }) });
  return {
    trpc: {
      useUtils: () => ({ admin: { getStudentDetail: invalidate, getCertificateAuthorities: invalidate, getAuditLogs: invalidate } }),
      admin: {
        getStudentDetail: { useQuery: () => ({ data: mocks.member, isLoading: false }) },
        updateStudentNotes: mutation(),
        getCertificateAuthorities: { useQuery: () => ({ data: mocks.authorities, isLoading: false }) },
        setCertificateAuthority: { useMutation: () => ({ mutate: mocks.setAuthority, isPending: false }) },
        getAllUsersMasterAdmin: { useQuery: () => ({ data: mocks.users, isLoading: false, refetch: vi.fn() }) },
        getLearningGroups: { useQuery: () => ({ data: [], isLoading: false }) },
        getAuditLogs: { useQuery: () => ({ data: [], isLoading: false }) },
        getParentLinks: { useQuery: () => ({ data: mocks.parentLinks, isLoading: false }) },
        updateUserRole: mutation(),
        adjustUserLevel: mutation(),
        approveTeacher: mutation(),
        assignStudentTeacher: mutation(),
        createAdminAccount: mutation(),
        saveLearningGroup: mutation(),
        addLearningGroupMember: mutation(),
        removeLearningGroupMember: mutation(),
      },
      teacherRating: {
        detail: { useQuery: () => ({ data: mocks.detail, isLoading: false }) },
        profile: { useQuery: () => ({ data: mocks.profile }) },
        overview: { useQuery: () => ({ data: mocks.ratings, isLoading: false }) },
      },
    },
  };
});

import AdminStudentDetail from "./AdminStudentDetail";
import MasterAdminConsole from "./MasterAdminConsole";

let container: HTMLDivElement;
let root: Root;
const render = async (node: React.ReactElement) => act(async () => root.render(node));
const button = (label: string) => Array.from(container.querySelectorAll<HTMLButtonElement>("button")).find((item) => item.textContent?.includes(label));

const memberOf = (role: "user" | "teacher" | "admin", extra: Record<string, unknown> = {}) => ({
  user: { id: 9, name: "김선생", email: "t@example.com", role, tag: "중고등", createdAt: new Date("2026-01-01"), lastSignedIn: new Date(), adminNotes: "", teacherLevel: 2, teacherStatus: "approved", ...extra },
  submissions: [{ id: 1, title: "학생 글", content: "본문", courseType: "middle_high", level: 1, createdAt: new Date() }],
  aiFeedbacks: [{}, {}],
  certificates: [{ id: 1, title: "수료증 A", certNumber: "C-1" }],
});

beforeEach(() => {
  (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
  vi.clearAllMocks();
  mocks.authorities = [];
  mocks.parentLinks = { linked: [], requests: [] };
  mocks.detail = { teacherId: 9, average: 3.5, count: 2, distribution: { 1: 0, 2: 1, 3: 0, 4: 0, 5: 1 }, lowCount: 1, reviews: [{ id: 1, rating: 5, review: "친절해요", createdAt: new Date("2026-10-10"), essayId: 5, essayTitle: "글 A", studentName: "김학생" }, { id: 2, rating: 2, review: null, createdAt: new Date("2026-10-09"), essayId: 6, essayTitle: "글 B", studentName: "이학생" }] };
  window.history.pushState({}, "", "/");
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});
afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
});

describe("회원 상세: 회원 등급별 표시", () => {
  it("학생은 학생 기준 용어와 논술 제출·수료증 목록을 보고, 수료증 권한·교사 평점 영역은 없다", async () => {
    mocks.member = memberOf("user", { name: "김학생" });
    await render(<AdminStudentDetail />);
    const text = container.textContent ?? "";
    expect(container.querySelector('[data-testid="member-detail"]')!.getAttribute("data-role")).toBe("user");
    expect(text).toContain("학생 상세 분석 및 관리자 메모");
    expect(text).toContain("누적 논술 제출");
    expect(text).toContain("최근 논술 제출 및 첨삭 내역");
    expect(text).toContain("보유 수료증 목록");
    expect(text).toContain("학습 상담 및 특이사항 메모");
    expect(container.querySelector('[data-testid="member-authority-card"]')).toBeNull();
    expect(container.querySelector('[data-testid="teacher-rating-panel"]')).toBeNull();
    expect(text).toContain("회원관리로 돌아가기");
  });

  it("학부모는 '학생'이 아니라 '학부모 상세'로 표기하고, 학습·제출 내역 대신 연결된 자녀를 보여 준다", async () => {
    mocks.member = memberOf("user", { name: "홍서방", tag: "학부모" });
    mocks.parentLinks = { linked: [{ id: 28, name: "홍길동", email: "c@example.com", courseLabel: "고등/대입" }], requests: [{ linkId: 3, studentName: "표정희", studentEmail: null, status: "pending" }] };
    await render(<AdminStudentDetail />);
    const text = container.textContent ?? "";
    expect(container.querySelector('[data-testid="member-detail"]')!.getAttribute("data-role")).toBe("parent");
    expect(text).toContain("학부모 상세 · 자녀 연결 현황");
    expect(text).not.toContain("학생 상세");
    expect(text).not.toContain("누적 논술 제출");
    expect(text).not.toContain("최근 논술 제출 및 첨삭 내역");
    expect(text).not.toContain("보유 수료증 목록");
    expect(text).toContain("학부모 상담 메모");
    expect(container.querySelector('[data-testid="member-authority-card"]')).toBeNull();
    const links = container.querySelector('[data-testid="parent-links-card"]')!;
    expect(links.textContent).toContain("홍길동");
    expect(links.textContent).toContain("고등/대입");
    expect(links.textContent).toContain("표정희 · 자녀의 승인을 기다리는 중");
    expect(links.querySelector('a[href="/admin/student/28"]')).toBeTruthy();
  });

  it("연결된 자녀가 없는 학부모는 안내 문구를 보인다", async () => {
    mocks.member = memberOf("user", { name: "홍서방", tag: "학부모" });
    await render(<AdminStudentDetail />);
    expect(container.querySelector('[data-testid="no-parent-links"]')).toBeTruthy();
  });

  it("교사는 '교사 상세'로 표기하고 학생용 제출·수료증 목록 대신 평점·후기, 수료증 검토 권한, 교사 평가 메모를 보여 준다", async () => {
    mocks.member = memberOf("teacher");
    mocks.authorities = [{ userId: 9, role: "teacher", granted: false }];
    await render(<AdminStudentDetail />);
    const text = container.textContent ?? "";
    expect(container.querySelector('[data-testid="member-detail"]')!.getAttribute("data-role")).toBe("teacher");
    expect(text).toContain("교사 상세 · 평점·후기 관리");
    expect(text).toContain("Lv.2");
    expect(text).not.toContain("누적 논술 제출");
    expect(text).not.toContain("최근 논술 제출 및 첨삭 내역");
    expect(text).not.toContain("보유 수료증 목록");
    expect(text).toContain("교사 평가·관리 메모");
    // 평점·후기
    expect(container.querySelector('[data-testid="rating-average"]')!.textContent).toContain("3.5");
    expect(text).toContain("친절해요");
    expect(text).toContain("낮은 평가(2점 이하) 1건");
    expect(text).toContain("12건"); // 등록한 첨삭
    expect(text).toContain("3명"); // 담당 학생
    // 수료증 검토·요청 권한 부여
    expect(container.querySelector('[data-testid="member-authority-card"]')).toBeTruthy();
    expect(text).toContain("수료증 검토·요청 불가");
    vi.spyOn(window, "confirm").mockReturnValue(true);
    await act(async () => button("권한 부여")!.click());
    expect(mocks.setAuthority).toHaveBeenCalledWith({ userId: 9, enabled: true });
  });

  it("관리자는 '관리자 상세'로 표기하고 수료증 최종 승인 권한만 보여 준다(회수 가능)", async () => {
    mocks.member = memberOf("admin", { name: "관리자A" });
    mocks.authorities = [{ userId: 9, role: "admin", granted: true }];
    await render(<AdminStudentDetail />);
    const text = container.textContent ?? "";
    expect(text).toContain("관리자 상세 · 권한 관리");
    expect(text).toContain("수료증 최종 승인 가능");
    expect(text).toContain("관리자 계정 메모");
    expect(container.querySelector('[data-testid="teacher-rating-panel"]')).toBeNull();
    expect(text).not.toContain("누적 논술 제출");
    vi.spyOn(window, "confirm").mockReturnValue(true);
    await act(async () => button("권한 회수")!.click());
    expect(mocks.setAuthority).toHaveBeenCalledWith({ userId: 9, enabled: false });
  });
});

describe("회원관리 콘솔", () => {
  const users = [
    { id: 1, name: "관리자A", email: "a@example.com", role: "admin", teacherLevel: 1, teacherStatus: "approved", tag: "", teacherId: null, preferredTeacherId: null },
    { id: 9, name: "김선생", email: "t@example.com", role: "teacher", teacherLevel: 1, teacherStatus: "approved", tag: "", teacherId: null, preferredTeacherId: null },
    { id: 10, name: "대기교사", email: "p@example.com", role: "teacher", teacherLevel: 1, teacherStatus: "pending", tag: "", teacherId: null, preferredTeacherId: null },
    { id: 21, name: "홍길동", email: "s@example.com", role: "user", teacherLevel: 1, teacherStatus: "approved", tag: "중고등", teacherId: null, preferredTeacherId: null },
  ];

  it("명칭이 '회원관리'로 통일되고, 승인 교사·관리자 행에만 수료증 승인 권한 부여·회수 버튼이 있으며 모든 행에 상세 보기가 있다", async () => {
    mocks.users = users;
    mocks.authorities = [{ userId: 1, role: "admin", granted: true }, { userId: 9, role: "teacher", granted: false }];
    await render(<MasterAdminConsole />);
    const text = container.textContent ?? "";
    expect(container.querySelector("h1")!.textContent).toBe("회원관리");
    expect(text).not.toContain("회원·관리자·반 관리");
    expect(text).toContain("수료증 승인 권한");
    const cells = Array.from(container.querySelectorAll('[data-testid="authority-cell"]'));
    expect(cells).toHaveLength(4);
    expect(cells[0].textContent).toContain("수료증 최종 승인 가능"); // 관리자
    expect(cells[1].textContent).toContain("수료증 검토·요청 불가"); // 승인 교사
    expect(cells[2].textContent?.trim()).toBe("-"); // 승인 대기 교사
    expect(cells[3].textContent?.trim()).toBe("-"); // 학생
    const detailLinks = Array.from(container.querySelectorAll("a")).filter((link) => link.textContent?.includes("상세 보기"));
    expect(detailLinks.map((link) => link.getAttribute("href"))).toEqual(["/admin/student/1", "/admin/student/9", "/admin/student/10", "/admin/student/21"]);
  });

  it("학부모 계정은 '학습자'가 아니라 '학부모'로 표시하고, 레벨·담당 교사 지정과 교사 전환 버튼을 보이지 않는다", async () => {
    mocks.users = [...users, { id: 30, name: "홍서방", email: "p2@example.com", role: "user", teacherLevel: 3, teacherStatus: "approved", tag: "학부모", teacherId: 99, preferredTeacherId: null }];
    await render(<MasterAdminConsole />);
    const rows = Array.from(container.querySelectorAll("tbody tr"));
    const parentRow = rows.find((row) => row.textContent?.includes("홍서방"))!;
    const studentRow = rows.find((row) => row.textContent?.includes("홍길동"))!;
    expect(parentRow.textContent).toContain("학부모");
    expect(parentRow.textContent).not.toContain("학습자");
    expect(parentRow.querySelector('[data-testid="parent-no-level"]')).toBeTruthy();
    expect(parentRow.querySelectorAll("select")).toHaveLength(0);
    expect(parentRow.textContent).not.toContain("교사로 전환");
    expect(parentRow.textContent).not.toContain("학생으로 전환");
    expect(parentRow.textContent).toContain("상세 보기");
    // 학생 행은 그대로 레벨·담당 교사 지정이 있다
    expect(studentRow.textContent).toContain("학습자");
    expect(studentRow.querySelectorAll("select").length).toBe(2);
    expect(studentRow.textContent).toContain("교사로 전환");
  });

  it("계정 필터에 학부모가 있고, 집계 카드의 학습자 수에는 학부모가 들어가지 않는다", async () => {
    mocks.users = [...users, { id: 30, name: "홍서방", email: "p2@example.com", role: "user", teacherLevel: 1, teacherStatus: "approved", tag: "학부모", teacherId: null, preferredTeacherId: null }];
    await render(<MasterAdminConsole />);
    const filter = container.querySelector("select")!;
    expect(Array.from(filter.querySelectorAll("option")).map((option) => option.textContent)).toEqual(["전체 계정", "학습자", "학부모", "교사", "관리자"]);
    const metric = (label: string) => Array.from(container.querySelectorAll("p")).find((p) => p.textContent === label)!.nextElementSibling!.textContent;
    expect(metric("학습자")).toBe("1명");
    expect(metric("학부모")).toBe("1명");
  });

  it("교사 평점 탭 안내와 표(평균 별점·받은 평가·낮은 평가·등록 첨삭)가 있고, ?tab=ratings로 바로 열린다", async () => {
    mocks.users = users;
    mocks.ratings = [{ teacherId: 9, name: "김선생", email: "t@example.com", teacherLevel: 1, teacherStatus: "approved", feedbackCount: 12, ratingCount: 4, average: 2.5, lowCount: 2, lastRatedAt: new Date("2026-10-10") }];
    window.history.pushState({}, "", "/master-admin?tab=ratings");
    await render(<MasterAdminConsole />);
    const overview = container.querySelector('[data-testid="teacher-rating-overview"]');
    expect(overview).toBeTruthy();
    const text = overview!.textContent ?? "";
    expect(text).toContain("교사 평점·후기 관리");
    expect(text).toContain("김선생");
    expect(text).toContain("2.5");
    expect(text).toContain("4건");
    expect(text).toContain("2건"); // 낮은 평가
    expect(text).toContain("12건");
    expect(overview!.querySelector('a[href="/admin/student/9"]')).toBeTruthy();
  });
});

describe("관리자 대시보드·이동 경로 명칭", () => {
  const read = (relative: string) => readFileSync(join(process.cwd(), relative), "utf8");

  it("대시보드 회원 목록은 학생·교사·관리자를 구분하고 교사 필터가 있으며, 카드 이름은 '회원관리'이다", () => {
    const dashboard = read("client/src/pages/AdminDashboard.tsx");
    expect(dashboard).toContain('<SelectItem value="teacher">교사</SelectItem>');
    expect(dashboard).toContain("ACCOUNT_KIND_LABELS[getAccountKind(u)]");
    expect(dashboard).toContain('<SelectItem value="parent">학부모</SelectItem>');
    expect(dashboard).toContain('<span className="font-bold text-slate-800 text-xs">회원관리</span>');
    expect(dashboard).not.toContain("회원·반 관리");
    expect(dashboard).toContain("회원 전체 현황 & 관리자 대시보드");
  });

  it("이동 바 경로: /master-admin은 '회원관리', 회원 상세는 '회원관리 > 회원 상세'이다", async () => {
    const { getPageTrail } = await import("../lib/pageTrail");
    expect(getPageTrail("/master-admin")?.items).toEqual([{ label: "회원관리" }]);
    expect(getPageTrail("/admin/student/9")?.items).toEqual([{ label: "회원관리", href: "/master-admin" }, { label: "회원 상세" }]);
  });
});
