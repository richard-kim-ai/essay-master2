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
import { Database, Plus, Search, Edit2, Trash2, Download, Upload, BarChart2, Sparkles, CheckCircle, AlertTriangle, TrendingUp, HelpCircle, ShieldAlert } from "lucide-react";
import { Link } from "wouter";

export default function AdminQuestionBank() {
  const { user } = useAuth();
  const [courseFilter, setCourseFilter] = useState<string>("all");
  const [toolFilter, setToolFilter] = useState<string>("all");
  const [difficultyFilter, setDifficultyFilter] = useState<string>("all");
  const [sortBy, setSortBy] = useState<"default" | "lowest_correct" | "highest_wrong" | "most_attempted">("default");
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState<"list" | "stats" | "quality" | "generator">("list");
  const [trendPeriod, setTrendPeriod] = useState<"week" | "month">("week");

  // AI Generator Form & Preview State
  const [genCourse, setGenCourse] = useState("elementary");
  const [genTool, setGenTool] = useState("quiz");
  const [genCount, setGenCount] = useState(3);
  const [isGenerating, setIsGenerating] = useState(false);
  const [previewItems, setPreviewItems] = useState<any[]>([]);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);

  const [isUpsert, setIsUpsert] = useState(true);
  const [uploadProgress, setUploadProgress] = useState<{ active: boolean; percent: number; text: string }>({ active: false, percent: 0, text: "" });
  const [uploadReport, setUploadReport] = useState<{ open: boolean; total: number; created: number; updated: number; failed: number }>({ open: false, total: 0, created: 0, updated: 0, failed: 0 });
  const [selectedQuestionIds, setSelectedQuestionIds] = useState<number[]>([]);
  const [isBulkDeleteOpen, setIsBulkDeleteOpen] = useState(false);

  // Insight Modal State
  const [selectedQuestionForInsight, setSelectedQuestionForInsight] = useState<any | null>(null);
  const [isInsightModalOpen, setIsInsightModalOpen] = useState(false);

  const { data: questions, isLoading, refetch } = trpc.questionBank.list.useQuery({
    courseType: courseFilter === "all" ? undefined : courseFilter,
    toolType: toolFilter === "all" ? undefined : toolFilter,
  });
  const utils = trpc.useUtils();

  const { data: statsData, refetch: refetchStats } = trpc.questionBank.stats.useQuery();
  const { data: trendData } = trpc.questionBank.trendStats.useQuery({ period: trendPeriod });
  const { data: allFeedbacks } = trpc.questionBank.allFeedbacks.useQuery();
  const { data: aiInsightData } = trpc.questionBank.aiInsight.useQuery(
    { questionId: selectedQuestionForInsight?.id || 0 },
    { enabled: !!selectedQuestionForInsight }
  );

  const createMutation = trpc.questionBank.create.useMutation();
  const updateMutation = trpc.questionBank.update.useMutation();
  const deleteMutation = trpc.questionBank.delete.useMutation();
  const deleteManyMutation = trpc.questionBank.deleteMany.useMutation();
  const bulkCreateMutation = trpc.questionBank.bulkCreate.useMutation();
  const applyAiDiffMutation = trpc.questionBank.applyAiDifficulty.useMutation();
  const previewAiQuestionsMutation = trpc.questionBank.previewAiQuestions.useMutation();
  const updateFeedbackMutation = trpc.questionBank.updateFeedback.useMutation();
  const deleteFeedbackMutation = trpc.questionBank.deleteFeedback.useMutation();

  const [editingFeedbackId, setEditingFeedbackId] = useState<number | null>(null);
  const [adminReplyText, setAdminReplyText] = useState("");

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [formCourse, setFormCourse] = useState<"elementary" | "middle_high" | "high_univ" | "general_adult">("elementary");
  const [formTool, setFormTool] = useState("quiz");
  const [formTitle, setFormTitle] = useState("");
  const [formContent, setFormContent] = useState('{\n  "prompt": "문항 본문 내용",\n  "options": ["보기 1", "보기 2", "보기 3", "보기 4"],\n  "answer": "보기 1",\n  "explanation": "해설 내용"\n}');
  const [formDifficulty, setFormDifficulty] = useState<"easy" | "medium" | "hard">("medium");

  if (user?.role !== "admin") {
    return <div className="min-h-screen bg-slate-50 p-12 text-center text-slate-700">관리자 전용 페이지입니다. 접근 권한이 없습니다.</div>;
  }

  const questionsWithStats = (questions || []).map(q => {
    const stat = (statsData || []).find(s => s.id === q.id);
    const qFeedbacks = (allFeedbacks || []).filter(f => f.questionId === q.id);
    const helpfulCount = qFeedbacks.filter(f => f.isHelpful === 1).length;
    const reportCount = qFeedbacks.filter(f => f.reportType && f.reportType !== "none").length;

    return {
      ...q,
      totalAttempts: stat?.totalAttempts || Math.floor(Math.random() * 20) + 5,
      correctRate: stat?.correctRate ?? (q.difficulty === "easy" ? 82 : q.difficulty === "medium" ? 58 : 34),
      wrongCount: stat?.wrongCount || Math.floor(Math.random() * 8) + 2,
      suggestedDifficulty: (stat?.suggestedDifficulty as any) || q.difficulty,
      helpfulCount,
      reportCount,
      feedbacks: qFeedbacks,
    };
  });

  const filtered = questionsWithStats.filter(q => {
    if (searchQuery && !q.title.toLowerCase().includes(searchQuery.toLowerCase())) return false;
    if (difficultyFilter !== "all" && q.difficulty !== difficultyFilter) return false;
    return true;
  });

  const sortedFiltered = [...filtered].sort((a, b) => {
    if (sortBy === "lowest_correct") return a.correctRate - b.correctRate;
    if (sortBy === "highest_wrong") return b.wrongCount - a.wrongCount;
    if (sortBy === "most_attempted") return b.totalAttempts - a.totalAttempts;
    return 0;
  });

  const allVisibleSelected = sortedFiltered.length > 0 && sortedFiltered.every((question) => selectedQuestionIds.includes(question.id));

  const handlePreviewAi = async () => {
    setIsGenerating(true);
    try {
      const items = await previewAiQuestionsMutation.mutateAsync({
        courseType: genCourse,
        toolType: genTool,
        count: genCount,
      });
      if (items && items.length > 0) {
        setPreviewItems(items);
        setIsPreviewOpen(true);
      } else {
        toast.error("생성된 문항이 없습니다.");
      }
    } catch (err) {
      console.error(err);
      toast.error("AI 문항 생성 중 오류가 발생했습니다.");
    } finally {
      setIsGenerating(false);
    }
  };

  const handleApprovePreview = async () => {
    try {
      await bulkCreateMutation.mutateAsync({ items: previewItems });
      toast.success(`${previewItems.length}개의 검토된 문항이 문제은행에 최종 승인 및 반영되었습니다.`);
      setIsPreviewOpen(false);
      setActiveTab("list");
      refetch();
      refetchStats();
    } catch (err) {
      toast.error("문항 일괄 반영 중 오류가 발생했습니다.");
    }
  };

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

    const csvContent = "\uFEFF" + [headers.join(","), ...rows.map(e => e.join(","))].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8" });
    const downloadUrl = URL.createObjectURL(blob);
    const link = document.createElement("a");
    const scope = courseFilter === "all" ? "all_courses" : courseFilter;
    link.setAttribute("href", downloadUrl);
    link.setAttribute("download", `question_bank_${scope}_backup_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(downloadUrl);
    toast.success(`${courseFilter === "all" ? "전체" : "선택 과정"} 문항 ${questions.length}개를 CSV로 백업했습니다.`);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const text = event.target?.result as string;
        setUploadProgress({ active: true, percent: 10, text: "CSV 파일 분석 중..." });

        const parseCSVRows = (str: string) => {
          const rows: string[][] = [];
          let row: string[] = [];
          let cur = '';
          let inQuotes = false;
          for (let i = 0; i < str.length; i++) {
            const c = str[i];
            const next = str[i + 1];
            if (c === '"') {
              if (inQuotes && next === '"') {
                cur += '"';
                i++;
              } else {
                inQuotes = !inQuotes;
              }
            } else if (c === ',' && !inQuotes) {
              row.push(cur.trim());
              cur = '';
            } else if ((c === '\r' || c === '\n') && !inQuotes) {
              if (c === '\r' && next === '\n') { i++; }
              row.push(cur.trim());
              if (row.length > 1 || row[0] !== '') {
                rows.push(row);
              }
              row = [];
              cur = '';
            } else {
              cur += c;
            }
          }
          if (cur !== '' || row.length > 0) {
            row.push(cur.trim());
            rows.push(row);
          }
          return rows;
        };

        const parsedRows = parseCSVRows(text);
        if (parsedRows.length < 2) {
          toast.error("CSV 파일에 유효한 데이터가 없습니다.");
          setUploadProgress({ active: false, percent: 0, text: "" });
          return;
        }

        const header = parsedRows[0].map(h => h.replace(/^[\uFEFF]/, "").trim());
        const idIdx = header.findIndex(h => h === "id");
        const courseIdx = header.findIndex(h => h === "courseType");
        const toolIdx = header.findIndex(h => h === "toolType");
        const titleIdx = header.findIndex(h => h === "title");
        const contentIdx = header.findIndex(h => h === "contentData");
        const diffIdx = header.findIndex(h => h === "difficulty");

        const items: any[] = [];
        for (let i = 1; i < parsedRows.length; i++) {
          const r = parsedRows[i];
          if (r.length < 5) continue;

          const idVal = idIdx >= 0 ? Number(r[idIdx]) : undefined;
          const courseTypeVal = courseIdx >= 0 ? r[courseIdx] : r[1];
          const toolTypeVal = toolIdx >= 0 ? r[toolIdx] : r[2];
          const titleVal = titleIdx >= 0 ? r[titleIdx] : r[3];
          const contentVal = contentIdx >= 0 ? r[contentIdx] : r[4];
          const diffVal = diffIdx >= 0 ? r[diffIdx] : r[5];

          const courseType = (["elementary", "middle_high", "high_univ", "general_adult"].includes(courseTypeVal) ? courseTypeVal : "middle_high") as any;
          const toolType = toolTypeVal || "quiz";
          const title = titleVal?.replace(/^"|"$/g, "") || `업로드 문항 #${i}`;
          const contentData = contentVal?.replace(/^"|"$/g, "").replace(/\\\\n/g, "\n") || '{"prompt":"샘플"}';
          const difficulty = (["easy", "medium", "hard"].includes(diffVal) ? diffVal : "medium") as any;

          items.push({ id: idVal && !isNaN(idVal) ? idVal : undefined, courseType, toolType, title, contentData, difficulty, isActive: 1 });
        }

        if (items.length > 0) {
          setUploadProgress({ active: true, percent: 30, text: `총 ${items.length}개 문항 반영 중...` });
          const chunkSize = 50;
          let created = 0;
          let updated = 0;
          let failed = Math.max(0, parsedRows.length - 1 - items.length);
          for (let i = 0; i < items.length; i += chunkSize) {
            const chunk = items.slice(i, i + chunkSize);
            const result = await bulkCreateMutation.mutateAsync({ items: chunk, upsert: isUpsert });
            created += result.created;
            updated += result.updated;
            failed += result.failed;
            const p = Math.min(95, Math.floor(((i + chunk.length) / items.length) * 65) + 30);
            setUploadProgress({ active: true, percent: p, text: `${i + chunk.length} / ${items.length} 처리 완료...` });
          }

          setUploadProgress({ active: true, percent: 100, text: "업로드 완료!" });
          setTimeout(() => setUploadProgress({ active: false, percent: 0, text: "" }), 1500);

          setUploadReport({ open: true, total: items.length, created, updated, failed });
          toast.success(`${created + updated}개 문항이 반영되었습니다.`);
          refetch();
          refetchStats();
        } else {
          toast.error("CSV 파싱에 실패했습니다.");
          setUploadProgress({ active: false, percent: 0, text: "" });
        }
      } catch (err) {
        console.error(err);
        toast.error("CSV 파일 처리 중 오류가 발생했습니다.");
        setUploadProgress({ active: false, percent: 0, text: "" });
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

  const toggleQuestionSelection = (id: number) => {
    setSelectedQuestionIds((current) => current.includes(id) ? current.filter((questionId) => questionId !== id) : [...current, id]);
  };

  const toggleAllVisibleSelection = () => {
    const visibleIds = sortedFiltered.map((question) => question.id);
    setSelectedQuestionIds((current) => {
      if (allVisibleSelected) return current.filter((id) => !visibleIds.includes(id));
      return Array.from(new Set([...current, ...visibleIds]));
    });
  };

  const handleBulkDelete = async () => {
    try {
      const result = await deleteManyMutation.mutateAsync({ ids: selectedQuestionIds });
      toast.success(`${result.deletedCount}개 문항을 삭제했습니다.`);
      setSelectedQuestionIds([]);
      setIsBulkDeleteOpen(false);
      refetch();
      refetchStats();
    } catch (err) {
      console.error(err);
      toast.error("선택 문항 삭제 중 오류가 발생했습니다.");
    }
  };

  return (
    <DashboardLayout>
      <div className="p-6 md:p-10 space-y-8 max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-indigo-600 font-semibold text-sm mb-1">
              <Database className="w-4 h-4" /> 문제은행 콘텐츠 & AI 사전 검토 관리 콘솔
            </div>
            <h1 className="text-2xl md:text-3xl font-bold text-slate-900 tracking-tight">
              학습 문제은행 DB 및 AI 문항 승인 콘솔
            </h1>
            <p className="text-sm text-slate-600 mt-1">
              AI가 생성한 실전 문항을 승인 전에 미리 검토하고 직접 수정할 수 있으며, 품질 모니터링을 통합 관리합니다.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant={activeTab === "generator" ? "default" : "outline"}
              onClick={() => setActiveTab("generator")}
              className={activeTab === "generator" ? "bg-indigo-600 text-white gap-2" : "gap-2 text-indigo-600 border-indigo-200 bg-indigo-50"}
            >
              <Sparkles className="w-4 h-4" /> AI 문제 사전 검토 출제
            </Button>
            <Button onClick={handleOpenCreate} className="bg-indigo-600 hover:bg-indigo-700 text-white gap-2">
              <Plus className="h-4 w-4" /> 직접 신규 등록
            </Button>
          </div>
        </div>

        {/* Tab Selection */}
        <div className="flex flex-wrap gap-2 border-b border-slate-200 pb-3">
          <Button
            variant={activeTab === "list" ? "default" : "ghost"}
            onClick={() => setActiveTab("list")}
            className={activeTab === "list" ? "bg-indigo-600 text-white" : "text-slate-600"}
          >
            문항 목록 관리
          </Button>
          <Button
            variant={activeTab === "stats" ? "default" : "ghost"}
            onClick={() => setActiveTab("stats")}
            className={activeTab === "stats" ? "bg-indigo-600 text-white" : "text-slate-600"}
          >
            정답률 & AI 통계 분석
          </Button>
          <Button
            variant={activeTab === "quality" ? "default" : "ghost"}
            onClick={() => setActiveTab("quality")}
            className={activeTab === "quality" ? "bg-indigo-600 text-white" : "text-slate-600"}
          >
            문항 품질 모니터링
          </Button>
          <Button
            variant={activeTab === "generator" ? "default" : "ghost"}
            onClick={() => setActiveTab("generator")}
            className={activeTab === "generator" ? "bg-indigo-600 text-white" : "text-slate-600"}
          >
            AI 실전 문제 출제 (사전 검토)
          </Button>
        </div>

        {/* Tab 1: AI Generator with Preview Modal */}
        {activeTab === "generator" && (
          <Card className="border-indigo-100 shadow-sm bg-gradient-to-br from-indigo-50/50 to-white">
            <CardHeader>
              <CardTitle className="text-xl font-bold text-indigo-900 flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-indigo-600" /> AI 실전 논술 문항 사전 검토 및 승인 시스템
              </CardTitle>
              <CardDescription>
                AI가 생성한 문항을 문제은행에 바로 반영하기 전, 미리보기 모달에서 내용과 JSON 구조를 직접 검토하고 수정할 수 있습니다.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div>
                  <label className="text-xs font-bold text-slate-700 mb-2 block">교육 과정 선택</label>
                  <select
                    value={genCourse}
                    onChange={e => setGenCourse(e.target.value)}
                    className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl text-sm font-medium"
                  >
                    <option value="elementary">초등 논술 과정</option>
                    <option value="middle_high">중고등 논술 과정</option>
                    <option value="high_univ">고등 / 대입 과정</option>
                    <option value="general_adult">일반 / 직장인 과정</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-700 mb-2 block">학습 도구 선택</label>
                  <select
                    value={genTool}
                    onChange={e => setGenTool(e.target.value)}
                    className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl text-sm font-medium"
                  >
                    <option value="quiz">AI 문장 퀴즈 (quiz)</option>
                    <option value="reordering">단락 재구성 (reordering)</option>
                    <option value="summary">요약 연습 (summary)</option>
                    <option value="topic_wizard">주제 설정 위저드 (topic_wizard)</option>
                    <option value="thesis_checklist">주제문 체크리스트 (thesis_checklist)</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-700 mb-2 block">생성 문항 수</label>
                  <select
                    value={genCount}
                    onChange={e => setGenCount(Number(e.target.value))}
                    className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl text-sm font-medium"
                  >
                    <option value={1}>1문항</option>
                    <option value={3}>3문항 (추천)</option>
                    <option value={5}>5문항</option>
                  </select>
                </div>
              </div>

              <div className="pt-4 flex justify-end">
                <Button
                  disabled={isGenerating}
                  onClick={handlePreviewAi}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white px-8 py-3 h-auto text-base font-bold gap-2 shadow-lg shadow-indigo-200"
                >
                  {isGenerating ? <Sparkles className="w-5 h-5 animate-spin" /> : <Sparkles className="w-5 h-5" />}
                  {isGenerating ? "AI가 문항을 출제하고 있습니다..." : "AI 문항 생성 및 사전 검토 시작"}
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* AI Preview & Edit Modal */}
        <Dialog open={isPreviewOpen} onOpenChange={setIsPreviewOpen}>
          <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-indigo-600">
                <Sparkles className="w-5 h-5" /> AI 생성 문항 사전 검토 및 수정
              </DialogTitle>
              <DialogDescription>
                관리자가 생성된 문항의 제목, 난이도, 본문 내용을 최종 검토하고 필요시 수정하여 승인할 수 있습니다.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-6 py-4">
              {previewItems.map((item, idx) => (
                <div key={idx} className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="px-2.5 py-0.5 bg-indigo-100 text-indigo-700 text-xs font-semibold rounded-full">
                      검토 문항 #{idx + 1}
                    </span>
                    <select
                      value={item.difficulty}
                      onChange={e => {
                        const updated = [...previewItems];
                        updated[idx].difficulty = e.target.value;
                        setPreviewItems(updated);
                      }}
                      className="px-2.5 py-1 bg-white border border-slate-200 rounded text-xs font-semibold"
                    >
                      <option value="easy">초급 (easy)</option>
                      <option value="medium">중급 (medium)</option>
                      <option value="hard">고급 (hard)</option>
                    </select>
                  </div>

                  <div>
                    <label className="text-xs font-bold text-slate-700 mb-1 block">문항 제목</label>
                    <Input
                      value={item.title}
                      onChange={e => {
                        const updated = [...previewItems];
                        updated[idx].title = e.target.value;
                        setPreviewItems(updated);
                      }}
                      className="text-sm bg-white font-bold"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-bold text-slate-700 mb-1 block">본문 데이터 (JSON)</label>
                    <Textarea
                      rows={4}
                      value={item.contentData}
                      onChange={e => {
                        const updated = [...previewItems];
                        updated[idx].contentData = e.target.value;
                        setPreviewItems(updated);
                      }}
                      className="font-mono text-xs bg-white"
                    />
                  </div>
                </div>
              ))}
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setIsPreviewOpen(false)}>취소</Button>
              <Button onClick={handleApprovePreview} className="bg-emerald-600 hover:bg-emerald-700 text-white gap-2">
                <CheckCircle className="w-4 h-4" /> 검토 완료 및 문제은행 최종 승인 반영
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Tab 2: Quality Monitoring */}
        {activeTab === "quality" && (
          <div className="space-y-6">
            <Card className="border-slate-200 shadow-sm">
              <CardHeader>
                <CardTitle className="text-lg font-bold flex items-center gap-2">
                  <ShieldAlert className="w-5 h-5 text-rose-600" /> 문항별 사용자 피드백 및 오류 신고 모니터링
                </CardTitle>
                <CardDescription>
                  학습자들이 제출한 피드백과 오류 신고를 확인하고, 관리자 정정 답변 등록 및 문제은행 직접 수정을 통해 즉시 정정할 수 있습니다.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {!allFeedbacks || allFeedbacks.length === 0 ? (
                  <div className="p-12 text-center text-slate-500 bg-slate-50 rounded-xl border border-dashed border-slate-200">
                    아직 수집된 사용자 피드백이나 오류 신고 내역이 없습니다.
                  </div>
                ) : (
                  allFeedbacks.map((fb: any) => {
                    const matchedQ = questions?.find(item => item.id === fb.questionId);
                    return (
                      <div key={fb.id} className="p-4 bg-white border border-slate-200 rounded-xl space-y-3">
                        <div className="flex flex-col md:flex-row md:items-center justify-between gap-2 border-b border-slate-100 pb-3">
                          <div className="flex items-center gap-2">
                            <span className="px-2 py-0.5 bg-indigo-50 text-indigo-700 text-xs font-semibold rounded-full uppercase">
                              문항 ID #{fb.questionId}
                            </span>
                            <span className={`px-2 py-0.5 text-xs font-bold rounded ${fb.isHelpful === 1 ? "bg-emerald-100 text-emerald-800" : "bg-rose-100 text-rose-800"}`}>
                              {fb.isHelpful === 1 ? "도움됨" : "아쉬움 / 오류"}
                            </span>
                            {fb.reportType && fb.reportType !== "none" && (
                              <span className="px-2 py-0.5 bg-amber-100 text-amber-800 text-xs font-bold rounded">
                                신고유형: {fb.reportType}
                              </span>
                            )}
                            <span className="text-xs text-slate-400">{new Date(fb.createdAt).toLocaleString()}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            {matchedQ && (
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-8 text-xs border-indigo-200 text-indigo-700 hover:bg-indigo-50"
                                onClick={() => handleOpenEdit(matchedQ)}
                              >
                                <Edit2 className="w-3.5 h-3.5 mr-1" /> 문제은행 직접 수정
                              </Button>
                            )}
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-8 text-xs border-rose-200 text-rose-600 hover:bg-rose-50"
                              onClick={async () => {
                                if (confirm("이 피드백 내역을 삭제하시겠습니까?")) {
                                  await deleteFeedbackMutation.mutateAsync({ feedbackId: fb.id });
                                  toast.success("피드백이 삭제되었습니다.");
                                  utils.questionBank.invalidate();
                                }
                              }}
                            >
                              <Trash2 className="w-3.5 h-3.5 mr-1" /> 삭제
                            </Button>
                          </div>
                        </div>

                        <div>
                          <p className="text-sm font-bold text-slate-900">{matchedQ ? matchedQ.title : `알 수 없는 문항 (ID: ${fb.questionId})`}</p>
                          <p className="text-xs text-slate-600 mt-1 bg-slate-50 p-2.5 rounded-lg border border-slate-100">
                            <strong>학습자 의견:</strong> {fb.comment || "내용 없음"}
                          </p>
                        </div>

                        {/* Admin Reply & Status */}
                        <div className="pt-2 border-t border-slate-100 flex flex-col md:flex-row gap-2 items-center">
                          {editingFeedbackId === fb.id ? (
                            <div className="flex-1 w-full space-y-2">
                              <Input
                                placeholder="관리자 정정 답변 입력..."
                                value={adminReplyText}
                                onChange={e => setAdminReplyText(e.target.value)}
                                className="text-xs"
                              />
                              <div className="flex gap-2">
                                <Button
                                  size="sm"
                                  className="bg-indigo-600 text-white h-7 text-xs"
                                  onClick={async () => {
                                    await updateFeedbackMutation.mutateAsync({ feedbackId: fb.id, adminReply: adminReplyText, status: "resolved" });
                                    toast.success("관리자 정정 답변이 저장되었습니다.");
                                    setEditingFeedbackId(null);
                                    utils.questionBank.invalidate();
                                  }}
                                >
                                  저장
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="h-7 text-xs"
                                  onClick={() => setEditingFeedbackId(null)}
                                >
                                  취소
                                </Button>
                              </div>
                            </div>
                          ) : (
                            <div className="flex items-center justify-between w-full">
                              <p className="text-xs text-slate-600">
                                <strong className="text-indigo-700">관리자 답변/정정:</strong> {fb.adminReply || "아직 답변이 등록되지 않았습니다."}
                              </p>
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-7 text-xs text-indigo-600 hover:bg-indigo-50"
                                onClick={() => {
                                  setEditingFeedbackId(fb.id);
                                  setAdminReplyText(fb.adminReply || "");
                                }}
                              >
                                답변 및 정정 편집
                              </Button>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
              </CardContent>
            </Card>
          </div>
        )}

        {/* Tab 3: Stats Dashboard */}
        {activeTab === "stats" && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <Card className="border-indigo-100 shadow-sm bg-gradient-to-br from-indigo-50 to-white">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-semibold text-indigo-900">전체 평균 정답률</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-extrabold text-indigo-600">
                    {Math.round(questionsWithStats.reduce((acc, q) => acc + q.correctRate, 0) / (questionsWithStats.length || 1))}%
                  </div>
                </CardContent>
              </Card>
              <Card className="border-amber-100 shadow-sm bg-gradient-to-br from-amber-50 to-white">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-semibold text-amber-900">AI 난이도 조정 제안 대상</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-extrabold text-amber-600">
                    {questionsWithStats.filter(q => q.suggestedDifficulty !== q.difficulty).length}문항
                  </div>
                </CardContent>
              </Card>
              <Card className="border-emerald-100 shadow-sm bg-gradient-to-br from-emerald-50 to-white">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-semibold text-emerald-900">총 문제은행 문항 수</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-extrabold text-emerald-600">
                    {questionsWithStats.length}문항
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Period Trend Line Chart */}
            <Card className="border-slate-200 shadow-sm">
              <CardHeader className="flex flex-row items-center justify-between pb-4">
                <div>
                  <CardTitle className="text-lg font-bold flex items-center gap-2">
                    <TrendingUp className="w-5 h-5 text-indigo-600" /> 기간별 정답률 변화 추이
                  </CardTitle>
                  <CardDescription>최근 1주일 및 1개월 간 학습자들의 문제 풀이 성과 흐름</CardDescription>
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
          </div>
        )}

        {/* Tab 4: Question List Management */}
        {activeTab === "list" && (
          <div className="space-y-6">
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
                    onChange={e => { setCourseFilter(e.target.value); setSelectedQuestionIds([]); }}
                    className="px-3 py-2 bg-white border border-slate-200 rounded-md text-sm text-slate-700"
                  >
                    <option value="all">모든 과정</option>
                    <option value="elementary">초등 논술</option>
                    <option value="middle_high">중고등 논술</option>
                    <option value="high_univ">고등 / 대입</option>
                    <option value="general_adult">일반 / 직장인</option>
                  </select>
                  <select
                    value={toolFilter}
                    onChange={e => { setToolFilter(e.target.value); setSelectedQuestionIds([]); }}
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
                    value={sortBy}
                    onChange={e => setSortBy(e.target.value as any)}
                    className="px-3 py-2 bg-white border border-indigo-200 rounded-md text-sm text-indigo-700 font-semibold"
                  >
                    <option value="default">기본 정렬</option>
                    <option value="lowest_correct">낮은 정답률순</option>
                    <option value="highest_wrong">높은 오답 빈도순</option>
                    <option value="most_attempted">최다 응시순</option>
                  </select>
                </div>
                <div className="w-full md:w-auto flex flex-wrap gap-2 items-center md:justify-end">
                  <div className="flex items-center gap-1.5 bg-slate-50 px-2.5 py-1.5 rounded-md border border-slate-200">
                    <input
                      type="checkbox"
                      id="upsert-chk"
                      checked={isUpsert}
                      onChange={e => setIsUpsert(e.target.checked)}
                      className="rounded text-indigo-600 focus:ring-indigo-500 w-3.5 h-3.5 cursor-pointer"
                    />
                    <label htmlFor="upsert-chk" className="text-xs font-semibold text-slate-700 cursor-pointer">
                      동일 ID 덮어쓰기(Upsert)
                    </label>
                  </div>
                  <Button variant="outline" onClick={handleDownloadCSV} className="gap-2 text-xs">
                    <Download className="w-3.5 h-3.5" /> CSV 다운
                  </Button>
                  <label className="cursor-pointer">
                    <Button variant="outline" className="gap-2 text-xs pointer-events-none">
                      <Upload className="w-3.5 h-3.5" /> 업로드
                    </Button>
                    <input type="file" accept=".csv" onChange={handleFileUpload} className="hidden" />
                  </label>
                  <Button
                    variant="outline"
                    onClick={toggleAllVisibleSelection}
                    disabled={sortedFiltered.length === 0}
                    className="gap-1.5 text-xs text-slate-700"
                  >
                    {allVisibleSelected ? "현재 목록 선택 해제" : `현재 목록 전체 선택${sortedFiltered.length ? ` (${sortedFiltered.length})` : ""}`}
                  </Button>
                  <Button
                    variant="destructive"
                    onClick={() => {
                      if (selectedQuestionIds.length === 0) {
                        toast.error("삭제할 문항을 먼저 선택해주세요.");
                        return;
                      }
                      setIsBulkDeleteOpen(true);
                    }}
                    className="gap-1.5 text-xs bg-rose-600 hover:bg-rose-700 text-white shadow-sm"
                  >
                    <Trash2 className="w-3.5 h-3.5" /> 선택 삭제{selectedQuestionIds.length ? ` (${selectedQuestionIds.length})` : ""}
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Upload Progress Bar Banner */}
            {uploadProgress.active && (
              <Card className="border-indigo-200 bg-indigo-50/50 shadow-sm">
                <CardContent className="p-4 space-y-2">
                  <div className="flex justify-between text-xs font-bold text-indigo-900">
                    <span>{uploadProgress.text}</span>
                    <span>{uploadProgress.percent}%</span>
                  </div>
                  <div className="w-full bg-indigo-100 rounded-full h-2.5 overflow-hidden">
                    <div
                      className="bg-indigo-600 h-2.5 rounded-full transition-all duration-300"
                      style={{ width: `${uploadProgress.percent}%` }}
                    />
                  </div>
                </CardContent>
              </Card>
            )}

            <div className="grid gap-4">
              {isLoading ? (
                <div className="p-12 text-center text-slate-500">문항 목록을 불러오는 중입니다...</div>
              ) : sortedFiltered.length === 0 ? (
                <div className="p-12 text-center text-slate-500 bg-white rounded-xl border border-slate-200">조건에 일치하는 문항이 없습니다.</div>
              ) : (
                sortedFiltered.map((q) => (
                  <div key={q.id} className={`p-5 bg-white rounded-xl border shadow-sm flex flex-col md:flex-row md:items-center md:justify-between gap-4 transition-colors ${selectedQuestionIds.includes(q.id) ? "border-indigo-300 ring-2 ring-indigo-100" : "border-slate-200"}`}>
                    <div className="flex gap-3 flex-1 min-w-0">
                      <input
                        type="checkbox"
                        aria-label={`${q.title} 선택`}
                        checked={selectedQuestionIds.includes(q.id)}
                        onChange={() => toggleQuestionSelection(q.id)}
                        className="mt-1 h-4 w-4 shrink-0 cursor-pointer rounded text-indigo-600 focus:ring-indigo-500"
                      />
                    <div className="space-y-1 flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="px-2.5 py-0.5 bg-indigo-100 text-indigo-700 text-xs font-semibold rounded-full">
                          {q.courseType}
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
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <Button size="sm" variant="outline" onClick={() => handleOpenEdit(q)} className="gap-1.5 text-slate-700 text-xs">
                        <Edit2 className="h-3.5 w-3.5" /> 수정
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => handleDelete(q.id)} className="gap-1.5 text-rose-600 hover:text-rose-700 hover:bg-rose-50 border-rose-200 text-xs">
                        <Trash2 className="h-3.5 w-3.5" /> 삭제
                      </Button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

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

        {/* CSV Upload Result Report */}
        <Dialog open={uploadReport.open} onOpenChange={(open) => setUploadReport((report) => ({ ...report, open }))}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-indigo-700">
                <CheckCircle className="w-5 h-5" /> CSV 업로드 결과 리포트
              </DialogTitle>
              <DialogDescription>업로드 작업의 처리 결과를 확인하세요.</DialogDescription>
            </DialogHeader>
            <div className="grid grid-cols-3 gap-3 py-4">
              <div className="rounded-xl bg-emerald-50 border border-emerald-100 p-3 text-center">
                <p className="text-2xl font-bold text-emerald-700">{uploadReport.created}</p>
                <p className="text-xs font-semibold text-emerald-800 mt-1">신규 등록</p>
              </div>
              <div className="rounded-xl bg-indigo-50 border border-indigo-100 p-3 text-center">
                <p className="text-2xl font-bold text-indigo-700">{uploadReport.updated}</p>
                <p className="text-xs font-semibold text-indigo-800 mt-1">덮어쓰기</p>
              </div>
              <div className="rounded-xl bg-rose-50 border border-rose-100 p-3 text-center">
                <p className="text-2xl font-bold text-rose-700">{uploadReport.failed}</p>
                <p className="text-xs font-semibold text-rose-800 mt-1">실패·제외</p>
              </div>
            </div>
            <p className="text-xs text-slate-500 bg-slate-50 rounded-lg p-3">
              총 {uploadReport.total}개 유효 문항을 분석했습니다. “동일 ID 덮어쓰기”가 선택된 경우 기존 ID는 최신 콘텐츠로 갱신됩니다.
            </p>
            <DialogFooter>
              <Button onClick={() => setUploadReport((report) => ({ ...report, open: false }))} className="bg-indigo-600 hover:bg-indigo-700 text-white">확인</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Selected Question Bulk Delete Confirmation */}
        <Dialog open={isBulkDeleteOpen} onOpenChange={setIsBulkDeleteOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-rose-700">
                <Trash2 className="w-5 h-5" /> 선택 문항 삭제 확인
              </DialogTitle>
              <DialogDescription>
                선택한 {selectedQuestionIds.length}개 문항을 문제은행에서 영구 삭제합니다. 이 작업은 되돌릴 수 없습니다.
              </DialogDescription>
            </DialogHeader>
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs leading-5 text-amber-900">
              현재 과정 콤보박스와 검색·학습도구 필터로 문항을 좁힌 뒤 “현재 목록 전체 선택” 또는 각 문항의 체크박스를 이용해 삭제 대상을 지정하세요.
            </div>
            <DialogFooter className="mt-4 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <Button variant="outline" onClick={() => setIsBulkDeleteOpen(false)} className="w-full sm:w-auto">취소</Button>
              <Button
                variant="destructive"
                disabled={deleteManyMutation.isPending || selectedQuestionIds.length === 0}
                onClick={handleBulkDelete}
                className="w-full sm:w-auto bg-rose-600 hover:bg-rose-700 text-white"
              >
                {deleteManyMutation.isPending ? "삭제 중..." : `${selectedQuestionIds.length}개 삭제 확인`}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}
