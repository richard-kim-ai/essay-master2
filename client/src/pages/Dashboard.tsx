import {useRef} from "react";
import { useAuth } from "@/_core/hooks/useAuth";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { trpc } from "@/lib/trpc";
import { Link } from "wouter";
import { toast } from "sonner";
import { BookOpen, TrendingUp, Award, Target, CheckCircle2, Circle, ChevronRight, Sparkles, Loader2, Clock3, BrainCircuit } from "lucide-react";
import { useEffect, useState } from "react";
import { COURSE_OPTIONS, type CourseType } from "@shared/course";
import { buildLearningAnalytics, buildRecommendations, type LevelProgress, type Recommendation } from "@shared/learningAnalytics";
import { useLearningCourse } from "@/hooks/useLearningCourse";
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";

const BADGE_TOOL_LINKS: Record<string, string> = {
  summary: "/summary-practice",
  reordering: "/paragraph-reordering",
  quiz: "/quiz",
  thesis_checklist: "/thesis-checklist",
  topic_wizard: "/topic-wizard",
};

function BadgeSection({ courseType, enabled }: { courseType: CourseType; enabled: boolean }) {
  const { data: badges, isLoading } = trpc.badges.getByUser.useQuery(undefined, { enabled });

  if (isLoading) return <div className="text-sm text-slate-500">뱃지 불러오는 중...</div>;

  const earnedBadgeTypes = new Set(badges?.map(b => `${b.courseType}-${b.badgeType}`) || []);

  const badgeDefinitions = [
    { courseType: "elementary", badgeType: "summary", badgeName: "초등 요약왕 뱃지" },
    { courseType: "elementary", badgeType: "reordering", badgeName: "초등 문장 마스터 뱃지" },
    { courseType: "middle_high", badgeType: "quiz", badgeName: "중고등 퀴즈 달인 뱃지" },
    { courseType: "middle_high", badgeType: "thesis_checklist", badgeName: "중고등 논증 설계사 뱃지" },
    { courseType: "high_univ", badgeType: "topic_wizard", badgeName: "고등/대입 심층 논증 뱃지" },
    { courseType: "general_adult", badgeType: "summary", badgeName: "비즈니스 기획 전문가 뱃지" },
  ];

  const visibleDefinitions = badgeDefinitions.filter((definition) => definition.courseType === courseType);
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {visibleDefinitions.map((def) => {
          const isEarned = earnedBadgeTypes.has(`${def.courseType}-${def.badgeType}`);
          return (
            <div key={`${def.courseType}-${def.badgeType}`} className={`p-4 rounded-xl border flex items-center justify-between ${isEarned ? "bg-amber-50/70 border-amber-200" : "bg-white border-slate-200 opacity-60"}`}>
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold ${isEarned ? "bg-amber-500 text-white shadow-md" : "bg-slate-200 text-slate-500"}`}>
                  🏆
                </div>
                <div>
                  <h4 className="font-bold text-slate-900 text-sm">{def.badgeName}</h4>
                  <p className="text-xs text-slate-500">{def.courseType === "elementary" ? "초등 논술" : def.courseType === "middle_high" ? "중고등 논술" : def.courseType === "high_univ" ? "고등 / 대입" : "일반 / 직장인"}</p>
                </div>
              </div>
              <div>
                {isEarned ? (
                  <span className="text-xs font-bold text-amber-700 bg-amber-100 px-2 py-1 rounded-full">획득 완료</span>
                ) : (
                  <Link href={BADGE_TOOL_LINKS[def.badgeType] || "/curriculum"}><Button size="sm" variant="outline" className="text-xs h-7">학습 시작</Button></Link>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function Dashboard() {
  const { user, isAuthenticated } = useAuth();
  const { effectiveCourse, courseLabel, canLearn, canPersist, canSelectCourse, needsSelection, mode, scopeKey, setCourseType } = useLearningCourse();
  const isSampleMode = mode === "public-preview";
  const isStaffPreview = mode === "staff-preview";
  const activeCourseType = effectiveCourse;
  const queryCourse = activeCourseType ?? "elementary";
  const { data: progressData } = trpc.progress.getByUser.useQuery(undefined, {
    enabled: canPersist,
  });
  // 대시보드는 현재 과정 하나만 조회한다. 학습자 계정에서 8개 과정 쿼리를 수행하지 않는다.
  const { data: currentCurriculum } = trpc.curriculum.getDynamicByType.useQuery(queryCourse, { enabled: canLearn && !isSampleMode });
  const { data: publicCurriculum } = trpc.curriculum.getPublicOverview.useQuery(queryCourse, { enabled: canLearn && isSampleMode });
  const [selectedCourse, setSelectedCourse] = useState<{ title: string; rows: any[]; percent: number; color: string } | null>(null);
  const DASHBOARD_FALLBACK = {
    elementary: [
      { level: 1, title: "재미있는 낱말과 문장", description: "낱말 익히기와 짧은 문장 만들기" },
      { level: 2, title: "이야기 만들기", description: "그림 보고 이야기 꾸미기와 육하원칙 글쓰기" },
      { level: 3, title: "생각 정리하기", description: "핵심 내용 찾기와 짧은 글 요약하기" },
      { level: 4, title: "상상력 키우기", description: "동화·편지·일기 등 창의적 글쓰기" },
    ],
    middle_high: [
      { level: 1, title: "문장의 기초", description: "정확한 어휘와 문장 성분 호응" },
      { level: 2, title: "단락의 논리적 연결", description: "소주제문과 뒷받침 문장 구성" },
      { level: 3, title: "구조적 분석 및 요약", description: "서론·본론·결론과 개요 작성" },
      { level: 4, title: "비판적 사고와 주제 설정", description: "제시문 분석과 자신의 견해 논증" },
    ],
    high_univ: [
      { level: 1, title: "인문·사회 제시문 심층 분석", description: "다면적 제시문 비교 및 독해 훈련" },
      { level: 2, title: "수리·과학적 사고와 논증", description: "도표·통계 자료를 활용한 논증" },
      { level: 3, title: "대입 논술 실전 모의고사", description: "시간 관리와 실전 답안 작성" },
    ],
    general_adult: [
      { level: 1, title: "비즈니스 기획서와 보고서 작성법", description: "결론 우선의 간결한 문서 구조화" },
      { level: 2, title: "논리적 설득 스피치와 논설문", description: "근거 배치와 반박 대응" },
      { level: 3, title: "직장인 실전 글쓰기 프로젝트", description: "제안서·이메일·회의록 실전 작성" },
    ],
  };
  const { data: quizData } = trpc.quiz.getByUser.useQuery(undefined, {
    enabled: canPersist,
  });
  const { data: certificates = [] } = trpc.certificate.getUserCertificates.useQuery(undefined, { enabled: canPersist });
  const { data: earnedBadges = [] } = trpc.badges.getByUser.useQuery(undefined, { enabled: canPersist });
  const [isReportExporting, setIsReportExporting] = useState(false);
  const { data: weeklyUsageData } = trpc.aiAutoFeedback.getWeeklyUsage.useQuery(undefined, {
    enabled: canPersist,
  });
  const { data: trialQuota } = trpc.aiAutoFeedback.getTodayQuota.useQuery(undefined, { enabled: canPersist });
  // 능력·성장·추천은 실제 AI·교사 첨삭 점수와 학습 도구 결과에서 계산한다(기록이 없으면 비어 있는 그대로 보여 준다).
  const { data: analyticsData } = trpc.progress.analytics.useQuery(undefined, { enabled: canPersist });
  const analytics = analyticsData ?? buildLearningAnalytics({ ai: [], teacher: [], tools: [] });
  const [difficultyGuide, setDifficultyGuide] = useState<{
    headline: string;
    summary: string;
    recommendedDifficulty: "easy" | "medium" | "hard";
    focus: string;
    nextAction: string;
    basis: string;
    presetMode: "standard" | "advanced";
    source: "ai" | "fallback";
  } | null>(null);
  const activeScopeRef = useRef(scopeKey);
  activeScopeRef.current = scopeKey;
  const difficultyGuideMutation = trpc.questionBank.difficultyLearningGuide.useMutation();
  const requestDifficultyGuide = () => {
    if (!canPersist) return;
    const requestScope = scopeKey;
    difficultyGuideMutation.mutate(undefined,{
      onSuccess:guide=>{if(activeScopeRef.current===requestScope)setDifficultyGuide(guide);},
      onError:error=>{if(activeScopeRef.current===requestScope)toast.error(error.message||"AI 추천 학습 가이드를 준비하지 못했습니다.");}
    });
  };

  useEffect(() => {
    setSelectedCourse(null);
    setDifficultyGuide(null);
    return ()=>{activeScopeRef.current="disposed";};
  }, [scopeKey]);

  // 비로그인 방문자도 샘플 대시보드를 탐색할 수 있도록 가상 사용자 지정
  const effectiveUser = user || {
    id: 999,
    name: "샘플 학습자 (방문자 체험 모드)",
    email: "visitor@sample.com",
    role: "user" as const,
    tag: "초등",
    teacherLevel: 1,
    teacherStatus: "approved" as const,
  };

  // 과정별 동적 진도 계산. 기존 불리언(1)과 워크북의 백분율(100) 저장 형식을 모두 지원합니다.
  const isProgressComplete = (progress: { completed?: number | null } | undefined) => {
    const completed = Number(progress?.completed ?? 0);
    return completed === 1 || completed >= 100;
  };
  const progressStatus = (progress: { completed?: number | null } | undefined) => {
    const completed = Number(progress?.completed ?? 0);
    if (isProgressComplete(progress)) return "complete" as const;
    if (completed > 0) return "in_progress" as const;
    return "not_started" as const;
  };
  const completedIds = new Set(progressData?.filter((p) => isProgressComplete(p)).map((p) => p.curriculumId) || []);

  const progressForModule = (module: any) => progressData?.find((item: any) => {
    if (item.curriculumId !== module.id && item.curriculumId !== module.level) return false;
    // New records carry source metadata. Fixtures and legacy records without it remain readable.
    if (item.courseType != null && item.courseType !== activeCourseType) return false;
    if (module.id != null && item.curriculumSource != null && item.curriculumSource !== "dynamic") return false;
    return true;
  });

  const calcCourseProgress = (currList: any[] = []) => {
    const total = currList.length;
    if (total === 0) return { percent: 0, completedCount: 0, total: 0 };
    const completedCount = currList.filter((item) => isProgressComplete(progressForModule(item))).length;
    const percent = Math.round((completedCount / total) * 100);
    return { percent, completedCount, total };
  };

  const currentRows = currentCurriculum?.length ? currentCurriculum : publicCurriculum?.length ? publicCurriculum : DASHBOARD_FALLBACK[queryCourse];
  const currentProgress = calcCourseProgress(currentRows);
  const colorByCourse: Record<CourseType, string> = { elementary: "indigo", middle_high: "blue", high_univ: "purple", general_adult: "amber" };
  const displayCards = activeCourseType ? [{ key: activeCourseType, title: `${courseLabel} 논술 과정 진도`, rows: currentRows, progress: currentProgress, color: colorByCourse[activeCourseType] }] : [];

  // 진도율·완료 수는 현재 과정의 레벨 기준이다(진도 기록 개수가 아니다).
  const totalProgress = currentProgress.total;

  const getCourseTitleLabel = (key: string) => {
    switch (key) {
      case "elementary": return "초등 논술 과정";
      case "middle_high": return "중고등 논술 과정";
      case "high_univ": return "고등/대입 논술 과정";
      case "general_adult": return "일반/직장인 논술 과정";
      default: return "종합 논술 과정";
    }
  };
  const completedProgress = currentProgress.completedCount;

  // 현재 과정의 레벨별 실제 진행 상태와 점수(레벨 번호는 커리큘럼의 레벨이며 기록 순서가 아니다).
  const levelRows: LevelProgress[] = (currentRows as any[]).map((module, index) => {
    const record = progressForModule(module);
    const status = progressStatus(record);
    const score = Number(record?.score ?? 0);
    return {
      level: Number(module.level ?? index + 1),
      title: String(module.title ?? `Level ${module.level ?? index + 1}`),
      status,
      score: score > 0 ? score : null,
    };
  });
  const scoredLevels = levelRows.filter((row) => row.score !== null);
  const avgScore = scoredLevels.length ? Math.round(scoredLevels.reduce((sum, row) => sum + (row.score as number), 0) / scoredLevels.length) : 0;

  // 차트 데이터: 학습을 시작한 레벨만, 실제 레벨 번호와 최고 점수로 그린다.
  const compactProgressChartData = levelRows
    .filter((row) => row.status !== "not_started")
    .map((row) => ({ name: `Level ${row.level}`, score: row.score ?? 0, status: row.status }));
  const progressChartData = compactProgressChartData;

  const growthChartData = analytics.weekly.map((point) => ({ week: point.label, essay: point.essayScore, tool: point.toolScore }));
  const hasGrowthData = analytics.weekly.some((point) => point.essayScore !== null || point.toolScore !== null);
  const measuredSkills = analytics.skills.filter((skill) => skill.value !== null);
  const skillChartData = analytics.skills.map((skill) => ({ skill: skill.label, value: skill.value ?? 0 }));
  // 성취 리포트(PDF)에도 같은 실제 값만 넣는다.
  const growthData = analytics.weekly
    .filter((point) => point.essayScore !== null || point.toolScore !== null)
    .map((point) => ({ week: point.label, score: (point.essayScore ?? point.toolScore) as number }));
  const skillData = measuredSkills.map((skill) => ({ skill: skill.label, value: skill.value as number }));
  const recommendations: Recommendation[] = buildRecommendations({ analytics, courseType: activeCourseType ?? queryCourse, levels: levelRows });

  const quizStats = quizData?.reduce(
    (acc, q) => {
      acc.total += 1;
      if (q.isCorrect === 1) acc.correct += 1;
      return acc;
    },
    { total: 0, correct: 0 }
  ) || { total: 0, correct: 0 };

  const correctRate =
    quizStats.total > 0
      ? Math.round((quizStats.correct / quizStats.total) * 100)
      : 0;
  const overallProgressPercent = totalProgress > 0 ? Math.round((completedProgress / totalProgress) * 100) : 0;
  const learningDays = new Set((progressData || []).map((item: any) => {
    const timestamp = item.updatedAt || item.createdAt;
    const date = timestamp ? new Date(timestamp) : null;
    return date && !Number.isNaN(date.getTime()) ? date.toLocaleDateString() : null;
  }).filter(Boolean)).size;
  const activeCourseCard = displayCards[0];
  const visibleCertificates = certificates.filter((certificate: any) => certificate.courseType === activeCourseType);
  const visibleBadges = earnedBadges.filter((badge: any) => badge.courseType === activeCourseType);
  const handleExportAchievementReport = async () => {
    setIsReportExporting(true);
    try {
      const { exportAchievementReportPdf } = await import("@/lib/achievementReportPdf");
      await exportAchievementReportPdf({
        learnerName: effectiveUser.name || "학습자",
        courseLabel: getCourseTitleLabel(activeCourseType ?? queryCourse),
        courseProgress: activeCourseCard?.progress.percent || 0,
        completedLevels: activeCourseCard?.progress.completedCount || 0,
        totalLevels: activeCourseCard?.progress.total || 0,
        overallProgress: overallProgressPercent,
        averageScore: avgScore,
        quizCorrectRate: correctRate,
        learningDays,
        certificates: visibleCertificates,
        badges: visibleBadges,
        progressData: compactProgressChartData,
        growthData,
        skillData,
      });
      toast.success("성취 요약 리포트 PDF를 저장했습니다.");
    } catch (error) {
      console.error(error);
      toast.error("성취 요약 리포트 PDF를 저장하지 못했습니다.");
    } finally {
      setIsReportExporting(false);
    }
  };

  return (
    <div className="bg-slate-50/70 py-6 sm:py-8">
      {/* Main Content */}
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <h1 className="mb-5 text-3xl font-extrabold tracking-tight text-slate-950 sm:text-4xl">학습 대시보드</h1>
        {trialQuota?.isTrial && !isSampleMode && (
          <section className="mb-6 rounded-2xl border border-indigo-200 bg-gradient-to-r from-indigo-50 via-white to-cyan-50 p-4 shadow-sm sm:p-5" aria-label="7일 무료 체험 상태">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex gap-3"><div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-indigo-600 text-white"><Clock3 className="h-5 w-5" /></div><div><p className="font-extrabold text-indigo-950">7일 무료 체험 · {trialQuota.daysRemaining}일 남음</p><p className="mt-1 text-sm leading-6 text-slate-600">내 과정의 레슨과 학습 도구를 자유롭게 경험해 보세요.</p></div></div>
              <div className={`rounded-xl border px-4 py-3 text-sm ${trialQuota.remaining > 0 ? "border-emerald-200 bg-emerald-50 text-emerald-950" : "border-slate-200 bg-slate-50 text-slate-700"}`}><p className="flex items-center gap-1.5 font-bold"><BrainCircuit className="h-4 w-4" />레슨 1 AI 논술 평가 {trialQuota.remaining > 0 ? "사용 가능" : "사용 완료"}</p><p className="mt-1 text-xs">{trialQuota.remaining > 0 ? "첫 서술형 답안 1회를 평가받을 수 있습니다." : "평가 결과와 학습 기록은 계속 확인할 수 있습니다."}</p></div>
            </div>
          </section>
        )}
        {needsSelection && <div className="mb-6 rounded-xl border border-amber-200 bg-amber-50 p-4 text-amber-950"><p className="font-bold">가입 과정이 확인되지 않았습니다.</p><p className="mt-1 text-sm">학습 기록을 보려면 마이페이지에서 과정을 설정해 주세요.</p><Link href="/mypage" className="mt-3 inline-flex text-sm font-bold text-indigo-700 underline underline-offset-4">마이페이지에서 과정 확인</Link></div>}
        {canSelectCourse && <div className="mb-6 flex flex-col gap-2 rounded-xl border border-indigo-100 bg-indigo-50/70 p-4 sm:flex-row sm:items-center sm:justify-between"><div><p className="font-bold text-indigo-950">{isStaffPreview ? "운영 탐색 과정 선택" : "공개 학습 과정 선택"}</p><p className="mt-1 text-sm text-indigo-700">선택한 과정의 커리큘럼과 예시만 확인할 수 있으며 학습 기록은 저장되지 않습니다.</p></div><select aria-label={isStaffPreview ? "운영 탐색 과정" : "공개 학습 과정"} value={queryCourse} onChange={(event) => setCourseType(event.target.value as CourseType)} className="h-10 rounded-lg border border-indigo-200 bg-white px-3 text-sm font-semibold text-indigo-900">{COURSE_OPTIONS.map((course) => <option key={course.value} value={course.value}>{course.label} 논술</option>)}</select></div>}

        {/* Course Progress Breakdown Bars (개인화된 가입 과정에 맞춤 표시) */}
        <div className="mb-5 grid gap-4">
          {displayCards.map((course) => (
            <Card
              key={course.key}
              role="button"
              tabIndex={0}
              onClick={() => setSelectedCourse({ title: course.title, rows: course.rows, percent: course.progress.percent, color: course.color })}
              onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); setSelectedCourse({ title: course.title, rows: course.rows, percent: course.progress.percent, color: course.color }); } }}
              className="cursor-pointer border-slate-200 bg-white shadow-sm transition hover:-translate-y-0.5 hover:border-indigo-300 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
              aria-label={`${course.title} 상세 모듈 보기`}
            >
              <CardHeader className="pb-1">
                <CardTitle className="flex items-center justify-between text-sm font-bold text-slate-700"><span>{course.title}</span><ChevronRight className="h-4 w-4 text-slate-400" /></CardTitle>
                <CardDescription className="text-[11px]">클릭하여 세부 모듈 확인</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="flex justify-between text-xs font-semibold text-slate-600"><span>완료율</span><span className={`text-${course.color}-600`}>{course.progress.percent}%</span></div>
                <div className="h-2.5 w-full overflow-hidden rounded-full bg-slate-100"><div className={`h-full rounded-full bg-${course.color}-600 transition-all duration-500`} style={{ width: `${course.progress.percent}%` }} /></div>
                <p className="text-[11px] text-slate-400">총 {course.progress.total}개 레벨 중 {course.progress.completedCount}개 수료</p>
              </CardContent>
            </Card>
          ))}
        </div>

        {canPersist && (
          <Card className="mb-5 overflow-hidden border-indigo-200 bg-gradient-to-br from-indigo-50 via-white to-indigo-50 shadow-sm">
            <CardHeader className="grid-cols-1 gap-3 border-b border-indigo-100 px-5 pt-5 sm:grid-cols-[1fr_auto] sm:px-6 sm:pt-6">
              <div>
                <CardTitle className="flex items-center gap-2 text-xl font-bold text-slate-900"><Sparkles className="h-5 w-5 text-indigo-600" /> AI 추천 학습 가이드</CardTitle>
                <CardDescription className="mt-1">현재 운영 난이도, 과정별 문항 분포·정답률, 나의 서버 검증 수행 기록을 바탕으로 다음 학습을 안내합니다.</CardDescription>
              </div>
              <CardAction className="col-auto row-auto w-full sm:col-start-2 sm:row-span-2 sm:row-start-1 sm:w-auto"><Button onClick={requestDifficultyGuide} disabled={difficultyGuideMutation.isPending} className="w-full bg-indigo-700 text-white hover:bg-indigo-800 sm:w-auto">
                {difficultyGuideMutation.isPending ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />분석 중</> : <><Sparkles className="mr-2 h-4 w-4" />맞춤 가이드 만들기</>}
              </Button></CardAction>
            </CardHeader>
            <CardContent className="px-5 py-5 sm:px-6">
              {difficultyGuide ? (
                <div className="grid gap-4 lg:grid-cols-[1.1fr_1fr]">
                  <div className="rounded-xl border border-indigo-100 bg-white/90 p-5"><div className="flex flex-wrap items-center gap-2"><p className="font-bold text-slate-900">{difficultyGuide.headline}</p><span className={`rounded-full px-2.5 py-1 text-xs font-bold ${difficultyGuide.recommendedDifficulty === "easy" ? "bg-emerald-100 text-emerald-800" : difficultyGuide.recommendedDifficulty === "medium" ? "bg-amber-100 text-amber-800" : "bg-rose-100 text-rose-800"}`}>{difficultyGuide.recommendedDifficulty === "easy" ? "초급 추천" : difficultyGuide.recommendedDifficulty === "medium" ? "중급 추천" : "고급 추천"}</span><span className="rounded-full bg-indigo-100 px-2.5 py-1 text-xs font-semibold text-indigo-800">{difficultyGuide.presetMode === "advanced" ? "심화 운영" : "표준 운영"}</span></div><p className="mt-3 text-sm leading-6 text-slate-700">{difficultyGuide.summary}</p><p className="mt-3 text-xs leading-5 text-slate-500">판단 근거: {difficultyGuide.basis}</p></div>
                  <div className="grid gap-3 sm:grid-cols-2"><div className="rounded-xl border border-indigo-100 bg-indigo-50/70 p-4"><p className="text-xs font-bold text-indigo-800">이번 학습 초점</p><p className="mt-2 text-sm leading-6 text-slate-800">{difficultyGuide.focus}</p></div><div className="rounded-xl border border-emerald-100 bg-emerald-50/70 p-4"><p className="text-xs font-bold text-emerald-800">바로 할 일</p><p className="mt-2 text-sm leading-6 text-slate-800">{difficultyGuide.nextAction}</p></div></div>
                </div>
              ) : <div className="rounded-xl border border-dashed border-indigo-200 bg-white/60 p-5 text-sm leading-6 text-slate-600">가이드를 만들면 현재 프리셋과 실제 학습 기록을 반영해 적절한 다음 문항 난이도와 구체적인 연습 순서를 제안합니다.</div>}
            </CardContent>
          </Card>
        )}

        <Dialog open={Boolean(selectedCourse)} onOpenChange={(open) => { if (!open) setSelectedCourse(null); }}>
          <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
            <DialogHeader>
              <DialogTitle>{selectedCourse?.title} 세부 학습 모듈</DialogTitle>
              <DialogDescription>과정 내 모듈별 완료 상태와 현재 학습 점수를 확인하세요. 전체 완료율은 {selectedCourse?.percent ?? 0}%입니다.</DialogDescription>
            </DialogHeader>
            <div className="space-y-3 py-2">
              {selectedCourse?.rows?.length ? selectedCourse.rows.map((module: any) => {
                const moduleId = module.id ?? module.level;
                const moduleProgress = progressForModule(module);
                const status = progressStatus(moduleProgress);
                const complete = status === "complete";
                const inProgress = status === "in_progress";
                return <div key={`${selectedCourse.title}-${moduleId}`} className={`flex items-start gap-3 rounded-xl border p-4 ${complete ? "border-emerald-200 bg-emerald-50/60" : inProgress ? "border-amber-200 bg-amber-50/50" : "border-slate-200 bg-white"}`}><div className="mt-0.5">{complete ? <CheckCircle2 className="h-5 w-5 text-emerald-600" /> : <Circle className={`h-5 w-5 ${inProgress ? "text-amber-500" : "text-slate-300"}`} />}</div><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center justify-between gap-2"><p className="font-semibold text-slate-900">Level {module.level} · {module.title}</p><span className={`text-xs font-bold ${complete ? "text-emerald-700" : inProgress ? "text-amber-700" : "text-slate-500"}`}>{complete ? "완료" : inProgress ? `진행 중 (${Number(moduleProgress?.completed ?? 0)}%)` : "미시작"}</span></div><p className="mt-1 text-sm leading-6 text-slate-600">{module.description}</p>{moduleProgress?.score != null && <p className="mt-2 text-xs font-medium text-indigo-600">학습 점수 {moduleProgress.score}점</p>}</div></div>;
              }) : <div className="rounded-xl border border-dashed border-slate-300 p-8 text-center text-sm text-slate-500">아직 등록된 학습 모듈이 없습니다.</div>}
            </div>
          </DialogContent>
        </Dialog>

        {/* Summary Cards */}
        <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-slate-600">
                전체 진도율
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-extrabold text-indigo-600 sm:text-3xl">
                {overallProgressPercent}
                %
              </div>
              <p className="text-xs text-slate-500 mt-2">
                {completedProgress} / {totalProgress} 완료
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-slate-600">
                평균 점수
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-extrabold text-green-600 sm:text-3xl">{scoredLevels.length ? avgScore : "–"}</div>
              <p className="text-xs text-slate-500 mt-2">{scoredLevels.length ? `점 · 점수가 기록된 ${scoredLevels.length}개 레벨 기준` : "점수가 기록된 레벨이 없습니다"}</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-slate-600">
                퀴즈 정답률
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-extrabold text-indigo-600 sm:text-3xl">{correctRate}%</div>
              <p className="text-xs text-slate-500 mt-2">
                {quizStats.correct} / {quizStats.total} 정답
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-slate-600">
                학습 일수
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-extrabold text-indigo-600 sm:text-3xl">{learningDays}</div>
              <p className="text-xs text-slate-500 mt-2">일</p>
            </CardContent>
          </Card>
        </div>

        {/* Badges Section & Achievement Gallery Widget */}
        <div className="mb-8 space-y-6">
          <Card className="border-indigo-100 bg-gradient-to-r from-indigo-50/50 to-indigo-50/50 shadow-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-xl font-bold text-slate-900">
                <Award className="h-6 w-6 text-indigo-600" /> 학습 뱃지 현황 (Badge System)
              </CardTitle>
              <CardDescription>
                요약 연습, 단락 재구성, 퀴즈, 주제 위저드 등 학습 도구를 수행할 때마다 과정별 전문 뱃지가 수여됩니다.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {activeCourseType && <BadgeSection courseType={activeCourseType} enabled={canPersist} />}
            </CardContent>
          </Card>

          {/* 학생 성취 갤러리 위젯 (My Achievement Gallery) */}
          <Card className="border-emerald-100 bg-gradient-to-br from-white to-emerald-50/30 shadow-sm">
            <CardHeader className="flex flex-col items-start gap-3 pb-2 sm:flex-row sm:justify-between">
              <div>
                <CardTitle className="text-lg font-bold text-slate-900 flex flex-wrap items-center gap-2">
                  <span>🏆 나의 성취 갤러리 (Achievement Gallery)</span>
                  <span className="text-xs bg-emerald-100 text-emerald-800 font-semibold px-2.5 py-0.5 rounded-full">수료증 및 뱃지 모음</span>
                </CardTitle>
                <CardDescription className="text-xs text-slate-500 mt-1">
                  지금까지 획득한 수료증과 뱃지를 한눈에 확인하고 이미지 공유 및 PDF 다운로드를 이용하세요.
                </CardDescription>
              </div>
              <Link href="/certificate">
                <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs gap-1">
                  수료증 발급 센터로 이동 <ChevronRight className="w-3 h-3" />
                </Button>
              </Link>
            </CardHeader>
            <CardContent className="pt-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-4 rounded-xl border border-emerald-200 bg-white flex items-center justify-between shadow-xs">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold">📜</div>
                    <div>
                      <h4 className="font-bold text-slate-900 text-sm">논술 마스터 수료증</h4>
                      <p className="text-xs text-slate-500">각 과정별 단계 완료 시 발급</p>
                    </div>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    className="text-xs h-8 border-emerald-300 text-emerald-700 hover:bg-emerald-50"
                    onClick={() => {
                      toast.success("수료증 갤러리 링크가 클립보드에 복사되었습니다! SNS에 공유해보세요.");
                    }}
                  >
                    링크 공유
                  </Button>
                </div>
                <div className="p-4 rounded-xl border border-indigo-200 bg-white flex items-center justify-between shadow-xs">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold">🎯</div>
                    <div>
                      <h4 className="font-bold text-slate-900 text-sm">성취 요약 리포트</h4>
                      <p className="text-xs text-slate-500">주간 학습 진도 및 정답률 통계</p>
                    </div>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    className="text-xs h-8 border-indigo-300 text-indigo-700 hover:bg-indigo-50"
                    onClick={handleExportAchievementReport}
                    disabled={isReportExporting}
                  >
                    {isReportExporting ? <><Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />PDF 생성 중</> : "PDF 저장"}
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Charts */}
        <Tabs defaultValue="progress" className="space-y-6">
          <TabsList className="grid w-full max-w-md grid-cols-3">
            <TabsTrigger value="progress">진도</TabsTrigger>
            <TabsTrigger value="growth">성장</TabsTrigger>
            <TabsTrigger value="skills">능력</TabsTrigger>
          </TabsList>

          <TabsContent value="progress">
            <Card>
              <CardHeader>
                <CardTitle>레벨별 점수</CardTitle>
                <CardDescription>
                  {compactProgressChartData.length > 0
                    ? `${courseLabel} 과정에서 학습을 시작한 ${compactProgressChartData.length}개 레벨의 최고 점수입니다 (전체 ${levelRows.length}개 레벨)`
                    : "아직 학습을 시작한 레벨이 없습니다"}
                </CardDescription>
              </CardHeader>
              <CardContent>
                {compactProgressChartData.length > 0 ? (
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={compactProgressChartData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="name" tick={{ fontSize: 11 }} interval="preserveStartEnd" />
                      <YAxis domain={[0, 100]} />
                      <Tooltip formatter={(value: any, _name: any, item: any) => [item?.payload?.status === "complete" ? `${value}점 (완료)` : `${value}점 (진행 중)`, "최고 점수"]} />
                      <Bar dataKey="score" name="최고 점수" fill="#4f46e5" />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex h-48 flex-col items-center justify-center rounded-xl border border-dashed border-slate-300 bg-slate-50 p-6 text-center">
                    <p className="text-sm font-semibold text-slate-800">레벨 학습 기록이 아직 없습니다.</p>
                    <p className="mt-1 text-xs text-slate-500">레슨과 워크북을 풀면 레벨별 점수가 이곳에 표시됩니다.</p>
                    <Link href="/curriculum"><Button size="sm" className="mt-4 bg-indigo-600 text-white hover:bg-indigo-700">커리큘럼 보기</Button></Link>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="growth">
            <Card className="mb-6">
              <CardHeader>
                <CardTitle>성장 추이</CardTitle>
                <CardDescription>
                  최근 8주 동안 주별 평균 점수입니다. AI·교사 첨삭 종합 점수와 학습 도구(문장 교정·단락 재구성·요약) 점수를 따로 보여 줍니다.
                </CardDescription>
              </CardHeader>
              <CardContent>
                {hasGrowthData ? (
                  <ResponsiveContainer width="100%" height={300}>
                    <LineChart data={growthChartData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="week" />
                      <YAxis domain={[0, 100]} />
                      <Tooltip formatter={(value: any) => (value === null || value === undefined ? "기록 없음" : `${value}점`)} />
                      <Legend />
                      <Line type="monotone" dataKey="essay" stroke="#4f46e5" name="첨삭 점수" connectNulls dot />
                      <Line type="monotone" dataKey="tool" stroke="#059669" name="학습 도구 점수" connectNulls dot />
                    </LineChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex h-48 flex-col items-center justify-center rounded-xl border border-dashed border-slate-300 bg-slate-50 p-6 text-center">
                    <p className="text-sm font-semibold text-slate-800">최근 8주 동안 점수 기록이 없습니다.</p>
                    <p className="mt-1 text-xs text-slate-500">AI 첨삭을 받거나 학습 도구를 풀면 주별 점수 변화가 그려집니다.</p>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card className="border-sky-100 shadow-sm bg-gradient-to-br from-white to-sky-50/30">
              <CardHeader className="flex flex-col items-start gap-3 pb-2 sm:flex-row sm:justify-between">
                <div>
                  <CardTitle className="text-lg font-bold text-slate-900 flex flex-wrap items-center gap-2">
                    <span>🤖 주간 AI 첨삭 사용량 통계</span>
                    <span className="text-xs bg-sky-100 text-sky-800 font-semibold px-2.5 py-0.5 rounded-full">최근 7일</span>
                  </CardTitle>
                  <CardDescription className="text-xs text-slate-500 mt-1">
                    일자별 공용 크레딧 기반 AI 자동 첨삭 이용 횟수 현황입니다.
                  </CardDescription>
                </div>
                <div className="text-right hidden sm:block">
                  <span className="text-2xl font-extrabold text-sky-600">
                    {weeklyUsageData ? weeklyUsageData.reduce((acc, curr) => acc + curr.count, 0) : 0}회
                  </span>
                  <p className="text-[11px] text-slate-400">총 이용 횟수</p>
                </div>
              </CardHeader>
              <CardContent>
                {weeklyUsageData && weeklyUsageData.some(d => d.count > 0) ? (
                  <div className="pt-4">
                    <ResponsiveContainer width="100%" height={260}>
                      <BarChart data={weeklyUsageData}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                        <XAxis dataKey="date" stroke="#64748b" fontSize={12} tickLine={false} />
                        <YAxis allowDecimals={false} stroke="#64748b" fontSize={12} tickLine={false} axisLine={false} />
                        <Tooltip
                          contentStyle={{ backgroundColor: "#ffffff", borderRadius: "12px", border: "1px solid #e2e8f0", boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1)" }}
                          formatter={(value: any) => [`${value}회`, "첨삭"]}
                        />
                        <Bar dataKey="count" name="첨삭 횟수" fill="#0284c7" radius={[6, 6, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                ) : (
                  <div className="h-64 flex flex-col items-center justify-center text-center p-6 bg-white/60 rounded-xl border border-dashed border-sky-200">
                    <div className="w-12 h-12 rounded-full bg-sky-100 flex items-center justify-center text-sky-600 mb-3 font-bold text-lg">AI</div>
                    <p className="text-sm font-semibold text-slate-800">아직 이번 주 AI 첨삭 기록이 없습니다.</p>
                    <p className="text-xs text-slate-500 mt-1">AI 자동 첨삭 메뉴에서 글을 작성하고 첨삭을 받아보세요!</p>
                    <Link href="/ai-auto-feedback">
                      <Button size="sm" className="mt-4 bg-sky-600 hover:bg-sky-700 text-white text-xs">AI 자동 첨삭 하러 가기</Button>
                    </Link>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="skills">
            <Card>
              <CardHeader>
                <CardTitle>영역별 능력 분석</CardTitle>
                <CardDescription>
                  실제 AI·교사 첨삭 점수와 학습 도구 결과의 최근 {20}회 평균입니다. 기록이 없는 영역은 측정 전으로 표시합니다.
                </CardDescription>
              </CardHeader>
              <CardContent>
                {measuredSkills.length >= 3 && (
                  <ResponsiveContainer width="100%" height={300}>
                    <RadarChart data={skillChartData}>
                      <PolarGrid />
                      <PolarAngleAxis dataKey="skill" />
                      <PolarRadiusAxis angle={90} domain={[0, 100]} />
                      <Radar name="능력" dataKey="value" stroke="#4f46e5" fill="#4f46e5" fillOpacity={0.6} />
                      <Tooltip />
                    </RadarChart>
                  </ResponsiveContainer>
                )}
                {measuredSkills.length < 3 && (
                  <p className="mb-4 rounded-lg border border-dashed border-slate-300 bg-slate-50 p-4 text-sm text-slate-600">
                    {measuredSkills.length === 0 ? "아직 측정된 영역이 없습니다." : "측정된 영역이 3개 미만이라 그래프 대신 점수로 보여 드립니다."} AI 첨삭을 받거나 학습 도구를 풀면 점수가 쌓입니다.
                  </p>
                )}
                <ul className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3" data-testid="skill-list">
                  {analytics.skills.map((skill) => (
                    <li key={skill.key} className="flex items-center justify-between rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm">
                      <span className="font-semibold text-slate-800">{skill.label}</span>
                      {skill.value === null ? (
                        <span className="text-xs text-slate-400">측정 전</span>
                      ) : (
                        <span className="font-extrabold text-indigo-700">{skill.value}점 <span className="text-xs font-medium text-slate-500">· 최근 {skill.samples}회</span></span>
                      )}
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Recommendations */}
        <Card className="mt-8" data-testid="dashboard-recommendations">
          <CardHeader>
            <CardTitle>추천 학습</CardTitle>
            <CardDescription>
              내 진도와 점수, AI 첨삭 기록을 분석해 만든 추천입니다
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {recommendations.map((item) => {
                const style = {
                  focus: { box: "bg-indigo-50", icon: <Target className="w-5 h-5 text-indigo-600 mt-1 flex-shrink-0" /> },
                  progress: { box: "bg-green-50", icon: <TrendingUp className="w-5 h-5 text-green-600 mt-1 flex-shrink-0" /> },
                  action: { box: "bg-indigo-50", icon: <Award className="w-5 h-5 text-indigo-600 mt-1 flex-shrink-0" /> },
                  done: { box: "bg-emerald-50", icon: <CheckCircle2 className="w-5 h-5 text-emerald-600 mt-1 flex-shrink-0" /> },
                }[item.tone];
                return (
                  <div key={item.id} className={`flex items-start gap-4 rounded-lg p-4 ${style.box}`}>
                    {style.icon}
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold text-slate-900">{item.title}</p>
                      <p className="text-sm text-slate-600">{item.text}</p>
                    </div>
                    {item.href && (
                      <Link href={item.href} className="shrink-0">
                        <Button size="sm" variant="outline" className="bg-white">{item.cta ?? "바로가기"}</Button>
                      </Link>
                    )}
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
