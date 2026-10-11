// 학습 대시보드의 성장·능력 분석과 추천 학습을 실제 학습 기록에서 계산한다(고정 값·임의 값 없음).
// 서버(집계)와 화면(추천 문구)이 같은 규칙을 쓰도록 shared에 둔다.

export type DateLike = Date | string | number;

export interface AiScoreRow {
  createdAt: DateLike;
  overallScore: number | null;
  structureScore: number | null;
  logicScore: number | null;
  expressionScore: number | null;
}

export type TeacherScoreRow = AiScoreRow;

export type ToolType = "quiz" | "reordering" | "summary";

export interface ToolAttemptRow {
  createdAt: DateLike;
  toolType: ToolType;
  /** 0~100 */
  score: number;
}

export interface AnalyticsInput {
  ai: AiScoreRow[];
  teacher: TeacherScoreRow[];
  tools: ToolAttemptRow[];
  now?: DateLike;
}

export type SkillKey = "structure" | "logic" | "expression" | "quiz" | "reordering" | "summary";

export interface SkillScore {
  key: SkillKey;
  label: string;
  /** 최근 기록의 평균(0~100). 기록이 없으면 null — 값을 지어내지 않는다. */
  value: number | null;
  /** 평균에 쓴 기록 수 */
  samples: number;
  /** 어떤 기록에서 나온 점수인지 */
  source: string;
}

export interface WeeklyPoint {
  /** 그 주 월요일(한국 시간) YYYY-MM-DD */
  weekStart: string;
  label: string;
  /** AI·교사 첨삭 종합 점수 평균 */
  essayScore: number | null;
  essayCount: number;
  /** 학습 도구(퀴즈·단락 재구성·요약) 점수 평균 */
  toolScore: number | null;
  toolCount: number;
}

export interface LearningAnalytics {
  skills: SkillScore[];
  weekly: WeeklyPoint[];
  totals: {
    aiFeedbackCount: number;
    teacherFeedbackCount: number;
    toolAttemptCount: number;
    lastAiFeedbackAt: string | null;
    /** 최근 두 번의 AI 첨삭 종합 점수 변화(없으면 null) */
    latestAiScoreChange: number | null;
    latestAiScore: number | null;
  };
}

/** 각 영역 점수는 최근 이 개수의 기록으로 평균을 낸다("최근 실력"). */
export const SKILL_RECENT_LIMIT = 20;
export const WEEKLY_WINDOW = 8;

const KST_OFFSET_MS = 9 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

export const SKILL_LABELS: Record<SkillKey, string> = {
  structure: "구조력",
  logic: "논리력",
  expression: "표현력",
  quiz: "문장 교정",
  reordering: "단락 재구성",
  summary: "요약",
};

const toTime = (value: DateLike) => (value instanceof Date ? value.getTime() : new Date(value).getTime());
const isScore = (value: unknown): value is number => typeof value === "number" && Number.isFinite(value);
const average = (values: number[]) => (values.length ? Math.round(values.reduce((sum, value) => sum + value, 0) / values.length) : null);

function recent<T extends { createdAt: DateLike }>(rows: T[]) {
  return [...rows].filter((row) => Number.isFinite(toTime(row.createdAt))).sort((a, b) => toTime(b.createdAt) - toTime(a.createdAt));
}

/** 한국 시간 기준 그 주 월요일 0시의 UTC 시각(ms) */
function weekStartMs(time: number) {
  const kst = time + KST_OFFSET_MS;
  const dayStart = Math.floor(kst / DAY_MS) * DAY_MS;
  const weekday = new Date(dayStart).getUTCDay(); // 0=일
  const sinceMonday = (weekday + 6) % 7;
  return dayStart - sinceMonday * DAY_MS - KST_OFFSET_MS;
}

function formatWeek(startMs: number) {
  const kst = new Date(startMs + KST_OFFSET_MS);
  const month = kst.getUTCMonth() + 1;
  const day = kst.getUTCDate();
  const iso = `${kst.getUTCFullYear()}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  return { iso, label: `${month}/${day}` };
}

export function buildLearningAnalytics(input: AnalyticsInput): LearningAnalytics {
  const now = input.now === undefined ? Date.now() : toTime(input.now);
  const ai = recent(input.ai);
  const teacher = recent(input.teacher);
  const tools = recent(input.tools).filter((row) => isScore(row.score));
  const essayScoreRows = [...ai, ...teacher];

  const essaySkill = (key: "structure" | "logic" | "expression", pick: (row: AiScoreRow) => number | null): SkillScore => {
    const values = recent(essayScoreRows)
      .map(pick)
      .filter(isScore)
      .slice(0, SKILL_RECENT_LIMIT);
    return { key, label: SKILL_LABELS[key], value: average(values), samples: values.length, source: "AI·교사 첨삭 점수" };
  };
  const toolSkill = (key: ToolType): SkillScore => {
    const values = tools.filter((row) => row.toolType === key).slice(0, SKILL_RECENT_LIMIT).map((row) => row.score);
    return { key, label: SKILL_LABELS[key], value: average(values), samples: values.length, source: "학습 도구 결과" };
  };
  const skills: SkillScore[] = [
    essaySkill("structure", (row) => row.structureScore),
    essaySkill("logic", (row) => row.logicScore),
    essaySkill("expression", (row) => row.expressionScore),
    toolSkill("quiz"),
    toolSkill("reordering"),
    toolSkill("summary"),
  ];

  // 최근 WEEKLY_WINDOW주(이번 주 포함)를 오래된 주부터 만든다.
  const currentWeek = weekStartMs(now);
  const weekly: WeeklyPoint[] = [];
  for (let offset = WEEKLY_WINDOW - 1; offset >= 0; offset -= 1) {
    const start = currentWeek - offset * 7 * DAY_MS;
    const end = start + 7 * DAY_MS;
    const inWeek = (row: { createdAt: DateLike }) => {
      const time = toTime(row.createdAt);
      return time >= start && time < end;
    };
    const essayValues = essayScoreRows.filter(inWeek).map((row) => row.overallScore).filter(isScore);
    const toolValues = tools.filter(inWeek).map((row) => row.score);
    const { iso, label } = formatWeek(start);
    weekly.push({ weekStart: iso, label, essayScore: average(essayValues), essayCount: essayValues.length, toolScore: average(toolValues), toolCount: toolValues.length });
  }

  const aiWithScore = ai.filter((row) => isScore(row.overallScore));
  const latest = aiWithScore[0];
  const previous = aiWithScore[1];
  return {
    skills,
    weekly,
    totals: {
      aiFeedbackCount: ai.length,
      teacherFeedbackCount: teacher.length,
      toolAttemptCount: tools.length,
      lastAiFeedbackAt: ai[0] ? new Date(toTime(ai[0].createdAt)).toISOString() : null,
      latestAiScore: latest ? (latest.overallScore as number) : null,
      latestAiScoreChange: latest && previous ? (latest.overallScore as number) - (previous.overallScore as number) : null,
    },
  };
}

// ========== 추천 학습 ==========

export type LevelStatus = "complete" | "in_progress" | "not_started";

export interface LevelProgress {
  level: number;
  title: string;
  status: LevelStatus;
  score: number | null;
}

export interface Recommendation {
  id: string;
  tone: "focus" | "progress" | "action" | "done";
  title: string;
  text: string;
  href?: string;
  cta?: string;
}

export interface RecommendationInput {
  analytics: LearningAnalytics;
  courseType: string;
  levels: LevelProgress[];
  now?: DateLike;
}

/** 이 점수 미만이면 "보강이 필요한 영역"으로 본다. */
export const WEAK_SKILL_THRESHOLD = 80;
/** 마지막 AI 첨삭 뒤 이 일수가 지나면 다시 받도록 권한다. */
export const STALE_AI_DAYS = 14;

const SKILL_ADVICE: Record<SkillKey, { href: string; cta: string; tip: string }> = {
  structure: { href: "/paragraph-reordering", cta: "단락 재구성 연습", tip: "서론·본론·결론의 배치와 단락 연결을 점검하는 단락 재구성 연습이 도움이 됩니다." },
  logic: { href: "/thesis-checklist", cta: "주제문 점검", tip: "주장과 근거가 이어지는지 주제문 점검으로 확인해 보세요." },
  expression: { href: "/quiz", cta: "문장 교정 연습", tip: "중복 표현과 호응을 고치는 문장 교정 연습으로 표현을 다듬어 보세요." },
  quiz: { href: "/quiz", cta: "문장 교정 연습", tip: "틀린 문제는 해설을 읽고 같은 유형을 다시 풀어 보세요." },
  reordering: { href: "/paragraph-reordering", cta: "단락 재구성 연습", tip: "문장 사이 접속어와 지시어를 단서로 순서를 다시 맞춰 보세요." },
  summary: { href: "/summary-practice", cta: "요약 연습", tip: "핵심 문장을 먼저 고른 뒤 줄여 쓰는 순서로 연습해 보세요." },
};

export function buildRecommendations(input: RecommendationInput): Recommendation[] {
  const now = input.now === undefined ? Date.now() : toTime(input.now);
  const { analytics, levels } = input;
  const recommendations: Recommendation[] = [];

  // 1) 가장 낮은 측정 영역
  const measured = analytics.skills.filter((skill) => skill.value !== null);
  if (measured.length > 0) {
    const weakest = [...measured].sort((a, b) => (a.value as number) - (b.value as number))[0];
    if ((weakest.value as number) < WEAK_SKILL_THRESHOLD) {
      const advice = SKILL_ADVICE[weakest.key];
      recommendations.push({
        id: `skill-${weakest.key}`,
        tone: "focus",
        title: `${weakest.label} 영역 보강`,
        text: `최근 ${weakest.samples}회 평균 ${weakest.value}점으로 측정된 영역 중 가장 낮습니다. ${advice.tip}`,
        href: advice.href,
        cta: advice.cta,
      });
    } else {
      recommendations.push({
        id: "skills-strong",
        tone: "done",
        title: "측정된 모든 영역이 안정적입니다",
        text: `${measured.map((skill) => `${skill.label} ${skill.value}점`).join(", ")} — 모두 ${WEAK_SKILL_THRESHOLD}점 이상입니다. 다음 레벨에 도전해 보세요.`,
      });
    }
  }

  // 2) 다음으로 할 레벨
  const next = levels.find((level) => level.status !== "complete");
  if (levels.length > 0 && !next) {
    recommendations.push({ id: "course-complete", tone: "done", title: "과정의 모든 레벨을 완료했습니다", text: `${levels.length}개 레벨을 모두 마쳤습니다. 수료증을 확인해 보세요.`, href: "/certificate", cta: "수료증 보기" });
  } else if (next) {
    const completed = levels.filter((level) => level.status === "complete").length;
    const resume = next.status === "in_progress";
    recommendations.push({
      id: `level-${next.level}`,
      tone: "progress",
      title: resume ? `Level ${next.level} 이어서 학습하기` : `Level ${next.level} 시작하기`,
      text: `${next.title} — ${levels.length}개 레벨 중 ${completed}개를 완료했습니다.${resume && next.score ? ` 이 레벨의 현재 최고 점수는 ${next.score}점입니다.` : ""}`,
      href: `/workbook/${input.courseType}/${next.level}`,
      cta: resume ? "이어서 학습" : "학습 시작",
    });
  }

  // 3) AI 첨삭: 아직 없음 / 오래됨 / 점수 변화
  const { totals } = analytics;
  if (totals.aiFeedbackCount === 0) {
    recommendations.push({ id: "ai-first", tone: "action", title: "첫 AI 첨삭 받아 보기", text: "아직 받은 AI 첨삭이 없습니다. 글을 한 편 쓰고 첨삭을 받으면 구조·논리·표현 점수가 이 화면에 쌓입니다.", href: "/ai-auto-feedback", cta: "AI 첨삭 받기" });
  } else {
    const days = totals.lastAiFeedbackAt ? Math.floor((now - toTime(totals.lastAiFeedbackAt)) / DAY_MS) : null;
    if (days !== null && days >= STALE_AI_DAYS) {
      recommendations.push({ id: "ai-stale", tone: "action", title: "AI 첨삭을 다시 받아 보세요", text: `마지막 AI 첨삭이 ${days}일 전입니다. 새 글로 첨삭을 받아 최근 실력을 확인해 보세요.`, href: "/ai-auto-feedback", cta: "AI 첨삭 받기" });
    } else if (totals.latestAiScoreChange !== null && totals.latestAiScore !== null) {
      const change = totals.latestAiScoreChange;
      recommendations.push({
        id: "ai-trend",
        tone: change >= 0 ? "done" : "focus",
        title: change > 0 ? `최근 AI 첨삭 점수가 ${change}점 올랐습니다` : change < 0 ? `최근 AI 첨삭 점수가 ${Math.abs(change)}점 내려갔습니다` : "최근 AI 첨삭 점수가 같습니다",
        text: `가장 최근 종합 점수는 ${totals.latestAiScore}점입니다. 수정본과 원문을 비교해 고친 부분을 확인해 보세요.`,
        href: "/my-writings",
        cta: "내 글·첨삭 기록",
      });
    }
  }

  // 4) 기록이 하나도 없으면 시작 안내만
  const hasAnyRecord = measured.length > 0 || totals.aiFeedbackCount > 0 || totals.toolAttemptCount > 0 || levels.some((level) => level.status !== "not_started");
  if (!hasAnyRecord) {
    return [
      {
        id: "start",
        tone: "progress",
        title: "학습 기록이 아직 없습니다",
        text: "레슨을 시작하고 학습 도구를 풀어 보세요. 기록이 쌓이면 이곳에 실제 점수에 맞는 추천이 나타납니다.",
        href: levels[0] ? `/workbook/${input.courseType}/${levels[0].level}` : "/curriculum",
        cta: levels[0] ? `Level ${levels[0].level} 시작` : "커리큘럼 보기",
      },
    ];
  }
  return recommendations.slice(0, 4);
}

// ========== 이번 주 학습 요약(마이페이지 허브) ==========

export interface WeeklySummaryInput {
  /** 워크북 답안(최근 14일 이상) */
  answers: Array<{ createdAt: DateLike; isCorrect: number | boolean | null }>;
  /** 학습 도구 시도(최근 14일 이상) */
  tools: Array<{ createdAt: DateLike }>;
  /** 레벨을 완료한 시각 */
  completions: Array<{ completedAt: DateLike | null }>;
  now?: DateLike;
}

export interface WeeklySummary {
  /** 최근 7일에 푼 문항 수(워크북 답안 + 학습 도구 시도) */
  solvedThisWeek: number;
  solvedLastWeek: number;
  /** 지난 7일 대비 증감 */
  solvedDiff: number;
  /** 최근 7일 워크북 정답률(풀이가 없으면 null) */
  accuracyRate: number | null;
  /** 그 전 7일 대비 정답률 증감(%p). 비교할 기록이 한쪽이라도 없으면 null */
  accuracyDiffPercent: number | null;
  /** 최근 7일에 완료한 레벨 수 */
  completedModules: number;
  /** 최근 7일 중 학습 기록이 있는 날 수(한국 시간 기준) */
  activeDays: number;
}

export function buildWeeklySummary(input: WeeklySummaryInput): WeeklySummary {
  const now = input.now === undefined ? Date.now() : toTime(input.now);
  const thisStart = now - 7 * DAY_MS;
  const lastStart = now - 14 * DAY_MS;
  const inThis = (value: DateLike) => {
    const time = toTime(value);
    return time > thisStart && time <= now;
  };
  const inLast = (value: DateLike) => {
    const time = toTime(value);
    return time > lastStart && time <= thisStart;
  };
  const rate = (rows: Array<{ isCorrect: number | boolean | null }>) => (rows.length ? Math.round((rows.filter((row) => Number(row.isCorrect) === 1 || row.isCorrect === true).length / rows.length) * 100) : null);

  const answersThis = input.answers.filter((row) => inThis(row.createdAt));
  const answersLast = input.answers.filter((row) => inLast(row.createdAt));
  const toolsThis = input.tools.filter((row) => inThis(row.createdAt));
  const toolsLast = input.tools.filter((row) => inLast(row.createdAt));
  const solvedThisWeek = answersThis.length + toolsThis.length;
  const solvedLastWeek = answersLast.length + toolsLast.length;
  const accuracyThis = rate(answersThis);
  const accuracyLast = rate(answersLast);

  const days = new Set<string>();
  for (const row of [...answersThis, ...toolsThis]) days.add(new Date(toTime(row.createdAt) + KST_OFFSET_MS).toISOString().slice(0, 10));

  return {
    solvedThisWeek,
    solvedLastWeek,
    solvedDiff: solvedThisWeek - solvedLastWeek,
    accuracyRate: accuracyThis,
    accuracyDiffPercent: accuracyThis !== null && accuracyLast !== null ? accuracyThis - accuracyLast : null,
    completedModules: input.completions.filter((row) => row.completedAt !== null && inThis(row.completedAt)).length,
    activeDays: days.size,
  };
}
