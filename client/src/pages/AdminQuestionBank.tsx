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
import { Database, Plus, Search, Edit2, Trash2, CheckCircle2, AlertCircle } from "lucide-react";
import { Link } from "wouter";

export default function AdminQuestionBank() {
  const { user } = useAuth();
  const [courseFilter, setCourseFilter] = useState<string>("all");
  const [toolFilter, setToolFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");

  const { data: questions, isLoading, refetch } = trpc.questionBank.list.useQuery({
    courseType: courseFilter === "all" ? undefined : courseFilter,
    toolType: toolFilter === "all" ? undefined : toolFilter,
  });

  const createMutation = trpc.questionBank.create.useMutation();
  const updateMutation = trpc.questionBank.update.useMutation();
  const deleteMutation = trpc.questionBank.delete.useMutation();

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
    return true;
  });

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
              초등·중고등·고등/대입·일반/직장인 4대 과정별 200개 이상의 학습 문항(퀴즈, 요약, 단락 재구성 등)을 관리하고 랜덤 출제 풀을 조율합니다.
            </p>
          </div>
          <Button onClick={handleOpenCreate} className="bg-indigo-600 hover:bg-indigo-700 text-white gap-2 shrink-0">
            <Plus className="h-4 w-4" /> 신규 문제 등록
          </Button>
        </div>

        {/* Filters */}
        <Card className="border-slate-200 shadow-sm">
          <CardContent className="p-4 flex flex-col md:flex-row gap-4 items-center justify-between">
            <div className="flex flex-wrap gap-2 items-center w-full md:w-auto">
              <div className="relative flex-1 md:w-64">
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
            </div>
            <div className="text-sm text-slate-500 shrink-0">
              총 <span className="font-bold text-indigo-600">{filtered.length}</span>개의 문항 검색됨
            </div>
          </CardContent>
        </Card>

        {/* Question List */}
        <div className="grid gap-4">
          {isLoading ? (
            <div className="p-12 text-center text-slate-500">문제은행 데이터를 불러오는 중입니다...</div>
          ) : filtered.length === 0 ? (
            <div className="p-12 text-center text-slate-500 bg-white rounded-xl border border-slate-200">등록된 문제가 없습니다.</div>
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
