import { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { BookOpen, Plus, ArrowUp, ArrowDown, Edit3, Trash2, GripVertical, Search, Eye, Sparkles, Copy, Monitor, Smartphone } from "lucide-react";
import { Link } from "wouter";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";

export default function AdminCurriculumManager() {
  const [activeTab, setActiveTab] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [draggedId, setDraggedId] = useState<number | null>(null);
  const [highlightId, setHighlightId] = useState<number | null>(null);

  // Multi-select state
  const [selectedIds, setSelectedIds] = useState<number[]>([]);

  // Preview Modal State
  const [previewCategory, setPreviewCategory] = useState<any | null>(null);
  const [previewDevice, setPreviewDevice] = useState<"pc" | "mobile">("pc");

  // Create / Edit Form State
  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState({
    courseType: "elementary" as "elementary" | "middle_high" | "high_univ" | "general_adult",
    level: 1,
    title: "",
    description: "",
    topicsText: "",
    aiSummary: "",
    isActive: 1,
  });

  // Delete Confirmation State
  const [deleteId, setDeleteId] = useState<number | null>(null);

  const { data: categories, isLoading, refetch } = trpc.admin.getCurriculumCategoriesAdmin.useQuery();
  const utils = trpc.useUtils();

  const createMutation = trpc.admin.createCurriculumCategoryAdmin.useMutation({
    onSuccess: () => {
      toast.success("새 커리큘럼 카테고리가 생성되었습니다.");
      closeForm();
      refetch();
    },
    onError: (err: any) => toast.error(err.message || "생성 중 오류가 발생했습니다."),
  });

  const updateMutation = trpc.admin.updateCurriculumCategoryAdmin.useMutation({
    onSuccess: () => {
      toast.success("커리큘럼이 수정되었습니다.");
      closeForm();
      refetch();
    },
    onError: (err: any) => toast.error(err.message || "수정 중 오류가 발생했습니다."),
  });

  const deleteMutation = trpc.admin.deleteCurriculumCategoryAdmin.useMutation({
    onSuccess: () => {
      toast.success("카테고리가 삭제되었습니다.");
      setDeleteId(null);
      refetch();
    },
    onError: (err: any) => toast.error(err.message || "삭제 중 오류가 발생했습니다."),
  });

  const reorderMutation = trpc.admin.reorderCurriculumCategoriesAdmin.useMutation({
    onSuccess: () => {
      refetch();
    },
    onError: (err: any) => toast.error(err.message || "순서 변경 중 오류가 발생했습니다."),
  });

  const seedMutation = trpc.admin.seedDefaultCurriculumSamples.useMutation({
    onSuccess: () => {
      toast.success("고등/대입 및 일반/직장인 샘플 강의가 추가되었습니다.");
      refetch();
    },
    onError: (err: any) => toast.error(err.message || "샘플 추가 중 오류가 발생했습니다."),
  });

  const toggleActiveMutation = trpc.admin.toggleCurriculumActiveAdmin.useMutation({
    onSuccess: () => {
      refetch();
    },
    onError: (err: any) => toast.error(err.message || "노출 상태 변경 중 오류가 발생했습니다."),
  });

  const batchToggleMutation = trpc.admin.batchToggleCurriculumActiveAdmin.useMutation({
    onSuccess: () => {
      toast.success("선택한 항목의 노출 상태가 일괄 변경되었습니다.");
      setSelectedIds([]);
      refetch();
    },
    onError: (err: any) => toast.error(err.message || "일괄 처리 중 오류가 발생했습니다."),
  });

  const duplicateMutation = trpc.admin.duplicateCurriculumAdmin.useMutation({
    onSuccess: () => {
      toast.success("커리큘럼 카드가 복제되었습니다.");
      refetch();
    },
    onError: (err: any) => toast.error(err.message || "복제 중 오류가 발생했습니다."),
  });

  const openCreate = () => {
    setEditingId(null);
    setForm({
      courseType: "elementary",
      level: 1,
      title: "",
      description: "",
      topicsText: "주제 분석, 논리 전개, 글쓰기 실습",
      aiSummary: "",
      isActive: 1,
    });
    setFormOpen(true);
  };

  const openEdit = (cat: any) => {
    setEditingId(cat.id);
    setForm({
      courseType: cat.courseType,
      level: cat.level,
      title: cat.title,
      description: cat.description,
      topicsText: Array.isArray(cat.topics) ? cat.topics.join(", ") : "",
      aiSummary: cat.aiSummary || "",
      isActive: cat.isActive ?? 1,
    });
    setFormOpen(true);
  };

  const closeForm = () => {
    setFormOpen(false);
    setEditingId(null);
  };

  const handleSaveForm = (e: React.FormEvent) => {
    e.preventDefault();
    const topics = form.topicsText.split(",").map((t) => t.trim()).filter(Boolean);
    if (!form.title || !form.description || topics.length === 0) {
      toast.error("제목, 설명, 학습 주제를 올바르게 입력해주세요.");
      return;
    }
    const payload = {
      courseType: form.courseType,
      level: Number(form.level),
      title: form.title,
      description: form.description,
      topics,
      aiSummary: form.aiSummary,
      isActive: form.isActive,
    };

    if (editingId) {
      updateMutation.mutate({ id: editingId, ...payload });
    } else {
      createMutation.mutate(payload);
    }
  };

  const moveCategory = (index: number, direction: "up" | "down", items: any[]) => {
    const newItems = [...items];
    const targetIndex = direction === "up" ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= newItems.length) return;
    const temp = newItems[index];
    newItems[index] = newItems[targetIndex];
    newItems[targetIndex] = temp;

    const orderedIds = newItems.map((item) => item.id);
    setHighlightId(temp.id);
    setTimeout(() => setHighlightId(null), 1200);
    reorderMutation.mutate({ orderedIds });
  };

  const dropCategory = (sourceId: number, targetId: number, items: any[]) => {
    if (sourceId === targetId) return;
    const sourceIdx = items.findIndex((i) => i.id === sourceId);
    const targetIdx = items.findIndex((i) => i.id === targetId);
    if (sourceIdx < 0 || targetIdx < 0) return;

    const newItems = [...items];
    const [moved] = newItems.splice(sourceIdx, 1);
    newItems.splice(targetIdx, 0, moved);

    const orderedIds = newItems.map((item) => item.id);
    setHighlightId(moved.id);
    setTimeout(() => setHighlightId(null), 1200);
    reorderMutation.mutate({ orderedIds });
  };

  const toggleSelectAll = (items: any[]) => {
    const itemIds = items.map((i) => i.id);
    const allSelected = itemIds.every((id) => selectedIds.includes(id));
    if (allSelected) {
      setSelectedIds(selectedIds.filter((id) => !itemIds.includes(id)));
    } else {
      const merged = Array.from(new Set([...selectedIds, ...itemIds]));
      setSelectedIds(merged);
    }
  };

  const filteredCategories = useMemo(() => {
    if (!categories) return [];
    return categories.filter((c) => {
      const matchTab = activeTab === "all" || c.courseType === activeTab;
      const matchQuery =
        !searchQuery ||
        c.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        c.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
        c.topics?.some((t: string) => t.toLowerCase().includes(searchQuery.toLowerCase()));
      return matchTab && matchQuery;
    });
  }, [categories, activeTab, searchQuery]);

  const elementary = filteredCategories.filter((c) => c.courseType === "elementary");
  const middleHigh = filteredCategories.filter((c) => c.courseType === "middle_high");
  const highUniv = filteredCategories.filter((c) => c.courseType === "high_univ");
  const generalAdult = filteredCategories.filter((c) => c.courseType === "general_adult");

  const renderGroup = (title: string, items: any[], titleColorClass: string) => {
    if (activeTab !== "all" && activeTab !== items[0]?.courseType && items.length === 0) return null;
    const allChecked = items.length > 0 && items.every((i) => selectedIds.includes(i.id));

    return (
      <Card className="mb-6 border-slate-200 shadow-sm">
        <CardHeader className="pb-3 border-b border-slate-100">
          <div className="flex items-center justify-between">
            <CardTitle className={`text-lg font-bold flex items-center gap-2 ${titleColorClass}`}>
              <span>{title}</span>
              <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-semibold text-slate-600">{items.length}개</span>
            </CardTitle>
            {items.length > 0 && (
              <label className="flex items-center gap-2 cursor-pointer text-xs font-semibold text-slate-600">
                <Checkbox checked={allChecked} onCheckedChange={() => toggleSelectAll(items)} /> 전체 선택
              </label>
            )}
          </div>
          <CardDescription>카드를 드래그하거나 위아래 버튼으로 노출 순서를 변경할 수 있습니다. 토글 또는 일괄 체크박스로 학생 화면 노출 여부를 제어하세요.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 pt-4">
          {items.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-300 p-8 text-center text-sm text-slate-500">
              {searchQuery ? "검색 결과와 일치하는 카테고리가 없습니다." : "아직 등록된 카테고리가 없습니다."}
            </div>
          ) : (
            items.map((category, idx) => {
              const isSelected = selectedIds.includes(category.id);
              return (
                <div
                  key={category.id}
                  draggable
                  onDragStart={(event) => {
                    event.dataTransfer.effectAllowed = "move";
                    event.dataTransfer.setData("text/plain", String(category.id));
                    setDraggedId(category.id);
                  }}
                  onDragEnd={() => setDraggedId(null)}
                  onDragOver={(event) => {
                    event.preventDefault();
                    event.dataTransfer.dropEffect = "move";
                  }}
                  onDrop={(event) => {
                    event.preventDefault();
                    const sourceId = Number(event.dataTransfer.getData("text/plain"));
                    if (sourceId) dropCategory(sourceId, category.id, items);
                    setDraggedId(null);
                  }}
                  className={`rounded-xl border p-5 transition bg-white ${category.isActive === 0 ? "border-slate-300 bg-slate-100/70 opacity-75" : "border-slate-200 hover:border-indigo-300 hover:shadow-md"} ${highlightId === category.id ? "curriculum-order-highlight" : ""} ${draggedId === category.id ? "opacity-50" : ""} ${isSelected ? "ring-2 ring-indigo-500 bg-indigo-50/20" : ""}`}
                >
                  <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
                    {/* Left Checkbox & Main Info (Cols 1-8) */}
                    <div className="lg:col-span-8 flex items-start gap-3.5">
                      <Checkbox
                        className="mt-1"
                        checked={isSelected}
                        onCheckedChange={(checked) => {
                          if (checked) setSelectedIds([...selectedIds, category.id]);
                          else setSelectedIds(selectedIds.filter(id => id !== category.id));
                        }}
                      />
                      <div className="min-w-0 flex-1 space-y-2.5">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="inline-flex cursor-grab items-center gap-1 rounded-full bg-indigo-100 px-3 py-1 text-xs font-bold text-indigo-700 active:cursor-grabbing">
                            <GripVertical className="h-3.5 w-3.5" /> 순서 #{idx + 1} (Level {category.level})
                          </span>
                          <span className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-bold ${category.isActive !== 0 ? "bg-emerald-100 text-emerald-700" : "bg-slate-200 text-slate-600"}`}>
                            {category.isActive !== 0 ? "학생 노출 중" : "비공개 (숨김)"}
                          </span>
                          <h3 className="text-base font-bold text-slate-900">{category.title}</h3>
                        </div>
                        <p className="text-sm leading-relaxed text-slate-600">{category.description}</p>
                        {category.aiSummary && (
                          <div className="rounded-xl border border-indigo-100 bg-indigo-50/60 p-3.5">
                            <p className="mb-1 text-xs font-semibold text-indigo-700">AI 강의 요약</p>
                            <p className="text-sm leading-relaxed text-slate-700">{category.aiSummary}</p>
                          </div>
                        )}
                        <div className="flex flex-wrap gap-1.5 pt-1">
                          {category.topics.map((topic: string) => (
                            <span key={topic} className="rounded-md bg-slate-100 px-2.5 py-1 text-xs text-slate-600 font-medium">{topic}</span>
                          ))}
                        </div>
                        {category.aiTags?.length > 0 && (
                          <div className="flex flex-wrap gap-1.5">
                            {category.aiTags.map((tag: string) => (
                              <span key={tag} className="rounded-full border border-indigo-200 bg-indigo-50 px-3 py-1 text-xs font-semibold text-indigo-700">#{tag}</span>
                            ))}
                          </div>
                        )}
                        {category.samplePdfUrl && (
                          <a href={category.samplePdfUrl} target="_blank" rel="noreferrer" className="inline-flex text-sm font-semibold text-amber-700 underline-offset-4 hover:underline pt-1">
                            샘플 PDF 학습 자료 열기
                          </a>
                        )}
                      </div>
                    </div>

                    {/* Right Action Controls & Buttons (Cols 9-12) */}
                    <div className="lg:col-span-4 flex flex-col items-stretch justify-start gap-3.5 border-t lg:border-t-0 lg:border-l border-slate-100 pt-4 lg:pt-0 lg:pl-6 min-w-[210px]">
                      <div className="flex items-center justify-between w-full gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 shadow-xs">
                        <span className="text-xs font-semibold text-slate-700 whitespace-nowrap">학생 화면 노출</span>
                        <Switch
                          checked={category.isActive !== 0}
                          onCheckedChange={() => toggleActiveMutation.mutate({ id: category.id, isActive: category.isActive !== 0 ? 0 : 1 })}
                          disabled={toggleActiveMutation.isPending}
                        />
                      </div>
                      <div className="flex items-center justify-between w-full gap-2 bg-slate-50/70 p-2 rounded-xl border border-slate-100">
                        <span className="text-xs font-medium text-slate-500 pl-1">순서 이동</span>
                        <div className="flex items-center gap-1.5">
                          <Button size="sm" variant="outline" className="h-8 w-9 p-0 bg-white shadow-xs" disabled={idx === 0 || reorderMutation.isPending} onClick={() => moveCategory(idx, "up", items)} aria-label="위로 이동">
                            <ArrowUp className="h-4 w-4 text-slate-700" />
                          </Button>
                          <Button size="sm" variant="outline" className="h-8 w-9 p-0 bg-white shadow-xs" disabled={idx === items.length - 1 || reorderMutation.isPending} onClick={() => moveCategory(idx, "down", items)} aria-label="아래로 이동">
                            <ArrowDown className="h-4 w-4 text-slate-700" />
                          </Button>
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-2 w-full pt-1">
                        <Button size="sm" variant="outline" className="gap-1.5 text-indigo-700 border-indigo-200 bg-indigo-50/80 hover:bg-indigo-100 text-xs h-9 font-medium shadow-xs" onClick={() => { setPreviewDevice("pc"); setPreviewCategory(category); }}>
                          <Eye className="h-3.5 w-3.5 shrink-0" /> 미리보기
                        </Button>
                        <Button size="sm" variant="outline" className="gap-1.5 text-emerald-700 border-emerald-200 bg-emerald-50/80 hover:bg-emerald-100 text-xs h-9 font-medium shadow-xs" title="카드 복제" onClick={() => duplicateMutation.mutate({ id: category.id })} disabled={duplicateMutation.isPending}>
                          <Copy className="h-3.5 w-3.5 shrink-0" /> 복제
                        </Button>
                        <Button size="sm" variant="outline" className="gap-1.5 text-slate-700 border-slate-200 bg-white hover:bg-slate-50 text-xs h-9 font-medium shadow-xs" onClick={() => openEdit(category)}>
                          <Edit3 className="h-3.5 w-3.5 shrink-0" /> 수정
                        </Button>
                        <Button size="sm" variant="outline" className="gap-1.5 text-rose-700 border-rose-200 bg-rose-50/60 hover:bg-rose-100 text-xs h-9 font-medium shadow-xs" onClick={() => setDeleteId(category.id)}>
                          <Trash2 className="h-3.5 w-3.5 shrink-0" /> 삭제
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </CardContent>
      </Card>
    );
  };

  return (
    <div className="min-h-screen bg-slate-50 px-4 py-8 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <div className="rounded-2xl bg-indigo-100 p-3 text-indigo-700"><BookOpen className="h-8 w-8" /></div>
            <div>
              <p className="text-sm font-semibold text-indigo-700">관리자 운영 콘솔</p>
              <h1 className="text-3xl font-bold text-slate-900">커리큘럼 카테고리 관리</h1>
              <p className="mt-1 text-sm text-slate-600">과정별 필터링, 검색, 다중선택 일괄 노출, 카드 복제 및 기기별 미리보기 기능을 제공합니다.</p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link href="/admin"><Button variant="outline">관리자 대시보드</Button></Link>
            <Button variant="outline" className="gap-2 text-indigo-700 border-indigo-200 bg-indigo-50 hover:bg-indigo-100" onClick={() => seedMutation.mutate()} disabled={seedMutation.isPending}>
              <Sparkles className="h-4 w-4" /> 샘플 강의 추가
            </Button>
            <Button className="gap-2 bg-indigo-600 text-white hover:bg-indigo-700" onClick={openCreate}>
              <Plus className="h-4 w-4" /> 카테고리 추가
            </Button>
          </div>
        </div>

        {/* Batch Action Toolbar when items selected */}
        {selectedIds.length > 0 && (
          <div className="flex flex-wrap items-center justify-between rounded-xl border border-indigo-200 bg-indigo-600 p-4 text-white shadow-md">
            <div className="flex items-center gap-2 font-medium">
              <span className="rounded-full bg-white/20 px-2.5 py-0.5 text-xs font-bold">{selectedIds.length}개 선택됨</span>
              <span>선택한 커리큘럼 항목을 일괄 제어할 수 있습니다.</span>
            </div>
            <div className="flex gap-2">
              <Button size="sm" variant="secondary" className="bg-white text-indigo-900 hover:bg-indigo-50" onClick={() => batchToggleMutation.mutate({ ids: selectedIds, isActive: 1 })} disabled={batchToggleMutation.isPending}>
                일괄 노출 활성
              </Button>
              <Button size="sm" variant="secondary" className="bg-white/10 text-white hover:bg-white/20" onClick={() => batchToggleMutation.mutate({ ids: selectedIds, isActive: 0 })} disabled={batchToggleMutation.isPending}>
                일괄 비공개(숨김)
              </Button>
              <Button size="sm" variant="ghost" className="text-white hover:bg-white/10" onClick={() => setSelectedIds([])}>
                선택 해제
              </Button>
            </div>
          </div>
        )}

        {/* Filter Tabs & Search Bar */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
          <div className="flex flex-wrap gap-2">
            {[
              { id: "all", label: "전체 보기" },
              { id: "elementary", label: "초등 논술" },
              { id: "middle_high", label: "중고등 논술" },
              { id: "high_univ", label: "고등 / 대입" },
              { id: "general_adult", label: "일반 / 직장인" },
            ].map((tab) => (
              <Button
                key={tab.id}
                size="sm"
                variant={activeTab === tab.id ? "default" : "outline"}
                className={`text-xs ${activeTab === tab.id ? "bg-indigo-600 text-white" : "text-slate-700"}`}
                onClick={() => setActiveTab(tab.id)}
              >
                {tab.label}
              </Button>
            ))}
          </div>

          <div className="relative w-full sm:w-72">
            <Search className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
            <Input className="pl-9 text-sm" placeholder="강의 제목, 설명, 주제 검색..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
          </div>
        </div>

        {isLoading ? (
          <Card><CardContent className="p-12 text-center text-slate-500">커리큘럼 데이터를 불러오는 중입니다...</CardContent></Card>
        ) : (
          <div>
            {renderGroup("초등 논술", elementary, "text-emerald-600")}
            {renderGroup("중고등 논술", middleHigh, "text-blue-600")}
            {renderGroup("고등 / 대입", highUniv, "text-purple-600")}
            {renderGroup("일반 / 직장인", generalAdult, "text-amber-600")}
          </div>
        )}
      </div>

      {/* Create / Edit Dialog */}
      <Dialog open={formOpen} onOpenChange={(open) => { if (!open) closeForm(); }}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>{editingId ? "⚠️ 커리큘럼 수정 확인" : "새 커리큘럼 카테고리 추가"}</DialogTitle>
            <DialogDescription>{editingId ? "수정 내용을 저장하면 학생용 커리큘럼에 즉시 반영됩니다." : "새로운 과정 카테고리를 개설합니다."}</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSaveForm} className="space-y-4 py-2">
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-sm font-medium">과정</label>
                <select className="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm" value={form.courseType} onChange={(event) => setForm({ ...form, courseType: event.target.value as any })}>
                  <option value="elementary">초등 논술</option>
                  <option value="middle_high">중고등 논술</option>
                  <option value="high_univ">고등 / 대입</option>
                  <option value="general_adult">일반 / 직장인</option>
                </select>
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium">레벨 번호 (Level)</label>
                <Input type="number" min={1} max={20} value={form.level} onChange={(e) => setForm({ ...form, level: Number(e.target.value) })} />
              </div>
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium">강의 제목</label>
              <Input required placeholder="예: 수리·과학적 사고와 논증" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium">강의 상세 설명</label>
              <textarea required placeholder="강의 개요 및 학습 목표를 상세히 입력하세요..." className="w-full min-h-[90px] rounded-md border border-slate-200 p-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium">AI 강의 요약 (선택)</label>
              <Input placeholder="AI가 도출한 핵심 요약 설명..." value={form.aiSummary} onChange={(e) => setForm({ ...form, aiSummary: e.target.value })} />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium">학습 주제 (쉼표로 구분)</label>
              <Input placeholder="논리적 인과관계, 통계 데이터 분석, 설득력 있는 글쓰기" value={form.topicsText} onChange={(e) => setForm({ ...form, topicsText: e.target.value })} />
            </div>

            <DialogFooter className="pt-4">
              <Button type="button" variant="outline" onClick={closeForm}>취소</Button>
              <Button type="submit" className="bg-indigo-600 text-white hover:bg-indigo-700" disabled={createMutation.isPending || updateMutation.isPending}>
                {createMutation.isPending || updateMutation.isPending ? "저장 중..." : "저장 완료"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteId !== null} onOpenChange={(open) => { if (!open) setDeleteId(null); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>⚠️ 카테고리 삭제 실수 방지 경고</DialogTitle>
            <DialogDescription>이 카테고리를 삭제하면 학생용 커리큘럼 목록에서 영구적으로 제외됩니다. 신중하게 검토 후 확정해 주세요.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteId(null)}>취소</Button>
            <Button className="bg-rose-600 text-white hover:bg-rose-700" disabled={deleteMutation.isPending} onClick={() => deleteId && deleteMutation.mutate({ id: deleteId })}>
              {deleteMutation.isPending ? "삭제 처리 중..." : "영구 삭제 확정"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Student View Preview Modal with Device Switcher */}
      <Dialog open={previewCategory !== null} onOpenChange={(open) => { if (!open) setPreviewCategory(null); }}>
        <DialogContent className={`max-h-[85vh] overflow-y-auto transition-all duration-300 ${previewDevice === "mobile" ? "max-w-sm" : "sm:max-w-2xl"}`}>
          <DialogHeader>
            <div className="flex items-center justify-between">
              <DialogTitle className="flex items-center gap-2">
                <Eye className="h-5 w-5 text-indigo-600" /> 학생 화면 상세 미리보기
              </DialogTitle>
              <div className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-100 p-1">
                <Button size="sm" variant={previewDevice === "pc" ? "default" : "ghost"} className={`h-7 gap-1 px-2.5 text-xs ${previewDevice === "pc" ? "bg-indigo-600 text-white" : "text-slate-600"}`} onClick={() => setPreviewDevice("pc")}>
                  <Monitor className="h-3.5 w-3.5" /> PC 뷰
                </Button>
                <Button size="sm" variant={previewDevice === "mobile" ? "default" : "ghost"} className={`h-7 gap-1 px-2.5 text-xs ${previewDevice === "mobile" ? "bg-indigo-600 text-white" : "text-slate-600"}`} onClick={() => setPreviewDevice("mobile")}>
                  <Smartphone className="h-3.5 w-3.5" /> 모바일 뷰
                </Button>
              </div>
            </div>
            <DialogDescription>학생들이 실제로 보게 될 커리큘럼 상세 페이지 레이아웃입니다.</DialogDescription>
          </DialogHeader>
          {previewCategory && (
            <div className="py-4 space-y-4">
              <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm space-y-4">
                <div className="flex items-center gap-2">
                  <span className="rounded-full bg-indigo-100 px-3 py-1 text-xs font-bold text-indigo-700">Level {previewCategory.level}</span>
                  <h2 className="text-xl font-bold text-slate-900">{previewCategory.title}</h2>
                </div>
                <p className="text-sm leading-relaxed text-slate-700">{previewCategory.description}</p>
                {previewCategory.aiSummary && (
                  <div className="rounded-xl bg-indigo-50 border border-indigo-100 p-4">
                    <h4 className="text-xs font-bold text-indigo-700 mb-1">AI 강의 요약</h4>
                    <p className="text-sm text-slate-700">{previewCategory.aiSummary}</p>
                  </div>
                )}
                <div>
                  <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">핵심 학습 주제</h4>
                  <div className="flex flex-wrap gap-2">
                    {previewCategory.topics?.map((topic: string) => (
                      <span key={topic} className="rounded-lg bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-700">{topic}</span>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button onClick={() => setPreviewCategory(null)}>미리보기 닫기</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
