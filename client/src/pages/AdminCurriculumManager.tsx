import { useState } from "react";
import { Link } from "wouter";
import { BookOpen, Edit3, Layers3, Plus, ShieldCheck, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

type CourseTypeEnum = "elementary" | "middle_high" | "high_univ" | "general_adult";
const blankForm = {
  courseType: "elementary" as CourseTypeEnum,
  level: "1",
  title: "",
  description: "",
  topicsText: "",
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

  function closeForm() { setFormOpen(false); setEditingId(null); setForm(blankForm); }
  function openCreate() { setEditingId(null); setForm(blankForm); setFormOpen(true); }
  function openEdit(category: NonNullable<typeof categories>[number]) {
    setEditingId(category.id);
    setForm({ courseType: category.courseType, level: String(category.level), title: category.title, description: category.description, topicsText: category.topics.join("\n") });
    setFormOpen(true);
  }
  function submitForm() {
    const payload = { courseType: form.courseType, level: Number(form.level), title: form.title.trim(), description: form.description.trim(), topics: form.topicsText.split("\n").map((topic) => topic.trim()).filter(Boolean) };
    if (!payload.level || !payload.title || !payload.description || payload.topics.length === 0) { toast.error("레벨, 제목, 설명, 주제 항목을 모두 입력해 주세요."); return; }
    if (editingId) updateMutation.mutate({ id: editingId, ...payload }); else createMutation.mutate(payload);
  }

  if (loading) return <div className="p-12 text-center text-slate-600">권한을 확인하는 중입니다...</div>;
  if (!isAdmin) return <div className="p-12 text-center text-slate-600">관리자 권한이 필요합니다.</div>;

  const elementary = (categories ?? []).filter((category) => category.courseType === "elementary");
  const middleHigh = (categories ?? []).filter((category) => category.courseType === "middle_high");
  const renderGroup = (title: string, items: typeof elementary, color: string) => (
    <Card>
      <CardHeader><CardTitle className="flex items-center gap-2"><Layers3 className={`h-5 w-5 ${color}`} /> {title}</CardTitle><CardDescription>{items.length}개 카테고리 · 학생용 커리큘럼 화면에 표시되는 순서입니다.</CardDescription></CardHeader>
      <CardContent className="space-y-3">
        {items.length === 0 ? <div className="rounded-xl border border-dashed border-slate-300 p-8 text-center text-sm text-slate-500">아직 등록된 동적 카테고리가 없습니다.</div> : items.map((category) => <div key={category.id} className="rounded-xl border border-slate-200 bg-white p-4 transition hover:border-indigo-200 hover:shadow-sm"><div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between"><div className="min-w-0"><div className="mb-2 flex flex-wrap items-center gap-2"><span className="rounded-full bg-indigo-100 px-2.5 py-1 text-xs font-bold text-indigo-700">Level {category.level}</span><h3 className="font-bold text-slate-900">{category.title}</h3></div><p className="text-sm leading-6 text-slate-600">{category.description}</p><div className="mt-3 flex flex-wrap gap-1.5">{category.topics.map((topic) => <span key={topic} className="rounded-md bg-slate-100 px-2 py-1 text-xs text-slate-600">{topic}</span>)}</div></div><div className="flex shrink-0 gap-2"><Button size="sm" variant="outline" className="gap-1" onClick={() => openEdit(category)}><Edit3 className="h-3.5 w-3.5" /> 수정</Button><Button size="sm" variant="outline" className="gap-1 text-rose-700 hover:bg-rose-50" onClick={() => setDeleteId(category.id)}><Trash2 className="h-3.5 w-3.5" /> 삭제</Button></div></div></div>)}
      </CardContent>
    </Card>
  );

  return <div className="min-h-screen bg-slate-50 px-4 py-8 sm:px-6 lg:px-8"><div className="mx-auto max-w-7xl space-y-6">
    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"><div className="flex items-center gap-3"><div className="rounded-2xl bg-indigo-100 p-3 text-indigo-700"><BookOpen className="h-8 w-8" /></div><div><p className="text-sm font-semibold text-indigo-700">관리자 운영 콘솔</p><h1 className="text-3xl font-bold text-slate-900">커리큘럼 카테고리 관리</h1><p className="mt-1 text-sm text-slate-600">관리자가 추가·수정한 카테고리는 학생용 커리큘럼 화면에 즉시 반영됩니다.</p></div></div><div className="flex gap-2"><Link href="/admin"><Button variant="outline">관리자 대시보드</Button></Link><Button className="gap-2 bg-indigo-600 text-white hover:bg-indigo-700" onClick={openCreate}><Plus className="h-4 w-4" /> 카테고리 추가</Button></div></div>
    <Card className="border-indigo-100 bg-indigo-50/60"><CardContent className="flex gap-3 p-5"><ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-indigo-700" /><div><p className="font-semibold text-indigo-950">운영 기준</p><p className="mt-1 text-sm leading-6 text-indigo-900/80">카테고리를 삭제하면 학생 화면에서 해당 카드가 사라집니다. 이미 학습한 진도 데이터는 별도로 삭제하지 않으며, 삭제 전 확인 대화상자를 통해 영향을 다시 확인합니다.</p></div></CardContent></Card>
    {isLoading ? <Card><CardContent className="p-12 text-center text-slate-500">커리큘럼 카테고리를 불러오는 중입니다...</CardContent></Card> : <div className="grid gap-6 lg:grid-cols-2">{renderGroup("초등 논술", elementary, "text-emerald-600")}{renderGroup("중고등 논술", middleHigh, "text-blue-600")}</div>}
  </div>

    <Dialog open={formOpen} onOpenChange={(open) => { if (!open) closeForm(); }}><DialogContent className="sm:max-w-xl"><DialogHeader><DialogTitle>{editingId ? "커리큘럼 카테고리 수정" : "새 커리큘럼 카테고리 추가"}</DialogTitle><DialogDescription>각 줄에 하나의 주제 항목을 입력하세요. 저장 후 학생용 커리큘럼에 반영됩니다.</DialogDescription></DialogHeader><div className="space-y-4 py-2"><div className="grid gap-4 sm:grid-cols-2"><div><label className="mb-1 block text-sm font-medium">과정</label><select className="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm" value={form.courseType} onChange={(event) => setForm({ ...form, courseType: event.target.value as typeof form.courseType })}><option value="elementary">초등 논술</option><option value="middle_high">중고등 논술</option></select></div><div><label className="mb-1 block text-sm font-medium">레벨</label><Input type="number" min={1} max={20} value={form.level} onChange={(event) => setForm({ ...form, level: event.target.value })} /></div></div><div><label className="mb-1 block text-sm font-medium">카테고리 제목</label><Input placeholder="예: 근거를 들어 주장하기" value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} /></div><div><label className="mb-1 block text-sm font-medium">설명</label><Textarea className="min-h-24" placeholder="학습자가 이 단계에서 무엇을 배우는지 설명하세요." value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} /></div><div><label className="mb-1 block text-sm font-medium">주제 및 콘텐츠 항목</label><Textarea className="min-h-32" placeholder={"주장과 근거 구분하기\n근거 자료 고르기\n설득하는 문장 만들기"} value={form.topicsText} onChange={(event) => setForm({ ...form, topicsText: event.target.value })} /><p className="mt-1 text-xs text-slate-500">한 줄에 하나씩 입력합니다.</p></div></div><DialogFooter><Button variant="outline" onClick={closeForm}>취소</Button><Button className="bg-indigo-600 text-white hover:bg-indigo-700" disabled={createMutation.isPending || updateMutation.isPending} onClick={submitForm}>{createMutation.isPending || updateMutation.isPending ? "저장 중..." : editingId ? "수정 저장" : "추가 저장"}</Button></DialogFooter></DialogContent></Dialog>

    <Dialog open={deleteId !== null} onOpenChange={(open) => { if (!open) setDeleteId(null); }}><DialogContent className="sm:max-w-md"><DialogHeader><DialogTitle>카테고리 삭제 확인</DialogTitle><DialogDescription>이 카테고리를 삭제하면 학생용 커리큘럼에서 사라집니다. 학습 진도 데이터는 삭제되지 않습니다. 계속하시겠습니까?</DialogDescription></DialogHeader><DialogFooter><Button variant="outline" onClick={() => setDeleteId(null)}>취소</Button><Button className="bg-rose-600 text-white hover:bg-rose-700" disabled={deleteMutation.isPending} onClick={() => deleteId && deleteMutation.mutate({ id: deleteId })}>{deleteMutation.isPending ? "삭제 중..." : "삭제 확정"}</Button></DialogFooter></DialogContent></Dialog>
  </div>;
}
