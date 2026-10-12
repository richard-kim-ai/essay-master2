import { beforeEach, describe, expect, it, vi } from "vitest";

// db 계층은 미리 넣어 둔 결과를 차례로 돌려주는 가짜로 대체한다.
const fake = vi.hoisted(() => ({ rows: [] as any[], selectError: null as Error | null, inserts: [] as Array<{ table: unknown; values: any }>, notifyError: false }));
vi.mock("./db", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./db")>();
  const chain: any = { from: () => chain, where: () => chain, orderBy: () => chain, limit: () => (fake.selectError ? Promise.reject(fake.selectError) : Promise.resolve(fake.rows)) };
  return {
    ...actual,
    getDb: vi.fn(async () => ({
      select: () => chain,
      insert: (table: unknown) => ({
        values: async (values: any) => {
          if (fake.notifyError && values?.category === "system") throw new Error("notify failed");
          fake.inserts.push({ table, values });
        },
      }),
    })),
  };
});

import { addParentComment, listParentCommentsForStudent, parseLegacyParentComments } from "./parentCommentDb";
import { isBlockedForParent, isParentAccount } from "../client/src/lib/parentAccess";

// 운영 DB에 실제로 들어 있던 옛 형식(학생의 운영자 메모에 한 줄로 저장)
const LEGACY = "[학부모 코멘트(홍서방)] 힘내라 짜샤... (10/12/2026, 6:59:46 PM)";

beforeEach(() => {
  fake.rows = [];
  fake.selectError = null;
  fake.inserts = [];
  fake.notifyError = false;
});

describe("옛 학부모 코멘트(운영자 메모) 해석", () => {
  it("운영 DB에 있던 형식에서 이름·내용·날짜를 꺼낸다", () => {
    const [item] = parseLegacyParentComments(LEGACY);
    expect(item).toMatchObject({ parentName: "홍서방", comment: "힘내라 짜샤...", legacy: true, essayId: null, essayTitle: null });
    expect(item.createdAt).toBeInstanceOf(Date);
  });

  it("운영자 내부 메모 줄은 학부모 코멘트로 읽지 않는다", () => {
    const items = parseLegacyParentComments(`관리자 메모: 결제 문의 있음\n${LEGACY}\n[운영] 다른 메모`);
    expect(items).toHaveLength(1);
    expect(items[0].comment).toBe("힘내라 짜샤...");
  });

  it("메모가 비었거나 날짜가 없는 줄도 안전하게 처리한다", () => {
    expect(parseLegacyParentComments(null)).toEqual([]);
    expect(parseLegacyParentComments("")).toEqual([]);
    const [item] = parseLegacyParentComments("[학부모 코멘트(엄마)] 오늘도 수고했어");
    expect(item).toMatchObject({ parentName: "엄마", comment: "오늘도 수고했어", createdAt: null });
  });
});

describe("listParentCommentsForStudent", () => {
  it("새 테이블 기록과 옛 기록을 합쳐 최신순으로 돌려준다", async () => {
    fake.rows = [{ id: 7, parentName: "홍서방", comment: "새 코멘트", essayId: null, createdAt: new Date("2030-01-01T00:00:00Z") }];
    const list = await listParentCommentsForStudent(1, LEGACY);
    expect(list.map((item) => item.comment)).toEqual(["새 코멘트", "힘내라 짜샤..."]);
    expect(list[0]).toMatchObject({ id: "7", legacy: false });
  });

  it("마이그레이션 전이라 새 테이블이 없어도 옛 기록은 계속 보인다", async () => {
    fake.selectError = new Error("Table 'parent_comments' doesn't exist");
    const list = await listParentCommentsForStudent(1, LEGACY);
    expect(list).toHaveLength(1);
    expect(list[0].legacy).toBe(true);
  });

  it("기록이 없으면 빈 목록이다", async () => {
    expect(await listParentCommentsForStudent(1, null)).toEqual([]);
  });
});

describe("addParentComment", () => {
  it("코멘트를 전용 테이블에 저장하고 학생에게 알림을 보낸다(운영자 메모는 건드리지 않는다)", async () => {
    await addParentComment({ studentId: 28, parentId: 30, parentName: "홍서방", essayId: 5, essayTitle: "교육과 기술", comment: "  잘하고 있어  " });
    expect(fake.inserts).toHaveLength(2);
    expect(fake.inserts[0].values).toMatchObject({ studentId: 28, parentId: 30, parentName: "홍서방", essayId: 5, comment: "잘하고 있어" });
    expect(fake.inserts[1].values).toMatchObject({ userId: 28, category: "system" });
    expect(fake.inserts[1].values.message).toContain("교육과 기술");
  });

  it("알림 저장이 실패해도 코멘트는 저장된 채로 오류 없이 끝난다", async () => {
    fake.notifyError = true;
    await expect(addParentComment({ studentId: 28, parentId: 30, parentName: null, essayId: 5, essayTitle: "글", comment: "응원해" })).resolves.toBeUndefined();
    expect(fake.inserts).toHaveLength(1);
    expect(fake.inserts[0].values.parentName).toBe("학부모");
  });
});

describe("학부모 계정의 화면 접근", () => {
  it("학부모 계정만 학부모로 판단한다", () => {
    expect(isParentAccount({ role: "user", tag: "학부모" })).toBe(true);
    expect(isParentAccount({ role: "user", tag: "고등/대입" })).toBe(false);
    expect(isParentAccount({ role: "teacher", tag: "학부모" })).toBe(false);
    expect(isParentAccount(null)).toBe(false);
  });

  it("학습 도구·내 글·수료증·결제 등 학습자 전용 주소는 막고, 학부모 포털·요금정책·알림은 열어 둔다", () => {
    for (const path of ["/mypage", "/dashboard", "/dashboard-detail", "/my-writings", "/offline-essays", "/certificate", "/quiz", "/mistake-notebook", "/topic-wizard", "/thesis-checklist", "/curriculum", "/curriculum/high_univ/3", "/workbook/high_univ/2", "/ai-feedback-compare/9", "/teacher-feedback/4", "/mypage/", "/quiz?x=1"]) {
      expect(isBlockedForParent(path), path).toBe(true);
    }
    for (const path of ["/", "/parent-portal", "/pricing", "/checkout", "/checkout?student=3", "/notifications", "/essay-archive", "/login", "/sample", "/mypagex"]) {
      expect(isBlockedForParent(path), path).toBe(false);
    }
  });
});
