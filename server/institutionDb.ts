// 기관 계약·기관 소속 회원·예산 차감·교사 활동 장부(정산 제외)의 데이터 접근.
// 정책 규칙은 shared/institution.ts, 예산을 쓰는 작업의 흐름은 institutionBudget.ts에 있다.
import { and, asc, desc, eq, gt, gte, isNotNull, isNull, like, lt, lte, or, sql } from "drizzle-orm";
import {
  classAssignmentSubmissions,
  classAssignments,
  curriculumWorkbookAnswers,
  essaySubmission,
  institutionAuditLogs,
  institutionContracts,
  institutionMembers,
  institutionUsage,
  learningGroupMembers,
  learningGroups,
  teacherActivityAccounting,
  teacherFeedback,
  users,
  workbookTeacherFeedback,
} from "../drizzle/schema";
import { getDb } from "./db";
import { BUDGET_COLUMNS, BUDGET_TYPES, MAX_BUDGET_UNITS, contractAvailability, contractEnforcesLimit, decideAutomaticExclusion, type BudgetType, type ContractPolicy } from "../shared/institution";
import type { ActivityType } from "../shared/settlement";
import { InstitutionBudgetError, type BudgetOps } from "./institutionBudget";

async function requireDb() {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  return db;
}

const affectedRows = (result: unknown) => Number((result as { affectedRows?: number }).affectedRows ?? 0);

const USED_COLUMN = { human: institutionContracts.humanUsed, ai: institutionContracts.aiUsed, management: institutionContracts.managementUsed } as const;
const LIMIT_COLUMN = { human: institutionContracts.humanLimit, ai: institutionContracts.aiLimit, management: institutionContracts.managementLimit } as const;
const budgetLabel = (type: BudgetType) => BUDGET_TYPES.find((item) => item.type === type)?.label ?? type;

// ========== 감사 기록 ==========

export async function writeAudit(actorId: number, action: string, targetType: string, targetId: number, reason: string, detail?: unknown) {
  const db = await requireDb();
  await db.insert(institutionAuditLogs).values({ actorId, action, targetType, targetId, reason: reason.slice(0, 500), detailJson: detail === undefined ? null : JSON.stringify(detail) });
}

export async function listAudit(input: { targetType?: string; targetId?: number; limit: number; offset: number }) {
  const db = await requireDb();
  const conditions = [];
  if (input.targetType) conditions.push(eq(institutionAuditLogs.targetType, input.targetType));
  if (input.targetId !== undefined) conditions.push(eq(institutionAuditLogs.targetId, input.targetId));
  return db.select({
    id: institutionAuditLogs.id,
    actorId: institutionAuditLogs.actorId,
    actorName: users.name,
    action: institutionAuditLogs.action,
    targetType: institutionAuditLogs.targetType,
    targetId: institutionAuditLogs.targetId,
    reason: institutionAuditLogs.reason,
    detailJson: institutionAuditLogs.detailJson,
    createdAt: institutionAuditLogs.createdAt,
  }).from(institutionAuditLogs).leftJoin(users, eq(users.id, institutionAuditLogs.actorId))
    .where(conditions.length ? and(...conditions) : undefined).orderBy(desc(institutionAuditLogs.createdAt)).limit(input.limit).offset(input.offset);
}

// ========== 계약 ==========

export async function createContract(input: { name: string; contractCode: string; periodStart: Date; periodEnd: Date; humanLimit: number; aiLimit: number; managementLimit: number; usageMode?: ContractPolicy["usageMode"]; overageAction?: ContractPolicy["overageAction"]; memo?: string; createdBy: number }) {
  const db = await requireDb();
  if (input.periodEnd.getTime() <= input.periodStart.getTime()) throw new Error("계약 종료일은 시작일보다 뒤여야 합니다.");
  for (const limit of [input.humanLimit, input.aiLimit, input.managementLimit]) {
    if (!Number.isInteger(limit) || limit < 0 || limit > MAX_BUDGET_UNITS) throw new Error("예산은 0 이상의 정수여야 합니다.");
  }
  const [existing] = await db.select({ id: institutionContracts.id }).from(institutionContracts).where(eq(institutionContracts.contractCode, input.contractCode));
  if (existing) throw new Error("이미 사용 중인 계약 번호입니다.");
  const [result] = await db.insert(institutionContracts).values({
    name: input.name, contractCode: input.contractCode, periodStart: input.periodStart, periodEnd: input.periodEnd,
    humanLimit: input.humanLimit, aiLimit: input.aiLimit, managementLimit: input.managementLimit,
    usageMode: input.usageMode ?? "quota", overageAction: input.overageAction ?? "block", memo: input.memo ?? null, createdBy: input.createdBy, status: "draft",
  });
  const id = Number((result as { insertId?: number }).insertId);
  await writeAudit(input.createdBy, "contract_created", "contract", id, "계약 등록", { name: input.name, contractCode: input.contractCode, usageMode: input.usageMode ?? "quota", overageAction: input.overageAction ?? "block" });
  return getContract(id);
}

export async function getContract(id: number) {
  const db = await requireDb();
  const [contract] = await db.select().from(institutionContracts).where(eq(institutionContracts.id, id));
  return contract;
}

export async function listContractsAdmin() {
  const db = await requireDb();
  const [contracts, groups, members] = await Promise.all([
    db.select().from(institutionContracts).orderBy(desc(institutionContracts.createdAt)),
    db.select({ id: learningGroups.id, contractId: learningGroups.contractId }).from(learningGroups).where(isNotNull(learningGroups.contractId)),
    db.select({ id: institutionMembers.id, contractId: institutionMembers.contractId }).from(institutionMembers).where(and(isNull(institutionMembers.endedAt), isNotNull(institutionMembers.contractId))),
  ]);
  return contracts.map((contract) => ({
    ...contract,
    groupCount: groups.filter((group) => group.contractId === contract.id).length,
    memberCount: members.filter((member) => member.contractId === contract.id).length,
  }));
}

/** 예산 한도를 바꾼다. 이미 쓴 횟수(예약 포함)보다 작게 줄일 수 없다(갱신 조건에 포함해 동시 차감과 어긋나지 않게 한다). */
export async function updateContractBudgets(id: number, limits: Partial<Record<BudgetType, number>>, actorId: number, reason: string) {
  const db = await requireDb();
  const contract = await getContract(id);
  if (!contract) throw new Error("계약을 찾을 수 없습니다.");
  if (contract.status === "closed") throw new Error("종료된 계약은 수정할 수 없습니다.");
  const set: Record<string, number> = {};
  const floors = [];
  for (const type of ["human", "ai", "management"] as const) {
    const value = limits[type];
    if (value === undefined) continue;
    if (!Number.isInteger(value) || value < 0 || value > MAX_BUDGET_UNITS) throw new Error("예산은 0 이상의 정수여야 합니다.");
    set[BUDGET_COLUMNS[type].limit] = value;
    // 초과 이용을 허용하는 계약(기간제·경고 후 계속)은 이미 쓴 횟수보다 작게도 정할 수 있다(초과분으로 표시된다).
    if (contractEnforcesLimit(contract)) floors.push(lte(USED_COLUMN[type], value));
  }
  if (Object.keys(set).length === 0) return contract;
  const [result] = await db.update(institutionContracts).set(set).where(and(eq(institutionContracts.id, id), sql`${institutionContracts.status} <> 'closed'`, ...floors));
  if (affectedRows(result) === 0) {
    const latest = await getContract(id);
    const tooLow = (["human", "ai", "management"] as const).find((type) => limits[type] !== undefined && latest && (limits[type] as number) < latest[BUDGET_COLUMNS[type].used]);
    throw new Error(tooLow && latest ? `${budgetLabel(tooLow)} 예산은 이미 사용한 ${latest[BUDGET_COLUMNS[tooLow].used]}보다 작게 줄일 수 없습니다.` : "예산을 바꿀 수 없는 상태입니다. 다시 확인해 주세요.");
  }
  await writeAudit(actorId, "budget_changed", "contract", id, reason, { before: { human: contract.humanLimit, ai: contract.aiLimit, management: contract.managementLimit }, after: set });
  return getContract(id);
}

/**
 * 이용 방식(횟수제·기간제)과 소진 시 동작(차단·경고 후 계속)을 바꾼다. 바꾼 뒤의 새 이용부터 적용되고 이미 쓴 횟수는 그대로다.
 * 횟수제·차단으로 되돌릴 때 이미 한도를 넘긴 항목이 있으면 그 항목은 새 이용이 즉시 막힌다(관리자가 예산을 늘려 해소한다).
 */
export async function updateContractPolicy(id: number, policy: ContractPolicy, actorId: number, reason: string) {
  const db = await requireDb();
  const contract = await getContract(id);
  if (!contract) throw new Error("계약을 찾을 수 없습니다.");
  if (contract.status === "closed") throw new Error("종료된 계약은 수정할 수 없습니다.");
  const [result] = await db.update(institutionContracts).set({ usageMode: policy.usageMode, overageAction: policy.overageAction })
    .where(and(eq(institutionContracts.id, id), sql`${institutionContracts.status} <> 'closed'`));
  if (affectedRows(result) === 0 && (contract.usageMode !== policy.usageMode || contract.overageAction !== policy.overageAction)) throw new Error("이용 방식을 바꿀 수 없는 상태입니다. 다시 확인해 주세요.");
  await writeAudit(actorId, "policy_changed", "contract", id, reason, { before: { usageMode: contract.usageMode, overageAction: contract.overageAction }, after: policy });
  return getContract(id);
}

const STATUS_TRANSITIONS: Record<string, string[]> = { draft: ["active", "closed"], active: ["suspended", "closed"], suspended: ["active", "closed"], closed: [] };

export async function setContractStatus(id: number, status: "active" | "suspended" | "closed", actorId: number, reason: string) {
  const db = await requireDb();
  const contract = await getContract(id);
  if (!contract) throw new Error("계약을 찾을 수 없습니다.");
  if (!(STATUS_TRANSITIONS[contract.status] ?? []).includes(status)) throw new Error("이 상태에서는 선택한 상태로 바꿀 수 없습니다.");
  // 확인한 상태일 때만 바꾼다(동시에 종료·재활성화가 겹쳐도 종료된 계약이 다시 열리지 않는다).
  const [result] = await db.update(institutionContracts).set({ status }).where(and(eq(institutionContracts.id, id), eq(institutionContracts.status, contract.status)));
  if (affectedRows(result) === 0) throw new Error("계약 상태가 그 사이에 바뀌었습니다. 새로고침 후 다시 시도해 주세요.");
  await writeAudit(actorId, "contract_status", "contract", id, reason, { from: contract.status, to: status });
  return getContract(id);
}

// ========== 반 연결 ==========

export async function listGroupsWithContracts() {
  const db = await requireDb();
  const rows = await db.select({
    id: learningGroups.id,
    name: learningGroups.name,
    groupType: learningGroups.groupType,
    teacherId: learningGroups.teacherId,
    teacherName: users.name,
    contractId: learningGroups.contractId,
    isActive: learningGroups.isActive,
  }).from(learningGroups).leftJoin(users, eq(users.id, learningGroups.teacherId)).orderBy(asc(learningGroups.name));
  const members = await db.select({ groupId: learningGroupMembers.groupId }).from(learningGroupMembers);
  const memberCount = new Map<number, number>();
  for (const row of members) memberCount.set(row.groupId, (memberCount.get(row.groupId) ?? 0) + 1);
  return rows.map((row) => ({ ...row, memberCount: memberCount.get(row.id) ?? 0 }));
}

export async function bindGroupContract(groupId: number, contractId: number | null, actorId: number, reason: string) {
  const db = await requireDb();
  const [group] = await db.select().from(learningGroups).where(eq(learningGroups.id, groupId));
  if (!group) throw new Error("반을 찾을 수 없습니다.");
  if (contractId !== null) {
    const contract = await getContract(contractId);
    if (!contract) throw new Error("계약을 찾을 수 없습니다.");
    if (contract.status === "closed") throw new Error("종료된 계약에는 반을 연결할 수 없습니다.");
  }
  await db.update(learningGroups).set({ contractId }).where(eq(learningGroups.id, groupId));
  // 연결 시점 이후의 활동부터 적용된다(이미 장부에 기록된 활동은 그대로).
  await writeAudit(actorId, "group_contract_bound", "group", groupId, reason, { before: group.contractId, after: contractId });
}

// ========== 기관 소속 회원 ==========

export async function listInstitutionMembers() {
  const db = await requireDb();
  return db.select({
    id: institutionMembers.id,
    userId: institutionMembers.userId,
    userName: users.name,
    userEmail: users.email,
    userRole: users.role,
    contractId: institutionMembers.contractId,
    excludeIndividualSettlement: institutionMembers.excludeIndividualSettlement,
    reason: institutionMembers.reason,
    createdAt: institutionMembers.createdAt,
    endedAt: institutionMembers.endedAt,
  }).from(institutionMembers).leftJoin(users, eq(users.id, institutionMembers.userId)).orderBy(desc(institutionMembers.createdAt)).limit(300);
}

export async function getActiveMember(userId: number) {
  const db = await requireDb();
  const [member] = await db.select().from(institutionMembers).where(and(eq(institutionMembers.userId, userId), isNull(institutionMembers.endedAt))).limit(1);
  return member;
}

export async function addInstitutionMember(input: { userId: number; contractId: number | null; excludeIndividualSettlement: boolean; reason: string; createdBy: number }) {
  const db = await requireDb();
  const [user] = await db.select().from(users).where(eq(users.id, input.userId));
  if (!user) throw new Error("회원을 찾을 수 없습니다.");
  if (user.role === "admin") throw new Error("관리자 계정은 기관 소속으로 지정할 수 없습니다.");
  if (user.tag === "학부모") throw new Error("학부모 계정은 기관 소속으로 지정할 수 없습니다.");
  if (input.contractId !== null) {
    const contract = await getContract(input.contractId);
    if (!contract || contract.status === "closed") throw new Error("연결할 수 있는 계약이 아닙니다.");
    // 계약이 비용을 부담하는 것은 학생의 AI 평가이므로 교사에게는 계약을 연결하지 않는다.
    if (user.role !== "user") throw new Error("계약은 학생 회원에만 연결할 수 있습니다.");
  }
  if (await getActiveMember(input.userId)) throw new Error("이미 기관 소속으로 지정된 회원입니다. 먼저 해제해 주세요.");
  const [result] = await db.insert(institutionMembers).values({
    userId: input.userId, contractId: input.contractId, excludeIndividualSettlement: input.excludeIndividualSettlement ? 1 : 0, reason: input.reason, createdBy: input.createdBy,
  });
  const id = Number((result as { insertId?: number }).insertId);
  await writeAudit(input.createdBy, "member_added", "member", id, input.reason, { userId: input.userId, contractId: input.contractId });
  return id;
}

export async function endInstitutionMember(id: number, actorId: number, reason: string) {
  const db = await requireDb();
  const [member] = await db.select().from(institutionMembers).where(eq(institutionMembers.id, id));
  if (!member || member.endedAt) throw new Error("해제할 수 있는 기관 소속 기록이 없습니다.");
  await db.update(institutionMembers).set({ endedAt: new Date() }).where(eq(institutionMembers.id, id));
  // 해제 이후의 활동부터 개별 정산 대상이 된다(이미 장부에 기록된 활동은 그대로).
  await writeAudit(actorId, "member_ended", "member", id, reason, { userId: member.userId });
}

// ========== 계약·소속 확인 ==========

/** 이 교사가 이 학생을 지도하는 반 중 기관 계약이 연결된 반(가장 먼저 만든 것). */
export async function resolveTeacherStudentContext(teacherId: number, studentId: number) {
  const db = await requireDb();
  const rows = await db.select({ groupId: learningGroups.id, contractId: learningGroups.contractId })
    .from(learningGroupMembers)
    .innerJoin(learningGroups, eq(learningGroups.id, learningGroupMembers.groupId))
    .where(and(eq(learningGroupMembers.studentId, studentId), eq(learningGroups.teacherId, teacherId), eq(learningGroups.isActive, 1)))
    .orderBy(asc(learningGroups.id));
  const contracted = rows.find((row) => row.contractId !== null);
  return { groupId: (contracted ?? rows[0])?.groupId ?? null, contractId: contracted?.contractId ?? null };
}

export async function getGroupContractId(groupId: number): Promise<number | null> {
  const db = await requireDb();
  const [group] = await db.select({ contractId: learningGroups.contractId }).from(learningGroups).where(eq(learningGroups.id, groupId));
  return group?.contractId ?? null;
}

export type StudentFunding =
  | { kind: "none" }
  | { kind: "ambiguous" }
  | { kind: "contract"; contract: NonNullable<Awaited<ReturnType<typeof getContract>>>; via: "member" | "group" };

/** 학생의 AI 평가 비용을 부담하는 기관 계약. 소속 회원에 지정된 계약이 먼저이고, 없으면 속한 반의 계약이다(둘 이상이면 모호함). */
export async function resolveStudentFunding(studentId: number): Promise<StudentFunding> {
  const db = await requireDb();
  const member = await getActiveMember(studentId);
  if (member?.contractId) {
    const contract = await getContract(member.contractId);
    if (contract) return { kind: "contract", contract, via: "member" };
  }
  const rows = await db.select({ contractId: learningGroups.contractId })
    .from(learningGroupMembers)
    .innerJoin(learningGroups, eq(learningGroups.id, learningGroupMembers.groupId))
    .where(and(eq(learningGroupMembers.studentId, studentId), eq(learningGroups.isActive, 1), isNotNull(learningGroups.contractId)));
  const contractIds = Array.from(new Set(rows.map((row) => row.contractId as number)));
  if (contractIds.length === 0) return { kind: "none" };
  if (contractIds.length > 1) return { kind: "ambiguous" };
  const contract = await getContract(contractIds[0]);
  return contract ? { kind: "contract", contract, via: "group" } : { kind: "none" };
}

// ========== 예산 차감 ==========

/**
 * 한도 안일 때만 한 번의 조건부 갱신으로 차감한다(마지막 1건에 동시에 요청이 와도 한 건만 통과).
 * 계약이 활성 상태이고 기간 안이어야 한다(끝 시각은 포함하지 않는다).
 */
export function budgetOps(params: { contractId: number; budgetType: BudgetType; actorId: number; studentId?: number | null; groupId?: number | null; sourceType?: string }): BudgetOps {
  const { contractId, budgetType } = params;
  return {
    async reserve() {
      const db = await requireDb();
      const used = USED_COLUMN[budgetType];
      // 차감과 사용 기록을 한 트랜잭션으로 묶는다(한쪽만 반영되어 되돌릴 수 없는 일이 없도록).
      return db.transaction(async (tx) => {
        const now = new Date();
        const [result] = await tx.update(institutionContracts)
          .set({ [BUDGET_COLUMNS[budgetType].used]: sql`${used} + 1` })
          .where(and(eq(institutionContracts.id, contractId), eq(institutionContracts.status, "active"), lte(institutionContracts.periodStart, now), gt(institutionContracts.periodEnd, now),
            // 횟수제·차단 계약만 한도 안일 때 차감한다. 기간제·경고 후 계속 계약은 기간 안이면 한도를 넘어도 차감(기록)한다.
            or(eq(institutionContracts.usageMode, "period"), eq(institutionContracts.overageAction, "warn"), lt(used, LIMIT_COLUMN[budgetType]))));
        if (affectedRows(result) === 0) {
          const [contract] = await tx.select().from(institutionContracts).where(eq(institutionContracts.id, contractId));
          const availability = contract ? contractAvailability(contract, now) : { usable: false, reason: "기관 계약을 찾을 수 없습니다." };
          throw new InstitutionBudgetError(availability.usable
            ? `기관 계약의 ${budgetLabel(budgetType)} 예산을 모두 사용했습니다. 기관 담당자에게 문의해 주세요.`
            : `${availability.reason} 기관 담당자에게 문의해 주세요.`);
        }
        const [inserted] = await tx.insert(institutionUsage).values({
          contractId, budgetType, actorId: params.actorId, studentId: params.studentId ?? null, groupId: params.groupId ?? null, sourceType: params.sourceType ?? null, status: "consumed",
        });
        return { usageId: Number((inserted as { insertId?: number }).insertId) };
      });
    },
    async attachSource(usageId, sourceId) {
      const db = await requireDb();
      await db.update(institutionUsage).set({ sourceId }).where(eq(institutionUsage.id, usageId));
    },
    async release(usageId) {
      const db = await requireDb();
      const used = USED_COLUMN[budgetType];
      // 사용 기록을 되돌림 상태로 바꾸는 것과 차감 취소를 한 트랜잭션으로 묶는다(어느 한쪽만 반영되면 재시도가 막힌다).
      await db.transaction(async (tx) => {
        const [result] = await tx.update(institutionUsage).set({ status: "released" }).where(and(eq(institutionUsage.id, usageId), eq(institutionUsage.status, "consumed")));
        if (affectedRows(result) === 0) return;
        await tx.update(institutionContracts).set({ [BUDGET_COLUMNS[budgetType].used]: sql`GREATEST(${used} - 1, 0)` }).where(eq(institutionContracts.id, contractId));
      });
    },
  };
}

export async function listUsage(input: { contractId: number; budgetType?: BudgetType; limit: number; offset: number }) {
  const db = await requireDb();
  const conditions = [eq(institutionUsage.contractId, input.contractId)];
  if (input.budgetType) conditions.push(eq(institutionUsage.budgetType, input.budgetType));
  return db.select().from(institutionUsage).where(and(...conditions)).orderBy(desc(institutionUsage.createdAt)).limit(input.limit).offset(input.offset);
}

// ========== 교사 활동 장부 ==========

export type RecordActivityInput = {
  activityType: ActivityType;
  sourceId: number;
  teacherId: number;
  studentId: number;
  occurredAt?: Date;
  groupId?: number | null;
  /** 장부 도입 전의 과거 활동을 나중에 기록할 때: 현재 정책으로 다시 해석하지 않고 개별 정산 대상으로 둔다. */
  legacy?: boolean;
};

export async function getAccounting(activityType: string, sourceId: number) {
  const db = await requireDb();
  const [row] = await db.select().from(teacherActivityAccounting).where(and(eq(teacherActivityAccounting.activityType, activityType), eq(teacherActivityAccounting.sourceId, sourceId)));
  return row;
}

/**
 * 활동이 처음 완료된 시점의 정책으로 정산 대상 여부를 고정해 기록한다. 같은 활동은 한 번만 기록된다(수정·재저장은 새 활동이 아니다).
 */
export async function recordTeacherActivity(input: RecordActivityInput) {
  const db = await requireDb();
  const existing = await getAccounting(input.activityType, input.sourceId);
  if (existing) return existing;

  let groupId = input.groupId ?? null;
  let contractId: number | null = null;
  let automaticExclusion: ReturnType<typeof decideAutomaticExclusion> = "none";
  let snapshot: Record<string, unknown> = { legacy: Boolean(input.legacy) };
  if (!input.legacy) {
    const [context, studentMember, teacherMember] = await Promise.all([
      input.groupId ? getGroupContractId(input.groupId).then((contract) => ({ groupId: input.groupId ?? null, contractId: contract })) : resolveTeacherStudentContext(input.teacherId, input.studentId),
      getActiveMember(input.studentId),
      getActiveMember(input.teacherId),
    ]);
    groupId = context.groupId;
    contractId = context.contractId;
    const studentInInstitution = Boolean(studentMember?.excludeIndividualSettlement);
    const teacherInInstitution = Boolean(teacherMember?.excludeIndividualSettlement);
    automaticExclusion = decideAutomaticExclusion({ classContractId: contractId, studentInInstitution, teacherInInstitution });
    snapshot = { legacy: false, groupId, contractId, studentMemberId: studentMember?.id ?? null, teacherMemberId: teacherMember?.id ?? null, studentInInstitution, teacherInInstitution };
  }

  await db.insert(teacherActivityAccounting).values({
    activityType: input.activityType, sourceId: input.sourceId, teacherId: input.teacherId, studentId: input.studentId, groupId, contractId,
    occurredAt: input.occurredAt ?? new Date(), automaticExclusion, policySnapshotJson: JSON.stringify(snapshot),
  }).onDuplicateKeyUpdate({ set: { sourceId: input.sourceId } });
  return getAccounting(input.activityType, input.sourceId);
}

export type ActivitySource = { teacherId: number; studentId: number; groupId: number | null; occurredAt: Date };

/** 활동의 출처 테이블에서 담당 교사·학생·시각을 읽는다(읽기 전용). 소유자를 확인하기 전에는 아무것도 기록하지 않기 위해 따로 둔다. */
export async function resolveActivitySource(activityType: ActivityType, sourceId: number): Promise<ActivitySource | undefined> {
  const db = await requireDb();
  if (activityType === "essay_feedback") {
    const [feedback] = await db.select().from(teacherFeedback).where(eq(teacherFeedback.id, sourceId));
    if (!feedback) return undefined;
    const [essay] = await db.select().from(essaySubmission).where(eq(essaySubmission.id, feedback.essayId));
    return essay ? { teacherId: feedback.teacherId, studentId: essay.userId, groupId: null, occurredAt: feedback.createdAt } : undefined;
  }
  if (activityType === "assignment_review") {
    const [submission] = await db.select().from(classAssignmentSubmissions).where(eq(classAssignmentSubmissions.id, sourceId));
    if (!submission || submission.status !== "reviewed") return undefined;
    const [assignment] = await db.select().from(classAssignments).where(eq(classAssignments.id, submission.assignmentId));
    return assignment ? { teacherId: assignment.createdBy, studentId: submission.studentId, groupId: assignment.groupId, occurredAt: submission.reviewedAt ?? submission.submittedAt } : undefined;
  }
  const [feedback] = await db.select().from(workbookTeacherFeedback).where(eq(workbookTeacherFeedback.id, sourceId));
  if (!feedback) return undefined;
  const [answer] = await db.select().from(curriculumWorkbookAnswers).where(eq(curriculumWorkbookAnswers.id, feedback.answerId));
  return answer ? { teacherId: feedback.teacherId, studentId: answer.userId, groupId: null, occurredAt: feedback.createdAt } : undefined;
}

/** 장부 도입 시점(정책이 적용되어 처음 기록된 시각). 이 시각 이후의 활동은 장부에 있어야 하고, 없으면 기록에 실패한 것이다. */
export async function getLedgerStart(): Promise<Date | null> {
  const db = await requireDb();
  const [row] = await db.select({ first: sql<Date | null>`min(${teacherActivityAccounting.createdAt})` }).from(teacherActivityAccounting).where(like(teacherActivityAccounting.policySnapshotJson, '%"legacy":false%'));
  return row?.first ? new Date(row.first) : null;
}

/** 장부에 없는 과거(장부 도입 전) 활동을 개별 정산 대상으로 기록한다(수동 제외를 하려는 시점에 필요하다). */
export async function ensureAccountingRow(activityType: ActivityType, sourceId: number) {
  const existing = await getAccounting(activityType, sourceId);
  if (existing) return existing;
  const source = await resolveActivitySource(activityType, sourceId);
  if (!source) return undefined;
  return recordTeacherActivity({ activityType, sourceId, teacherId: source.teacherId, studentId: source.studentId, groupId: source.groupId, occurredAt: source.occurredAt, legacy: true });
}

/**
 * 장부 기록에 실패했던 최근 활동(장부 도입 이후인데 장부에 없는 것)을 지금의 정책으로 기록해 정리한다.
 * 정리하기 전에는 이런 활동이 정산 금액에 들어가지 않고, 정산 확정도 막힌다.
 */
export async function reconcileUnaccountedActivities(teacherId: number, start: Date, end: Date) {
  const ledgerStart = await getLedgerStart();
  if (!ledgerStart) return 0;
  const activities = await listTeacherActivitiesForMonth(teacherId, start, end);
  let reconciled = 0;
  for (const activity of activities) {
    if (!activity.unreconciled) continue;
    await recordTeacherActivity({ activityType: activity.activityType as ActivityType, sourceId: activity.sourceId, teacherId, studentId: activity.studentId, groupId: activity.groupId, occurredAt: new Date(activity.occurredAt) });
    reconciled += 1;
  }
  return reconciled;
}

export async function setManualExclusion(input: { activityType: ActivityType; sourceId: number; excluded: boolean; reason: string; actorId: number }) {
  const db = await requireDb();
  const row = await ensureAccountingRow(input.activityType, input.sourceId);
  if (!row) throw new Error("활동을 찾을 수 없습니다.");
  // 이미 원하는 상태이면 아무것도 바꾸지 않는다(처음 제외한 사람과 사유가 덮어써지지 않는다).
  if (input.excluded === (row.manualExcluded === 1)) return row;
  await db.update(teacherActivityAccounting).set(input.excluded
    ? { manualExcluded: 1, manualExclusionReason: input.reason.slice(0, 500), manualExcludedBy: input.actorId, manualExcludedAt: new Date() }
    : { manualExcluded: 0, manualExclusionReason: null, manualExcludedBy: null, manualExcludedAt: null })
    .where(eq(teacherActivityAccounting.id, row.id));
  await writeAudit(input.actorId, input.excluded ? "activity_excluded" : "activity_restored", "activity", row.id, input.reason, { activityType: input.activityType, sourceId: input.sourceId, teacherId: row.teacherId });
  return getAccounting(input.activityType, input.sourceId);
}

/** 한 달 동안 교사의 활동 목록(장부 + 장부 도입 전 과거 활동). */
export async function listTeacherActivitiesForMonth(teacherId: number, start: Date, end: Date) {
  const db = await requireDb();
  const ledger = await db.select({
    activityType: teacherActivityAccounting.activityType,
    sourceId: teacherActivityAccounting.sourceId,
    occurredAt: teacherActivityAccounting.occurredAt,
    studentId: teacherActivityAccounting.studentId,
    studentName: users.name,
    groupId: teacherActivityAccounting.groupId,
    automaticExclusion: teacherActivityAccounting.automaticExclusion,
    manualExcluded: teacherActivityAccounting.manualExcluded,
    manualExclusionReason: teacherActivityAccounting.manualExclusionReason,
    manualExcludedBy: teacherActivityAccounting.manualExcludedBy,
  }).from(teacherActivityAccounting).leftJoin(users, eq(users.id, teacherActivityAccounting.studentId))
    .where(and(eq(teacherActivityAccounting.teacherId, teacherId), gte(teacherActivityAccounting.occurredAt, start), lt(teacherActivityAccounting.occurredAt, end)));

  const legacyBase = { automaticExclusion: "none" as const, manualExcluded: 0, manualExclusionReason: null, manualExcludedBy: null, groupId: null as number | null };
  const essays = await db.select({ sourceId: teacherFeedback.id, occurredAt: teacherFeedback.createdAt, studentId: essaySubmission.userId, studentName: users.name })
    .from(teacherFeedback).innerJoin(essaySubmission, eq(essaySubmission.id, teacherFeedback.essayId)).leftJoin(users, eq(users.id, essaySubmission.userId))
    .leftJoin(teacherActivityAccounting, and(eq(teacherActivityAccounting.activityType, "essay_feedback"), eq(teacherActivityAccounting.sourceId, teacherFeedback.id)))
    .where(and(eq(teacherFeedback.teacherId, teacherId), gte(teacherFeedback.createdAt, start), lt(teacherFeedback.createdAt, end), isNull(teacherActivityAccounting.id)));
  const reviews = await db.select({ sourceId: classAssignmentSubmissions.id, occurredAt: classAssignmentSubmissions.reviewedAt, studentId: classAssignmentSubmissions.studentId, studentName: users.name, groupId: classAssignments.groupId })
    .from(classAssignmentSubmissions).innerJoin(classAssignments, eq(classAssignments.id, classAssignmentSubmissions.assignmentId)).leftJoin(users, eq(users.id, classAssignmentSubmissions.studentId))
    .leftJoin(teacherActivityAccounting, and(eq(teacherActivityAccounting.activityType, "assignment_review"), eq(teacherActivityAccounting.sourceId, classAssignmentSubmissions.id)))
    .where(and(eq(classAssignments.createdBy, teacherId), eq(classAssignmentSubmissions.status, "reviewed"), gte(classAssignmentSubmissions.reviewedAt, start), lt(classAssignmentSubmissions.reviewedAt, end), isNull(teacherActivityAccounting.id)));
  const workbooks = await db.select({ sourceId: workbookTeacherFeedback.id, occurredAt: workbookTeacherFeedback.createdAt, studentId: curriculumWorkbookAnswers.userId, studentName: users.name })
    .from(workbookTeacherFeedback).innerJoin(curriculumWorkbookAnswers, eq(curriculumWorkbookAnswers.id, workbookTeacherFeedback.answerId)).leftJoin(users, eq(users.id, curriculumWorkbookAnswers.userId))
    .leftJoin(teacherActivityAccounting, and(eq(teacherActivityAccounting.activityType, "workbook_feedback"), eq(teacherActivityAccounting.sourceId, workbookTeacherFeedback.id)))
    .where(and(eq(workbookTeacherFeedback.teacherId, teacherId), gte(workbookTeacherFeedback.createdAt, start), lt(workbookTeacherFeedback.createdAt, end), isNull(teacherActivityAccounting.id)));

  const legacy = [
    ...essays.map((row) => ({ ...legacyBase, activityType: "essay_feedback", sourceId: row.sourceId, occurredAt: row.occurredAt, studentId: row.studentId, studentName: row.studentName })),
    ...reviews.map((row) => ({ ...legacyBase, activityType: "assignment_review", sourceId: row.sourceId, occurredAt: row.occurredAt as Date, studentId: row.studentId, studentName: row.studentName, groupId: row.groupId as number | null })),
    ...workbooks.map((row) => ({ ...legacyBase, activityType: "workbook_feedback", sourceId: row.sourceId, occurredAt: row.occurredAt, studentId: row.studentId, studentName: row.studentName })),
  ];
  const ledgerStart = await getLedgerStart();
  return [...ledger.map((row) => ({ ...row, legacy: false, unreconciled: false })), ...legacy.map((row) => ({ ...row, legacy: true, unreconciled: Boolean(ledgerStart && new Date(row.occurredAt).getTime() >= ledgerStart.getTime()) }))]
    .sort((left, right) => new Date(right.occurredAt).getTime() - new Date(left.occurredAt).getTime());
}

export async function findUserByEmailOrId(input: { userId?: number; email?: string }) {
  const db = await requireDb();
  if (input.userId) {
    const [user] = await db.select({ id: users.id, name: users.name, email: users.email, role: users.role }).from(users).where(eq(users.id, input.userId));
    return user;
  }
  if (input.email) {
    const [user] = await db.select({ id: users.id, name: users.name, email: users.email, role: users.role }).from(users).where(eq(users.email, input.email.trim().toLowerCase()));
    return user;
  }
  return undefined;
}
