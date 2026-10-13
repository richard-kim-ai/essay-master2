// 기관 계약·기관 소속 회원·반 연결 관리 API. 전부 관리자 전용이다(교사·학생이 계약이나 소속을 만들 수 없다).
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { MAX_BUDGET_UNITS } from "../shared/institution";
import { adminProcedure, router } from "./_core/trpc";
import * as institution from "./institutionDb";

const units = z.number().int().min(0).max(MAX_BUDGET_UNITS);
const reason = z.string().trim().min(2).max(500);
const usageMode = z.enum(["quota", "period"]);
const overageAction = z.enum(["block", "warn"]);

/** 규칙 위반 메시지(예: 이미 사용한 횟수보다 줄일 수 없음)를 그대로 보여 주기 위해 BAD_REQUEST로 바꾼다. */
async function guarded<T>(work: () => Promise<T>): Promise<T> {
  try {
    return await work();
  } catch (error) {
    if (error instanceof TRPCError) throw error;
    throw new TRPCError({ code: "BAD_REQUEST", message: error instanceof Error ? error.message : "처리하지 못했습니다." });
  }
}

export const institutionRouter = router({
  adminList: adminProcedure.query(() => institution.listContractsAdmin()),

  adminCreateContract: adminProcedure
    .input(z.object({
      name: z.string().trim().min(2).max(160),
      contractCode: z.string().trim().min(2).max(80).regex(/^[A-Za-z0-9._-]+$/, "계약 번호는 영문·숫자·.-_ 만 쓸 수 있습니다."),
      periodStart: z.date(),
      periodEnd: z.date(),
      humanLimit: units,
      aiLimit: units,
      managementLimit: units,
      usageMode: usageMode.default("quota"),
      overageAction: overageAction.default("block"),
      memo: z.string().trim().max(500).optional(),
    }))
    .mutation(({ ctx, input }) => guarded(() => institution.createContract({ ...input, createdBy: ctx.user.id }))),

  /** 이용 방식(횟수제·기간제)과 예산 소진 시 동작(차단·경고 후 계속) 변경. 바꾼 뒤의 새 이용부터 적용되며 사유는 감사 기록에 남는다. */
  adminUpdatePolicy: adminProcedure
    .input(z.object({ contractId: z.number().int().positive(), usageMode, overageAction, reason }))
    .mutation(({ ctx, input }) => guarded(() => institution.updateContractPolicy(input.contractId, { usageMode: input.usageMode, overageAction: input.overageAction }, ctx.user.id, input.reason))),

  /** 예산 한도 변경. 이미 쓴 횟수보다 작게 줄일 수 없고, 변경 사유는 감사 기록에 남는다. */
  adminUpdateBudgets: adminProcedure
    .input(z.object({ contractId: z.number().int().positive(), human: units.optional(), ai: units.optional(), management: units.optional(), reason }))
    .mutation(({ ctx, input }) => guarded(() => institution.updateContractBudgets(input.contractId, { human: input.human, ai: input.ai, management: input.management }, ctx.user.id, input.reason))),

  adminSetStatus: adminProcedure
    .input(z.object({ contractId: z.number().int().positive(), status: z.enum(["active", "suspended", "closed"]), reason }))
    .mutation(({ ctx, input }) => guarded(() => institution.setContractStatus(input.contractId, input.status, ctx.user.id, input.reason))),

  adminGroups: adminProcedure.query(() => institution.listGroupsWithContracts()),

  /** 반을 계약에 연결(또는 해제). 연결한 시점 이후의 활동부터 개별 정산에서 제외되고 계약 예산을 쓴다. */
  adminBindGroup: adminProcedure
    .input(z.object({ groupId: z.number().int().positive(), contractId: z.number().int().positive().nullable(), reason }))
    .mutation(({ ctx, input }) => guarded(async () => { await institution.bindGroupContract(input.groupId, input.contractId, ctx.user.id, input.reason); return { success: true as const }; })),

  adminMembers: adminProcedure.query(() => institution.listInstitutionMembers()),

  /** 기관 소속 회원 지정(회원 단위 정산 제외). 회원은 번호나 이메일로 찾는다. */
  adminAddMember: adminProcedure
    .input(z.object({
      userId: z.number().int().positive().optional(),
      email: z.string().trim().email().optional(),
      contractId: z.number().int().positive().nullable(),
      excludeIndividualSettlement: z.boolean().default(true),
      reason,
    }).refine((value) => value.userId !== undefined || value.email !== undefined, "회원 번호나 이메일이 필요합니다."))
    .mutation(({ ctx, input }) => guarded(async () => {
      const user = await institution.findUserByEmailOrId({ userId: input.userId, email: input.email });
      if (!user) throw new Error("해당 회원을 찾을 수 없습니다.");
      const id = await institution.addInstitutionMember({ userId: user.id, contractId: input.contractId, excludeIndividualSettlement: input.excludeIndividualSettlement, reason: input.reason, createdBy: ctx.user.id });
      return { id, userId: user.id, name: user.name, email: user.email };
    })),

  adminEndMember: adminProcedure
    .input(z.object({ id: z.number().int().positive(), reason }))
    .mutation(({ ctx, input }) => guarded(async () => { await institution.endInstitutionMember(input.id, ctx.user.id, input.reason); return { success: true as const }; })),

  adminUsage: adminProcedure
    .input(z.object({ contractId: z.number().int().positive(), budgetType: z.enum(["human", "ai", "management"]).optional(), limit: z.number().int().min(1).max(200).default(50), offset: z.number().int().min(0).default(0) }))
    .query(({ input }) => institution.listUsage(input)),

  adminAudit: adminProcedure
    .input(z.object({ targetType: z.string().max(40).optional(), targetId: z.number().int().optional(), limit: z.number().int().min(1).max(200).default(50), offset: z.number().int().min(0).default(0) }))
    .query(({ input }) => institution.listAudit(input)),
});
