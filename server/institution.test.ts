import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("./billingDb", () => ({
  countAiUsage: vi.fn(async () => 0),
  listActiveSubscriptions: vi.fn(async () => []),
  listAwaitingStartSubscriptions: vi.fn(async () => []),
}));
vi.mock("./institutionDb", () => ({
  resolveStudentFunding: vi.fn(),
  listContractsAdmin: vi.fn(async () => []),
  createContract: vi.fn(),
  updateContractBudgets: vi.fn(),
  updateContractPolicy: vi.fn(),
  setContractStatus: vi.fn(),
  listGroupsWithContracts: vi.fn(async () => []),
  bindGroupContract: vi.fn(),
  listInstitutionMembers: vi.fn(async () => []),
  findUserByEmailOrId: vi.fn(),
  addInstitutionMember: vi.fn(),
  endInstitutionMember: vi.fn(),
  listUsage: vi.fn(async () => []),
  listAudit: vi.fn(async () => []),
}));

import * as institutionDb from "./institutionDb";
import { appRouter } from "./routers";
import { getAiEntitlement } from "./billing/service";
import { ambiguousInstitutionEntitlement, evaluateInstitutionEntitlement } from "./billing/entitlements";
import { InstitutionBudgetError, runWithBudget, type BudgetOps } from "./institutionBudget";
import { budgetOverage, budgetRemaining, contractAvailability, contractEnforcesLimit, decideAutomaticExclusion, exclusionLabel, isSettlementExcluded } from "../shared/institution";
import type { TrpcContext } from "./_core/context";

type TestUser = Record<string, unknown> & { id: number };
function callerFor(user: TestUser | null) {
  const ctx = {
    user: user && { openId: `u-${user.id}`, email: `u${user.id}@example.com`, name: `사용자${user.id}`, loginMethod: "email", role: "user", createdAt: new Date("2020-01-01"), updatedAt: new Date(), lastSignedIn: new Date(), ...user },
    req: { protocol: "https", headers: {} } as any,
    res: { clearCookie: vi.fn(), cookie: vi.fn() } as any,
  } as unknown as TrpcContext;
  return appRouter.createCaller(ctx);
}

const student: TestUser = { id: 10, role: "user", tag: "중고등" };
const teacher: TestUser = { id: 20, role: "teacher", teacherStatus: "approved" };
const admin: TestUser = { id: 1, role: "admin" };

const baseContract = { id: 5, name: "한빛중학교", status: "active" as const, periodStart: new Date("2026-03-01T00:00:00Z"), periodEnd: new Date("2026-09-01T00:00:00Z"), aiLimit: 10, aiUsed: 3 };

beforeEach(() => vi.clearAllMocks());

describe("정산 제외 정책(shared/institution)", () => {
  it("기관 계약 반 > 기관 소속 학생 > 기관 소속 교사 순서로 첫 사유를 정한다", () => {
    expect(decideAutomaticExclusion({ classContractId: 5, studentInInstitution: true, teacherInInstitution: true })).toBe("institution_contract");
    expect(decideAutomaticExclusion({ classContractId: null, studentInInstitution: true, teacherInInstitution: true })).toBe("institution_member");
    expect(decideAutomaticExclusion({ classContractId: null, studentInInstitution: false, teacherInInstitution: true })).toBe("teacher_member");
    expect(decideAutomaticExclusion({ classContractId: null, studentInInstitution: false, teacherInInstitution: false })).toBe("none");
  });

  it("자동 제외이거나 교사가 직접 제외한 활동은 정산에서 빠진다", () => {
    expect(isSettlementExcluded({ automaticExclusion: "none", manualExcluded: 0 })).toBe(false);
    expect(isSettlementExcluded({ automaticExclusion: "none", manualExcluded: 1 })).toBe(true);
    expect(isSettlementExcluded({ automaticExclusion: "institution_contract", manualExcluded: 0 })).toBe(true);
    expect(exclusionLabel({ automaticExclusion: "institution_member", manualExcluded: 0 })).toContain("기관 소속 학생");
    expect(exclusionLabel({ automaticExclusion: "none", manualExcluded: 1 })).toContain("교사가");
  });

  it("계약은 활성 상태이고 기간 안일 때만 쓸 수 있으며, 끝 시각은 포함하지 않는다", () => {
    const now = new Date("2026-05-01T00:00:00Z");
    expect(contractAvailability(baseContract, now).usable).toBe(true);
    for (const status of ["draft", "suspended", "closed"] as const) expect(contractAvailability({ ...baseContract, status }, now).usable).toBe(false);
    expect(contractAvailability(baseContract, new Date("2026-02-28T23:59:59Z")).usable).toBe(false);
    expect(contractAvailability(baseContract, new Date("2026-08-31T23:59:59Z")).usable).toBe(true);
    expect(contractAvailability(baseContract, new Date("2026-09-01T00:00:00Z")).usable).toBe(false);
    expect(budgetRemaining(10, 3)).toBe(7);
    expect(budgetRemaining(10, 12)).toBe(0);
  });
});

describe("예산 차감 흐름(runWithBudget)", () => {
  const makeOps = (overrides: Partial<BudgetOps> = {}) => ({
    reserve: vi.fn(async () => ({ usageId: 7 })),
    attachSource: vi.fn(async () => undefined),
    release: vi.fn(async () => undefined),
    ...overrides,
  });

  it("기관 계약이 비용을 부담하지 않으면 예산 없이 작업만 실행한다", async () => {
    const work = vi.fn(async () => "ok");
    await expect(runWithBudget(null, work)).resolves.toBe("ok");
    expect(work).toHaveBeenCalledTimes(1);
  });

  it("성공하면 출처를 연결하고 차감을 유지한다", async () => {
    const ops = makeOps();
    await expect(runWithBudget(ops, async () => ({ id: 42 }), (result) => result.id)).resolves.toEqual({ id: 42 });
    expect(ops.reserve).toHaveBeenCalledTimes(1);
    expect(ops.attachSource).toHaveBeenCalledWith(7, 42);
    expect(ops.release).not.toHaveBeenCalled();
  });

  it("작업이 실패하면 차감을 되돌리고 같은 오류를 다시 던진다", async () => {
    const ops = makeOps();
    await expect(runWithBudget(ops, async () => { throw new Error("AI 호출 실패"); })).rejects.toThrow("AI 호출 실패");
    expect(ops.release).toHaveBeenCalledWith(7);
    expect(ops.attachSource).not.toHaveBeenCalled();
  });

  it("예산이 없으면 작업을 실행하지 않는다(마지막 1건을 넘는 요청 차단)", async () => {
    const ops = makeOps({ reserve: vi.fn(async () => { throw new InstitutionBudgetError("기관 계약의 첨삭 예산을 모두 사용했습니다."); }) });
    const work = vi.fn(async () => "never");
    await expect(runWithBudget(ops, work)).rejects.toBeInstanceOf(InstitutionBudgetError);
    expect(work).not.toHaveBeenCalled();
    expect(ops.release).not.toHaveBeenCalled();
  });

  it("출처 연결이나 되돌리기가 실패해도 작업 결과와 원래 오류를 바꾸지 않는다", async () => {
    const quiet = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const attachFails = makeOps({ attachSource: vi.fn(async () => { throw new Error("중복"); }) });
    await expect(runWithBudget(attachFails, async () => ({ id: 1 }), (result) => result.id)).resolves.toEqual({ id: 1 });
    const releaseFails = makeOps({ release: vi.fn(async () => { throw new Error("DB 오류"); }) });
    await expect(runWithBudget(releaseFails, async () => { throw new Error("원래 오류"); })).rejects.toThrow("원래 오류");
    quiet.mockRestore();
  });
});

describe("교사의 AI 평가 이용 자격", () => {
  it("승인된 교사와 관리자만 한도 없이 쓰고, 승인 전·반려된 교사는 쓸 수 없다", async () => {
    const base = { id: 20, createdAt: new Date("2020-01-01") };
    await expect(getAiEntitlement({ ...base, role: "teacher", teacherStatus: "approved" })).resolves.toMatchObject({ mode: "unlimited", canUse: true });
    await expect(getAiEntitlement({ ...base, role: "admin" })).resolves.toMatchObject({ mode: "unlimited", canUse: true });
    for (const teacherStatus of ["pending", "rejected", undefined]) {
      const result = await getAiEntitlement({ ...base, role: "teacher", teacherStatus });
      expect(result).toMatchObject({ mode: "none", canUse: false });
      expect(result.reason).toContain("승인");
    }
  });
});

describe("AI 평가 이용 자격: 기관 계약 우선", () => {
  const learner = { id: 10, role: "user", tag: "중고등", createdAt: new Date("2020-01-01") };

  it("계약 기간 안에서 예산이 남아 있으면 기관 이용이고 남은 횟수를 보여 준다", () => {
    const result = evaluateInstitutionEntitlement(baseContract, new Date("2026-05-01T00:00:00Z"));
    expect(result).toMatchObject({ mode: "institution", canUse: true, limit: 10, used: 3, remaining: 7, contractId: 5, contractName: "한빛중학교" });
  });

  it("예산을 모두 쓰거나 계약이 끝나면 막히고, 기관 담당자에게 문의하도록 안내한다(이용권 구매 유도 없음)", () => {
    const exhausted = evaluateInstitutionEntitlement({ ...baseContract, aiUsed: 10 }, new Date("2026-05-01T00:00:00Z"));
    expect(exhausted).toMatchObject({ mode: "institution", canUse: false, remaining: 0 });
    expect(exhausted.reason).toContain("기관 담당자");
    expect(exhausted.reason).not.toContain("이용권을 선택");
    const expired = evaluateInstitutionEntitlement(baseContract, new Date("2026-10-01T00:00:00Z"));
    expect(expired.canUse).toBe(false);
    expect(expired.reason).toContain("기관 담당자");
  });

  it("여러 기관 계약에 속해 어느 계약을 쓸지 정할 수 없으면 막는다", () => {
    expect(ambiguousInstitutionEntitlement()).toMatchObject({ mode: "institution", canUse: false });
  });

  it("기관 계약이 있는 학생은 개인 이용권·체험으로 넘어가지 않고, 계약이 없으면 기존 규칙을 쓴다", async () => {
    vi.mocked(institutionDb.resolveStudentFunding).mockResolvedValueOnce({ kind: "contract", via: "group", contract: { ...baseContract, aiUsed: 10, status: "active" } as any });
    await expect(getAiEntitlement(learner)).resolves.toMatchObject({ mode: "institution", canUse: false });

    vi.mocked(institutionDb.resolveStudentFunding).mockResolvedValueOnce({ kind: "ambiguous" });
    await expect(getAiEntitlement(learner)).resolves.toMatchObject({ mode: "institution", canUse: false });

    vi.mocked(institutionDb.resolveStudentFunding).mockResolvedValueOnce({ kind: "none" });
    await expect(getAiEntitlement(learner)).resolves.toMatchObject({ mode: "none" });
  });

  it("관리자·교사·학부모는 기관 계약을 조회하지 않는다", async () => {
    await getAiEntitlement({ id: 1, role: "admin", createdAt: new Date() });
    await getAiEntitlement({ id: 2, role: "user", tag: "학부모", createdAt: new Date() });
    expect(institutionDb.resolveStudentFunding).not.toHaveBeenCalled();
  });
});

describe("기관 계약 관리 API는 관리자 전용", () => {
  const contractInput = { name: "한빛중학교", contractCode: "HB-2026-01", periodStart: new Date("2026-03-01"), periodEnd: new Date("2026-09-01"), humanLimit: 500, aiLimit: 300, managementLimit: 200 };

  it("학생·교사·비로그인은 계약·예산·반 연결·소속 지정을 할 수 없다", async () => {
    for (const user of [student, teacher]) {
      const caller = callerFor(user);
      await expect(caller.institution.adminList()).rejects.toMatchObject({ code: "FORBIDDEN" });
      await expect(caller.institution.adminCreateContract(contractInput)).rejects.toMatchObject({ code: "FORBIDDEN" });
      await expect(caller.institution.adminUpdateBudgets({ contractId: 1, ai: 10, reason: "증액" })).rejects.toMatchObject({ code: "FORBIDDEN" });
      await expect(caller.institution.adminBindGroup({ groupId: 1, contractId: 1, reason: "연결" })).rejects.toMatchObject({ code: "FORBIDDEN" });
      await expect(caller.institution.adminAddMember({ userId: 3, contractId: null, excludeIndividualSettlement: true, reason: "소속" })).rejects.toMatchObject({ code: "FORBIDDEN" });
      await expect(caller.institution.adminSetStatus({ contractId: 1, status: "active", reason: "시작" })).rejects.toMatchObject({ code: "FORBIDDEN" });
    }
    await expect(callerFor(null).institution.adminList()).rejects.toThrow();
    expect(institutionDb.createContract).not.toHaveBeenCalled();
    expect(institutionDb.bindGroupContract).not.toHaveBeenCalled();
  });

  it("관리자는 계약을 만들고 예산을 바꾸며, 변경 사유와 관리자 id가 함께 전달된다", async () => {
    vi.mocked(institutionDb.createContract).mockResolvedValue({ id: 9 } as any);
    vi.mocked(institutionDb.updateContractBudgets).mockResolvedValue({ id: 9 } as any);
    await callerFor(admin).institution.adminCreateContract(contractInput);
    expect(institutionDb.createContract).toHaveBeenCalledWith(expect.objectContaining({ contractCode: "HB-2026-01", humanLimit: 500, createdBy: 1 }));
    await callerFor(admin).institution.adminUpdateBudgets({ contractId: 9, ai: 400, reason: "계약 변경에 따른 증액" });
    expect(institutionDb.updateContractBudgets).toHaveBeenCalledWith(9, { human: undefined, ai: 400, management: undefined }, 1, "계약 변경에 따른 증액");
  });

  it("잘못된 입력(음수·한도 초과 예산, 이상한 계약 번호, 사유 없음)은 거절한다", async () => {
    const caller = callerFor(admin);
    await expect(caller.institution.adminCreateContract({ ...contractInput, humanLimit: -1 })).rejects.toThrow();
    await expect(caller.institution.adminCreateContract({ ...contractInput, aiLimit: 3_000_000_000 })).rejects.toThrow();
    await expect(caller.institution.adminCreateContract({ ...contractInput, contractCode: "한글 번호!" })).rejects.toThrow();
    await expect(caller.institution.adminUpdateBudgets({ contractId: 1, ai: 10, reason: "" })).rejects.toThrow();
    expect(institutionDb.createContract).not.toHaveBeenCalled();
  });

  it("규칙 위반(이미 쓴 횟수보다 줄이기 등)은 사유가 보이는 오류로 돌려준다", async () => {
    vi.mocked(institutionDb.updateContractBudgets).mockRejectedValue(new Error("AI 첨삭 예산은 이미 사용한 12보다 작게 줄일 수 없습니다."));
    await expect(callerFor(admin).institution.adminUpdateBudgets({ contractId: 1, ai: 5, reason: "감액" })).rejects.toMatchObject({ code: "BAD_REQUEST", message: expect.stringContaining("12") });
  });

  it("기관 소속 지정은 회원 번호나 이메일이 있어야 하고, 회원을 찾지 못하면 알려 준다", async () => {
    await expect(callerFor(admin).institution.adminAddMember({ contractId: null, excludeIndividualSettlement: true, reason: "소속" })).rejects.toThrow();
    vi.mocked(institutionDb.findUserByEmailOrId).mockResolvedValueOnce(undefined);
    await expect(callerFor(admin).institution.adminAddMember({ email: "none@example.com", contractId: null, excludeIndividualSettlement: true, reason: "소속" })).rejects.toMatchObject({ code: "BAD_REQUEST" });
    vi.mocked(institutionDb.findUserByEmailOrId).mockResolvedValueOnce({ id: 33, name: "교사", email: "t@example.com", role: "teacher" });
    vi.mocked(institutionDb.addInstitutionMember).mockResolvedValue(77);
    await expect(callerFor(admin).institution.adminAddMember({ email: "t@example.com", contractId: null, excludeIndividualSettlement: true, reason: "교내 전속 교사" })).resolves.toMatchObject({ id: 77, userId: 33 });
    expect(institutionDb.addInstitutionMember).toHaveBeenCalledWith({ userId: 33, contractId: null, excludeIndividualSettlement: true, reason: "교내 전속 교사", createdBy: 1 });
  });
});

describe("기관 계약 이용 방식: 기간제·소진 시 경고 후 계속", () => {
  const now = new Date("2026-05-01T00:00:00Z");

  it("횟수제·차단만 한도를 강제하고, 기간제나 경고 후 계속은 강제하지 않는다", () => {
    expect(contractEnforcesLimit({ usageMode: "quota", overageAction: "block" })).toBe(true);
    expect(contractEnforcesLimit({ usageMode: "quota", overageAction: "warn" })).toBe(false);
    expect(contractEnforcesLimit({ usageMode: "period", overageAction: "block" })).toBe(false);
    expect(budgetOverage(10, 13)).toBe(3);
    expect(budgetOverage(10, 4)).toBe(0);
  });

  it("정책이 없는 기존 계약은 횟수제·차단으로 동작한다", () => {
    expect(evaluateInstitutionEntitlement({ ...baseContract, aiUsed: 10 }, now)).toMatchObject({ canUse: false, periodOnly: false, overage: 0 });
  });

  it("경고 후 계속 계약은 예산을 넘겨도 이용할 수 있고 초과 횟수를 알려 준다", () => {
    const result = evaluateInstitutionEntitlement({ ...baseContract, aiUsed: 12, usageMode: "quota", overageAction: "warn" }, now);
    expect(result).toMatchObject({ canUse: true, used: 12, remaining: 0, overage: 2, periodOnly: false });
  });

  it("기간제 계약은 횟수와 상관없이 계약 기간 안에서만 이용할 수 있다", () => {
    const period = { ...baseContract, aiLimit: 0, aiUsed: 500, usageMode: "period" as const, overageAction: "block" as const };
    expect(evaluateInstitutionEntitlement(period, now)).toMatchObject({ canUse: true, periodOnly: true, used: 500, overage: 0 });
    const expired = evaluateInstitutionEntitlement(period, new Date("2026-10-01T00:00:00Z"));
    expect(expired.canUse).toBe(false);
    expect(expired.reason).toContain("기관 담당자");
  });

  it("관리자만 이용 방식을 바꾸고, 사유와 값을 검증한다", async () => {
    vi.mocked(institutionDb.updateContractPolicy).mockResolvedValue({ id: 5 } as any);
    await expect(callerFor({ id: 2, role: "teacher", teacherStatus: "approved" } as any).institution.adminUpdatePolicy({ contractId: 5, usageMode: "period", overageAction: "block", reason: "기간제로 변경" })).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(callerFor(admin).institution.adminUpdatePolicy({ contractId: 5, usageMode: "period", overageAction: "block", reason: "" })).rejects.toBeTruthy();
    await callerFor(admin).institution.adminUpdatePolicy({ contractId: 5, usageMode: "quota", overageAction: "warn", reason: "소진 후에도 수업 지속" });
    expect(institutionDb.updateContractPolicy).toHaveBeenCalledWith(5, { usageMode: "quota", overageAction: "warn" }, 1, "소진 후에도 수업 지속");
  });
});
