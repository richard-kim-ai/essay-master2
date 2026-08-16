import { useState } from "react";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { BookOpen, Plus, Edit3, Trash2, Layers3, Sparkles, ShieldCheck, GripVertical, ArrowUp, ArrowDown, Eye, Search, CheckCircle2, FileText, Tag, Filter, Copy, Smartphone, Monitor } from "lucide-react";
import { Link } from "wouter";

type CourseTypeEnum = "elementary" | "middle_high" | "high_univ" | "general_adult";

const blankForm = {
  courseType: "elementary" as CourseTypeEnum,
  level: "1",
  title: "",
  description: "",
  topicsText: "",
  aiSummary: "",
  isActive: 1,
};

type CurriculumForm = typeof blankForm;

export default function AdminCurriculumManager() {
  const { user, loading } = useAuth();
  const isAdmin = user?.role === "admin";
  const utils = trpc.useUtils();
  const { data: categories, isLoading } = trpc.admin.getCurriculumCategoriesAdmin.useQuery(undefined, { enabled: isAdmin });
  const [formOpen, setFormOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState<CurriculumForm>(blankForm);
  const [highlightId, setHighlightId] = useState<number | null>(null);
  const [draggedId, setDraggedId] = useState<number | null>(null);
  const [previewCategory, setPreviewCategory] = useState<any | null>(null);
  const [previewDevice, setPreviewDevice] = useState<"pc" | "mobile">("pc");
  const [selectedCourseTab, setSelectedCourseTab] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [selectedIds, setSelectedIds] = useState<number[]>([]);

  const createMutation = trpc.admin.createCurriculumCategoryAdmin.useMutation({
    onSuccess: () => { toast.success("커리큘럼 카테고리를 추가했습니다."); closeForm(); utils.admin.getCurriculumCategoriesAdmin.invalidate(); },
    onError: (error) => toast.error(error.message || "카테고리 추가에 실패했습니다."),
  });
  const updateMutation = trpc.admin.updateCurriculumCategoryAdmin.useMutation({
    onSuccess: () => { toast.success("커리큘럼 카테고리를 수정했습니다."); closeForm(); utils.admin.getCurriculumCategoriesAdmin.invalidate(); },
    onError: (error) => toast.error(error.message || "카테고리 수정에 실패했습니다."),
  });
  const deleteMutation = trpc.admin.deleteCurriculumCategoryAdmin.useMutation({
    onSuccess: () => { toast.success("커리큘럼 카테고리를 삭제했습니다."); setDeleteId(null); utils.admin.getCurriculumCategoriesAdmin.invalidate(); },
    onError: (error) => toast.error(error.message || "카테고리 삭제에 실패했습니다."),
  });
  const reorderMutation = trpc.admin.reorderCurriculumCategoriesAdmin.useMutation({
    onSuccess: () => { toast.success("커리큘럼 순서가 변경되었습니다."); utils.admin.getCurriculumCategoriesAdmin.invalidate(); },
    onError: (error) => toast.error(error.message || "순서 변경에 실패했습니다."),
  });
  const toggleActiveMutation = trpc.admin.toggleCurriculumActiveAdmin.useMutation({
    onSuccess: () => { toast.success("과정 노출 상태가 변경되었습니다."); utils.admin.getCurriculumCategoriesAdmin.invalidate(); },
    onError: (error) => toast.error(error.message || "노출 상태 변경에 실패했습니다."),
  });
  const batchToggleMutation = trpc.admin.batchToggleCurriculumActiveAdmin.useMutation({
    onSuccess: () => { toast.success("선택한 과정들의 노출 상태가 일괄 변경되었습니다."); setSelectedIds([]); utils.admin.getCurriculumCategoriesAdmin.invalidate(); },
    onError: (error) => toast.error(error.message || "일괄 노출 변경에 실패했습니다."),
  });
  const duplicateMutation = trpc.admin.duplicateCurriculumAdmin.useMutation({
    onSuccess: () => { toast.success("커리큘럼 카테고리를 복제했습니다."); utils.admin.getCurriculumCategoriesAdmin.invalidate(); },
    onError: (error) => toast.error(error.message || "카테고리 복제에 실패했습니다."),
  });
  const seedMutation = trpc.admin.seedDefaultCurriculumSamples.useMutation({
    onSuccess: () => { toast.success("고등/대입 및 일반/직장인 샘플 강의가 추가되었습니다."); utils.admin.getCurriculumCategoriesAdmin.invalidate(); },
    onError: (error) => toast.error(error.message || "샘플 추가에 실패했습니다."),
  });

  function closeForm() { setFormOpen(false); setEditingId(null); setForm(blankForm); }
  function openCreate() { setEditingId(null); setForm(blankForm); setFormOpen(true); }
  function openEdit(category: NonNullable<typeof categories>[number]) {
    setEditingId(category.id);
    setForm({
      courseType: category.courseType as CourseTypeEnum,
      level: String(category.level),
      title: category.title,
      description: category.description,
      topicsText: category.topics.join("\n"),
      aiSummary: category.aiSummary ?? "",
      isActive: category.isActive ?? 1,
    });
    setFormOpen(true);
  }
  function submitForm() {
    const payload = {
      courseType: form.courseType,
      level: Number(form.level),
      title: form.title.trim(),
      description: form.description.trim(),
      topics: form.topicsText.split("\n").map((topic) => topic.trim()).filter(Boolean),
      aiSummary: form.aiSummary.trim() || undefined,
      isActive: form.isActive,
    };
    if (!payload.level || !payload.title || !payload.description || payload.topics.length === 0) {
      toast.error("레벨, 제목, 설명, 주제 항목을 모두 입력해 주세요.");
      return;
    }
    if (editingId) updateMutation.mutate({ id: editingId, ...payload });
    else createMutation.mutate(payload);
  }

  function persistListOrder(list: NonNullable<typeof categories>, nextHighlightId: number) {
    const groupIds = list.map((item) => item.id);
    const groupIdSet = new Set(groupIds);
    let groupCursor = 0;
    const finalOrderedIds = (categories ?? []).map((item) => groupIdSet.has(item.id) ? groupIds[groupCursor++] : item.id);
    setHighlightId(nextHighlightId);
    window.setTimeout(() => setHighlightId(null), 1100);
    reorderMutation.mutate({ orderedIds: finalOrderedIds });
  }

  function moveCategory(index: number, direction: "up" | "down", list: NonNullable<typeof categories>) {
    const targetIndex = direction === "up" ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= list.length) return;
    const newList = [...list];
    [newList[index], newList[targetIndex]] = [newList[targetIndex], newList[index]];
    persistListOrder(newList, newList[targetIndex].id);
  }

  function dropCategory(sourceId: number, targetId: number, list: NonNullable<typeof categories>) {
    const sourceIndex = list.findIndex((item) => item.id === sourceId);
    const targetIndex = list.findIndex((item) => item.id === targetId);
    if (sourceIndex < 0 || targetIndex < 0 || sourceIndex === targetIndex) return;
    const newList = [...list];
    const [moved] = newList.splice(sourceIndex, 1);
    newList.splice(targetIndex, 0, moved);
    persistListOrder(newList, sourceId);
  }

  function toggleSelectAll(list: NonNullable<typeof categories>) {
    const ids = list.map(i => i.id);
    const allSelected = ids.every(id => selectedIds.includes(id));
    if (allSelected) {
      setSelectedIds(selectedIds.filter(id => !ids.includes(id)));
    } else {
      const merged = Array.from(new Set([...selectedIds, ...ids]));
      setSelectedIds(merged);
    }
  }

  if (loading) return <div className="p-12 text-center text-slate-600">권한을 확인하는 중입니다...</div>;
  if (!isAdmin) return <div className="p-12 text-center text-slate-600">관리자 권한이 필요합니다.</div>;

  const filteredCategories = (categories ?? []).filter((category) => {
    if (selectedCourseTab !== "all" && category.courseType !== selectedCourseTab) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchTitle = category.title.toLowerCase().includes(q);
      const matchDesc = category.description.toLowerCase().includes(q);
      const matchTopics = category.topics.some((t) => t.toLowerCase().includes(q));
      return matchTitle || matchDesc || matchTopics;
    }
    return true;
  });

  const elementary = filteredCategories.filter((category) => category.courseType === "elementary");
  const middleHigh = filteredCategories.filter((category) => category.courseType === "middle_high");
  const highUniv = filteredCategories.filter((category) => category.courseType === "high_univ");
  const generalAdult = filteredCategories.filter((category) => category.courseType === "general_adult");

  const renderGroup = (title: string, items: typeof elementary, color: string) => {
    if (items.length === 0 && selectedCourseTab !== "all") return null;
    const allChecked = items.length > 0 && items.every(i => selectedIds.includes(i.id));

    return (
      <Card className="mb-6">
        <CardHeader>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <CardTitle className="flex items-center gap-2">
              <Layers3 className={`h-5 w-5 ${color}`} /> {title}
              <span className="ml-2 rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-semibold text-slate-600">{items.length}개</span>
            </CardTitle>
            {items.length > 0 && (
              <div className="flex items-center gap-3">
                <label className="flex items-center gap-2 cursor-pointer text-xs font-semibold text-slate-600">
                  <Checkbox checked={allChecked} onCheckedChange={() => toggleSelectAll(items)} /> 전체 선택
                </label>
              </div>
            )}
          </div>
          <CardDescription>카드를 드래그하거나 위아래 버튼으로 노출 순서를 변경할 수 있습니다. 토글 또는 일괄 체크박스로 학생 화면 노출 여부를 제어하세요.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
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
                  className={`rounded-xl border p-4 transition ${category.isActive === 0 ? "border-slate-300 bg-slate-100/70 opacity-75" : "border-slate-200 bg-white hover:border-indigo-200 hover:shadow-sm"} ${highlightId === category.id ? "curriculum-order-highlight" : ""} ${draggedId === category.id ? "opacity-50" : ""} ${isSelected ? "ring-2 ring-indigo-500 bg-indigo-50/20" : ""}`}
                >
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="flex items-start gap-3 min-w-0 flex-1">
                      <Checkbox
                        className="mt-1"
                        checked={isSelected}
                        onCheckedChange={(checked) => {
                          if (checked) setSelectedIds([...selectedIds, category.id]);
                          else setSelectedIds(selectedIds.filter(id => id !== category.id));
                        }}
                      />
                      <div className="min-w-0 flex-1">
                        <div className="mb-2 flex flex-wrap items-center gap-2">
                          <span className="inline-flex cursor-grab items-center gap-1 rounded-full bg-indigo-100 px-2.5 py-1 text-xs font-bold text-indigo-700 active:cursor-grabbing">
                            <GripVertical className="h-3.5 w-3.5" /> 순서 #{idx + 1} (Level {category.level})
                          </span>
                          <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-bold ${category.isActive !== 0 ? "bg-emerald-100 text-emerald-700" : "bg-slate-200 text-slate-600"}`}>
                            {category.isActive !== 0 ? "학생 노출 중" : "비공개 (숨김)"}
                          </span>
                          <h3 className="font-bold text-slate-900">{category.title}</h3>
                        </div>
                        <p className="text-sm leading-6 text-slate-600">{category.description}</p>
                        {category.aiSummary && (
                          <div className="mt-3 rounded-lg border border-indigo-100 bg-indigo-50/70 p-3">
                            <p className="mb-1 text-xs font-semibold text-indigo-700">AI 강의 요약</p>
                            <p className="text-sm leading-6 text-slate-700">{category.aiSummary}</p>
                          </div>
                        )}
                        <div className="mt-3 flex flex-wrap gap-1.5">
                          {category.topics.map((topic: string) => (
                            <span key={topic} className="rounded-md bg-slate-100 px-2 py-1 text-xs text-slate-600">{topic}</span>
                          ))}
                        </div>
                        {category.aiTags?.length > 0 && (
                          <div className="mt-3 flex flex-wrap gap-1.5">
                            {category.aiTags.map((tag: string) => (
                              <span key={tag} className="rounded-full border border-indigo-200 bg-indigo-50 px-2.5 py-1 text-xs font-semibold text-indigo-700">#{tag}</span>
                            ))}
                          </div>
                        )}
                        {category.samplePdfUrl && (
                          <a href={category.samplePdfUrl} target="_blank" rel="noreferrer" className="mt-3 inline-flex text-sm font-semibold text-amber-700 underline-offset-4 hover:underline">
                            샘플 PDF 학습 자료 열기
                          </a>
                        )}
                      </div>
                    </div>
                    <div className="flex shrink-0 flex-wrap items-center gap-2 sm:flex-col sm:items-end">
                      <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5">
                        <span className="text-xs font-medium text-slate-600">노출</span>
                        <Switch
                          checked={category.isActive !== 0}
                          onCheckedChange={(checked) => toggleActiveMutation.mutate({ id: category.id, isActive: checked ? 1 : 0 })}
                          disabled={toggleActiveMutation.isPending}
                        />
                      </div>
                      <div className="flex items-center gap-1.5">
                        <div className="flex flex-col gap-1">
                          <Button size="icon" variant="outline" className="h-7 w-7" disabled={idx === 0 || reorderMutation.isPending} onClick={() => moveCategory(idx, "up", items)} aria-label="위로 이동">
                            <ArrowUp className="h-3.5 w-3.5" />
                          </Button>
                          <Button size="icon" variant="outline" className="h-7 w-7" disabled={idx === items.length - 1 || reorderMutation.isPending} onClick={() => moveCategory(idx, "down", items)} aria-label="아래로 이동">
                            <ArrowDown className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                        <Button size="sm" variant="outline" className="gap-1 text-indigo-700 border-indigo-200 bg-indigo-50 hover:bg-indigo-100" onClick={() => { setPreviewDevice("pc"); setPreviewCategory(category); }}>
                          <Eye className="h-3.5 w-3.5" /> 미리보기
                        </Button>
                        <Button size="sm" variant="outline" className="gap-1 text-emerald-700 border-emerald-200 bg-emerald-50 hover:bg-emerald-100" title="카드 복제" onClick={() => duplicateMutation.mutate({ id: category.id })} disabled={duplicateMutation.isPending}>
                          <Copy className="h-3.5 w-3.5" /> 복제
                        </Button>
                        <Button size="sm" variant="outline" className="gap-1" onClick={() => openEdit(category)}>
                          <Edit3 className="h-3.5 w-3.5" /> 수정
                        </Button>
                        <Button size="sm" variant="outline" className="gap-1 text-rose-700 hover:bg-rose-50" onClick={() => setDeleteId(category.id)}>
                          <Trash2 className="h-3.5 w-3.5" /> 삭제
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

        <Card className="border-indigo-100 bg-indigo-50/60">
          <CardContent className="flex gap-3 p-5">
            <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-indigo-700" />
            <div>
              <p className="font-semibold text-indigo-950">운영 안내</p>
              <p className="mt-1 text-sm leading-6 text-indigo-900/80">각 카드를 마우스로 끌어 놓거나 상하 화살표 버튼을 사용해 학생 화면 노출 순서를 간편하게 변경할 수 있으며, 순서가 변경된 카드는 부드러운 강조 배경 효과로 즉시 안내됩니다. '샘플 강의 3개씩 추가' 버튼을 누르면 고등/대입 및 일반/직장인 과정의 테스트용 강의가 즉시 생성됩니다.</p>
            </div>
          </CardContent>
        </Card>

        {/* Filter Tabs & Search Bar */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between rounded-xl border border-slate-200 bg-white p-4 shadow-xs">
          <div className="flex flex-wrap items-center gap-2">
            <span className="flex items-center gap-1.5 text-xs font-bold text-slate-500 mr-2"><Filter className="h-3.5 w-3.5" /> 과정 필터</span>
            <Button size="sm" variant={selectedCourseTab === "all" ? "default" : "outline"} className={selectedCourseTab === "all" ? "bg-indigo-600 text-white hover:bg-indigo-700" : ""} onClick={() => setSelectedCourseTab("all")}>전체 과정</Button>
            <Button size="sm" variant={selectedCourseTab === "elementary" ? "default" : "outline"} className={selectedCourseTab === "elementary" ? "bg-emerald-600 text-white hover:bg-emerald-700" : ""} onClick={() => setSelectedCourseTab("elementary")}>초등 논술</Button>
            <Button size="sm" variant={selectedCourseTab === "middle_high" ? "default" : "outline"} className={selectedCourseTab === "middle_high" ? "bg-blue-600 text-white hover:bg-blue-700" : ""} onClick={() => setSelectedCourseTab("middle_high")}>중고등 논술</Button>
            <Button size="sm" variant={selectedCourseTab === "high_univ" ? "default" : "outline"} className={selectedCourseTab === "high_univ" ? "bg-purple-600 text-white hover:bg-purple-700" : ""} onClick={() => setSelectedCourseTab("high_univ")}>고등 / 대입</Button>
            <Button size="sm" variant={selectedCourseTab === "general_adult" ? "default" : "outline"} className={selectedCourseTab === "general_adult" ? "bg-amber-600 text-white hover:bg-amber-700" : ""} onClick={() => setSelectedCourseTab("general_adult")}>일반 / 직장인</Button>
          </div>
          <div className="relative w-full sm:w-72">
            <Search className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
            <Input className="pl-9" placeholder="강의 제목, 설명, 주제 검색..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
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
          <div className="space-y-4 py-2">
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
                <label className="mb-1 block text-sm font-medium">레벨 순서</label>
                <Input type="number" min={1} max={20} value={form.level} onChange={(event) => setForm({ ...form, level: event.target.value })} />
              </div>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">카테고리 제목</label>
              <Input placeholder="예: 인문·사회 제시문 심층 분석" value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">설명</label>
              <Textarea className="min-h-24" placeholder="과정 개요를 입력하세요" value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">주제 및 콘텐츠 항목 (줄바꿈 구분)</label>
              <Textarea className="min-h-32" placeholder={"주제 1\n주제 2"} value={form.topicsText} onChange={(event) => setForm({ ...form, topicsText: event.target.value })} />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">AI 강의 요약 설명 (선택)</label>
              <Textarea className="min-h-20" placeholder="학습자가 얻는 핵심 역량을 2문장 이내로 입력합니다." value={form.aiSummary} onChange={(event) => setForm({ ...form, aiSummary: event.target.value })} />
            </div>
            <div className="flex items-center justify-between rounded-lg border border-slate-200 bg-slate-50 p-4">
              <div>
                <p className="font-medium text-slate-900">학생 화면 즉시 노출</p>
                <p className="text-xs text-slate-500">비활성화하면 학생용 커리큘럼 및 워크북에서 숨겨집니다.</p>
              </div>
              <Switch checked={form.isActive === 1} onCheckedChange={(checked) => setForm({ ...form, isActive: checked ? 1 : 0 })} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={closeForm}>취소</Button>
            <Button className="bg-indigo-600 text-white hover:bg-indigo-700" disabled={createMutation.isPending || updateMutation.isPending} onClick={submitForm}>
              {createMutation.isPending || updateMutation.isPending ? "저장 중..." : editingId ? "수정 확정 저장" : "추가 저장"}
            </Button>
          </DialogFooter>
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
            <DialogDescription>학생들이 실제로 보게 되는 강의 상세 페이지의 레이아웃과 콘텐츠 구성입니다 ({previewDevice.toUpperCase()} 화면).</DialogDescription>
          </DialogHeader>
          {previewCategory && (
            <div className={`space-y-6 py-4 mx-auto w-full ${previewDevice === "mobile" ? "max-w-[320px] border-x-4 border-slate-800 px-2 rounded-xl bg-slate-50" : ""}`}>
              <div className="rounded-2xl border border-indigo-100 bg-gradient-to-br from-indigo-50/60 to-white p-6 shadow-xs">
                <div className="mb-3 flex flex-wrap items-center gap-2">
                  <span className="rounded-full bg-indigo-600 px-3 py-1 text-xs font-bold text-white">Level {previewCategory.level}</span>
                  <span className="rounded-full bg-slate-200 px-3 py-1 text-xs font-semibold text-slate-700">
                    {previewCategory.courseType === "elementary" ? "초등 논술" : previewCategory.courseType === "middle_high" ? "중고등 논술" : previewCategory.courseType === "high_univ" ? "고등 / 대입" : "일반 / 직장인"}
                  </span>
                </div>
                <h2 className="text-2xl font-extrabold text-slate-900">{previewCategory.title}</h2>
                <p className="mt-2 text-base leading-relaxed text-slate-600">{previewCategory.description}</p>
              </div>

              {previewCategory.aiSummary && (
                <div className="rounded-xl border border-indigo-200 bg-white p-5 shadow-xs">
                  <h4 className="flex items-center gap-2 font-bold text-indigo-900"><Sparkles className="h-4 w-4 text-indigo-600" /> AI 강의 요약 및 특징</h4>
                  <p className="mt-2 text-sm leading-6 text-slate-700">{previewCategory.aiSummary}</p>
                  {previewCategory.aiTags?.length > 0 && (
                    <div className="mt-4 flex flex-wrap gap-2">
                      {previewCategory.aiTags.map((tag: string) => (
                        <span key={tag} className="rounded-full bg-indigo-50 px-3 py-1 text-xs font-bold text-indigo-700">#{tag}</span>
                      ))}
                    </div>
                  )}
                </div>
              )}

              <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs">
                <h4 className="font-bold text-slate-900">핵심 학습 주제 ({previewCategory.topics?.length ?? 0}개)</h4>
                <div className={`mt-3 grid gap-2.5 ${previewDevice === "mobile" ? "grid-cols-1" : "sm:grid-cols-2"}`}>
                  {previewCategory.topics?.map((topic: string, i: number) => (
                    <div key={topic} className="flex items-center gap-2.5 rounded-lg border border-slate-100 bg-slate-50 p-3 text-sm font-medium text-slate-800">
                      <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
                      <span>{i + 1}. {topic}</span>
                    </div>
                  ))}
                </div>
              </div>

              {previewCategory.samplePdfUrl && (
                <div className="flex flex-col sm:flex-row items-center justify-between gap-3 rounded-xl border border-amber-200 bg-amber-50/70 p-4">
                  <div className="flex items-center gap-3">
                    <div className="rounded-lg bg-amber-100 p-2.5 text-amber-700"><FileText className="h-5 w-5" /></div>
                    <div>
                      <p className="font-bold text-amber-900">샘플 PDF 학습 자료</p>
                      <p className="text-xs text-amber-700">학생들이 워크북 실습을 위해 다운로드할 수 있는 교재입니다.</p>
                    </div>
                  </div>
                  <a href={previewCategory.samplePdfUrl} target="_blank" rel="noreferrer" className="w-full sm:w-auto">
                    <Button size="sm" className="w-full bg-amber-700 text-white hover:bg-amber-800">PDF 열기</Button>
                  </a>
                </div>
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setPreviewCategory(null)}>닫기</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
