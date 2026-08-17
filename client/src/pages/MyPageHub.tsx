import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { BarChart3, FileText, Award, User, BookOpen, ArrowRight, ShieldCheck, Sparkles } from "lucide-react";
import { useLocation } from "wouter";

export default function MyPageHub() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();

  const { data: progressList } = trpc.progress.getByUser.useQuery();
  const { data: offlineEssays = [] } = trpc.essaySubmission.getByUser.useQuery();
  const { data: certificates = [] } = trpc.certificate.getUserCertificates.useQuery();

  return (
    <DashboardLayout>
      <div className="p-6 md:p-10 space-y-8 max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 bg-gradient-to-r from-indigo-900 to-purple-900 text-white p-8 rounded-3xl shadow-xl">
          <div className="flex items-center gap-5">
            <div className="w-16 h-16 rounded-2xl bg-white/10 border border-white/20 flex items-center justify-center overflow-hidden">
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
                {user?.name || "사용자"}님의 마이페이지 허브
              </h1>
              <p className="text-xs md:text-sm text-indigo-200 mt-0.5">
                {user?.email} · 학습 대시보드, 오프라인 보관함, 수료증을 한눈에 관리하세요.
              </p>
            </div>
          </div>
          <Button
            onClick={() => setLocation("/dashboard")}
            className="bg-white text-indigo-900 hover:bg-indigo-50 font-bold gap-2 shadow-md"
          >
            상세 대시보드로 이동 <ArrowRight className="w-4 h-4" />
          </Button>
        </div>

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
                  {progressList?.filter((p: any) => p.isCompleted)?.length || 0}개 완료
                </p>
              </div>
              <p className="text-xs text-slate-600">과정별 진도율과 AI 첨삭 사용량을 상세하게 추적합니다.</p>
              <Button
                variant="outline"
                className="w-full text-blue-600 border-blue-200 hover:bg-blue-50 font-semibold"
                onClick={() => setLocation("/dashboard")}
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
        </div>
      </div>
    </DashboardLayout>
  );
}
