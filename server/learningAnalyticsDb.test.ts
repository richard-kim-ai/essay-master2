import { beforeEach, describe, expect, it, vi } from "vitest";

// select는 미리 넣어 둔 결과를 차례로 돌려주는 가짜 DB.
const fake = vi.hoisted(() => ({ queue: [] as any[][], calls: 0 }));
vi.mock("./db", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./db")>();
  const chain: any = new Proxy(
    {},
    {
      get(_target, property) {
        if (property === "then") {
          return (resolve: (value: unknown) => void) => {
            fake.calls += 1;
            resolve(fake.queue.shift() ?? []);
          };
        }
        return () => chain;
      },
    }
  );
  return { ...actual, getDb: vi.fn(async () => ({ select: () => chain })) };
});

import { appRouter } from "./routers";
import { getLearningAnalytics } from "./learningAnalyticsDb";

const recent = (daysAgo: number) => new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000);

beforeEach(() => {
  fake.queue = [];
  fake.calls = 0;
});

describe("getLearningAnalytics(실제 기록 집계)", () => {
  it("기록이 하나도 없으면 영역은 모두 측정 전(null), 성장은 8주 빈 값이다", async () => {
    // AI 첨삭, 글 목록, 학습 도구는 동시에 조회하고 (글이 없으니 교사 첨삭은 조회하지 않음)
    fake.queue = [[], [], []];
    const result = await getLearningAnalytics(7, "middle_high");
    expect(result.skills.every((skill) => skill.value === null)).toBe(true);
    expect(result.weekly).toHaveLength(8);
    expect(result.totals.aiFeedbackCount).toBe(0);
    expect(fake.calls).toBe(3);
  });

  it("AI 첨삭·교사 첨삭·학습 도구 기록을 합쳐 영역 점수와 주별 점수를 계산한다", async () => {
    fake.queue = [
      [{ createdAt: recent(0), overallScore: 70, structureScore: 60, logicScore: 70, expressionScore: 80 }], // AI
      [{ id: 11 }], // 내 글
      [{ createdAt: recent(0), toolType: "quiz", score: 100 }, { createdAt: recent(0), toolType: "summary", score: 40 }], // 학습 도구(AI·글·도구 순으로 동시 조회한 뒤 교사 첨삭)
      [{ createdAt: recent(0), overallScore: 90, structureScore: 80, logicScore: 90, expressionScore: 100 }], // 교사
    ];
    const result = await getLearningAnalytics(7);
    const value = (key: string) => result.skills.find((skill) => skill.key === key)?.value;
    expect(value("structure")).toBe(70);
    expect(value("logic")).toBe(80);
    expect(value("expression")).toBe(90);
    expect(value("quiz")).toBe(100);
    expect(value("summary")).toBe(40);
    expect(value("reordering")).toBeNull();
    expect(result.totals).toMatchObject({ aiFeedbackCount: 1, teacherFeedbackCount: 1, toolAttemptCount: 2, latestAiScore: 70 });
    const thisWeek = result.weekly[result.weekly.length - 1];
    expect(thisWeek).toMatchObject({ essayScore: 80, toolScore: 70 });
  });
});

describe("progress.analytics API", () => {
  it("비로그인은 쓸 수 없고, 로그인한 사용자는 자기 기록 분석을 받는다", async () => {
    await expect(appRouter.createCaller({ user: null, req: { headers: {} }, res: {} } as any).progress.analytics()).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    fake.queue = [[], [], []];
    const result = await appRouter.createCaller({ user: { id: 7, role: "user", tag: "중고등" }, req: { headers: {} }, res: {} } as any).progress.analytics();
    expect(result.weekly).toHaveLength(8);
  });
});

describe("getWeeklyStudySummary(마이페이지 허브)", () => {
  it("워크북 답안·학습 도구 시도·레벨 완료 기록으로 이번 주 요약을 만들고 학습 시간은 만들지 않는다", async () => {
    const { getWeeklyStudySummary } = await import("./learningAnalyticsDb");
    fake.queue = [
      [{ createdAt: recent(1), isCorrect: 1 }, { createdAt: recent(2), isCorrect: 0 }, { createdAt: recent(9), isCorrect: 1 }], // 워크북 답안
      [{ createdAt: recent(1) }], // 학습 도구(AI·글·도구 순으로 동시 조회한 뒤 교사 첨삭)
      [{ completedAt: recent(2) }], // 레벨 완료
    ];
    const result = await getWeeklyStudySummary(7, "middle_high");
    expect(result).toMatchObject({ solvedThisWeek: 3, solvedLastWeek: 1, solvedDiff: 2, accuracyRate: 50, accuracyDiffPercent: -50, completedModules: 1 });
    expect(result).not.toHaveProperty("studyTimeString");
    expect(result).not.toHaveProperty("timeDiffMinutes");
  });
});
