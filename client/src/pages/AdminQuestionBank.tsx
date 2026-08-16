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
import { Database, Plus, Search, Edit2, Trash2, Download, Upload, FileSpreadsheet } from "lucide-react";
import { Link } from "wouter";

export default function AdminQuestionBank() {
  const { user } = useAuth();
  const [courseFilter, setCourseFilter] = useState<string>("all");
  const [toolFilter, setToolFilter] = useState<string>("all");
  const [difficultyFilter, setDifficultyFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");

  const { data: questions, isLoading, refetch } = trpc.questionBank.list.useQuery({
    courseType: courseFilter === "all" ? undefined : courseFilter,
    toolType: toolFilter === "all" ? undefined : toolFilter,
  });

  const createMutation = trpc.questionBank.create.useMutation();
  const updateMutation = trpc.questionBank.update.useMutation();
  const deleteMutation = trpc.questionBank.delete.useMutation();
  const bulkCreateMutation = trpc.questionBank.bulkCreate.useMutation();

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

  const filtered = (questions || []).filter(q => {
    if (searchQuery && !q.title.toLowerCase().includes(searchQuery.toLowerCase())) return false;
    if (difficultyFilter !== "all" && q.difficulty !== difficultyFilter) return false;
    return true;
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
        const lines = text.split("\n").filter(l => l.trim().length > 0);
        if (lines.length < 2) {
          toast.error("업로드된 파일에 유효한 데이터가 없습니다.");
          return;
        }

        const items: any[] = [];
        // 첫 줄 헤더 제외
        for (let i = 1; i < lines.length; i++) {
          const line = lines[i];
          // 간단한 CSV 파서 (쌍따옴표 고려)
          const parts = line.split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/);
          if (parts.length >= 6) {
            const courseType = parts[1]?.replace(/"/g, '').trim() as any || "elementary";
            const toolType = parts[2]?.replace(/"/g, '').trim() || "quiz";
            const title = parts[3]?.replace(/"/g, '').trim() || "업로드된 문항";
            let contentData = parts[4]?.replace(/"/g, '').trim() || "{}";
            contentData = contentData.replace(/\\n/g, '\n');
            const difficulty = (parts[5]?.replace(/"/g, '').trim() || "medium") as any;

            items.push({
              courseType: ["elementary", "middle_high", "high_univ", "general_adult"].includes(courseType) ? courseType : "elementary",
              toolType,
              title,
              contentData,
              difficulty: ["easy", "medium", "hard"].includes(difficulty) ? difficulty : "medium",
              isActive: 1,
            });
          }
        }

        if (items.length === 0) {
          toast.error("가져올 수 있는 유효한 문항이 없습니다.");
          return;
        }

        await bulkCreateMutation.mutateAsync({ items });
        toast.success(`총 ${items.length}개의 문항이 문제은행에 일괄 등록되었습니다.`);
        refetch();
      } catch (err: any) {
        toast.error("CSV 파일 파싱 중 오류가 발생했습니다: " + err.message);
      }
    };
    reader.readAsText(file);
    e.target.value = "";
  };

  const handleOpenCreate = () => {
    setEditingId(null);
    setFormTitle("");
    setFormContent('{\n  "prompt": "문항 본문",\n  "options": ["보기1", "보기2", "보기3", "보기4"],\n  "answer": "보기1",\n  "explanation": "해설"\n}');
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

  const handleSave = () => {
    if (!formTitle.trim()) {
      toast.error("문제 제목을 입력해주세요.");
      return;
    }

    try {
      JSON.parse(formContent);
    } catch {
      toast.error("본문 데이터(contentData)는 올바른 JSON 형식이어야 합니다.");
      return;
    }

    if (editingId) {
      updateMutation.mutate({
        id: editingId,
        courseType: formCourse,
        toolType: formTool,
        title: formTitle,
        contentData: formContent,
        difficulty: formDifficulty,
      }, {
        onSuccess: () => {
          toast.success("문제가 성공적으로 수정되었습니다.");
          setIsDialogOpen(false);
          refetch();
        },
        onError: (err) => toast.error(err.message),
      });
    } else {
      createMutation.mutate({
        courseType: formCourse,
        toolType: formTool,
        title: formTitle,
        contentData: formContent,
        difficulty: formDifficulty,
        isActive: 1,
      }, {
        onSuccess: () => {
          toast.success("새로운 문제가 문제은행에 등록되었습니다.");
          setIsDialogOpen(false);
          refetch();
        },
        onError: (err) => toast.error(err.message),
      });
    }
  };

  const handleDelete = (id: number) => {
    if (!confirm("정말 이 문제를 삭제하시겠습니까?")) return;
    deleteMutation.mutate({ id }, {
      onSuccess: () => {
        toast.success("문제가 삭제되었습니다.");
        refetch();
      },
      onError: (err) => toast.error(err.message),
    });
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight flex items-center gap-2">
              <Database className="h-8 w-8 text-indigo-600" /> 문제은행 관리 콘솔
            </h1>
            <p className="text-sm text-slate-500 mt-1">
              초등·중고등·고등/대입·일반/직장인 4대 과정별 문항을 조회, 등록, 수정하며 CSV 대량 업로드 및 다운로드를 관리합니다.
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Button variant="outline" onClick={handleDownloadCSV} className="gap-2 text-slate-700">
              <Download className="h-4 w-4" /> CSV 다운로드
            </Button>
            <label className="cursor-pointer">
              <Button variant="outline" className="gap-2 text-indigo-600 border-indigo-200 bg-indigo-50/50 hover:bg-indigo-100" asChild>
                <span>
                  <Upload className="h-4 w-4" /> CSV 대량 업로드
                </span>
              </Button>
              <input type="file" accept=".csv" onChange={handleFileUpload} className="hidden" />
            </label>
            <Button onClick={handleOpenCreate} className="bg-indigo-600 hover:bg-indigo-700 text-white gap-2">
              <Plus className="h-4 w-4" /> 신규 등록
            </Button>
          </div>
        </div>

        {/* Filters */}
        <Card className="border-slate-200 shadow-sm">
          <CardContent className="p-4 flex flex-col md:flex-row gap-4 items-center justify-between">
            <div className="flex flex-wrap gap-2 items-center w-full md:w-auto">
              <div className="relative flex-1 md:w-60">
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
            </div>
            <div className="text-sm text-slate-500 shrink-0">
              필터 결과: <span className="font-bold text-indigo-600">{filtered.length}</span>문항
            </div>
          </CardContent>
        </Card>

        {/* Question List */}
        <div className="grid gap-4">
          {isLoading ? (
            <div className="p-12 text-center text-slate-500">문제은행 데이터를 불러오는 중입니다...</div>
          ) : filtered.length === 0 ? (
            <div className="p-12 text-center text-slate-500 bg-white rounded-xl border border-slate-200">조건에 일치하는 문항이 없습니다.</div>
          ) : (
            filtered.map((q) => (
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
                  </div>
                  <h3 className="text-lg font-bold text-slate-900">{q.title}</h3>
                  <p className="text-xs text-slate-400 font-mono truncate max-w-xl">{q.contentData}</p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
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
