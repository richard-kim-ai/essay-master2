import { useAuth } from "@/_core/hooks/useAuth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { trpc } from "@/lib/trpc";
import { Link } from "wouter";
import { BookOpen, TrendingUp, Award, Target } from "lucide-react";
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
  const { data: quizData } = trpc.quiz.getByUser.useQuery(undefined, {
    enabled: isAuthenticated,
  });
  const { data: weeklyUsageData } = trpc.aiAutoFeedback.getWeeklyUsage.useQuery(undefined, {
    enabled: isAuthenticated,
  });

  if (!isAuthenticated) {
    return <div className="text-center py-12">로그인이 필요합니다.</div>;
  }

  // 진도 데이터 계산
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
          <Card className="border-indigo-100 bg-white shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-bold text-slate-700">초등 과정 진도</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="flex justify-between text-xs font-semibold text-slate-600">
                <span>완료율</span>
                <span className="text-indigo-600">75%</span>
              </div>
              <div className="h-2.5 w-full rounded-full bg-slate-100 overflow-hidden">
                <div className="h-full bg-indigo-600 rounded-full transition-all duration-500" style={{ width: "75%" }} />
              </div>
              <p className="text-[11px] text-slate-400">총 4개 레벨 중 3개 수료</p>
            </CardContent>
          </Card>

          <Card className="border-blue-100 bg-white shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-bold text-slate-700">중고등 과정 진도</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="flex justify-between text-xs font-semibold text-slate-600">
                <span>완료율</span>
                <span className="text-blue-600">50%</span>
              </div>
              <div className="h-2.5 w-full rounded-full bg-slate-100 overflow-hidden">
                <div className="h-full bg-blue-600 rounded-full transition-all duration-500" style={{ width: "50%" }} />
              </div>
              <p className="text-[11px] text-slate-400">총 4개 레벨 중 2개 수료</p>
            </CardContent>
          </Card>

          <Card className="border-purple-100 bg-white shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-bold text-slate-700">고등/대입 과정 진도</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="flex justify-between text-xs font-semibold text-slate-600">
                <span>완료율</span>
                <span className="text-purple-600">25%</span>
              </div>
              <div className="h-2.5 w-full rounded-full bg-slate-100 overflow-hidden">
                <div className="h-full bg-purple-600 rounded-full transition-all duration-500" style={{ width: "25%" }} />
              </div>
              <p className="text-[11px] text-slate-400">총 4개 레벨 중 1개 수료</p>
            </CardContent>
          </Card>

          <Card className="border-amber-100 bg-white shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-bold text-slate-700">일반/직장인 과정 진도</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="flex justify-between text-xs font-semibold text-slate-600">
                <span>완료율</span>
                <span className="text-amber-600">0%</span>
              </div>
              <div className="h-2.5 w-full rounded-full bg-slate-100 overflow-hidden">
                <div className="h-full bg-amber-500 rounded-full transition-all duration-500" style={{ width: "0%" }} />
              </div>
              <p className="text-[11px] text-slate-400">총 3개 레벨 중 0개 수료</p>
            </CardContent>
          </Card>
        </div>

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
