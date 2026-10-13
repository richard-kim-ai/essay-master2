import { TRPCError } from "@trpc/server";
import { appNotifications } from "../drizzle/schema";
import { getDb, getLinkedStudentsForParent } from "./db";

// 학부모가 연결(승인)된 자녀에게 이용권·첨삭지도권을 구매해 주는 결제의 대상 확인.
// 주문의 userId는 이용권을 받는 학생, payerUserId는 결제한 학부모다. 이용권·첨삭지도권은 모두 학생 계정에 지급된다.

export type PurchaseActor = { id: number; role: string; tag?: string | null; name?: string | null };

export type PurchaseTarget = {
  /** 이용권·첨삭지도권을 받는 학생 */
  beneficiaryId: number;
  beneficiaryName: string | null;
  /** 결제하는 사람 */
  payerId: number;
  /** 주문에 기록할 결제자(본인 구매면 null) */
  payerUserId: number | null;
  isGift: boolean;
};

export function isParentActor(user: PurchaseActor) {
  return user.role === "user" && user.tag === "학부모";
}

/**
 * 누구에게 지급하는 결제인지 정한다.
 * - 학생 본인: 본인에게 지급(studentId를 주지 않거나 본인 id).
 * - 학부모: 반드시 studentId가 필요하고, 학생이 승인한 연결이어야 한다.
 */
export async function resolvePurchaseTarget(user: PurchaseActor, studentId?: number): Promise<PurchaseTarget> {
  if (isParentActor(user)) {
    if (!studentId) throw new TRPCError({ code: "BAD_REQUEST", message: "이용권을 받을 자녀를 선택해 주세요. 자녀 계정을 먼저 연결해야 합니다." });
    const linked = await getLinkedStudentsForParent(user.id);
    const child = linked.find((student) => student.id === studentId);
    if (!child) throw new TRPCError({ code: "FORBIDDEN", message: "연결을 승인한 자녀에게만 구매해 줄 수 있습니다." });
    return { beneficiaryId: child.id, beneficiaryName: child.name ?? null, payerId: user.id, payerUserId: user.id, isGift: true };
  }
  if (user.role !== "user") throw new TRPCError({ code: "FORBIDDEN", message: "학습자 계정만 이용권을 결제할 수 있습니다." });
  if (studentId && studentId !== user.id) throw new TRPCError({ code: "FORBIDDEN", message: "학부모 계정만 자녀에게 구매해 줄 수 있습니다." });
  return { beneficiaryId: user.id, beneficiaryName: user.name ?? null, payerId: user.id, payerUserId: null, isGift: false };
}

/** 학부모가 구매해 준 사실을 학생에게 알린다. 알림 저장이 실패해도 결제 결과에는 영향이 없다. */
export async function notifyGiftPurchase(input: { studentId: number; parentName: string | null; itemName: string; needsStart?: boolean }) {
  const db = await getDb();
  if (!db) return;
  const parent = input.parentName || "학부모";
  const message = input.needsStart
    ? `${parent}님이 '${input.itemName}'을(를) 구매해 주셨습니다. 이용권 화면에서 '유료 이용 시작'을 눌러야 이용 기간이 시작됩니다.`
    : `${parent}님이 '${input.itemName}'을(를) 구매해 주셨습니다.`;
  try {
    await db.insert(appNotifications).values({ userId: input.studentId, title: "학부모님이 이용권을 구매해 주셨습니다", message, category: "system" });
  } catch (error) {
    console.warn("[gift-purchase] 학생 알림 저장 실패:", error instanceof Error ? error.message.slice(0, 120) : error);
  }
}
