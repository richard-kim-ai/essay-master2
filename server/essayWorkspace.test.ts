import { beforeEach, describe, expect, it, vi } from "vitest";
import { MySqlDialect } from "drizzle-orm/mysql-core";

vi.mock("./db", () => ({ getDb: vi.fn() }));

import { getDb } from "./db";
import { essaySubmission } from "../drizzle/schema";
import {
  getEssayWorkspace,
  requestEssayTeacherFeedback,
  syncEssayDraft,
} from "./essayWorkspace";

type Essay = {
  id: number;
  userId: number;
  clientId: string;
  title: string;
  content: string;
  status: "draft" | "submitted" | "reviewed";
  syncRevision: number;
  aiFeedbackId?: number | null;
};

type QueryCalls = {
  selectArgs: unknown[][];
  from: unknown[];
  where: unknown[];
  leftJoin: Array<[unknown, unknown]>;
  limits: number[];
  insertValues: unknown[];
  duplicateSets: unknown[];
  updateSets: unknown[];
  updateWheres: unknown[];
};

/**
 * A deliberately small Drizzle-shaped mock. Each select query is a thenable so
 * it supports both `await ...where(...)` and `await ...where(...).limit(1)`.
 */
function createDb(selectResults: unknown[][], affectedRows = 1) {
  const calls: QueryCalls = {
    selectArgs: [],
    from: [],
    where: [],
    leftJoin: [],
    limits: [],
    insertValues: [],
    duplicateSets: [],
    updateSets: [],
    updateWheres: [],
  };

  const db = {
    select: vi.fn((...args: unknown[]) => {
      calls.selectArgs.push(args);
      const result = selectResults.shift() ?? [];
      const query: any = {
        from: vi.fn((table: unknown) => {
          calls.from.push(table);
          return query;
        }),
        leftJoin: vi.fn((table: unknown, condition: unknown) => {
          calls.leftJoin.push([table, condition]);
          return query;
        }),
        where: vi.fn((condition: unknown) => {
          calls.where.push(condition);
          return query;
        }),
        limit: vi.fn((limit: number) => {
          calls.limits.push(limit);
          return query;
        }),
        then: (
          onFulfilled: (value: unknown[]) => unknown,
          onRejected?: (reason: unknown) => unknown
        ) => Promise.resolve(result).then(onFulfilled, onRejected),
        catch: (onRejected: (reason: unknown) => unknown) =>
          Promise.resolve(result).catch(onRejected),
        finally: (onFinally: () => void) =>
          Promise.resolve(result).finally(onFinally),
      };
      return query;
    }),
    insert: vi.fn(() => {
      const query: any = {
        values: vi.fn((values: unknown) => {
          calls.insertValues.push(values);
          return query;
        }),
        onDuplicateKeyUpdate: vi.fn((argument: { set: unknown }) => {
          calls.duplicateSets.push(argument.set);
          return Promise.resolve({ affectedRows: 1 });
        }),
      };
      return query;
    }),
    update: vi.fn(() => {
      const query: any = {
        set: vi.fn((values: unknown) => {
          calls.updateSets.push(values);
          return query;
        }),
        where: vi.fn((condition: unknown) => {
          calls.updateWheres.push(condition);
          return Promise.resolve([{ affectedRows }]);
        }),
      };
      return query;
    }),
  };

  return { db, calls };
}

function essay(overrides: Partial<Essay> = {}): Essay {
  return {
    id: 101,
    userId: 7,
    clientId: "draft_client_101",
    title: "초안 제목",
    content: "초안 본문",
    status: "draft",
    syncRevision: 3,
    aiFeedbackId: null,
    ...overrides,
  };
}

function renderCondition(condition: unknown) {
  return new MySqlDialect().sqlToQuery(condition as any);
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("syncEssayDraft", () => {
  it("명시한 글 id가 다른 사용자의 것이면 소유자 확인 뒤 거절하고 쓰지 않는다", async () => {
    const foreignEssay = essay({ userId: 8 });
    const { db } = createDb([[foreignEssay]]);
    vi.mocked(getDb).mockResolvedValue(db as any);

    await expect(
      syncEssayDraft(7, {
        id: foreignEssay.id,
        clientId: foreignEssay.clientId,
        title: "변경 제목",
        content: "변경 본문",
        baseRevision: foreignEssay.syncRevision,
      })
    ).rejects.toMatchObject({ code: "FORBIDDEN" });

    expect(db.insert).not.toHaveBeenCalled();
    expect(db.update).not.toHaveBeenCalled();
  });

  it("응답 유실 후 같은 clientId·원문 요청을 다시 보내도 새 글이나 수정본을 만들지 않는다", async () => {
    const saved = essay();
    const { db } = createDb([[saved]]);
    vi.mocked(getDb).mockResolvedValue(db as any);

    await expect(
      syncEssayDraft(7, {
        clientId: saved.clientId,
        title: saved.title,
        content: saved.content,
      })
    ).resolves.toEqual(saved);

    expect(db.insert).not.toHaveBeenCalled();
    expect(db.update).not.toHaveBeenCalled();
  });

  it("본문 변경은 현재 revision을 조건으로 제목·본문을 갱신하고 revision을 올린다", async () => {
    const current = essay();
    const persisted = essay({
      title: "새 제목",
      content: "새 본문",
      syncRevision: 4,
    });
    const { db, calls } = createDb([[current], [persisted]]);
    vi.mocked(getDb).mockResolvedValue(db as any);

    await expect(
      syncEssayDraft(7, {
        id: current.id,
        clientId: current.clientId,
        title: persisted.title,
        content: persisted.content,
        baseRevision: current.syncRevision,
      })
    ).resolves.toEqual(persisted);

    expect(db.update).toHaveBeenCalledWith(essaySubmission);
    expect(calls.updateSets[0]).toMatchObject({
      title: persisted.title,
      content: persisted.content,
      aiFeedbackId: null,
    });
    expect(
      (calls.updateSets[0] as Record<string, unknown>).syncRevision
    ).toBeDefined();

    const updateCondition = renderCondition(calls.updateWheres[0]);
    expect(updateCondition.sql).toContain(
      "`essay_submission`.`syncRevision` = ?"
    );
    expect(updateCondition.sql).toContain("`essay_submission`.`status` = ?");
    expect(updateCondition.params).toEqual([
      current.id,
      7,
      current.syncRevision,
      "draft",
    ]);
  });

  it("baseRevision이 오래되면 optimistic update 전에 conflict로 거절한다", async () => {
    const current = essay({ syncRevision: 5 });
    const { db } = createDb([[current]]);
    vi.mocked(getDb).mockResolvedValue(db as any);

    await expect(
      syncEssayDraft(7, {
        id: current.id,
        clientId: current.clientId,
        title: "다른 기기의 제목",
        content: "다른 기기의 본문",
        baseRevision: 4,
      })
    ).rejects.toMatchObject({ code: "CONFLICT" });

    expect(db.update).not.toHaveBeenCalled();
  });

  it.each(["submitted", "reviewed"] as const)(
    "%s 원문은 수정 요청을 막는다",
    async status => {
      const immutable = essay({ status });
      const { db } = createDb([[immutable]]);
      vi.mocked(getDb).mockResolvedValue(db as any);

      await expect(
        syncEssayDraft(7, {
          id: immutable.id,
          clientId: immutable.clientId,
          title: immutable.title,
          content: "보존되어야 하는 원문을 바꾸려는 내용",
          baseRevision: immutable.syncRevision,
        })
      ).rejects.toMatchObject({ code: "CONFLICT" });

      expect(db.update).not.toHaveBeenCalled();
    }
  );

  it("새 글 동기화 중 다른 사용자의 동일 clientId를 발견하면 insert나 overwrite 없이 거절한다", async () => {
    const foreignClientId = essay({ userId: 8, clientId: "shared_client_id" });
    const { db } = createDb([[foreignClientId]]);
    vi.mocked(getDb).mockResolvedValue(db as any);

    await expect(
      syncEssayDraft(7, {
        clientId: foreignClientId.clientId,
        title: "내 새 글",
        content: "내 새 본문",
      })
    ).rejects.toMatchObject({ code: "FORBIDDEN" });

    expect(db.insert).not.toHaveBeenCalled();
    expect(db.update).not.toHaveBeenCalled();
  });
});

describe("database availability", () => {
  it("연결된 DB가 없으면 모든 workspace 작업을 SERVICE_UNAVAILABLE로 실패시킨다", async () => {
    vi.mocked(getDb).mockResolvedValue(null as any);

    await expect(
      syncEssayDraft(7, {
        clientId: "offline_client_7",
        title: "오프라인 초안",
        content: "기기에 보관된 본문",
      })
    ).rejects.toMatchObject({ code: "SERVICE_UNAVAILABLE" });
    await expect(getEssayWorkspace(7)).rejects.toMatchObject({
      code: "SERVICE_UNAVAILABLE",
    });
    await expect(requestEssayTeacherFeedback(7, 101)).rejects.toMatchObject({
      code: "SERVICE_UNAVAILABLE",
    });
  });
});

describe("requestEssayTeacherFeedback", () => {
  it("승인된 담당 교사가 있으면 draft를 submitted로 전환한다", async () => {
    const draft = essay({ content: "교사에게 보낼 충분한 본문" });
    const student = { id: 7, teacherId: 22, role: "user" };
    const teacher = {
      id: 22,
      role: "teacher",
      teacherStatus: "approved",
      openId: "teacher_open_id",
    };
    const { db, calls } = createDb([[draft], [student], [teacher]]);
    vi.mocked(getDb).mockResolvedValue(db as any);

    await expect(requestEssayTeacherFeedback(7, draft.id)).resolves.toEqual({
      status: "submitted",
    });

    expect(db.update).toHaveBeenCalledWith(essaySubmission);
    expect(calls.updateSets[0]).toMatchObject({ status: "submitted" });
    expect(
      (calls.updateSets[0] as Record<string, unknown>).submittedAt
    ).toBeInstanceOf(Date);
    expect(
      (calls.updateSets[0] as Record<string, unknown>).syncRevision
    ).toBeDefined();
    expect(renderCondition(calls.updateWheres[0]).params).toEqual([
      draft.id,
      7,
      "draft",
    ]);
  });

  it.each([
    ["담당 교사가 없는 학생", { id: 7, teacherId: null, role: "user" }, []],
    [
      "AI 첨삭 봇이 배정된 학생",
      { id: 7, teacherId: 22, role: "user" },
      [
        {
          id: 22,
          role: "teacher",
          teacherStatus: "approved",
          openId: "ai_tutor_bot_system",
        },
      ],
    ],
  ])("%s은 교사 첨삭 요청을 거절한다", async (_label, student, teacherRows) => {
    const draft = essay({ content: "본문은 있으나 인간 담당 교사가 없다" });
    const { db } = createDb([[draft], [student], teacherRows]);
    vi.mocked(getDb).mockResolvedValue(db as any);

    await expect(
      requestEssayTeacherFeedback(7, draft.id)
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect(db.update).not.toHaveBeenCalled();
  });

  it("이미 submitted인 글을 재요청하면 담당 교사를 다시 조회하거나 다시 수정하지 않고 현재 상태를 돌려준다", async () => {
    const submitted = essay({ status: "submitted" });
    const { db } = createDb([[submitted]]);
    vi.mocked(getDb).mockResolvedValue(db as any);

    await expect(requestEssayTeacherFeedback(7, submitted.id)).resolves.toEqual(
      { status: "submitted" }
    );
    expect(db.select).toHaveBeenCalledTimes(1);
    expect(db.update).not.toHaveBeenCalled();
  });
});

describe("getEssayWorkspace", () => {
  it("요청한 사용자 id로만 essay·교사·AI 피드백 join을 조회하고 workspace 형태로 돌려준다", async () => {
    const owned = essay();
    const teacher = {
      id: 301,
      essayId: owned.id,
      teacherId: 22,
      overallComment: "구조가 좋습니다.",
    };
    const ai = {
      id: 401,
      userId: 7,
      essayTitle: owned.title,
      essayContent: owned.content,
      overallComment: "AI 의견",
    };
    const { db, calls } = createDb([[{ essay: owned, teacher, ai }]]);
    vi.mocked(getDb).mockResolvedValue(db as any);

    // AI 첨삭에는 기본 점검(대체) 결과 여부(fallbackUsed)가 함께 붙는다. 평가 기록이 없으면 false이다.
    await expect(getEssayWorkspace(7)).resolves.toEqual([
      { ...owned, teacherFeedback: teacher, aiFeedback: { ...ai, fallbackUsed: false } },
    ]);

    expect(calls.leftJoin).toHaveLength(3);
    // 요청한 사용자의 글만, 휴지통에 옮기지 않은 글만 조회한다.
    const condition = renderCondition(calls.where[0]);
    expect(condition.sql).toContain("`essay_submission`.`userId` = ?");
    expect(condition.sql).toContain("`essay_submission`.`deletedAt` is null");
    expect(condition.params).toEqual([7]);
  });
});
