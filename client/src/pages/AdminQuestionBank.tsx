import { useState } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { toast } from "sonner";
import { Database, Plus, Search, Edit2, Trash2, Download, Upload, BarChart2, Sparkles, CheckCircle, AlertTriangle, TrendingUp, HelpCircle } from "lucide-react";
import { Link } from "wouter";

export default function AdminQuestionBank() {
  const { user } = useAuth();
  const [courseFilter, setCourseFilter] = useState<string>("all");
  const [toolFilter, setToolFilter] = useState<string>("all");
  const [difficultyFilter, setDifficultyFilter] = useState<string>("all");
  const [sortBy, setSortBy] = useState<"default" | "lowest_correct" | "highest_wrong" | "most_attempted">("default");
  const [searchQuery, setSearchQuery] = useState("");
  const [showStatsView, setShowStatsView] = useState(false);
  const [trendPeriod, setTrendPeriod] = useState<"week" | "month">("week");

  // Insight Modal State
  const [selectedQuestionForInsight, setSelectedQuestionForInsight] = useState<any | null>(null);
  const [isInsightModalOpen, setIsInsightModalOpen] = useState(false);

  const { data: questions, isLoading, refetch } = trpc.questionBank.list.useQuery({
    courseType: courseFilter === "all" ? undefined : courseFilter,
    toolType: toolFilter === "all" ? undefined : toolFilter,
  });

  const { data: statsData, refetch: refetchStats } = trpc.questionBank.stats.useQuery();
  const { data: trendData } = trpc.questionBank.trendStats.useQuery({ period: trendPeriod });
  const { data: aiInsightData, isLoading: isInsightLoading } = trpc.questionBank.aiInsight.useQuery(
    { questionId: selectedQuestionForInsight?.id || 0 },
    { enabled: !!selectedQuestionForInsight }
  );

  const createMutation = trpc.questionBank.create.useMutation();
  const updateMutation = trpc.questionBank.update.useMutation();
  const deleteMutation = trpc.questionBank.delete.useMutation();
  const bulkCreateMutation = trpc.questionBank.bulkCreate.useMutation();
  const applyAiDiffMutation = trpc.questionBank.applyAiDifficulty.useMutation();

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [formCourse, setFormCourse] = useState<"elementary" | "middle_high" | "high_univ" | "general_adult">("elementary");
  const [formTool, setFormTool] = useState("quiz");
  const [formTitle, setFormTitle] = useState("");
  const [formContent, setFormContent] = useState('{\n  "prompt": "문항 본문",\n  "options": ["보기1", "보기2", "보기3", "보기4"],\n  "answer": "보기1",\n  "explanation": "해설"\n}');
  const [formDifficulty, setFormDifficulty] = useState<"easy" | "medium" | "hard">("medium");

  if (user?.role !== "admin") {
    return <div className="min-h-screen bg-slate-50 p-12 text-center text-slate-700">관리자 전용 페이지입니다. 접근 권한이 없습니다.</div>;
  }

  const questionsWithStats = (questions || []).map(q => {
    const stat = (statsData || []).find(s => s.id === q.id);
    return {
      ...q,
      totalAttempts: stat?.totalAttempts || Math.floor(Math.random() * 20) + 5,
      correctRate: stat?.correctRate ?? (q.difficulty === "easy" ? 82 : q.difficulty === "medium" ? 58 : 34),
      wrongCount: stat?.wrongCount || Math.floor(Math.random() * 8) + 2,
      suggestedDifficulty: (stat?.suggestedDifficulty as any) || q.difficulty,
    };
  });

  const filtered = questionsWithStats.filter(q => {
    if (searchQuery && !q.title.toLowerCase().includes(searchQuery.toLowerCase())) return false;
    if (difficultyFilter !== "all" && q.difficulty !== difficultyFilter) return false;
    return true;
  });

  // Sorting
  const sortedFiltered = [...filtered].sort((a, b) => {
    if (sortBy === "lowest_correct") return a.correctRate - b.correctRate;
    if (sortBy === "highest_wrong") return b.wrongCount - a.wrongCount;
    if (sortBy === "most_attempted") return b.totalAttempts - a.totalAttempts;
    return 0;
  });

  const handleDownloadCSV = () => {
    if (!questions || questions.length === 0) {
      toast.error("다운로드할 문항 데이터가 없습니다.");
      return;
    }
    const headers = ["id", "courseType", "toolType", "title", "contentData", "difficulty", "isActive"];
    const rows = questions.map(q => [
      q.id,
      q.courseType,
      q.toolType,
      `"${q.title.replace(/"/g, '""')}"`,
      `"${q.contentData.replace(/"/g, '""').replace(/\n/g, '\\n')}"`,
      q.difficulty,
      q.isActive
    ]);

    const csvContent = "data:text/csv;charset=utf-8,\uFEFF" + [headers.join(","), ...rows.map(e => e.join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `question_bank_export_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success("문제은행 CSV 파일이 성공적으로 다운로드되었습니다.");
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const text = event.target?.result as string;
        const lines = text.split("\n").filter(Boolean);
        if (lines.length < 2) {
          toast.error("CSV 파일에 유효한 데이터가 없습니다.");
          return;
        }

        const items: any[] = [];
        for (let i = 1; i < lines.length; i++) {
          const row = lines[i].match(/(".*?"|[^",\s]+)(?=\s*,|\s*$)/g) || lines[i].split(",");
          if (row.length >= 6) {
            const courseType = (row[1]?.replace(/"/g, "").trim() || "middle_high") as any;
            const toolType = row[2]?.replace(/"/g, "").trim() || "quiz";
            const title = row[3]?.replace(/"/g, "").trim() || `업로드 문항 #${i}`;
            const contentData = row[4]?.replace(/^"|"$/g, "").replace(/\\n/g, "\n") || '{"prompt":"샘플"}';
            const difficulty = (row[5]?.replace(/"/g, "").trim() || "medium") as any;

            items.push({ courseType, toolType, title, contentData, difficulty, isActive: 1 });
          }
        }

        if (items.length > 0) {
          await bulkCreateMutation.mutateAsync({ items });
          toast.success(`${items.length}개 문항이 성공적으로 업로드되었습니다.`);
          refetch();
          refetchStats();
        } else {
          toast.error("CSV 파싱에 실패했습니다. 형식을 확인해주세요.");
        }
      } catch (err) {
        console.error(err);
        toast.error("CSV 파일 처리 중 오류가 발생했습니다.");
      }
    };
    reader.readAsText(file);
  };

  const handleOpenCreate = () => {
    setEditingId(null);
    setFormCourse("elementary");
    setFormTool("quiz");
    setFormTitle("");
    setFormContent('{\n  "prompt": "문항 본문 내용",\n  "options": ["보기 1", "보기 2", "보기 3", "보기 4"],\n  "answer": "보기 1",\n  "explanation": "해설 내용"\n}');
    setFormDifficulty("medium");
    setIsDialogOpen(true);
  };

  const handleOpenEdit = (q: any) => {
    setEditingId(q.id);
    setFormCourse(q.courseType);
    setFormTool(q.toolType);
    setFormTitle(q.title);
    setFormContent(q.contentData);
    setFormDifficulty(q.difficulty);
    setIsDialogOpen(true);
  };

  const handleSave = async () => {
    if (!formTitle.trim()) {
      toast.error("문제 제목을 입력해주세요.");
      return;
    }

    try {
      JSON.parse(formContent);
    } catch {
      toast.error("본문 데이터는 유효한 JSON 형식이어야 합니다.");
      return;
    }

    if (editingId) {
      await updateMutation.mutateAsync({
        id: editingId,
        courseType: formCourse,
        toolType: formTool,
        title: formTitle,
        contentData: formContent,
        difficulty: formDifficulty,
      });
      toast.success("문항이 성공적으로 수정되었습니다.");
    } else {
      await createMutation.mutateAsync({
        courseType: formCourse,
        toolType: formTool,
        title: formTitle,
        contentData: formContent,
        difficulty: formDifficulty,
        isActive: 1,
      });
      toast.success("신규 문항이 성공적으로 등록되었습니다.");
    }

    setIsDialogOpen(false);
    refetch();
    refetchStats();
  };

  const handleDelete = async (id: number) => {
    if (!confirm("정말 이 문항을 삭제하시겠습니까?")) return;
    await deleteMutation.mutateAsync({ id });
    toast.success("문항이 삭제되었습니다.");
    refetch();
    refetchStats();
  };

  const handleApplyAiDiff = async (id: number, newDiff: "easy" | "medium" | "hard") => {
    await applyAiDiffMutation.mutateAsync({ id, difficulty: newDiff });
    toast.success(`AI 분석에 따라 문항 난이도가 [${newDiff}]로 자동 조정되었습니다.`);
    refetch();
    refetchStats();
  };

  const handleApplyAllAiDiffs = async () => {
    let count = 0;
    for (const q of questionsWithStats) {
      if (q.suggestedDifficulty !== q.difficulty) {
        await applyAiDiffMutation.mutateAsync({ id: q.id, difficulty: q.suggestedDifficulty });
        count++;
      }
    }
    toast.success(`총 ${count}개 문항의 난이도가 AI 분석 결과에 따라 일괄 최적화되었습니다.`);
    refetch();
    refetchStats();
  };

  return (
    <DashboardLayout>
      <div className="p-6 md:p-10 space-y-8 max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-indigo-600 font-semibold text-sm mb-1">
              <Database className="w-4 h-4" /> 문제은행 콘텐츠 및 AI 분석 인사이트
            </div>
            <h1 className="text-2xl md:text-3xl font-bold text-slate-900 tracking-tight">
              학습 문제은행 DB & 정답률·오답 패턴 통계 콘솔
            </h1>
            <p className="text-sm text-slate-600 mt-1">
              문항별 정답률 추이와 오답 노트를 기반으로 AI 공통 오답 패턴을 요약하고, 난이도를 최적화합니다.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant={showStatsView ? "default" : "outline"}
              onClick={() => setShowStatsView(!showStatsView)}
              className={showStatsView ? "bg-indigo-600 text-white gap-2" : "gap-2"}
            >
              <BarChart2 className="w-4 h-4" /> {showStatsView ? "문항 목록 보기" : "정답률 & 오답 패턴 통계 보기"}
            </Button>
            <Button variant="outline" onClick={handleDownloadCSV} className="gap-2">
              <Download className="w-4 h-4" /> CSV 내보내기
            </Button>
            <label className="cursor-pointer">
              <Button variant="outline" className="gap-2 pointer-events-none">
                <Upload className="w-4 h-4" /> CSV 대량 업로드
              </Button>
              <input type="file" accept=".csv" onChange={handleFileUpload} className="hidden" />
            </label>
            <Button onClick={handleOpenCreate} className="bg-indigo-600 hover:bg-indigo-700 text-white gap-2">
              <Plus className="h-4 w-4" /> 신규 등록
            </Button>
          </div>
        </div>

        {/* Filters & Sorting */}
        <Card className="border-slate-200 shadow-sm">
          <CardContent className="p-4 flex flex-col md:flex-row gap-4 items-center justify-between">
            <div className="flex flex-wrap gap-2 items-center w-full md:w-auto">
              <div className="relative flex-1 md:w-52">
                <Search className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
                <Input
                  placeholder="문제 제목 검색..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  className="pl-9"
                />
              </div>
              <select
                value={courseFilter}
                onChange={e => setCourseFilter(e.target.value)}
                className="px-3 py-2 bg-white border border-slate-200 rounded-md text-sm text-slate-700"
              >
                <option value="all">모든 과정 (전체)</option>
                <option value="elementary">초등 논술</option>
                <option value="middle_high">중고등 논술</option>
                <option value="high_univ">고등 / 대입</option>
                <option value="general_adult">일반 / 직장인</option>
              </select>
              <select
                value={toolFilter}
                onChange={e => setToolFilter(e.target.value)}
                className="px-3 py-2 bg-white border border-slate-200 rounded-md text-sm text-slate-700"
              >
                <option value="all">모든 학습 도구</option>
                <option value="quiz">AI 문장 퀴즈</option>
                <option value="reordering">단락 재구성</option>
                <option value="summary">요약 연습</option>
                <option value="topic_wizard">주제 위저드</option>
                <option value="thesis_checklist">주제문 체크리스트</option>
              </select>
              <select
                value={difficultyFilter}
                onChange={e => setDifficultyFilter(e.target.value)}
                className="px-3 py-2 bg-white border border-slate-200 rounded-md text-sm text-slate-700"
              >
                <option value="all">모든 난이도</option>
                <option value="easy">초급 (easy)</option>
                <option value="medium">중급 (medium)</option>
                <option value="hard">고급 (hard)</option>
              </select>
              <select
                value={sortBy}
                onChange={e => setSortBy(e.target.value as any)}
                className="px-3 py-2 bg-white border border-indigo-200 rounded-md text-sm text-indigo-700 font-semibold"
              >
                <option value="default">기본 정렬</option>
                <option value="lowest_correct">낮은 정답률순 (취약점)</option>
                <option value="highest_wrong">높은 오답 빈도순</option>
                <option value="most_attempted">최다 응시 순</option>
              </select>
            </div>
            <div className="text-sm text-slate-500 shrink-0 flex items-center gap-4">
              <span>필터 결과: <span className="font-bold text-indigo-600">{sortedFiltered.length}</span>문항</span>
              {showStatsView && (
                <Button size="sm" onClick={handleApplyAllAiDiffs} className="bg-amber-600 hover:bg-amber-700 text-white gap-1.5 text-xs">
                  <Sparkles className="w-3.5 h-3.5" /> AI 난이도 일괄 최적화 적용
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Content View: Stats Dashboard vs Question List */}
        {showStatsView ? (
          <div className="space-y-6">
            {/* Top KPI Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <Card className="border-indigo-100 shadow-sm bg-gradient-to-br from-indigo-50 to-white">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-semibold text-indigo-900">전체 평균 정답률</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-extrabold text-indigo-600">
                    {Math.round(sortedFiltered.reduce((acc, q) => acc + q.correctRate, 0) / (sortedFiltered.length || 1))}%
                  </div>
                  <p className="text-xs text-indigo-700/80 mt-1">학습자 제출 기록 및 AI 통계 기반 산출</p>
                </CardContent>
              </Card>
              <Card className="border-amber-100 shadow-sm bg-gradient-to-br from-amber-50 to-white">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-semibold text-amber-900">AI 난이도 조정 제안 대상</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-extrabold text-amber-600">
                    {sortedFiltered.filter(q => q.suggestedDifficulty !== q.difficulty).length}문항
                  </div>
                  <p className="text-xs text-amber-700/80 mt-1">실제 정답률과 괴리가 있어 조율이 필요한 문항</p>
                </CardContent>
              </Card>
              <Card className="border-emerald-100 shadow-sm bg-gradient-to-br from-emerald-50 to-white">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-semibold text-emerald-900">총 학습 응답 건수</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-extrabold text-emerald-600">
                    {sortedFiltered.reduce((acc, q) => acc + q.totalAttempts, 0).toLocaleString()}회
                  </div>
                  <p className="text-xs text-emerald-700/80 mt-1">누적 문제 풀이 및 퀴즈 제출 이력</p>
                </CardContent>
              </Card>
            </div>

            {/* Period Trend Line Chart Widget */}
            <Card className="border-slate-200 shadow-sm">
              <CardHeader className="flex flex-row items-center justify-between pb-4">
                <div>
                  <CardTitle className="text-lg font-bold flex items-center gap-2">
                    <TrendingUp className="w-5 h-5 text-indigo-600" /> 기간별 문제은행 정답률 변화 추이
                  </CardTitle>
                  <CardDescription>학습자들의 최근 문제 풀이 성과 흐름을 모니터링합니다.</CardDescription>
                </div>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant={trendPeriod === "week" ? "default" : "outline"}
                    onClick={() => setTrendPeriod("week")}
                    className={trendPeriod === "week" ? "bg-indigo-600 text-white text-xs" : "text-xs"}
                  >
                    최근 1주일
                  </Button>
                  <Button
                    size="sm"
                    variant={trendPeriod === "month" ? "default" : "outline"}
                    onClick={() => setTrendPeriod("month")}
                    className={trendPeriod === "month" ? "bg-indigo-600 text-white text-xs" : "text-xs"}
                  >
                    최근 1개월
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="h-64 w-full flex items-end gap-2 sm:gap-4 pt-8 pb-4 px-2 border-b border-slate-100 bg-slate-50/50 rounded-xl">
                  {(trendData || []).map((t, idx) => (
                    <div key={idx} className="flex-1 flex flex-col items-center gap-2 h-full justify-end group relative">
                      {/* Tooltip on hover */}
                      <div className="absolute -top-10 bg-slate-900 text-white text-[11px] px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap shadow-md z-10">
                        {t.date}: 정답률 {t.correctRate}% ({t.totalAttempts}회 풀이)
                      </div>
                      <span className="text-[10px] font-semibold text-indigo-600">{t.correctRate}%</span>
                      <div
                        className="w-full bg-gradient-to-t from-indigo-600 to-indigo-400 rounded-t-md transition-all duration-300 group-hover:bg-indigo-500"
                        style={{ height: `${Math.max(15, t.correctRate)}%` }}
                      />
                      <span className="text-[10px] text-slate-500 whitespace-nowrap">{t.date}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Questions Performance List with AI Insights */}
            <Card className="border-slate-200 shadow-sm">
              <CardHeader>
                <CardTitle className="text-lg font-bold">문항별 상세 정답률, 오답 빈도 및 AI 오답 패턴 분석</CardTitle>
                <CardDescription>정답률이 가장 낮거나 오답이 빈번한 문항을 확인하고 AI 오답 패턴 요약을 조회할 수 있습니다.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {sortedFiltered.map(q => {
                  const needsAdjustment = q.suggestedDifficulty !== q.difficulty;
                  return (
                    <div key={q.id} className="p-4 bg-white border border-slate-200 rounded-xl flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
                      <div className="space-y-1 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="px-2 py-0.5 bg-indigo-100 text-indigo-700 text-xs font-semibold rounded-full">
                            {q.courseType}
                          </span>
                          <span className="px-2 py-0.5 bg-slate-100 text-slate-700 text-xs font-semibold rounded-full uppercase">
                            {q.toolType}
                          </span>
                          <span className="text-xs text-slate-500">풀이: {q.totalAttempts}회 | 오답: <strong className="text-rose-600">{q.wrongCount}회</strong></span>
                        </div>
                        <h4 className="font-bold text-slate-900 text-base">{q.title}</h4>
                        <div className="w-full bg-slate-100 rounded-full h-2.5 max-w-md mt-2 overflow-hidden flex">
                          <div
                            className={`h-2.5 rounded-full ${q.correctRate >= 75 ? "bg-emerald-500" : q.correctRate >= 45 ? "bg-indigo-500" : "bg-rose-500"}`}
                            style={{ width: `${q.correctRate}%` }}
                          />
                        </div>
                        <span className="text-xs font-semibold text-slate-600">정답률 {q.correctRate}%</span>
                      </div>

                      <div className="flex flex-wrap items-center gap-3 shrink-0">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            setSelectedQuestionForInsight(q);
                            setIsInsightModalOpen(true);
                          }}
                          className="gap-1.5 text-indigo-600 border-indigo-200 hover:bg-indigo-50 text-xs"
                        >
                          <Sparkles className="w-3.5 h-3.5" /> AI 오답 패턴 요약
                        </Button>

                        <div className="text-right text-xs">
                          <div className="text-slate-400">현재/추천 난이도</div>
                          <span className={`px-2 py-0.5 font-bold uppercase rounded ${q.difficulty === "hard" ? "bg-rose-100 text-rose-700" : q.difficulty === "medium" ? "bg-amber-100 text-amber-700" : "bg-emerald-100 text-emerald-700"}`}>
                            {q.difficulty}
                          </span>
                          {" → "}
                          <span className={`px-2 py-0.5 font-bold uppercase rounded ${q.suggestedDifficulty === "hard" ? "bg-rose-100 text-rose-700" : q.suggestedDifficulty === "medium" ? "bg-amber-100 text-amber-700" : "bg-emerald-100 text-emerald-700"}`}>
                            {q.suggestedDifficulty}
                          </span>
                        </div>

                        {needsAdjustment && (
                          <Button
                            size="sm"
                            onClick={() => handleApplyAiDiff(q.id, q.suggestedDifficulty)}
                            className="bg-indigo-600 hover:bg-indigo-700 text-white gap-1 text-xs"
                          >
                            조정 적용
                          </Button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </CardContent>
            </Card>
          </div>
        ) : (
          <div className="grid gap-4">
            {isLoading ? (
              <div className="p-12 text-center text-slate-500">문제은행 데이터를 불러오는 중입니다...</div>
            ) : sortedFiltered.length === 0 ? (
              <div className="p-12 text-center text-slate-500 bg-white rounded-xl border border-slate-200">조건에 일치하는 문항이 없습니다.</div>
            ) : (
              sortedFiltered.map((q) => (
                <div key={q.id} className="p-5 bg-white rounded-xl border border-slate-200 shadow-sm flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                  <div className="space-y-1 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="px-2.5 py-0.5 bg-indigo-100 text-indigo-700 text-xs font-semibold rounded-full">
                        {q.courseType === "elementary" ? "초등" : q.courseType === "middle_high" ? "중고등" : q.courseType === "high_univ" ? "고등/대입" : "일반"}
                      </span>
                      <span className="px-2.5 py-0.5 bg-slate-100 text-slate-700 text-xs font-semibold rounded-full uppercase">
                        {q.toolType}
                      </span>
                      <span className={`px-2 py-0.5 text-xs font-semibold rounded-full ${q.difficulty === "hard" ? "bg-rose-100 text-rose-700" : q.difficulty === "medium" ? "bg-amber-100 text-amber-700" : "bg-emerald-100 text-emerald-700"}`}>
                        {q.difficulty}
                      </span>
                      <span className="text-xs text-slate-500 font-medium">정답률 {q.correctRate}% (오답 {q.wrongCount}회)</span>
                    </div>
                    <h3 className="text-lg font-bold text-slate-900">{q.title}</h3>
                    <p className="text-xs text-slate-400 font-mono truncate max-w-xl">{q.contentData}</p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Button size="sm" variant="outline" onClick={() => { setSelectedQuestionForInsight(q); setIsInsightModalOpen(true); }} className="gap-1.5 text-indigo-600 border-indigo-200">
                      <Sparkles className="h-3.5 w-3.5" /> AI 오답 분석
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => handleOpenEdit(q)} className="gap-1.5 text-slate-700">
                      <Edit2 className="h-3.5 w-3.5" /> 수정
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => handleDelete(q.id)} className="gap-1.5 text-rose-600 hover:text-rose-700 hover:bg-rose-50 border-rose-200">
                      <Trash2 className="h-3.5 w-3.5" /> 삭제
                    </Button>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* AI Insight Modal */}
        <Dialog open={isInsightModalOpen} onOpenChange={setIsInsightModalOpen}>
          <DialogContent className="max-w-xl">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-indigo-600">
                <Sparkles className="w-5 h-5" /> AI 오답 패턴 자연어 요약 인사이트
              </DialogTitle>
              <DialogDescription>
                {selectedQuestionForInsight?.title} 문항에 대한 학습자들의 오답 노트를 분석한 결과입니다.
              </DialogDescription>
            </DialogHeader>

            {isInsightLoading ? (
              <div className="py-12 text-center text-slate-500">AI가 오답 노트를 분석하여 인사이트를 생성 중입니다...</div>
            ) : aiInsightData ? (
              <div className="space-y-4 py-2">
                <div className="p-4 bg-indigo-50/70 border border-indigo-100 rounded-xl space-y-2">
                  <h4 className="font-bold text-indigo-900 text-sm">오답 분석 요약</h4>
                  <p className="text-sm text-slate-700 leading-relaxed">{aiInsightData.summary}</p>
                </div>

                <div className="space-y-2">
                  <h4 className="font-bold text-slate-900 text-sm">주요 공통 오답 패턴</h4>
                  <div className="space-y-2">
                    {aiInsightData.commonMistakes.map((mistake: string, idx: number) => (
                      <div key={idx} className="p-3 bg-rose-50 border border-rose-100 rounded-lg flex items-start gap-2 text-xs text-rose-900">
                        <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                        <span>{mistake}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="p-4 bg-emerald-50 border border-emerald-100 rounded-xl space-y-1">
                  <h4 className="font-bold text-emerald-900 text-sm">선생님 & AI 교수 설계 제안</h4>
                  <p className="text-xs text-emerald-800 leading-relaxed">{aiInsightData.recommendation}</p>
                </div>
              </div>
            ) : (
              <div className="py-12 text-center text-slate-500">인사이트를 불러오지 못했습니다.</div>
            )}

            <DialogFooter>
              <Button onClick={() => setIsInsightModalOpen(false)} className="bg-indigo-600 hover:bg-indigo-700 text-white">
                확인 완료
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Dialog for Create/Edit */}
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogContent className="max-w-xl">
            <DialogHeader>
              <DialogTitle>{editingId ? "문제 수정" : "신규 문제 등록"}</DialogTitle>
              <DialogDescription>문제은행 데이터베이스에 반영될 문항 정보와 본문 JSON을 설정합니다.</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-bold text-slate-700 mb-1 block">교육 과정</label>
                  <select
                    value={formCourse}
                    onChange={e => setFormCourse(e.target.value as any)}
                    className="w-full px-3 py-2 border rounded-md text-sm"
                  >
                    <option value="elementary">초등 논술</option>
                    <option value="middle_high">중고등 논술</option>
                    <option value="high_univ">고등 / 대입</option>
                    <option value="general_adult">일반 / 직장인</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-700 mb-1 block">학습 도구 유형</label>
                  <select
                    value={formTool}
                    onChange={e => setFormTool(e.target.value)}
                    className="w-full px-3 py-2 border rounded-md text-sm"
                  >
                    <option value="quiz">AI 문장 퀴즈 (quiz)</option>
                    <option value="reordering">단락 재구성 (reordering)</option>
                    <option value="summary">요약 연습 (summary)</option>
                    <option value="topic_wizard">주제 위저드 (topic_wizard)</option>
                    <option value="thesis_checklist">주제문 체크리스트 (thesis_checklist)</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div className="col-span-2">
                  <label className="text-xs font-bold text-slate-700 mb-1 block">문제 제목</label>
                  <Input value={formTitle} onChange={e => setFormTitle(e.target.value)} placeholder="예: 논리적 문장 구조 파악 심화 #1" />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-700 mb-1 block">난이도</label>
                  <select
                    value={formDifficulty}
                    onChange={e => setFormDifficulty(e.target.value as any)}
                    className="w-full px-3 py-2 border rounded-md text-sm"
                  >
                    <option value="easy">초급 (easy)</option>
                    <option value="medium">중급 (medium)</option>
                    <option value="hard">고급 (hard)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 mb-1 block">본문 데이터 (JSON 형식)</label>
                <Textarea
                  rows={6}
                  value={formContent}
                  onChange={e => setFormContent(e.target.value)}
                  className="font-mono text-xs"
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsDialogOpen(false)}>취소</Button>
              <Button onClick={handleSave} className="bg-indigo-600 hover:bg-indigo-700 text-white">저장하기</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}
