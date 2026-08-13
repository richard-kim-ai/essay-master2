import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ShieldCheck, Settings, Users, BookOpen, ArrowRight, KeyRound, Download, Sliders, Eye, Search, Filter, ArrowUpDown } from "lucide-react";
import { Link } from "wouter";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { useState, useMemo } from "react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export default function AdminDashboard() {
  const { user, loading } = useAuth();
  const isAdmin = user?.role === "admin";
  const { data: analytics, isLoading: analyticsLoading } = trpc.admin.getAnalytics.useQuery(undefined, {
    enabled: isAdmin,
  });

  const [difficultyMode, setDifficultyMode] = useState<"standard" | "advanced">("standard");
  const [pendingDifficulty, setPendingDifficulty] = useState<"standard" | "advanced" | null>(null);
  const [confirmModalOpen, setConfirmModalOpen] = useState(false);

  // Search, filter & sort states
  const [searchQuery, setSearchQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState<string>("all");
  const [sortBy, setSortBy] = useState<string>("recent"); // 'recent' | 'name' | 'id'

  const filteredUsers = useMemo(() => {
    if (!analytics?.users.users) return [];
    let list = analytics.users.users.filter((u) => {
      const matchQuery =
        (u.name && u.name.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (u.email && u.email.toLowerCase().includes(searchQuery.toLowerCase())) ||
        String(u.id).includes(searchQuery);

      const matchRole = roleFilter === "all" || u.role === roleFilter;

      return matchQuery && matchRole;
    });

    // Sorting
    return list.sort((a, b) => {
      if (sortBy === "recent") {
        const timeA = a.lastSignedIn ? new Date(a.lastSignedIn).getTime() : 0;
        const timeB = b.lastSignedIn ? new Date(b.lastSignedIn).getTime() : 0;
        return timeB - timeA;
      } else if (sortBy === "name") {
        const nameA = a.name || `사용자 #${a.id}`;
        const nameB = b.name || `사용자 #${b.id}`;
        return nameA.localeCompare(nameB);
      } else {
        return b.id - a.id;
      }
    });
  }, [analytics?.users.users, searchQuery, roleFilter, sortBy]);

  const handleExportCSV = () => {
    if (!analytics || !analytics.users.users.length) {
      toast.error("내보낼 학습자 데이터가 없습니다.");
      return;
    }

    const headers = ["ID", "이름", "이메일", "권한", "로그인방식", "가입일", "최근접속일"];
    const rows = analytics.users.users.map(u => [
      u.id,
      `"${u.name || '미설정'}"`,
      `"${u.email || '소셜계정'}"`,
      u.role,
      u.loginMethod,
      new Date(u.createdAt).toISOString().split('T')[0],
      u.lastSignedIn ? new Date(u.lastSignedIn).toISOString().split('T')[0] : '기록없음'
    ]);

    const csvContent = "data:text/csv;charset=utf-8,\uFEFF" + [headers.join(","), ...rows.map(e => e.join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `essay_master_students_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success("학습자 분석 데이터가 CSV 파일로 다운로드되었습니다.");
  };

  const handleDifficultyChangeRequest = (mode: "standard" | "advanced") => {
    if (difficultyMode === mode) return;
    setPendingDifficulty(mode);
    setConfirmModalOpen(true);
  };

  const confirmDifficultyChange = () => {
    if (pendingDifficulty) {
      setDifficultyMode(pendingDifficulty);
      toast.success(`커리큘럼 난이도가 '${pendingDifficulty === 'standard' ? '표준 (Standard)' : '심화 (Advanced)'}'(으)로 성공적으로 변경되었습니다.`);
    }
    setConfirmModalOpen(false);
    setPendingDifficulty(null);
  };

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
      <div className="mx-auto max-w-7xl">
        <div className="mb-8 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="rounded-2xl bg-blue-100 p-3 text-blue-700">
              <ShieldCheck className="h-8 w-8" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-slate-900">학습자 전체 분석 & 관리자 대시보드</h1>
              <p className="text-sm text-slate-600 mt-1">전체 학생 현황, AI 사용량 통계 및 커리큘럼 난이도를 총괄 관리합니다.</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Button onClick={handleExportCSV} size="sm" className="bg-emerald-600 hover:bg-emerald-700 text-white gap-2">
              <Download className="w-4 h-4" /> 학습자 데이터 내보내기 (CSV)
            </Button>
            <Link href="/admin/social-providers">
              <Button size="sm" variant="outline" className="gap-2">
                <Settings className="w-4 h-4" /> 설정
              </Button>
            </Link>
          </div>
        </div>

        {/* Analytics Overview Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <Card className="border-slate-200 shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-xs font-medium text-slate-500 uppercase tracking-wider">전체 가입 회원</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-extrabold text-slate-900">
                {analyticsLoading ? "..." : analytics?.users.totalUsers || 0}명
              </div>
              <p className="text-xs text-slate-500 mt-1">플랫폼 누적 가입 학습자</p>
            </CardContent>
          </Card>

          <Card className="border-slate-200 shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-xs font-medium text-slate-500 uppercase tracking-wider">오늘 활성 학습자</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-extrabold text-blue-600">
                {analyticsLoading ? "..." : analytics?.users.activeToday || 0}명
              </div>
              <p className="text-xs text-slate-500 mt-1">오늘 접속 및 학습 기록</p>
            </CardContent>
          </Card>

          <Card className="border-slate-200 shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-xs font-medium text-slate-500 uppercase tracking-wider">전체 논술 제출 및 첨삭</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-extrabold text-indigo-600">
                {analyticsLoading ? "..." : analytics?.progress.totalSubmissions || 0}건
              </div>
              <p className="text-xs text-slate-500 mt-1">누적 학습 진도 및 제출</p>
            </CardContent>
          </Card>

          <Card className="border-slate-200 shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-xs font-medium text-slate-500 uppercase tracking-wider">AI 첨삭 공용 호출</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-extrabold text-sky-600">
                {analyticsLoading ? "..." : analytics?.ai.totalCalls || 0}회
              </div>
              <p className="text-xs text-slate-500 mt-1">누적 AI 자동 첨삭 호출</p>
            </CardContent>
          </Card>
        </div>

        {/* Detailed Sections */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left 2 Cols: Student List & Stats */}
          <div className="lg:col-span-2 space-y-6">
            <Card className="border-slate-200">
              <CardHeader className="pb-4">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                  <div>
                    <CardTitle className="text-xl font-bold flex items-center gap-2">
                      <Users className="h-5 w-5 text-blue-600" />
                      <span>전체 학습자 현황 및 상세 관리</span>
                    </CardTitle>
                    <CardDescription>학생을 검색, 정렬 및 클릭하여 상세 진도와 메모를 관리하세요.</CardDescription>
                  </div>
                  <span className="text-xs bg-slate-100 text-slate-700 font-semibold px-2.5 py-1 rounded-full">
                    총 {filteredUsers.length}명 검색됨
                  </span>
                </div>

                {/* Search, Filter & Sort Bar */}
                <div className="flex flex-col sm:flex-row items-center gap-3 mt-4 pt-4 border-t border-slate-100">
                  <div className="relative flex-1 w-full">
                    <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                    <Input
                      placeholder="이름, 이메일 또는 ID로 검색..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-9 text-sm"
                    />
                  </div>
                  <Select value={roleFilter} onValueChange={setRoleFilter}>
                    <SelectTrigger className="w-full sm:w-[130px] text-sm">
                      <Filter className="w-3.5 h-3.5 mr-2 text-slate-500" />
                      <SelectValue placeholder="권한" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">모든 권한</SelectItem>
                      <SelectItem value="user">학습자</SelectItem>
                      <SelectItem value="admin">관리자</SelectItem>
                    </SelectContent>
                  </Select>

                  <Select value={sortBy} onValueChange={setSortBy}>
                    <SelectTrigger className="w-full sm:w-[140px] text-sm">
                      <ArrowUpDown className="w-3.5 h-3.5 mr-2 text-slate-500" />
                      <SelectValue placeholder="정렬 기준" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="recent">최근 접속일순</SelectItem>
                      <SelectItem value="name">이름순 (가나다)</SelectItem>
                      <SelectItem value="latest">최근 가입일순</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </CardHeader>

              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-slate-200 text-xs font-semibold text-slate-500 uppercase bg-slate-50">
                        <th className="py-3 px-4">ID / 이름</th>
                        <th className="py-3 px-4">이메일</th>
                        <th className="py-3 px-4">권한</th>
                        <th className="py-3 px-4">가입일</th>
                        <th className="py-3 px-4 text-right">상세보기</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-sm">
                      {filteredUsers.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="py-8 text-center text-sm text-slate-500">
                            검색 결과와 일치하는 학습자가 없습니다.
                          </td>
                        </tr>
                      ) : (
                        filteredUsers.map((u) => (
                          <tr key={u.id} className="hover:bg-slate-50/60 transition">
                            <td className="py-3 px-4 font-semibold text-slate-900">{u.name || `사용자 #${u.id}`}</td>
                            <td className="py-3 px-4 text-slate-600">{u.email || "소셜 로그인 계정"}</td>
                            <td className="py-3 px-4">
                              <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${u.role === 'admin' ? 'bg-purple-100 text-purple-800' : 'bg-blue-100 text-blue-800'}`}>
                                {u.role === 'admin' ? '관리자' : '학습자'}
                              </span>
                            </td>
                            <td className="py-3 px-4 text-slate-500 text-xs">{new Date(u.createdAt).toLocaleDateString()}</td>
                            <td className="py-3 px-4 text-right">
                              <Link href={`/admin/student/${u.id}`}>
                                <Button size="sm" variant="outline" className="h-8 gap-1 text-xs">
                                  <Eye className="w-3.5 h-3.5" /> 상세 보기
                                </Button>
                              </Link>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Right Col: Curriculum & Difficulty Management */}
          <div className="space-y-6">
            <Card className="border-slate-200">
              <CardHeader>
                <CardTitle className="text-lg font-bold flex items-center gap-2">
                  <Sliders className="h-5 w-5 text-indigo-600" />
                  <span>커리큘럼 및 난이도 관리</span>
                </CardTitle>
                <CardDescription>과정별 난이도 스펙 조절 및 업그레이드 설정</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-semibold text-slate-800">현재 난이도 프리셋</span>
                    <span className="text-xs bg-indigo-100 text-indigo-800 px-2 py-0.5 rounded font-bold uppercase">{difficultyMode}</span>
                  </div>
                  <p className="text-xs text-slate-600 leading-relaxed">
                    초등 및 중고등 과정의 AI 자동 첨삭 기준 및 워크북 레벨 난이도를 일괄 조절합니다.
                  </p>
                  <div className="grid grid-cols-2 gap-2 pt-2">
                    <Button
                      size="sm"
                      variant={difficultyMode === "standard" ? "default" : "outline"}
                      onClick={() => handleDifficultyChangeRequest("standard")}
                      className="text-xs"
                    >
                      표준 (Standard)
                    </Button>
                    <Button
                      size="sm"
                      variant={difficultyMode === "advanced" ? "default" : "outline"}
                      onClick={() => handleDifficultyChangeRequest("advanced")}
                      className="text-xs"
                    >
                      심화 (Advanced)
                    </Button>
                  </div>
                </div>

                <div className="p-4 bg-blue-50/50 rounded-xl border border-blue-100 space-y-3">
                  <div className="flex items-center gap-2 text-blue-900 font-semibold text-sm">
                    <BookOpen className="h-4 w-4 text-blue-600" />
                    <span>커리큘럼 확장 가이드</span>
                  </div>
                  <p className="text-xs text-blue-700 leading-relaxed">
                    새로운 레슨이나 주제를 추가하려면 서버 측 <code className="bg-white px-1 py-0.5 rounded text-blue-900 font-mono">CURRICULUM_DATA</code> 및 <code className="bg-white px-1 py-0.5 rounded text-blue-900 font-mono">WORKBOOK_CONTENT</code> 구조를 확장하세요.
                  </p>
                  <Link href="/curriculum">
                    <Button size="sm" className="w-full bg-blue-600 hover:bg-blue-700 text-xs text-white">
                      실제 커리큘럼 화면 확인하기
                    </Button>
                  </Link>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      {/* Difficulty Change Confirmation Modal */}
      <Dialog open={confirmModalOpen} onOpenChange={setConfirmModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>커리큘럼 난이도 변경 확인</DialogTitle>
            <DialogDescription>
              난이도를 <span className="font-bold text-indigo-600 uppercase">{pendingDifficulty}</span> 프리셋으로 변경하시겠습니까? 전체 학습자들의 AI 첨삭 기준과 워크북 문제 수준에 즉시 반영됩니다.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex gap-2 sm:justify-end">
            <Button variant="outline" onClick={() => setConfirmModalOpen(false)}>
              취소
            </Button>
            <Button className="bg-indigo-600 hover:bg-indigo-700 text-white" onClick={confirmDifficultyChange}>
              변경 적용하기
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
