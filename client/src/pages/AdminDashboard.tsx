import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ShieldCheck, Settings, Users, BookOpen, ArrowRight, KeyRound, Download, Sliders, Eye, Search, Filter, FileText, Database, BarChart2 } from "lucide-react";
import { WeeklyReportPdfModal } from "@/components/WeeklyReportPdfModal";
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

  // Search and filter states
  const [searchQuery, setSearchQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState<string>("all");

  // Multi-select state
  const [selectedStudentIds, setSelectedStudentIds] = useState<number[]>([]);
  const [batchTag, setBatchTag] = useState("일반");
  const [batchEmailSubject, setBatchEmailSubject] = useState("");
  const [batchEmailBody, setBatchEmailBody] = useState("");
  const [batchEmailModalOpen, setBatchEmailModalOpen] = useState(false);
  const [weeklyReportModalOpen, setWeeklyReportModalOpen] = useState(false);

  const utils = trpc.useUtils();
  const updateBatchTagMutation = trpc.admin.updateBatchTag.useMutation({
    onSuccess: () => {
      toast.success("선택된 학생들의 태그가 일괄 변경되었습니다.");
      utils.admin.getAnalytics.invalidate();
    },
    onError: (err) => {
      toast.error(err.message || "태그 일괄 변경 중 오류가 발생했습니다.");
    }
  });

  const handleToggleSelectAll = () => {
    if (selectedStudentIds.length === filteredUsers.length) {
      setSelectedStudentIds([]);
    } else {
      setSelectedStudentIds(filteredUsers.map(u => u.id));
    }
  };

  const handleToggleSelectOne = (id: number) => {
    if (selectedStudentIds.includes(id)) {
      setSelectedStudentIds(selectedStudentIds.filter(item => item !== id));
    } else {
      setSelectedStudentIds([...selectedStudentIds, id]);
    }
  };

  const handleApplyBatchTag = (tag: string) => {
    if (selectedStudentIds.length === 0) {
      toast.error("선택된 학생이 없습니다.");
      return;
    }
    updateBatchTagMutation.mutate({ studentIds: selectedStudentIds, tag });
  };

  const handleSendBatchEmail = () => {
    if (selectedStudentIds.length === 0) {
      toast.error("선택된 학생이 없습니다.");
      return;
    }
    if (!batchEmailSubject || !batchEmailBody) {
      toast.error("제목과 내용을 모두 입력해주세요.");
      return;
    }
    toast.success(`선택된 ${selectedStudentIds.length}명의 학생에게 공지 이메일이 발송되었습니다.`);
    setBatchEmailModalOpen(false);
    setBatchEmailSubject("");
    setBatchEmailBody("");
    setSelectedStudentIds([]);
  };

  const filteredUsers = useMemo(() => {
    if (!analytics?.users.users) return [];
    return analytics.users.users.filter((u) => {
      const matchQuery =
        (u.name && u.name.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (u.email && u.email.toLowerCase().includes(searchQuery.toLowerCase())) ||
        String(u.id).includes(searchQuery);

      const matchRole = roleFilter === "all" || u.role === roleFilter;

      return matchQuery && matchRole;
    });
  }, [analytics?.users.users, searchQuery, roleFilter]);

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
          <div className="flex items-center gap-2">
            <Button onClick={handleExportCSV} size="sm" className="bg-emerald-600 hover:bg-emerald-700 text-white gap-1.5 text-xs">
              <Download className="w-3.5 h-3.5" /> CSV 내보내기
            </Button>
            <Button onClick={() => setWeeklyReportModalOpen(true)} size="sm" className="bg-blue-600 hover:bg-blue-700 text-white gap-1.5 text-xs">
              <FileText className="w-3.5 h-3.5" /> 주간 리포트(PDF)
            </Button>
          </div>
        </div>

        {/* Analytics Overview Cards with Interactive Tooltip & Hover Animation */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <Card className="border-slate-200 shadow-sm transition-all duration-300 hover:shadow-md hover:border-blue-300 hover:-translate-y-1 cursor-pointer group">
            <CardHeader className="pb-2">
              <CardTitle className="text-xs font-medium text-slate-500 uppercase tracking-wider group-hover:text-blue-600 transition">전체 가입 회원</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-extrabold text-slate-900 group-hover:scale-105 transition transform origin-left">
                {analyticsLoading ? "..." : analytics?.users.totalUsers || 0}명
              </div>
              <p className="text-xs text-slate-500 mt-1 flex items-center justify-between">
                <span>플랫폼 누적 가입 학습자</span>
                <span className="text-[10px] bg-slate-100 px-1.5 py-0.5 rounded text-slate-600">상세 보기</span>
              </p>
            </CardContent>
          </Card>

          <Card className="border-slate-200 shadow-sm transition-all duration-300 hover:shadow-md hover:border-blue-400 hover:-translate-y-1 cursor-pointer group">
            <CardHeader className="pb-2">
              <CardTitle className="text-xs font-medium text-slate-500 uppercase tracking-wider group-hover:text-blue-600 transition">오늘 활성 학습자</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-extrabold text-blue-600 group-hover:scale-105 transition transform origin-left">
                {analyticsLoading ? "..." : analytics?.users.activeToday || 0}명
              </div>
              <p className="text-xs text-slate-500 mt-1 flex items-center justify-between">
                <span>오늘 접속 및 학습 기록</span>
                <span className="text-[10px] bg-blue-50 px-1.5 py-0.5 rounded text-blue-600">실시간</span>
              </p>
            </CardContent>
          </Card>

          <Card className="border-slate-200 shadow-sm transition-all duration-300 hover:shadow-md hover:border-indigo-400 hover:-translate-y-1 cursor-pointer group">
            <CardHeader className="pb-2">
              <CardTitle className="text-xs font-medium text-slate-500 uppercase tracking-wider group-hover:text-indigo-600 transition">전체 논술 제출 및 첨삭</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-extrabold text-indigo-600 group-hover:scale-105 transition transform origin-left">
                {analyticsLoading ? "..." : analytics?.progress.totalSubmissions || 0}건
              </div>
              <p className="text-xs text-slate-500 mt-1 flex items-center justify-between">
                <span>누적 학습 진도 및 제출</span>
                <span className="text-[10px] bg-indigo-50 px-1.5 py-0.5 rounded text-indigo-600">평균 점수 {analytics?.progress.avgScore || 0}점</span>
              </p>
            </CardContent>
          </Card>

          <Card className="border-slate-200 shadow-sm transition-all duration-300 hover:shadow-md hover:border-sky-400 hover:-translate-y-1 cursor-pointer group">
            <CardHeader className="pb-2">
              <CardTitle className="text-xs font-medium text-slate-500 uppercase tracking-wider group-hover:text-sky-600 transition">AI 첨삭 공용 호출</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-extrabold text-sky-600 group-hover:scale-105 transition transform origin-left">
                {analyticsLoading ? "..." : analytics?.ai.totalCalls || 0}회
              </div>
              <p className="text-xs text-slate-500 mt-1 flex items-center justify-between">
                <span>누적 AI 자동 첨삭 호출</span>
                <span className="text-[10px] bg-sky-50 px-1.5 py-0.5 rounded text-sky-600">하이브리드 쿼터</span>
              </p>
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
                    <CardDescription>학생을 검색하고 클릭하여 상세 진도 및 메모를 관리하세요.</CardDescription>
                  </div>
                  <span className="text-xs bg-slate-100 text-slate-700 font-semibold px-2.5 py-1 rounded-full">
                    총 {filteredUsers.length}명 검색됨
                  </span>
                </div>

                {/* Search & Filter Bar */}
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
                    <SelectTrigger className="w-full sm:w-[150px] text-sm">
                      <Filter className="w-3.5 h-3.5 mr-2 text-slate-500" />
                      <SelectValue placeholder="권한 필터" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">모든 권한</SelectItem>
                      <SelectItem value="user">학습자</SelectItem>
                      <SelectItem value="admin">관리자</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Batch Actions Toolbar */}
                {selectedStudentIds.length > 0 && (
                  <div className="flex flex-wrap items-center justify-between gap-3 mt-4 p-3 bg-indigo-50 rounded-xl border border-indigo-200">
                    <span className="text-xs font-bold text-indigo-900">
                      {selectedStudentIds.length}명 선택됨
                    </span>
                    <div className="flex items-center gap-2">
                      <Select value={batchTag} onValueChange={(val) => { setBatchTag(val); handleApplyBatchTag(val); }}>
                        <SelectTrigger className="w-[120px] h-8 text-xs bg-white">
                          <SelectValue placeholder="태그 지정" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="일반">일반 태그</SelectItem>
                          <SelectItem value="우수학생">우수학생</SelectItem>
                          <SelectItem value="집중지도">집중지도</SelectItem>
                          <SelectItem value="수료예정">수료예정</SelectItem>
                        </SelectContent>
                      </Select>
                      <Button
                        size="sm"
                        variant="default"
                        className="h-8 text-xs bg-indigo-600 hover:bg-indigo-700 text-white"
                        onClick={() => setBatchEmailModalOpen(true)}
                      >
                        일괄 이메일 보내기
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-8 text-xs text-slate-600 bg-white"
                        onClick={() => setSelectedStudentIds([])}
                      >
                        선택 해제
                      </Button>
                    </div>
                  </div>
                )}
              </CardHeader>

              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-slate-200 text-xs font-semibold text-slate-500 uppercase bg-slate-50">
                        <th className="py-3 px-3 w-10 text-center">
                          <input
                            type="checkbox"
                            checked={filteredUsers.length > 0 && selectedStudentIds.length === filteredUsers.length}
                            onChange={handleToggleSelectAll}
                            className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                          />
                        </th>
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
                          <td colSpan={6} className="py-8 text-center text-sm text-slate-500">
                            검색 결과와 일치하는 학습자가 없습니다.
                          </td>
                        </tr>
                      ) : (
                        filteredUsers.map((u) => (
                          <tr key={u.id} className={`hover:bg-slate-50/60 transition ${selectedStudentIds.includes(u.id) ? 'bg-indigo-50/30' : ''}`}>
                            <td className="py-3 px-3 text-center">
                              <input
                                type="checkbox"
                                checked={selectedStudentIds.includes(u.id)}
                                onChange={() => handleToggleSelectOne(u.id)}
                                className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                              />
                            </td>
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

                {/* Curriculum Difficulty Distribution & Correct Rate Widget */}
                <CurriculumStatsWidget />
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

      {/* Weekly Report PDF Modal */}
      <WeeklyReportPdfModal open={weeklyReportModalOpen} onClose={() => setWeeklyReportModalOpen(false)} analyticsData={analytics} />

      {/* Batch Email Modal */}
      <Dialog open={batchEmailModalOpen} onOpenChange={setBatchEmailModalOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>선택된 학습자 일괄 이메일 발송</DialogTitle>
            <DialogDescription>
              총 <span className="font-bold text-indigo-600">{selectedStudentIds.length}명</span>의 학생에게 공지 또는 안내 이메일을 발송합니다.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1">이메일 제목</label>
              <Input
                placeholder="예: [논술 마스터] 이번 주 학습 과제 및 안내 사항"
                value={batchEmailSubject}
                onChange={(e) => setBatchEmailSubject(e.target.value)}
                className="text-sm"
              />
            </div>
            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1">이메일 내용</label>
              <textarea
                placeholder="학생들에게 전달할 안내 메시지를 입력하세요..."
                value={batchEmailBody}
                onChange={(e) => setBatchEmailBody(e.target.value)}
                className="w-full min-h-[120px] rounded-md border border-slate-200 p-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          </div>
          <DialogFooter className="flex gap-2 sm:justify-end">
            <Button variant="outline" onClick={() => setBatchEmailModalOpen(false)}>
              취소
            </Button>
            <Button className="bg-indigo-600 hover:bg-indigo-700 text-white" onClick={handleSendBatchEmail}>
              이메일 발송하기
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Optimized Admin Categories & Quick Management Section */}
      <div className="mt-12 pt-8 border-t border-slate-200 space-y-6">
        <div>
          <h2 className="text-xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <Sliders className="w-5 h-5 text-indigo-600" /> 관리자 전용 운영 카테고리 및 도구
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            수료증, 커리큘럼 카테고리, 문제은행, 총괄 콘솔 및 약관 설정을 한눈에 관리할 수 있습니다.
          </p>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
          <Link href="/admin/certificates">
            <div className="p-4 bg-white rounded-xl border border-slate-200 hover:border-indigo-400 hover:shadow-md transition-all cursor-pointer flex flex-col items-center text-center group">
              <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center mb-2 group-hover:scale-110 transition">
                <FileText className="w-5 h-5" />
              </div>
              <span className="font-bold text-slate-800 text-xs">수료증 관리</span>
              <span className="text-[10px] text-slate-400 mt-0.5">발급 및 취소</span>
            </div>
          </Link>

          <Link href="/admin/curriculum">
            <div className="p-4 bg-white rounded-xl border border-slate-200 hover:border-indigo-400 hover:shadow-md transition-all cursor-pointer flex flex-col items-center text-center group">
              <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center mb-2 group-hover:scale-110 transition">
                <BookOpen className="w-5 h-5" />
              </div>
              <span className="font-bold text-slate-800 text-xs">카테고리 관리</span>
              <span className="text-[10px] text-slate-400 mt-0.5">커리큘럼 및 과정</span>
            </div>
          </Link>

          <Link href="/admin/question-bank">
            <div className="p-4 bg-white rounded-xl border border-slate-200 hover:border-indigo-400 hover:shadow-md transition-all cursor-pointer flex flex-col items-center text-center group">
              <div className="w-10 h-10 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center mb-2 group-hover:scale-110 transition">
                <Database className="w-5 h-5" />
              </div>
              <span className="font-bold text-slate-800 text-xs">문제은행 관리</span>
              <span className="text-[10px] text-slate-400 mt-0.5">AI 출제 및 통계</span>
            </div>
          </Link>

          <Link href="/master-admin">
            <div className="p-4 bg-white rounded-xl border border-slate-200 hover:border-indigo-400 hover:shadow-md transition-all cursor-pointer flex flex-col items-center text-center group">
              <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center mb-2 group-hover:scale-110 transition">
                <Users className="w-5 h-5" />
              </div>
              <span className="font-bold text-slate-800 text-xs">총괄 콘솔</span>
              <span className="text-[10px] text-slate-400 mt-0.5">전체 사용자 통계</span>
            </div>
          </Link>

          <Link href="/parent-portal">
            <div className="p-4 bg-white rounded-xl border border-slate-200 hover:border-indigo-400 hover:shadow-md transition-all cursor-pointer flex flex-col items-center text-center group">
              <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center mb-2 group-hover:scale-110 transition">
                <ShieldCheck className="w-5 h-5" />
              </div>
              <span className="font-bold text-slate-800 text-xs">학부모 포털</span>
              <span className="text-[10px] text-slate-400 mt-0.5">학생 연동 관리</span>
            </div>
          </Link>

          <Link href="/admin/evaluation-models">
            <div className="p-4 bg-white rounded-xl border border-slate-200 hover:border-indigo-400 hover:shadow-md transition-all cursor-pointer flex flex-col items-center text-center group">
              <div className="w-10 h-10 rounded-xl bg-slate-100 text-slate-700 flex items-center justify-center mb-2 group-hover:scale-110 transition">
                <Settings className="w-5 h-5" />
              </div>
              <span className="font-bold text-slate-800 text-xs">평가 모델 관리</span>
              <span className="text-[10px] text-slate-400 mt-0.5">모델 활성화 및 우선순위</span>
            </div>
          </Link>

          <Link href="/admin/social-providers">
            <div className="p-4 bg-white rounded-xl border border-slate-200 hover:border-indigo-400 hover:shadow-md transition-all cursor-pointer flex flex-col items-center text-center group">
              <div className="w-10 h-10 rounded-xl bg-slate-100 text-slate-700 flex items-center justify-center mb-2 group-hover:scale-110 transition">
                <Settings className="w-5 h-5" />
              </div>
              <span className="font-bold text-slate-800 text-xs">약관 및 설정</span>
              <span className="text-[10px] text-slate-400 mt-0.5">소셜 키 및 정책</span>
            </div>
          </Link>
        </div>
      </div>
    </div>
  );
}

function CurriculumStatsWidget() {
  const { data: stats, isLoading } = trpc.questionBank.curriculumDifficultyStats.useQuery();

  if (isLoading) {
    return <div className="p-4 text-center text-xs text-slate-400">커리큘럼 통계 불러오는 중...</div>;
  }

  const courseNames: Record<string, string> = {
    elementary: "초등 논술",
    middle_high: "중고등 논술",
    high_univ: "고등 / 대입",
    general_adult: "일반 / 직장인",
  };

  return (
    <div className="space-y-4 pt-2">
      <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
        <BarChart2 className="w-3.5 h-3.5 text-indigo-600" /> 과정별 난이도 분포 및 평균 정답률
      </h4>
      <div className="space-y-3">
        {(stats || []).map((item) => (
          <div key={item.courseType} className="p-3 bg-white border border-slate-200 rounded-xl space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="font-bold text-slate-900">{courseNames[item.courseType] || item.courseType}</span>
              <span className="font-extrabold text-indigo-600">평균 정답률: {item.avgCorrectRate}%</span>
            </div>
            <div className="flex h-2 w-full bg-slate-100 rounded-full overflow-hidden">
              <div className="bg-emerald-500" style={{ width: `${item.total > 0 ? (item.easy / item.total) * 100 : 33}%` }} title="초급" />
              <div className="bg-amber-500" style={{ width: `${item.total > 0 ? (item.medium / item.total) * 100 : 33}%` }} title="중급" />
              <div className="bg-rose-500" style={{ width: `${item.total > 0 ? (item.hard / item.total) * 100 : 34}%` }} title="고급" />
            </div>
            <div className="flex items-center justify-between text-[10px] text-slate-500 pt-1">
              <span>총 {item.total}문항</span>
              <div className="flex gap-2">
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-emerald-500"></span>초급 {item.easy}</span>
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-amber-500"></span>중급 {item.medium}</span>
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-rose-500"></span>고급 {item.hard}</span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
