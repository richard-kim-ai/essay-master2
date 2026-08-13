import { useAuth } from "@/_core/hooks/useAuth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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

            <Card>
              <CardHeader>
                <CardTitle>🤖 주간 AI 첨삭 사용량 통계 (최근 7일)</CardTitle>
                <CardDescription>
                  일자별 AI 자동 첨삭 이용 횟수를 한눈에 확인하세요 (공용 크레딧)
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={260}>
                  <BarChart data={weeklyUsageData || []}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" />
                    <YAxis allowDecimals={false} />
                    <Tooltip />
                    <Bar dataKey="count" name="첨삭 횟수" fill="#0ea5e9" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
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
