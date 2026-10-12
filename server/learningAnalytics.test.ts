import { describe, expect, it } from "vitest";
import {
  buildLearningAnalytics,
  buildRecommendations,
  STALE_AI_DAYS,
  WEEKLY_WINDOW,
  type AiScoreRow,
  type LevelProgress,
  type ToolAttemptRow,
} from "../shared/learningAnalytics";

// 2026-10-14(수) 12:00 KST 기준. 그 주 월요일은 10/12.
const NOW = new Date("2026-10-14T03:00:00Z");
const day = (daysAgo: number) => new Date(NOW.getTime() - daysAgo * 24 * 60 * 60 * 1000);

const ai = (daysAgo: number, scores: Partial<AiScoreRow> = {}): AiScoreRow => ({
  createdAt: day(daysAgo),
  overallScore: 80,
  structureScore: 80,
  logicScore: 80,
  expressionScore: 80,
  ...scores,
});
const tool = (daysAgo: number, toolType: ToolAttemptRow["toolType"], score: number): ToolAttemptRow => ({ createdAt: day(daysAgo), toolType, score });
const build = (input: Partial<Parameters<typeof buildLearningAnalytics>[0]> = {}) => buildLearningAnalytics({ ai: [], teacher: [], tools: [], now: NOW, ...input });

describe("능력 분석(buildLearningAnalytics.skills)", () => {
  it("기록이 없으면 모든 영역이 null(측정 전)이고 값을 지어내지 않는다", () => {
    const { skills, totals } = build();
    expect(skills.map((skill) => skill.key)).toEqual(["structure", "logic", "expression", "quiz", "reordering", "summary"]);
    expect(skills.every((skill) => skill.value === null && skill.samples === 0)).toBe(true);
    expect(totals).toMatchObject({ aiFeedbackCount: 0, toolAttemptCount: 0, lastAiFeedbackAt: null, latestAiScore: null, latestAiScoreChange: null });
  });

  it("구조·논리·표현은 AI와 교사 첨삭 점수의 평균, 문장 교정·단락 재구성·요약은 학습 도구 점수의 평균이다", () => {
    const { skills } = build({
      ai: [ai(1, { structureScore: 60, logicScore: 70, expressionScore: 90 })],
      teacher: [ai(2, { structureScore: 80, logicScore: 90, expressionScore: 70 })],
      tools: [tool(1, "quiz", 100), tool(2, "quiz", 50), tool(3, "reordering", 40), tool(4, "summary", 90)],
    });
    const byKey = Object.fromEntries(skills.map((skill) => [skill.key, skill]));
    expect(byKey.structure).toMatchObject({ value: 70, samples: 2 });
    expect(byKey.logic).toMatchObject({ value: 80, samples: 2 });
    expect(byKey.expression).toMatchObject({ value: 80, samples: 2 });
    expect(byKey.quiz).toMatchObject({ value: 75, samples: 2 });
    expect(byKey.reordering).toMatchObject({ value: 40, samples: 1 });
    expect(byKey.summary).toMatchObject({ value: 90, samples: 1 });
  });

  it("점수가 비어 있는 기록(null)은 평균에서 빼고, 영역마다 최근 20회만 쓴다", () => {
    const rows = [ai(0, { structureScore: null }), ...Array.from({ length: 25 }, (_, index) => ai(index + 1, { structureScore: index < 20 ? 100 : 0 }))];
    const structure = build({ ai: rows }).skills[0];
    expect(structure.samples).toBe(20);
    expect(structure.value).toBe(100);
  });
});

describe("성장 추이(buildLearningAnalytics.weekly)", () => {
  it("최근 8주를 오래된 주부터 만들고, 한국 시간 월요일을 주 시작으로 한다", () => {
    const { weekly } = build();
    expect(weekly).toHaveLength(WEEKLY_WINDOW);
    expect(weekly[WEEKLY_WINDOW - 1].weekStart).toBe("2026-10-12");
    expect(weekly[WEEKLY_WINDOW - 2].weekStart).toBe("2026-10-05");
    expect(weekly[0].weekStart).toBe("2026-08-24");
    expect(weekly.every((point) => point.essayScore === null && point.toolScore === null)).toBe(true);
  });

  it("주별 첨삭 종합 점수 평균과 학습 도구 점수 평균을 따로 계산하고, 기록 없는 주는 null로 남긴다", () => {
    const { weekly } = build({
      ai: [ai(1, { overallScore: 70 }), ai(2, { overallScore: 90 }), ai(9, { overallScore: 60 })],
      teacher: [ai(2, { overallScore: 80 })],
      // 이번 주(월 10/12~)는 0~2일 전, 지난 주는 8일 전(10/6 화)이다. 3일 전·10일 전은 일요일이라 전주에 속한다.
      tools: [tool(1, "quiz", 100), tool(2, "summary", 50), tool(8, "reordering", 30)],
    });
    const thisWeek = weekly[WEEKLY_WINDOW - 1];
    expect(thisWeek).toMatchObject({ essayScore: 80, essayCount: 3, toolScore: 75, toolCount: 2 });
    const lastWeek = weekly[WEEKLY_WINDOW - 2];
    expect(lastWeek).toMatchObject({ essayScore: 60, essayCount: 1, toolScore: 30, toolCount: 1 });
    expect(weekly[WEEKLY_WINDOW - 3]).toMatchObject({ essayScore: null, essayCount: 0, toolScore: null, toolCount: 0 });
  });

  it("8주보다 오래된 기록은 추이에 넣지 않는다", () => {
    const { weekly } = build({ ai: [ai(100, { overallScore: 99 })] });
    expect(weekly.every((point) => point.essayScore === null)).toBe(true);
  });
});

describe("AI 첨삭 요약(totals)", () => {
  it("횟수·마지막 시각·최근 두 번의 점수 변화를 알려 준다", () => {
    const { totals } = build({ ai: [ai(10, { overallScore: 60 }), ai(3, { overallScore: 75 }), ai(1, { overallScore: 72 })] });
    expect(totals).toMatchObject({ aiFeedbackCount: 3, latestAiScore: 72, latestAiScoreChange: -3 });
    expect(totals.lastAiFeedbackAt).toBe(day(1).toISOString());
  });
});

const levels = (statuses: Array<LevelProgress["status"]>, scores: Array<number | null> = []): LevelProgress[] =>
  statuses.map((status, index) => ({ level: index + 1, title: `레벨 ${index + 1} 제목`, status, score: scores[index] ?? null }));
const recommend = (analytics: ReturnType<typeof build>, levelRows: LevelProgress[]) => buildRecommendations({ analytics, courseType: "middle_high", levels: levelRows, now: NOW });

describe("추천 학습(buildRecommendations)", () => {
  it("기록이 하나도 없으면 시작 안내 하나만 보여 주고 점수가 있는 것처럼 말하지 않는다", () => {
    const result = recommend(build(), levels(["not_started", "not_started"]));
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ id: "start", href: "/workbook/middle_high/1" });
    expect(result[0].text).not.toMatch(/\d+점/);
  });

  it("가장 낮은 측정 영역을 실제 평균 점수와 함께 추천하고 알맞은 학습 도구로 연결한다", () => {
    const analytics = build({ tools: [tool(1, "quiz", 90), tool(2, "summary", 55), tool(3, "summary", 65)] });
    const first = recommend(analytics, levels(["complete", "not_started"]))[0];
    expect(first).toMatchObject({ id: "skill-summary", tone: "focus", href: "/summary-practice" });
    expect(first.text).toContain("최근 2회 평균 60점");
  });

  it("측정된 모든 영역이 80점 이상이면 약점을 지어내지 않고 안정적이라고 알린다", () => {
    const analytics = build({ tools: [tool(1, "quiz", 95), tool(2, "reordering", 85)] });
    const first = recommend(analytics, levels(["complete", "not_started"]))[0];
    expect(first.id).toBe("skills-strong");
    expect(first.text).toContain("문장 교정 95점");
    expect(first.text).toContain("단락 재구성 85점");
  });

  it("다음 레벨은 완료하지 않은 첫 레벨이고, 진행 중이면 '이어서'로, 완료 수와 현재 점수를 실제 값으로 말한다", () => {
    const analytics = build({ tools: [tool(1, "quiz", 90)] });
    const result = recommend(analytics, levels(["complete", "in_progress", "not_started"], [90, 64, null]));
    const level = result.find((item) => item.id === "level-2");
    expect(level).toMatchObject({ title: "Level 2 이어서 학습하기", href: "/workbook/middle_high/2" });
    expect(level?.text).toContain("3개 레벨 중 1개를 완료");
    expect(level?.text).toContain("64점");
    // 과거처럼 고정된 'Level 2를 완료했습니다' 문구가 아니다.
    expect(result.some((item) => item.text.includes("Level 3에 도전"))).toBe(false);
  });

  it("모든 레벨을 마치면 수료증을 안내한다", () => {
    const result = recommend(build({ tools: [tool(1, "quiz", 90)] }), levels(["complete", "complete"]));
    expect(result.find((item) => item.id === "course-complete")).toMatchObject({ href: "/certificate" });
  });

  it("AI 첨삭: 받은 적 없으면 첫 첨삭을, 오래됐으면 경과 일수를, 최근이면 점수 변화를 알려 준다", () => {
    const base = levels(["complete", "not_started"]);
    expect(recommend(build({ tools: [tool(1, "quiz", 90)] }), base).find((item) => item.id === "ai-first")).toBeTruthy();

    const stale = recommend(build({ ai: [ai(STALE_AI_DAYS + 3)] }), base).find((item) => item.id === "ai-stale");
    expect(stale?.text).toContain(`${STALE_AI_DAYS + 3}일 전`);

    const rising = recommend(build({ ai: [ai(5, { overallScore: 60 }), ai(1, { overallScore: 78 })] }), base).find((item) => item.id === "ai-trend");
    expect(rising).toMatchObject({ tone: "done", title: "최근 AI 첨삭 점수가 18점 올랐습니다", href: "/my-writings" });
    const falling = recommend(build({ ai: [ai(5, { overallScore: 80 }), ai(1, { overallScore: 70 })] }), base).find((item) => item.id === "ai-trend");
    expect(falling).toMatchObject({ tone: "focus", title: "최근 AI 첨삭 점수가 10점 내려갔습니다" });
  });

  it("추천은 최대 4개이다", () => {
    const analytics = build({ ai: [ai(5, { overallScore: 60 }), ai(1, { overallScore: 70 })], tools: [tool(1, "quiz", 50)] });
    expect(recommend(analytics, levels(["complete", "in_progress"])).length).toBeLessThanOrEqual(4);
  });
});

import { buildWeeklySummary } from "../shared/learningAnalytics";

describe("이번 주 학습 요약(buildWeeklySummary)", () => {
  const answer = (daysAgo: number, isCorrect: number) => ({ createdAt: day(daysAgo), isCorrect });
  const summary = (input: Partial<Parameters<typeof buildWeeklySummary>[0]> = {}) => buildWeeklySummary({ answers: [], tools: [], completions: [], now: NOW, ...input });

  it("기록이 없으면 0과 null이고, 학습 시간이나 증감을 지어내지 않는다", () => {
    expect(summary()).toEqual({ solvedThisWeek: 0, solvedLastWeek: 0, solvedDiff: 0, accuracyRate: null, accuracyDiffPercent: null, completedModules: 0, activeDays: 0 });
  });

  it("최근 7일 푼 문항(워크북 + 학습 도구)과 지난 7일 대비 증감, 정답률 증감을 실제 기록으로 계산한다", () => {
    const result = summary({
      answers: [answer(1, 1), answer(2, 1), answer(3, 0), answer(4, 1), answer(8, 1), answer(9, 0), answer(10, 0), answer(20, 1)],
      tools: [{ createdAt: day(1) }, { createdAt: day(12) }],
      completions: [{ completedAt: day(2) }, { completedAt: day(9) }, { completedAt: null }],
    });
    expect(result.solvedThisWeek).toBe(5); // 워크북 4 + 도구 1
    expect(result.solvedLastWeek).toBe(4); // 워크북 3 + 도구 1
    expect(result.solvedDiff).toBe(1);
    expect(result.accuracyRate).toBe(75); // 3/4
    expect(result.accuracyDiffPercent).toBe(42); // 75% - 33%
    expect(result.completedModules).toBe(1);
  });

  it("지난주 풀이가 없으면 정답률 증감은 null(비교하지 않음)이고, 활동일은 한국 시간 날짜로 센다", () => {
    const result = summary({ answers: [answer(0.1, 1), answer(0.2, 1), answer(2, 0)] });
    expect(result.accuracyDiffPercent).toBeNull();
    expect(result.activeDays).toBe(2);
  });
});
