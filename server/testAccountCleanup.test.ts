import { describe, expect, it, vi } from "vitest";
// 운영 전용 ESM 스크립트는 TypeScript 선언 파일이 없으며 테스트에서는 모킹된 DB만 사용한다.
// @ts-ignore
import { APPROVED_ACCOUNTS, PROTECTED_IDS, PRESERVED_TABLES, validateAccounts, cleanup } from "../scripts/cleanup-approved-test-accounts.mjs";

const protectedUsers = [
  { id: 1, role: "admin", openId: "owner", email: "nicky@ufinsu.com", name: "nicky" },
  { id: 14670001, role: "teacher", openId: "ai_tutor_bot_system", email: "ai-tutor@essaymaster.internal", name: "AI 첨삭 전용 봇" },
];
const selected = [...APPROVED_ACCOUNTS.entries()].map(([id, email]) => ({ id, email, role: "user", openId: `test-${id}` }));
function connection(users = [...protectedUsers, ...selected]) {
  return {
    beginTransaction: vi.fn().mockResolvedValue(undefined),
    rollback: vi.fn().mockResolvedValue(undefined),
    commit: vi.fn().mockResolvedValue(undefined),
    query: vi.fn(async (sql: string) => {
      if (sql.startsWith("SELECT * FROM users")) return [users];
      if (sql.includes("information_schema.TABLES")) return [[]];
      if (sql.includes("information_schema.KEY_COLUMN_USAGE")) return [[]];
      throw new Error(`예상하지 않은 쿼리: ${sql}`);
    }),
  };
}

describe("승인된 테스트 계정 정리 안전장치", () => {
  it("명시적으로 승인한 14개만 선택하고 관리자와 AI 봇을 제외한다", () => {
    const ids = validateAccounts([...protectedUsers, ...selected, { id: 99, email: "new@real.example", role: "user" }]);
    expect(ids).toHaveLength(14);
    expect(ids).not.toContain(99);
    for (const id of PROTECTED_IDS) expect(ids).not.toContain(id);
  });
  it("새 관리자 계정으로 승격한 대상은 삭제하지 않고 중단한다", () => {
    expect(() => validateAccounts([...protectedUsers, { ...selected[0], role: "admin" }])).toThrow("일치하지 않습니다");
  });
  it("동일 ID가 다른 이메일로 바뀌었으면 중단한다", () => {
    expect(() => validateAccounts([...protectedUsers, { ...selected[0], email: "different@example.com" }])).toThrow("일치하지 않습니다");
  });
  it("AI 봇 식별자가 다르면 중단한다", () => {
    expect(() => validateAccounts([protectedUsers[0], { ...protectedUsers[1], openId: "not-ai" }])).toThrow("AI 기본 담당 봇");
  });
  it("관리자 보호 계정이 없거나 관리자 권한이 아니면 중단한다", () => {
    expect(() => validateAccounts([protectedUsers[1]])).toThrow("관리자");
    expect(() => validateAccounts([{ ...protectedUsers[0], role: "user" }, protectedUsers[1]])).toThrow("관리자");
  });
  it("재실행 시 이미 삭제된 대상은 자동으로 제외한다", () => {
    expect(validateAccounts(protectedUsers)).toEqual([]);
  });
  it("문제은행·교재·감사·결제·정산 테이블을 보호 대상으로 명시한다", () => {
    expect(PRESERVED_TABLES).toEqual(expect.arrayContaining(["question_bank", "curriculum", "lesson_theory_content", "admin_audit_logs", "payment_orders", "teacher_settlements", "teacher_activity_accounting"]));
  });
  it("기본 실행은 계획만 반환하며 데이터 변경 없이 롤백한다", async () => {
    const db = connection();
    const report = await cleanup(db);
    expect(report.mode).toBe("dry-run");
    expect(report.counts.users).toBe(14);
    expect(report.planSha).toMatch(/^[a-f0-9]{64}$/);
    expect(db.rollback).toHaveBeenCalledOnce();
    expect(db.commit).not.toHaveBeenCalled();
    expect(db.query.mock.calls.some(([sql]) => /^(DELETE|UPDATE|INSERT)/.test(sql))).toBe(false);
  });
  it("승인된 계획 해시가 없거나 다르면 변경 전에 중단·롤백한다", async () => {
    const db = connection();
    await expect(cleanup(db, { apply: true, expectedSha: "stale" })).rejects.toThrow("삭제 계획이 변경");
    expect(db.rollback).toHaveBeenCalledOnce();
    expect(db.commit).not.toHaveBeenCalled();
    expect(db.query.mock.calls.some(([sql]) => sql.startsWith("DELETE"))).toBe(false);
  });
  it("이미 정리된 DB는 재실행해도 계정 삭제 쿼리 없이 검증한다", async () => {
    const dry = await cleanup(connection(protectedUsers));
    const db = connection(protectedUsers);
    const report = await cleanup(db, { apply: true, expectedSha: dry.planSha });
    expect(report.verified).toBe(true);
    expect(report.remainingUsers).toHaveLength(2);
    expect(db.commit).toHaveBeenCalledOnce();
    expect(db.query.mock.calls.some(([sql]) => sql.startsWith("DELETE"))).toBe(false);
  });
});
