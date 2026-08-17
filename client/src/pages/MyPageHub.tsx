import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { BarChart3, FileText, Award, User, BookOpen, ArrowRight, Target, Trophy, CheckCircle2, Sliders } from "lucide-react";
import { useLocation } from "wouter";
import { useState, useEffect } from "react";
import { toast } from "sonner";

export default function MyPageHub() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();

  const { data: progressList } = trpc.progress.getByUser.useQuery();
  const { data: offlineEssays = [] } = trpc.essaySubmission.getByUser.useQuery();
  const { data: certificates = [] } = trpc.certificate.getUserCertificates.useQuery();

  // Weekly Goal State (stored in localStorage per user)
  const goalKey = `essay_weekly_goal_${user?.id || 1}`;
  const [targetGoal, setTargetGoal] = useState<number>(() => {
    const saved = localStorage.getItem(goalKey);
    return saved ? parseInt(saved, 10) : 5; // default 5 modules per week
  });
  const [isEditingGoal, setIsEditingGoal] = useState(false);
  const [tempGoal, setTempGoal] = useState(targetGoal.toString());

  const completedCount = progressList?.filter((p: any) => p.isCompleted)?.length || 0;
  const achievementRate = Math.min(100, Math.round((completedCount / (targetGoal || 1)) * 100));

  const handleSaveGoal = () => {
    const val = parseInt(tempGoal, 10);
    if (isNaN(val) || val <= 0) {
      toast.error("올바른 목표 횟수를 입력해주세요.");
      return;
    }
    setTargetGoal(val);
    localStorage.setItem(goalKey, val.toString());
    setIsEditingGoal(false);
    toast.success("주간 학습 목표가 설정되었습니다.");
  };

  return (
    <DashboardLayout>
      <div className="p-6 md:p-10 space-y-8 max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 bg-gradient-to-r from-indigo-900 to-purple-900 text-white p-8 rounded-3xl shadow-xl">
          <div className="flex items-center gap-5">
            <div className="w-16 h-16 rounded-2xl bg-white/10 border border-white/20 flex items-center justify-center overflow-hidden shrink-0">
              {user?.avatarUrl ? (
                <img src={user.avatarUrl} alt="Avatar" className="w-full h-full object-cover" />
              ) : (
                <User className="w-8 h-8 text-indigo-200" />
              )}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-indigo-500/30 text-indigo-200 border border-indigo-400/30">
                  {user?.role === "admin" ? "총괄 관리자" : user?.role === "teacher" ? "첨삭 교사" : "일반 학습자"}
                </span>
                <span className="text-xs text-indigo-200">{user?.tag || "일반 과정"}</span>
              </div>
              <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight mt-1">
                {user?.name || "사용자"}님의 마이페이지
              </h1>
              <p className="text-xs md:text-sm text-indigo-200 mt-0.5">
                {user?.email} · 주간 학습 목표 및 핵심 학습 공간을 한눈에 관리하세요.
              </p>
            </div>
          </div>
          <Button
            onClick={() => setLocation("/dashboard-detail")}
            className="bg-white text-indigo-900 hover:bg-indigo-50 font-bold gap-2 shadow-md"
          >
            상세 대시보드로 이동 <ArrowRight className="w-4 h-4" />
          </Button>
        </div>

        {/* Weekly Goal Widget */}
        <Card className="border-indigo-100 bg-gradient-to-br from-indigo-50/60 to-purple-50/60 shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-base font-bold text-indigo-950 flex items-center gap-2">
              <Target className="w-5 h-5 text-indigo-600" /> 주간 학습 목표 및 달성률
            </CardTitle>
            <Button
              size="sm"
              variant="outline"
              className="h-7 px-2.5 text-xs text-indigo-700 border-indigo-200 bg-white"
              onClick={() => {
                setTempGoal(targetGoal.toString());
                setIsEditingGoal(!isEditingGoal);
              }}
            >
              <Sliders className="w-3.5 h-3.5 mr-1" /> {isEditingGoal ? "취소" : "목표 설정"}
            </Button>
          </CardHeader>
          <CardContent className="space-y-4 pt-2">
            {isEditingGoal && (
              <div className="flex items-center gap-3 bg-white p-3 rounded-xl border border-indigo-200 shadow-sm">
                <span className="text-xs font-semibold text-slate-700 whitespace-nowrap">이번 주 목표 모듈 수:</span>
                <input
                  type="number"
                  min="1"
                  max="50"
                  value={tempGoal}
                  onChange={(e) => setTempGoal(e.target.value)}
                  className="w-20 h-8 px-2 text-xs border border-slate-300 rounded focus:outline-none focus:ring-1 focus:ring-indigo-500 font-bold"
                />
                <Button
                  size="sm"
                  className="h-8 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold"
                  onClick={handleSaveGoal}
                >
                  저장하기
                </Button>
              </div>
            )}

            <div className="flex items-center justify-between text-xs font-bold text-slate-700">
              <span className="flex items-center gap-1.5">
                <Trophy className="w-4 h-4 text-amber-500" /> 주간 목표: <span className="text-indigo-600">{targetGoal}개 모듈 완료</span>
              </span>
              <span>현재 달성: <span className="text-emerald-600">{completedCount}개 완료 ({achievementRate}%)</span></span>
            </div>
            <Progress value={achievementRate} className="h-3 bg-indigo-100" />
            <p className="text-[11px] text-slate-500 flex items-center gap-1">
              <CheckCircle2 className="w-3.5 h-3.5 text-indigo-600" /> 매주 꾸준히 학습 모듈을 완료하고 논술 실력을 키워보세요!
            </p>
          </CardContent>
        </Card>

        {/* Quick Summary Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Card 1: Dashboard */}
          <Card className="border-slate-200 shadow-sm hover:shadow-md transition-all">
            <CardHeader className="flex flex-row items-center justify-between pb-2 bg-slate-50/50 rounded-t-xl">
              <CardTitle className="text-base font-bold text-slate-900 flex items-center gap-2">
                <BarChart3 className="w-5 h-5 text-blue-600" /> 학습 대시보드
              </CardTitle>
              <span className="text-xs font-semibold text-blue-600 bg-blue-50 px-2 py-1 rounded-full">진도율 관리</span>
            </CardHeader>
            <CardContent className="pt-6 space-y-4">
              <div>
                <p className="text-xs text-slate-500">완료한 학습 모듈</p>
                <p className="text-2xl font-extrabold text-slate-900 mt-1">
                  {completedCount}개 완료
                </p>
              </div>
              <p className="text-xs text-slate-600">과정별 진도율과 AI 첨삭 사용량을 상세하게 추적합니다.</p>
              <Button
                variant="outline"
                className="w-full text-blue-600 border-blue-200 hover:bg-blue-50 font-semibold"
                onClick={() => setLocation("/dashboard-detail")}
              >
                대시보드 바로가기 <ArrowRight className="w-4 h-4 ml-1" />
              </Button>
            </CardContent>
          </Card>

          {/* Card 2: Offline Vault */}
          <Card className="border-slate-200 shadow-sm hover:shadow-md transition-all">
            <CardHeader className="flex flex-row items-center justify-between pb-2 bg-slate-50/50 rounded-t-xl">
              <CardTitle className="text-base font-bold text-slate-900 flex items-center gap-2">
                <FileText className="w-5 h-5 text-indigo-600" /> 오프라인 보관함
              </CardTitle>
              <span className="text-xs font-semibold text-indigo-600 bg-indigo-50 px-2 py-1 rounded-full">임시 글 관리</span>
            </CardHeader>
            <CardContent className="pt-6 space-y-4">
              <div>
                <p className="text-xs text-slate-500">저장된 논술 원고</p>
                <p className="text-2xl font-extrabold text-slate-900 mt-1">
                  {offlineEssays.length}개 보관중
                </p>
              </div>
              <p className="text-xs text-slate-600">오프라인 상태에서도 글을 작성하고 온라인 시 자동 동기화합니다.</p>
              <Button
                variant="outline"
                className="w-full text-indigo-600 border-indigo-200 hover:bg-indigo-50 font-semibold"
                onClick={() => setLocation("/offline-essays")}
              >
                오프라인 보관함 열기 <ArrowRight className="w-4 h-4 ml-1" />
              </Button>
            </CardContent>
          </Card>

          {/* Card 3: Certificates */}
          <Card className="border-slate-200 shadow-sm hover:shadow-md transition-all">
            <CardHeader className="flex flex-row items-center justify-between pb-2 bg-slate-50/50 rounded-t-xl">
              <CardTitle className="text-base font-bold text-slate-900 flex items-center gap-2">
                <Award className="w-5 h-5 text-purple-600" /> 수료증
              </CardTitle>
              <span className="text-xs font-semibold text-purple-600 bg-purple-50 px-2 py-1 rounded-full">성취 인증</span>
            </CardHeader>
            <CardContent className="pt-6 space-y-4">
              <div>
                <p className="text-xs text-slate-500">발급된 수료증</p>
                <p className="text-2xl font-extrabold text-slate-900 mt-1">
                  {certificates.length}장 획득
                </p>
              </div>
              <p className="text-xs text-slate-600">과정 수료증을 미리보고, 고해상도 이미지·PDF 저장 및 소셜 공유를 하세요.</p>
              <Button
                variant="outline"
                className="w-full text-purple-600 border-purple-200 hover:bg-purple-50 font-semibold"
                onClick={() => setLocation("/certificate")}
              >
                수료증 센터 가기 <ArrowRight className="w-4 h-4 ml-1" />
              </Button>
            </CardContent>
          </Card>

          {/* Card 4: Mistake Notebook & Clinic */}
          <Card className="border-slate-200 shadow-sm hover:shadow-md transition-all">
            <CardHeader className="flex flex-row items-center justify-between pb-2 bg-slate-50/50 rounded-t-xl">
              <CardTitle className="text-base font-bold text-slate-900 flex items-center gap-2">
                <BookOpen className="w-5 h-5 text-rose-600" /> 오답 노트 & 복습 클리닉
              </CardTitle>
              <span className="text-xs font-semibold text-rose-600 bg-rose-50 px-2 py-1 rounded-full">취약점 분석</span>
            </CardHeader>
            <CardContent className="pt-6 space-y-4">
              <div>
                <p className="text-xs text-slate-500">워크북 오답 문항</p>
                <p className="text-2xl font-extrabold text-slate-900 mt-1">
                  자동 축적 및 복습
                </p>
              </div>
              <p className="text-xs text-slate-600">틀린 기출문제를 다시 풀고, AI가 추천하는 취약 영역 맞춤 문제를 풀어보세요.</p>
              <Button
                variant="outline"
                className="w-full text-rose-600 border-rose-200 hover:bg-rose-50 font-semibold"
                onClick={() => setLocation("/mistake-notebook")}
              >
                오답 노트 열기 <ArrowRight className="w-4 h-4 ml-1" />
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </DashboardLayout>
  );
}
