// 라우터가 기관 계약 예산과 교사 활동 장부를 쓰는 입구. 예산이 없는 일반 작업은 그대로 실행된다.
import { TRPCError } from "@trpc/server";
import * as institution from "./institutionDb";
import { InstitutionBudgetError, runWithBudget, type BudgetOps } from "./institutionBudget";
import type { BudgetType } from "../shared/institution";

/** 예산 부족·계약 만료는 사용자에게 이유가 보이도록 FORBIDDEN으로 바꾼다. */
export function toBudgetTrpcError(error: unknown): unknown {
  if (error instanceof InstitutionBudgetError) return new TRPCError({ code: "FORBIDDEN", message: error.message });
  return error;
}

async function execute<T>(ops: Promise<BudgetOps | null>, work: () => Promise<T>, sourceIdOf?: (result: T) => number | null | undefined): Promise<T> {
  try {
    return await runWithBudget(await ops, work, sourceIdOf);
  } catch (error) {
    throw toBudgetTrpcError(error);
  }
}

/** 반(group)에 연결된 기관 계약 예산으로 작업한다(출결·공지·과제 생성, 반 과제 채점 등). 연결된 계약이 없으면 예산 없이 실행한다. */
export function withGroupBudget<T>(input: { groupId: number; budgetType: BudgetType; actorId: number; studentId?: number | null; sourceType: string }, work: () => Promise<T>, sourceIdOf?: (result: T) => number | null | undefined): Promise<T> {
  const ops = institution.getGroupContractId(input.groupId).then((contractId) =>
    contractId ? institution.budgetOps({ contractId, budgetType: input.budgetType, actorId: input.actorId, studentId: input.studentId ?? null, groupId: input.groupId, sourceType: input.sourceType }) : null,
  );
  return execute(ops, work, sourceIdOf);
}

/** 교사가 학생을 지도하는 반의 기관 계약 예산으로 작업한다(교사 첨삭, 교사 AI 초안 등). 해당하는 계약이 없으면 예산 없이 실행한다. */
export function withTeacherStudentBudget<T>(input: { teacherId: number; studentId: number; budgetType: BudgetType; actorId: number; sourceType: string }, work: () => Promise<T>, sourceIdOf?: (result: T) => number | null | undefined): Promise<T> {
  const ops = institution.resolveTeacherStudentContext(input.teacherId, input.studentId).then((context) =>
    context.contractId ? institution.budgetOps({ contractId: context.contractId, budgetType: input.budgetType, actorId: input.actorId, studentId: input.studentId, groupId: context.groupId, sourceType: input.sourceType }) : null,
  );
  return execute(ops, work, sourceIdOf);
}

/**
 * 교사 활동을 장부에 기록한다. 기록에 실패해도 교사의 작업(첨삭·채점)은 막지 않는다.
 * 실패한 활동은 장부에 없으므로 개별 정산 대상으로 세어진다 — 오류를 남겨 운영팀이 확인할 수 있게 한다.
 */
export async function recordActivitySafely(input: Parameters<typeof institution.recordTeacherActivity>[0]) {
  try {
    return await institution.recordTeacherActivity(input);
  } catch (error) {
    console.error("[institution] failed to record teacher activity", input.activityType, input.sourceId, error);
    return undefined;
  }
}
