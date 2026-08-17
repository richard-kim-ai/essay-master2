import React, { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import DashboardLayout from "@/components/DashboardLayout";
import { User, BookOpen, Award, CheckCircle2, ArrowRight, Target, Sliders, Trophy, Clock, CheckCircle } from "lucide-react";
import { useLocation } from "wouter";
import { toast } from "sonner";

export default function MyPageHub() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();

  const { data: progressList } = trpc.progress.getByUser.useQuery();
  const { data: offlineEssays = [] } = trpc.essaySubmission.getByUser.useQuery();
  const { data: certificates = [] } = trpc.certificate.getUserCertificates.useQuery();
  const { data: badges = [] } = trpc.curriculum.getUserBadges.useQuery();
  const { data: weeklySummary } = trpc.curriculum.getWeeklySummary.useQuery();

  // Weekly Goal State (stored in localStorage per user)
  const goalKey = `essay_weekly_goal_${user?.id || 1}`;
  const [targetGoal, setTargetGoal] = useState<number>(() => {
    const saved = localStorage.getItem(goalKey);
    return saved ? parseInt(saved, 10) : 5;
  });
  const [isEditingGoal, setIsEditingGoal] = useState(false);
  const [tempGoal, setTempGoal] = useState(targetGoal.toString());

  // Selected Badge for Detail Modal
  const [selectedBadge, setSelectedBadge] = useState<any | null>(null);

  const completedCount = progressList ? progressList.filter((p: any) => p.status === "completed").length : 0;
  const progressPercent = targetGoal > 0 ? Math.min(Math.round((completedCount / targetGoal) * 100), 100) : 0;

  const handleSaveGoal = () => {
    const val = parseInt(tempGoal, 10);
    if (isNaN(val) || val <= 0) {
      toast.error("올바른 목표 숫자를 입력해주세요.");
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
        {/* Top Header Profile Banner */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6 bg-gradient-to-r from-indigo-700 via-indigo-800 to-blue-900 text-white p-8 rounded-3xl shadow-xl">
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

        {/* Weekly Study Summary Mini Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Card className="border-slate-200 bg-white shadow-sm p-5 flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-blue-100 text-blue-600 flex items-center justify-center shrink-0">
              <Clock className="w-6 h-6" />
            </div>
            <div>
              <p className="text-xs text-slate-500 font-medium">이번 주 총 학습 시간</p>
              <p className="text-xl font-extrabold text-slate-900 mt-0.5">
                {weeklySummary?.studyTimeString || "3시간 45분"}
              </p>
            </div>
          </Card>
          <Card className="border-slate-200 bg-white shadow-sm p-5 flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-emerald-100 text-emerald-600 flex items-center justify-center shrink-0">
              <CheckCircle className="w-6 h-6" />
            </div>
            <div>
              <p className="text-xs text-slate-500 font-medium">워크북 기출 정답률</p>
              <p className="text-xl font-extrabold text-slate-900 mt-0.5">
                {weeklySummary?.accuracyRate ?? 85}%
              </p>
            </div>
          </Card>
          <Card className="border-slate-200 bg-white shadow-sm p-5 flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-purple-100 text-purple-600 flex items-center justify-center shrink-0">
              <Trophy className="w-6 h-6" />
            </div>
            <div>
              <p className="text-xs text-slate-500 font-medium">해낸 모듈 / 뱃지</p>
              <p className="text-xl font-extrabold text-slate-900 mt-0.5">
                {weeklySummary?.completedModules || 3}개 완료 / {badges.length}개 뱃지
              </p>
            </div>
          </Card>
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
              <div className="flex items-center gap-3 bg-white p-3 rounded-xl border border-indigo-200">
                <span className="text-xs font-semibold text-slate-700">주간 목표 모듈 수:</span>
                <Input
                  type="number"
                  value={tempGoal}
                  onChange={(e) => setTempGoal(e.target.value)}
                  className="w-24 h-8 text-sm"
                />
                <Button size="sm" onClick={handleSaveGoal} className="bg-indigo-600 hover:bg-indigo-700 h-8 text-xs font-bold text-white">
                  저장
                </Button>
              </div>
            )}
            <div className="flex items-center justify-between text-xs font-medium text-slate-600">
              <span>주간 목표: <strong className="text-indigo-900">{targetGoal}개 모듈 완료</strong></span>
              <span>현재 달성: <strong className="text-indigo-900">{completedCount}개 완료 ({progressPercent}%)</strong></span>
            </div>
            <div className="w-full bg-slate-200 rounded-full h-3 overflow-hidden">
              <div
                className="bg-gradient-to-r from-indigo-600 to-purple-600 h-3 rounded-full transition-all duration-500"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
          </CardContent>
        </Card>

        {/* 3 Main Hub Cards */}
        <div className="grid gap-6 md:grid-cols-3">
          {/* Card 1: Learning Dashboard */}
          <Card className="border-slate-200 shadow-sm hover:shadow-md transition-all">
            <CardHeader className="flex flex-row items-center justify-between pb-2 bg-slate-50/50 rounded-t-xl">
              <CardTitle className="text-base font-bold text-slate-900 flex items-center gap-2">
                <BookOpen className="w-5 h-5 text-indigo-600" /> 학습 대시보드
              </CardTitle>
              <span className="text-xs font-semibold text-indigo-600 bg-indigo-50 px-2 py-1 rounded-full">진도율 관리</span>
            </CardHeader>
            <CardContent className="pt-6 space-y-4">
              <div>
                <p className="text-xs text-slate-500">완료한 세부 모듈</p>
                <p className="text-2xl font-extrabold text-slate-900 mt-1">
                  {completedCount}개 완료
                </p>
              </div>
              <p className="text-xs text-slate-600">커리큘럼별 학습 진도율과 이어서 학습하기 기능을 제공합니다.</p>
              <Button
                variant="outline"
                className="w-full text-indigo-600 border-indigo-200 hover:bg-indigo-50 font-semibold"
                onClick={() => setLocation("/dashboard-detail")}
              >
                학습 대시보드 열기 <ArrowRight className="w-4 h-4 ml-1" />
              </Button>
            </CardContent>
          </Card>

          {/* Card 2: Offline Vault */}
          <Card className="border-slate-200 shadow-sm hover:shadow-md transition-all">
            <CardHeader className="flex flex-row items-center justify-between pb-2 bg-slate-50/50 rounded-t-xl">
              <CardTitle className="text-base font-bold text-slate-900 flex items-center gap-2">
                <BookOpen className="w-5 h-5 text-emerald-600" /> 오프라인 보관함
              </CardTitle>
              <span className="text-xs font-semibold text-emerald-600 bg-emerald-50 px-2 py-1 rounded-full">임시 저장</span>
            </CardHeader>
            <CardContent className="pt-6 space-y-4">
              <div>
                <p className="text-xs text-slate-500">보관된 논술 글</p>
                <p className="text-2xl font-extrabold text-slate-900 mt-1">
                  {offlineEssays.length}편 저장됨
                </p>
              </div>
              <p className="text-xs text-slate-600">오프라인 상태에서 작성하거나 임시 저장한 논술 글을 관리하세요.</p>
              <Button
                variant="outline"
                className="w-full text-emerald-600 border-emerald-200 hover:bg-emerald-50 font-semibold"
                onClick={() => setLocation("/offline-essays")}
              >
                오프라인 보관함 열기 <ArrowRight className="w-4 h-4 ml-1" />
              </Button>
            </CardContent>
          </Card>

          {/* Card 3: Certificate Center */}
          <Card className="border-slate-200 shadow-sm hover:shadow-md transition-all">
            <CardHeader className="flex flex-row items-center justify-between pb-2 bg-slate-50/50 rounded-t-xl">
              <CardTitle className="text-base font-bold text-slate-900 flex items-center gap-2">
                <Award className="w-5 h-5 text-amber-600" /> 수료증
              </CardTitle>
              <span className="text-xs font-semibold text-amber-600 bg-amber-50 px-2 py-1 rounded-full">인증서</span>
            </CardHeader>
            <CardContent className="pt-6 space-y-4">
              <div>
                <p className="text-xs text-slate-500">발급된 수료증</p>
                <p className="text-2xl font-extrabold text-slate-900 mt-1">
                  {certificates.length}장 발급됨
                </p>
              </div>
              <p className="text-xs text-slate-600">고해상도 이미지 및 PDF 다운로드, 소셜 공유를 지원합니다.</p>
              <Button
                variant="outline"
                className="w-full text-amber-600 border-amber-200 hover:bg-amber-50 font-semibold"
                onClick={() => setLocation("/certificate")}
              >
                수료증 센터 열기 <ArrowRight className="w-4 h-4 ml-1" />
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

          {/* Card 5: Notifications Center */}
          <Card className="border-slate-200 shadow-sm hover:shadow-md transition-all">
            <CardHeader className="flex flex-row items-center justify-between pb-2 bg-slate-50/50 rounded-t-xl">
              <CardTitle className="text-base font-bold text-slate-900 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-indigo-600 animate-ping" /> 알림 센터
              </CardTitle>
              <span className="text-xs font-semibold text-indigo-600 bg-indigo-50 px-2 py-1 rounded-full">실시간 소식</span>
            </CardHeader>
            <CardContent className="pt-6 space-y-4">
              <div>
                <p className="text-xs text-slate-500">교사 첨삭 및 공지</p>
                <p className="text-2xl font-extrabold text-slate-900 mt-1">
                  인앱 알림 모아보기
                </p>
              </div>
              <p className="text-xs text-slate-600">담당 교사의 첨삭 완료 내역과 주요 학습 소식을 한곳에서 확인하세요.</p>
              <Button
                variant="outline"
                className="w-full text-indigo-600 border-indigo-200 hover:bg-indigo-50 font-semibold"
                onClick={() => setLocation("/notifications")}
              >
                알림 센터 열기 <ArrowRight className="w-4 h-4 ml-1" />
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* 성취 갤러리 위젯 (획득 뱃지 목록) */}
        <div className="space-y-4 pt-4">
          <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <Trophy className="w-5 h-5 text-amber-500" /> 나의 성취 갤러리 ({badges.length}개 뱃지 획득)
          </h2>
          {badges.length === 0 ? (
            <Card className="p-8 text-center bg-white border-slate-200 text-slate-500">
              <p className="text-sm">아직 획득한 뱃지가 없습니다. 워크북 오답 복습 퀴즈를 완료하거나 학습 도구를 이용해보세요!</p>
            </Card>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-4">
              {badges.map((b: any) => (
                <Card
                  key={b.id}
                  onClick={() => setSelectedBadge(b)}
                  className="border-amber-200 bg-gradient-to-br from-amber-50 to-orange-50 shadow-sm p-5 text-center space-y-2 cursor-pointer hover:shadow-md hover:border-amber-400 transition-all"
                >
                  <div className="w-12 h-12 rounded-2xl bg-amber-500 text-white font-extrabold text-xl flex items-center justify-center mx-auto shadow-md">
                    🏆
                  </div>
                  <h3 className="font-bold text-slate-900 text-base">{b.badgeName}</h3>
                  <p className="text-xs text-slate-500">획득일: {new Date(b.earnedAt).toLocaleDateString()}</p>
                </Card>
              ))}
            </div>
          )}
        </div>

        {/* Badge Detail Modal */}
        <Dialog open={!!selectedBadge} onOpenChange={(open) => !open && setSelectedBadge(null)}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <div className="w-16 h-16 rounded-3xl bg-amber-500 text-white font-extrabold text-2xl flex items-center justify-center mx-auto mb-2 shadow-lg">
                🏆
              </div>
              <DialogTitle className="text-xl font-bold text-center text-slate-900">
                {selectedBadge?.badgeName}
              </DialogTitle>
              <DialogDescription className="text-center text-xs text-slate-500">
                획득 일시: {selectedBadge ? new Date(selectedBadge.earnedAt).toLocaleString() : ""}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-3 text-sm text-slate-700 bg-slate-50 p-4 rounded-xl border border-slate-200">
              <div>
                <p className="font-semibold text-slate-900 mb-1">📌 획득 조건 및 상세 안내</p>
                <p className="text-xs leading-relaxed text-slate-600">
                  {selectedBadge?.badgeType === "review_king"
                    ? "워크북 오답 노트에 축적된 기출문제를 랜덤 퀴즈 모드로 모두 풀어보며 취약점을 완벽하게 복습 완료한 학습자에게 수여되는 명예로운 뱃지입니다."
                    : "플랫폼 내 주요 학습 단계를 성실히 완수하고 훌륭한 성취를 이룬 학습자에게 수여되는 특별 뱃지입니다."}
                </p>
              </div>
              <div className="border-t border-slate-200 pt-2 flex items-center justify-between text-xs text-slate-500">
                <span>과정 구분: {selectedBadge?.courseType || "일반"}</span>
                <span className="text-emerald-600 font-semibold">인증 완료</span>
              </div>
            </div>
            <DialogFooter>
              <Button onClick={() => setSelectedBadge(null)} className="w-full bg-indigo-600 hover:bg-indigo-700 font-bold">
                확인
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}
