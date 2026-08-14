import { useState } from "react";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { GraduationCap, Users, FileEdit, Award, Search, CheckCircle, Clock } from "lucide-react";
import { Link } from "wouter";

export default function TeacherMyPage() {
  const { user, isAuthenticated } = useAuth();
  const [searchQuery, setSearchQuery] = useState("");

  const { data: adminStats, isLoading } = trpc.admin.getAnalytics.useQuery(undefined, {
    enabled: isAuthenticated && (user?.role === "teacher" || user?.role === "admin"),
  });

  if (!isAuthenticated) return <div className="p-12 text-center text-slate-600">로그인이 필요합니다.</div>;
  if (user?.role !== "teacher" && user?.role !== "admin") {
    return (
      <div className="mx-auto max-w-xl py-16 text-center">
        <GraduationCap className="mx-auto h-16 w-16 text-slate-300" />
        <h1 className="mt-4 text-2xl font-bold text-slate-900">교사 권한이 필요합니다</h1>
        <p className="mt-2 text-sm text-slate-600">교사회원으로 가입하거나 관리자 승인을 받은 계정만 교사 마이페이지를 이용할 수 있습니다.</p>
        <div className="mt-6 flex justify-center gap-4">
          <Link href="/teacher-signup"><Button className="bg-indigo-600 text-white hover:bg-indigo-700">교사 회원가입 하러 가기</Button></Link>
          <Link href="/"><Button variant="outline">홈으로 돌아가기</Button></Link>
        </div>
      </div>
    );
  }

  const teacherLevelNames: Record<number, string> = {
    1: "주니어 첨삭교사 (문장/단락 코멘트 권한)",
    2: "시니어 첨삭교사 (종합 평가 및 성취도 관리)",
    3: "수석 교사 (커리큘럼 조정 및 반 일괄 관리)",
  };

  const usersList = Array.isArray(adminStats?.users) ? adminStats.users : ((adminStats?.users as any)?.users || []);
  const students = usersList.filter((u: any) => u.role === "user");
  const filteredStudents = students.filter((s: any) => (s.name || "").toLowerCase().includes(searchQuery.toLowerCase()) || (s.email || "").toLowerCase().includes(searchQuery.toLowerCase()));

  return (
    <div className="min-h-screen bg-slate-50 px-4 py-8 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl space-y-8">
        <div className="flex flex-col gap-4 rounded-2xl bg-gradient-to-r from-indigo-700 to-blue-800 p-6 text-white shadow-lg sm:flex-row sm:items-center sm:justify-between sm:p-8">
          <div>
            <div className="flex items-center gap-2">
              <Badge className="bg-white/20 text-white hover:bg-white/30">교사 포털</Badge>
              <span className="text-xs text-indigo-200">Level {user.teacherLevel || 1} 권한</span>
            </div>
            <h1 className="mt-2 text-3xl font-bold">{user.name || "선생님"} 교사 마이페이지</h1>
            <p className="mt-1 text-sm text-indigo-100">{teacherLevelNames[user.teacherLevel || 1]}</p>
          </div>
          <div className="flex items-center gap-3">
            <Link href="/essay-submission"><Button variant="secondary" className="gap-2 bg-white text-indigo-900 hover:bg-indigo-50"><FileEdit className="h-4 w-4" /> 첨삭 관리 센터</Button></Link>
          </div>
        </div>

        <div className="grid gap-6 md:grid-cols-3">
          <Card className="border-indigo-100 bg-white shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between pb-2"><CardTitle className="text-sm font-medium text-slate-600">지도 학생 수</CardTitle><Users className="h-5 w-5 text-indigo-600" /></CardHeader>
            <CardContent><p className="text-3xl font-bold text-slate-900">{students.length}명</p><p className="text-xs text-slate-500 mt-1">배정된 전체 활성 학습자</p></CardContent>
          </Card>
          <Card className="border-blue-100 bg-white shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between pb-2"><CardTitle className="text-sm font-medium text-slate-600">첨삭 가능 권한</CardTitle><GraduationCap className="h-5 w-5 text-blue-600" /></CardHeader>
            <CardContent><p className="text-3xl font-bold text-slate-900">Level {user.teacherLevel || 1}</p><p className="text-xs text-slate-500 mt-1">문장 및 종합 피드백 부여 가능</p></CardContent>
          </Card>
          <Card className="border-emerald-100 bg-white shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between pb-2"><CardTitle className="text-sm font-medium text-slate-600">시스템 상태</CardTitle><CheckCircle className="h-5 w-5 text-emerald-600" /></CardHeader>
            <CardContent><p className="text-3xl font-bold text-emerald-600">정상 연동</p><p className="text-xs text-slate-500 mt-1">실시간 데이터베이스 연결됨</p></CardContent>
          </Card>
        </div>

        <Tabs defaultValue="students" className="space-y-6">
          <TabsList className="bg-white p-1 shadow-sm">
            <TabsTrigger value="students" className="gap-2"><Users className="h-4 w-4" /> 지도 학생 목록</TabsTrigger>
            <TabsTrigger value="guidelines" className="gap-2"><Award className="h-4 w-4" /> 교사 첨삭 가이드</TabsTrigger>
          </TabsList>

          <TabsContent value="students" className="space-y-6">
            <Card>
              <CardHeader>
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <CardTitle>지도 학생 관리 목록</CardTitle>
                    <CardDescription>담당 학생들의 가입일, 최근 접속일, 학습 진도를 한눈에 파악하고 개별 지도를 관리하세요.</CardDescription>
                  </div>
                  <div className="relative w-full sm:w-72">
                    <Search className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
                    <Input placeholder="학생 이름 또는 이메일 검색..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="pl-9" />
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <div className="py-12 text-center text-slate-500">학생 목록을 불러오는 중입니다...</div>
                ) : filteredStudents.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-slate-300 p-12 text-center text-slate-500">검색된 학생이 없습니다.</div>
                ) : (
                  <div className="divide-y divide-slate-100 overflow-x-auto">
                    <table className="w-full text-left text-sm">
                      <thead className="bg-slate-50 text-xs font-semibold uppercase text-slate-500">
                        <tr>
                          <th className="p-3">학생명</th>
                          <th className="p-3">이메일</th>
                          <th className="p-3">가입일</th>
                          <th className="p-3">최근 접속</th>
                          <th className="p-3 text-right">관리</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {filteredStudents.map((s: any) => (
                          <tr key={s.id} className="hover:bg-slate-50">
                            <td className="p-3 font-medium text-slate-900">{s.name || "익명 학생"}</td>
                            <td className="p-3 text-slate-600">{s.email || "이메일 없음"}</td>
                            <td className="p-3 text-slate-500">{new Date(s.createdAt).toLocaleDateString()}</td>
                            <td className="p-3 text-slate-500"><span className="flex items-center gap-1.5"><Clock className="h-3.5 w-3.5 text-slate-400" />{new Date(s.lastSignedIn).toLocaleDateString()}</span></td>
                            <td className="p-3 text-right"><Link href={`/admin/student/${s.id}`}><Button variant="outline" size="sm">상세 보기</Button></Link></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="guidelines" className="space-y-6">
            <Card>
              <CardHeader><CardTitle>교사 권한 레벨별 가이드</CardTitle><CardDescription>레벨에 따른 첨삭 및 시스템 접근 권한 설명입니다.</CardDescription></CardHeader>
              <CardContent className="space-y-4">
                <div className="rounded-xl border border-indigo-100 bg-indigo-50/50 p-4">
                  <h3 className="font-bold text-indigo-900">Level 1 · 주니어 첨삭교사</h3>
                  <p className="mt-1 text-sm text-slate-700">학생들이 제출한 논술 답안에 대해 문장별 단락 코멘트, 맞춤법 및 표현 교정 피드백을 작성할 수 있습니다.</p>
                </div>
                <div className="rounded-xl border border-blue-100 bg-blue-50/50 p-4">
                  <h3 className="font-bold text-blue-900">Level 2 · 시니어 첨삭교사</h3>
                  <p className="mt-1 text-sm text-slate-700">주니어 교사 권한을 포함하여 구조·논리·표현 영역별 종합 점수 부여 및 수료증 발급 검토 권한이 주어집니다.</p>
                </div>
                <div className="rounded-xl border border-purple-100 bg-purple-50/50 p-4">
                  <h3 className="font-bold text-purple-900">Level 3 · 수석 교사</h3>
                  <p className="mt-1 text-sm text-slate-700">모든 첨삭 권한과 함께 커리큘럼 난이도 조정, 반별 학생 일괄 배정 및 학습 분석 보고서 다운로드 권한을 가집니다.</p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
