import React from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ShieldCheck, Settings, Users, BookOpen, Bell, ArrowRight, KeyRound } from "lucide-react";
import { Link } from "wouter";
import { useAuth } from "@/_core/hooks/useAuth";

export default function AdminDashboard() {
  const { user, loading } = useAuth();
  const isAdmin = user?.role === "admin";

  if (loading) {
    return <div className="min-h-screen bg-slate-50 p-12 text-center text-slate-600">권한을 확인하는 중입니다...</div>;
  }

  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-slate-50 px-4 py-20">
        <Card className="mx-auto max-w-md p-8 text-center shadow-md">
          <ShieldCheck className="mx-auto h-12 w-12 text-amber-500 mb-4" />
          <h1 className="text-2xl font-bold text-slate-900">관리자 전용 페이지</h1>
          <p className="mt-3 text-sm text-slate-600 leading-relaxed">
            이 페이지는 시스템 관리자만 접근할 수 있습니다. 관리자 계정으로 로그인하거나 권한을 요청해주세요.
          </p>
          <div className="mt-6 flex flex-col gap-3">
            <Button onClick={() => window.location.href = "/login"} className="w-full bg-blue-600 hover:bg-blue-700">
              로그인 화면으로 이동
            </Button>
            <Link href="/">
              <Button variant="outline" className="w-full">홈으로 돌아가기</Button>
            </Link>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 px-4 py-8 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-5xl">
        <div className="mb-8 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="rounded-2xl bg-blue-100 p-3 text-blue-700">
              <ShieldCheck className="h-8 w-8" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-slate-900">시스템 관리자 대시보드</h1>
              <p className="text-sm text-slate-600 mt-1">소셜 로그인 설정, VAPID 푸시 키 및 플랫폼 운영 상태를 관리합니다.</p>
            </div>
          </div>
          <div className="text-right hidden sm:block">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800">
              <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" /> 관리자 권한 활성화됨
            </span>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <Card className="hover:shadow-md transition border-slate-200">
            <CardHeader className="pb-3">
              <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center mb-2">
                <KeyRound className="h-5 w-5" />
              </div>
              <CardTitle className="text-lg font-bold">소셜 로그인 & 푸시 설정</CardTitle>
              <CardDescription className="text-xs">Google, Kakao, 네이버 및 Web Push VAPID 키 관리</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-slate-600 mb-4">소셜 로그인 클라이언트 시크릿 및 푸시 알림 키를 안전하게 입력하고 관리합니다.</p>
              <Link href="/admin/social-providers">
                <Button className="w-full gap-2 bg-indigo-600 hover:bg-indigo-700 text-sm">
                  설정 관리하기 <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
            </CardContent>
          </Card>

          <Card className="hover:shadow-md transition border-slate-200">
            <CardHeader className="pb-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center mb-2">
                <Users className="h-5 w-5" />
              </div>
              <CardTitle className="text-lg font-bold">학습자 현황 및 관리</CardTitle>
              <CardDescription className="text-xs">가입 회원 및 학습 진도 통계</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-slate-600 mb-4">플랫폼에 가입한 학생들의 학습 통계 및 제출된 논술 현황을 모니터링합니다.</p>
              <Link href="/dashboard">
                <Button variant="outline" className="w-full gap-2 text-sm">
                  대시보드 보기 <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
            </CardContent>
          </Card>

          <Card className="hover:shadow-md transition border-slate-200">
            <CardHeader className="pb-3">
              <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center mb-2">
                <BookOpen className="h-5 w-5" />
              </div>
              <CardTitle className="text-lg font-bold">커리큘럼 및 워크북</CardTitle>
              <CardDescription className="text-xs">초등/중고등 교육과정 관리</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-slate-600 mb-4">단계별 커리큘럼과 워크북 레슨 내용을 검토하고 테스트할 수 있습니다.</p>
              <Link href="/curriculum">
                <Button variant="outline" className="w-full gap-2 text-sm">
                  커리큘럼 확인 <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
