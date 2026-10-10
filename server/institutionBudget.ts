// 기관 계약 예산을 쓰는 작업의 흐름: 예약(원자적 차감) → 작업 실행 → 성공하면 출처 연결, 실패하면 되돌림.
// DB에 의존하지 않는 순수 조율 함수라서 단위 테스트로 흐름을 검증할 수 있다(DB 구현은 institutionDb.ts).

export class InstitutionBudgetError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InstitutionBudgetError";
  }
}

export type BudgetOps = {
  /** 한도 안일 때만 차감하고 사용 기록 id를 돌려준다. 계약이 쓸 수 없거나 한도를 넘으면 InstitutionBudgetError를 던진다. */
  reserve(): Promise<{ usageId: number }>;
  /** 작업이 만든 출처(예: 첨삭 id)를 사용 기록에 연결한다. */
  attachSource(usageId: number, sourceId: number): Promise<void>;
  /** 작업이 실패했을 때 차감을 되돌린다. */
  release(usageId: number): Promise<void>;
};

/**
 * ops가 null이면(기관 계약이 비용을 부담하지 않는 일반 작업) 예산 없이 작업만 실행한다.
 * 작업이 던지면 예약을 되돌리고 같은 오류를 다시 던진다. 출처 연결 실패는 작업 결과에 영향을 주지 않는다.
 */
export async function runWithBudget<T>(ops: BudgetOps | null, run: () => Promise<T>, sourceIdOf?: (result: T) => number | null | undefined): Promise<T> {
  if (!ops) return run();
  const { usageId } = await ops.reserve();
  let result: T;
  try {
    result = await run();
  } catch (error) {
    await ops.release(usageId).catch((releaseError) => console.error("[institution] release failed", usageId, releaseError));
    throw error;
  }
  const sourceId = sourceIdOf?.(result);
  if (sourceId) await ops.attachSource(usageId, sourceId).catch((attachError) => console.error("[institution] attach failed", usageId, attachError));
  return result;
}
