import { beforeEach, describe, expect, it, vi } from "vitest";

// select는 미리 넣어 둔 결과를 차례로 돌려주고, update·delete는 호출 내용을 기록하는 가짜 DB.
const fake = vi.hoisted(() => ({ queue: [] as any[][], log: [] as Array<{ kind: string; method: string; args: unknown[] }> }));
vi.mock("./db", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./db")>();
  const chainFor = (kind: string, consume: boolean): any =>
    new Proxy(
      {},
      {
        get(_target, property) {
          if (property === "then") return (resolve: (value: unknown) => void) => resolve(consume ? (fake.queue.shift() ?? []) : [{ affectedRows: 1 }]);
          return (...args: unknown[]) => {
            fake.log.push({ kind, method: String(property), args });
            return chainFor(kind, consume);
          };
        },
      }
    );
  return { ...actual, getDb: vi.fn(async () => ({ select: () => chainFor("select", true), update: () => chainFor("update", false), delete: () => chainFor("delete", false) })) };
});

import { appRouter } from "./routers";
import { emptyTrash, listTrashedEssays, purgeEssay, restoreEssay, trashEssay } from "./essayWorkspace";

const essay = (overrides: Record<string, unknown> = {}) => ({
  id: 5,
  userId: 77,
  title: "내 글",
  content: "본문입니다.",
  status: "draft",
  deletedAt: null,
  purgedAt: null,
  ...overrides,
});
const logOf = (kind: string) => fake.log.filter((entry) => entry.kind === kind);
const setValues = () => logOf("update").find((entry) => entry.method === "set")?.args[0] as Record<string, any> | undefined;

beforeEach(() => {
  fake.queue = [];
  fake.log = [];
});

describe("글 삭제(휴지통으로 이동)", () => {
  it("본인의 초안은 휴지통으로 옮긴다(deletedAt 기록, 글 자체는 지우지 않는다)", async () => {
    fake.queue = [[essay()], []]; // 글, 진행 중인 교사 신청 없음
    const result = await trashEssay(77, 5);
    expect(result.id).toBe(5);
    expect(result.deletedAt).toBeInstanceOf(Date);
    expect(setValues()).toMatchObject({ deletedAt: expect.any(Date) });
    expect(logOf("delete")).toHaveLength(0);
  });

  it("없는 글·남의 글은 옮기지 못한다", async () => {
    fake.queue = [[]];
    await expect(trashEssay(77, 5)).rejects.toMatchObject({ code: "NOT_FOUND" });
    fake.queue = [[essay({ userId: 99 })]];
    await expect(trashEssay(77, 5)).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(logOf("update")).toHaveLength(0);
  });

  it("교사 첨삭 신청이 진행 중이거나, 제출했는데 첨삭이 아직 없으면 옮기지 못한다", async () => {
    fake.queue = [[essay({ status: "submitted" })], [{ id: 1 }]];
    await expect(trashEssay(77, 5)).rejects.toMatchObject({ code: "CONFLICT" });
    fake.queue = [[essay({ status: "submitted" })], [], []]; // 신청은 없지만 첨삭도 없음
    await expect(trashEssay(77, 5)).rejects.toMatchObject({ code: "CONFLICT" });
    expect(logOf("update")).toHaveLength(0);
  });

  it("첨삭이 끝난 글은 옮길 수 있다", async () => {
    fake.queue = [[essay({ status: "reviewed" })], []];
    await expect(trashEssay(77, 5)).resolves.toMatchObject({ id: 5 });
    expect(logOf("update").length).toBeGreaterThan(0);
  });

  it("이미 휴지통에 있으면 다시 쓰지 않는다", async () => {
    const deletedAt = new Date("2026-10-01T00:00:00Z");
    fake.queue = [[essay({ deletedAt })]];
    await expect(trashEssay(77, 5)).resolves.toEqual({ id: 5, deletedAt });
    expect(logOf("update")).toHaveLength(0);
  });
});

describe("복원", () => {
  it("휴지통의 글은 deletedAt을 비워 되돌린다", async () => {
    fake.queue = [[essay({ deletedAt: new Date() })]];
    await expect(restoreEssay(77, 5)).resolves.toEqual({ id: 5 });
    expect(setValues()).toMatchObject({ deletedAt: null });
  });

  it("영구 삭제된 글은 복원할 수 없다", async () => {
    fake.queue = [[essay({ deletedAt: new Date(), purgedAt: new Date() })]];
    await expect(restoreEssay(77, 5)).rejects.toMatchObject({ code: "NOT_FOUND" });
  });
});

describe("영구 삭제", () => {
  it("휴지통에 넣지 않은 글은 영구 삭제할 수 없다", async () => {
    fake.queue = [[essay()]];
    await expect(purgeEssay(77, 5)).rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect(logOf("delete")).toHaveLength(0);
  });

  it("교사 첨삭·신청·AI 초안 기록이 없으면 행을 지운다", async () => {
    fake.queue = [[essay({ deletedAt: new Date() })], [], [], []];
    await expect(purgeEssay(77, 5)).resolves.toEqual({ id: 5, mode: "deleted" });
    expect(logOf("delete")).toHaveLength(1);
    expect(logOf("update")).toHaveLength(0);
  });

  it("교사 첨삭 기록이 걸린 글은 행을 남기고 제목·본문만 비운다(정산·기록 보존)", async () => {
    fake.queue = [[essay({ deletedAt: new Date(), status: "reviewed" })], [{ id: 40 }], [], []];
    await expect(purgeEssay(77, 5)).resolves.toEqual({ id: 5, mode: "emptied" });
    expect(logOf("delete")).toHaveLength(0);
    expect(setValues()).toMatchObject({ title: "삭제된 글", content: "", aiFeedbackId: null, purgedAt: expect.any(Date) });
  });

  it("이미 영구 삭제된 글은 그대로 둔다", async () => {
    fake.queue = [[essay({ deletedAt: new Date(), purgedAt: new Date() })]];
    await expect(purgeEssay(77, 5)).resolves.toMatchObject({ mode: "already" });
    expect(logOf("delete")).toHaveLength(0);
  });
});

describe("휴지통 목록·비우기", () => {
  it("목록은 본문 전체 대신 미리보기만 돌려준다", async () => {
    fake.queue = [[{ id: 5, title: "내 글", status: "draft", content: "긴   본문\n".repeat(80), deletedAt: new Date(), updatedAt: new Date() }]];
    const rows = await listTrashedEssays(77);
    expect(rows).toHaveLength(1);
    expect(rows[0]).not.toHaveProperty("content");
    expect(rows[0].preview.length).toBeLessThanOrEqual(140);
  });

  it("비우기는 글마다 영구 삭제 규칙을 적용하고 개수를 알려 준다", async () => {
    fake.queue = [
      [
        { id: 5, title: "a", status: "draft", content: "x", deletedAt: new Date(), updatedAt: new Date() },
        { id: 6, title: "b", status: "reviewed", content: "y", deletedAt: new Date(), updatedAt: new Date() },
      ],
      // 5번: 글, 연결 없음 → 삭제
      [essay({ id: 5, deletedAt: new Date() })], [], [], [],
      // 6번: 글, 첨삭 있음 → 비움
      [essay({ id: 6, deletedAt: new Date(), status: "reviewed" })], [{ id: 1 }], [], [],
    ];
    await expect(emptyTrash(77)).resolves.toEqual({ count: 2, deleted: 1, emptied: 1 });
  });
});

describe("API", () => {
  const caller = (user: any) => appRouter.createCaller({ user, req: { headers: {} }, res: {} } as any);

  it("비로그인은 쓸 수 없다", async () => {
    const guest = caller(null);
    await expect(guest.essaySubmission.trash({ essayId: 5 })).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    await expect(guest.essaySubmission.restore({ essayId: 5 })).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    await expect(guest.essaySubmission.purge({ essayId: 5 })).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    await expect(guest.essaySubmission.trashList()).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    await expect(guest.essaySubmission.emptyTrash()).rejects.toMatchObject({ code: "UNAUTHORIZED" });
  });

  it("세션 사용자의 글만 대상이 된다(남의 글 ID를 보내도 FORBIDDEN)", async () => {
    fake.queue = [[essay({ userId: 99 })]];
    await expect(caller({ id: 77, role: "user" }).essaySubmission.trash({ essayId: 5 })).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
});
