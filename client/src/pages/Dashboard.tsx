import { useAuth } from "@/_core/hooks/useAuth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { trpc } from "@/lib/trpc";
import { Link } from "wouter";
import { BookOpen, TrendingUp, Award, Target, CheckCircle2, Circle, ChevronRight } from "lucide-react";
import { useState } from "react";
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

export default function Dashboard() {
  const { user, isAuthenticated } = useAuth();
  const { data: progressData } = trpc.progress.getByUser.useQuery(undefined, {
    enabled: isAuthenticated,
  });
  const { data: elementaryCurr } = trpc.curriculum.getDynamicByType.useQuery("elementary", { enabled: isAuthenticated });
  const { data: middleHighCurr } = trpc.curriculum.getDynamicByType.useQuery("middle_high", { enabled: isAuthenticated });
  const { data: highUnivCurr } = trpc.curriculum.getDynamicByType.useQuery("high_univ", { enabled: isAuthenticated });
  const { data: generalAdultCurr } = trpc.curriculum.getDynamicByType.useQuery("general_adult", { enabled: isAuthenticated });
  const { data: elementaryStatic } = trpc.curriculum.getByType.useQuery("elementary", { enabled: isAuthenticated });
  const { data: middleHighStatic } = trpc.curriculum.getByType.useQuery("middle_high", { enabled: isAuthenticated });
  const { data: highUnivStatic } = trpc.curriculum.getByType.useQuery("high_univ", { enabled: isAuthenticated });
  const { data: generalAdultStatic } = trpc.curriculum.getByType.useQuery("general_adult", { enabled: isAuthenticated });
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
    enabled: isAuthenticated,
  });
  const { data: weeklyUsageData } = trpc.aiAutoFeedback.getWeeklyUsage.useQuery(undefined, {
    enabled: isAuthenticated,
  });

  if (!isAuthenticated) {
    return <div className="text-center py-12">로그인이 필요합니다.</div>;
  }

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

  const calcCourseProgress = (currList: any[] = []) => {
    const total = currList.length;
    if (total === 0) return { percent: 0, completedCount: 0, total: 0 };
    const completedCount = currList.filter((item) => completedIds.has(item.id) || completedIds.has(item.level)).length;
    const percent = Math.round((completedCount / total) * 100);
    return { percent, completedCount, total };
  };

  const courseRows = {
    elementary: elementaryCurr?.length ? elementaryCurr : elementaryStatic?.length ? elementaryStatic : DASHBOARD_FALLBACK.elementary,
    middle_high: middleHighCurr?.length ? middleHighCurr : middleHighStatic?.length ? middleHighStatic : DASHBOARD_FALLBACK.middle_high,
    high_univ: highUnivCurr?.length ? highUnivCurr : highUnivStatic?.length ? highUnivStatic : DASHBOARD_FALLBACK.high_univ,
    general_adult: generalAdultCurr?.length ? generalAdultCurr : generalAdultStatic?.length ? generalAdultStatic : DASHBOARD_FALLBACK.general_adult,
  };
  const elemProgress = calcCourseProgress(courseRows.elementary);
  const mhProgress = calcCourseProgress(courseRows.middle_high);
  const huProgress = calcCourseProgress(courseRows.high_univ);
  const gaProgress = calcCourseProgress(courseRows.general_adult);

  const courseCards = [
    { key: "elementary", title: "초등 과정 진도", rows: courseRows.elementary, progress: elemProgress, color: "indigo" },
    { key: "middle_high", title: "중고등 과정 진도", rows: courseRows.middle_high, progress: mhProgress, color: "blue" },
    { key: "high_univ", title: "고등/대입 과정 진도", rows: courseRows.high_univ, progress: huProgress, color: "purple" },
    { key: "general_adult", title: "일반/직장인 과정 진도", rows: courseRows.general_adult, progress: gaProgress, color: "amber" },
  ];

  const totalProgress = progressData?.length || 0;
  const completedProgress = progressData?.filter((p) => p.completed === 1).length || 0;
  const avgScore = progressData?.length
    ? Math.round(
        progressData.reduce((sum, p) => sum + (p.score || 0), 0) /
          progressData.length
      )
    : 0;

  // 차트 데이터
  const progressChartData = progressData?.map((p, idx) => ({
    name: `Level ${idx + 1}`,
    score: p.score || 0,
  })) || [];

  const growthData = [
    { week: "1주", score: 45 },
    { week: "2주", score: 52 },
    { week: "3주", score: 58 },
    { week: "4주", score: 65 },
    { week: "5주", score: 72 },
    { week: "6주", score: avgScore },
  ];

  const skillData = [
    { skill: "경제성", value: 75 },
    { skill: "명료성", value: 82 },
    { skill: "정확성", value: 68 },
    { skill: "논리력", value: 71 },
    { skill: "표현력", value: 79 },
  ];

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

  return (
    <div className="min-h-screen bg-gray-50 py-12">
      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <h1 className="text-4xl font-bold text-gray-900 mb-8">학습 대시보드</h1>

        {/* Course Progress Breakdown Bars */}
        <div className="mb-8 grid gap-6 lg:grid-cols-4">
          {courseCards.map((course) => (
            <Card
              key={course.key}
              role="button"
              tabIndex={0}
              onClick={() => setSelectedCourse({ title: course.title, rows: course.rows, percent: course.progress.percent, color: course.color })}
              onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); setSelectedCourse({ title: course.title, rows: course.rows, percent: course.progress.percent, color: course.color }); } }}
              className="cursor-pointer border-slate-200 bg-white shadow-sm transition hover:-translate-y-0.5 hover:border-indigo-300 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
              aria-label={`${course.title} 상세 모듈 보기`}
            >
              <CardHeader className="pb-2">
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

        <Dialog open={Boolean(selectedCourse)} onOpenChange={(open) => { if (!open) setSelectedCourse(null); }}>
          <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
            <DialogHeader>
              <DialogTitle>{selectedCourse?.title} 세부 학습 모듈</DialogTitle>
              <DialogDescription>과정 내 모듈별 완료 상태와 현재 학습 점수를 확인하세요. 전체 완료율은 {selectedCourse?.percent ?? 0}%입니다.</DialogDescription>
            </DialogHeader>
            <div className="space-y-3 py-2">
              {selectedCourse?.rows?.length ? selectedCourse.rows.map((module: any) => {
                const moduleId = module.id ?? module.level;
                const moduleProgress = progressData?.find((item) => item.curriculumId === moduleId || item.curriculumId === module.level);
                const status = progressStatus(moduleProgress);
                const complete = status === "complete";
                const inProgress = status === "in_progress";
                return <div key={`${selectedCourse.title}-${moduleId}`} className={`flex items-start gap-3 rounded-xl border p-4 ${complete ? "border-emerald-200 bg-emerald-50/60" : inProgress ? "border-amber-200 bg-amber-50/50" : "border-slate-200 bg-white"}`}><div className="mt-0.5">{complete ? <CheckCircle2 className="h-5 w-5 text-emerald-600" /> : <Circle className={`h-5 w-5 ${inProgress ? "text-amber-500" : "text-slate-300"}`} />}</div><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center justify-between gap-2"><p className="font-semibold text-slate-900">Level {module.level} · {module.title}</p><span className={`text-xs font-bold ${complete ? "text-emerald-700" : inProgress ? "text-amber-700" : "text-slate-500"}`}>{complete ? "완료" : inProgress ? `진행 중 (${Number(moduleProgress?.completed ?? 0)}%)` : "미시작"}</span></div><p className="mt-1 text-sm leading-6 text-slate-600">{module.description}</p>{moduleProgress?.score != null && <p className="mt-2 text-xs font-medium text-indigo-600">학습 점수 {moduleProgress.score}점</p>}</div></div>;
              }) : <div className="rounded-xl border border-dashed border-slate-300 p-8 text-center text-sm text-slate-500">아직 등록된 학습 모듈이 없습니다.</div>}
            </div>
          </DialogContent>
        </Dialog>

        {/* Summary Cards */}
        <div className="grid md:grid-cols-4 gap-6 mb-8">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-gray-600">
                전체 진도율
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-indigo-600">
                {totalProgress > 0
                  ? Math.round((completedProgress / totalProgress) * 100)
                  : 0}
                %
              </div>
              <p className="text-xs text-gray-500 mt-2">
                {completedProgress} / {totalProgress} 완료
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-gray-600">
                평균 점수
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-green-600">{avgScore}</div>
              <p className="text-xs text-gray-500 mt-2">점</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-gray-600">
                퀴즈 정답률
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-blue-600">{correctRate}%</div>
              <p className="text-xs text-gray-500 mt-2">
                {quizStats.correct} / {quizStats.total} 정답
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-gray-600">
                학습 일수
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-purple-600">12</div>
              <p className="text-xs text-gray-500 mt-2">일</p>
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
                  각 레벨에서 획득한 점수를 확인하세요
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={progressChartData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" />
                    <YAxis />
                    <Tooltip />
                    <Bar dataKey="score" fill="#4f46e5" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="growth">
            <Card className="mb-6">
              <CardHeader>
                <CardTitle>성장 추이</CardTitle>
                <CardDescription>
                  주별 점수 변화를 확인하세요
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={growthData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="week" />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    <Line
                      type="monotone"
                      dataKey="score"
                      stroke="#4f46e5"
                      name="점수"
                    />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card className="border-sky-100 shadow-sm bg-gradient-to-br from-white to-sky-50/30">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <div>
                  <CardTitle className="text-lg font-bold text-gray-900 flex items-center gap-2">
                    <span>🤖 주간 AI 첨삭 사용량 통계</span>
                    <span className="text-xs bg-sky-100 text-sky-800 font-semibold px-2.5 py-0.5 rounded-full">최근 7일</span>
                  </CardTitle>
                  <CardDescription className="text-xs text-gray-500 mt-1">
                    일자별 공용 크레딧 기반 AI 자동 첨삭 이용 횟수 현황입니다.
                  </CardDescription>
                </div>
                <div className="text-right hidden sm:block">
                  <span className="text-2xl font-extrabold text-sky-600">
                    {weeklyUsageData ? weeklyUsageData.reduce((acc, curr) => acc + curr.count, 0) : 0}회
                  </span>
                  <p className="text-[11px] text-gray-400">총 이용 횟수</p>
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
                    <p className="text-sm font-semibold text-gray-800">아직 이번 주 AI 첨삭 기록이 없습니다.</p>
                    <p className="text-xs text-gray-500 mt-1">AI 자동 첨삭 메뉴에서 글을 작성하고 첨삭을 받아보세요!</p>
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
                  각 영역의 강점과 약점을 확인하세요
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <RadarChart data={skillData}>
                    <PolarGrid />
                    <PolarAngleAxis dataKey="skill" />
                    <PolarRadiusAxis angle={90} domain={[0, 100]} />
                    <Radar
                      name="능력"
                      dataKey="value"
                      stroke="#4f46e5"
                      fill="#4f46e5"
                      fillOpacity={0.6}
                    />
                    <Tooltip />
                  </RadarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Recommendations */}
        <Card className="mt-8">
          <CardHeader>
            <CardTitle>추천 학습</CardTitle>
            <CardDescription>
              당신의 학습 패턴에 기반한 맞춤형 추천입니다
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-start gap-4 p-4 bg-blue-50 rounded-lg">
                <Target className="w-5 h-5 text-blue-600 mt-1 flex-shrink-0" />
                <div>
                  <p className="font-semibold text-gray-900">
                    정확성 영역 강화 학습
                  </p>
                  <p className="text-sm text-gray-600">
                    정확성 점수가 다른 영역보다 낮습니다. 주술 호응과 조사 사용에
                    집중하세요.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-4 p-4 bg-green-50 rounded-lg">
                <TrendingUp className="w-5 h-5 text-green-600 mt-1 flex-shrink-0" />
                <div>
                  <p className="font-semibold text-gray-900">
                    다음 레벨 도전하기
                  </p>
                  <p className="text-sm text-gray-600">
                    Level 2를 완료했습니다. Level 3에 도전해보세요!
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-4 p-4 bg-purple-50 rounded-lg">
                <Award className="w-5 h-5 text-purple-600 mt-1 flex-shrink-0" />
                <div>
                  <p className="font-semibold text-gray-900">
                    AI 첨삭 받기
                  </p>
                  <p className="text-sm text-gray-600">
                    작성한 논술에 대해 AI 자동 첨삭을 받아보세요.
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
