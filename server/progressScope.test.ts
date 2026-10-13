import { beforeEach, afterEach, describe, it, expect, vi } from "vitest";
let db: typeof import("./db");
let saved: string | undefined;
beforeEach(async () => {
  saved = process.env.DATABASE_URL;
  process.env.DATABASE_URL = "";
  vi.resetModules();
  db = await import("./db");
});
afterEach(() => {
  if (saved === undefined) delete process.env.DATABASE_URL;
  else process.env.DATABASE_URL = saved;
});
describe("진도 과정·교재 출처 스냅샷", () => {
  it("같은 curriculumId도 다른 과정과 정적/동적 출처로 각각 보관한다", async () => {
    await db.upsertProgress({
      userId: 900,
      curriculumId: 1,
      courseType: "elementary",
      curriculumSource: "static",
      level: 1,
      completed: 1,
      score: 80,
    });
    await db.upsertProgress({
      userId: 900,
      curriculumId: 1,
      courseType: "high_univ",
      curriculumSource: "dynamic",
      level: 1,
      completed: 0,
      score: 40,
    });
    await db.upsertProgress({
      userId: 900,
      curriculumId: 1,
      courseType: "elementary",
      curriculumSource: "dynamic",
      level: 2,
      completed: 0,
      score: 20,
    });
    const all = await db.getProgressByUser(900);
    expect(all).toHaveLength(3);
    expect(await db.getProgressByUser(900, "high_univ")).toEqual([
      expect.objectContaining({
        courseType: "high_univ",
        score: 40,
        curriculumSource: "dynamic",
      }),
    ]);
    expect(await db.getProgressByUser(901, "high_univ")).toEqual([]);
  });
  it("기존 출처 미확인 기록을 삭제하거나 현재 가입 과정으로 추정하지 않는다", async () => {
    await db.upsertProgress({
      userId: 900,
      curriculumId: 3,
      completed: 1,
      score: 90,
    });
    expect(await db.getProgressByUser(900)).toEqual([
      expect.objectContaining({ courseType: null, curriculumSource: null }),
    ]);
    expect(await db.getProgressByUser(900, "high_univ")).toEqual([]);
  });
  it("동일 원천 기록은 갱신하고 더 낮은 재요청으로 완료·최고점수를 되돌리지 않는다", async () => {
    const key = {
      userId: 900,
      curriculumId: 1,
      courseType: "middle_high" as const,
      curriculumSource: "dynamic" as const,
      level: 1,
    };
    const completedAt = new Date("2026-10-10T00:00:00Z");
    await db.upsertProgress({ ...key, completed: 1, score: 80, completedAt });
    await db.upsertProgress({ ...key, completed: 0, score: 20 });
    expect(await db.getProgressByUser(900, "middle_high")).toEqual([
      expect.objectContaining({ completed: 1, score: 80, completedAt }),
    ]);
  });
});
