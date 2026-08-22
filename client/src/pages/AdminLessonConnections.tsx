import { useEffect, useMemo, useState } from "react";
import { Link } from "wouter";
import { CheckCircle2, Link2, Loader2, Settings2 } from "lucide-react";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

type CourseType = "elementary" | "middle_high" | "high_univ" | "general_adult";

const courseOptions: { value: CourseType; label: string }[] = [
  { value: "elementary", label: "초등 논술" },
  { value: "middle_high", label: "중고등 논술" },
  { value: "high_univ", label: "고등/대입 논술" },
  { value: "general_adult", label: "일반/직장인" },
];

const lessonLabels = ["첫 번째 레슨", "두 번째 레슨", "세 번째 레슨"];

function toggleId(ids: number[], id: number, checked: boolean) {
  return checked ? Array.from(new Set([...ids, id])) : ids.filter((item) => item !== id);
}

export default function AdminLessonConnections() {
  const { user } = useAuth();
  const utils = trpc.useUtils();
  const [courseType, setCourseType] = useState<CourseType>("middle_high");
  const [lessonLevel, setLessonLevel] = useState(1);
  const [lessonIndex, setLessonIndex] = useState(0);
  const [connectionMode, setConnectionMode] = useState<"automatic" | "manual">("automatic");
  const [theoryContentIds, setTheoryContentIds] = useState<number[]>([]);
  const [workbookQuestionIds, setWorkbookQuestionIds] = useState<number[]>([]);
  const input = useMemo(() => ({ courseType, lessonLevel, lessonIndex }), [courseType, lessonLevel, lessonIndex]);
  const { data, isLoading } = trpc.theoryContent.getLessonConnectionOptions.useQuery(input, { enabled: user?.role === "admin" });
  const saveMutation = trpc.theoryContent.saveLessonConnection.useMutation({
    onSuccess: async () => {
      toast.success("이 레슨의 연결 기준을 저장했습니다.");
      await Promise.all([
        utils.theoryContent.getLessonConnectionOptions.invalidate(input),
        utils.curriculum.getWorkbookLessonBundle.invalidate(),
      ]);
    },
    onError: (error) => toast.error(error.message || "연결 기준을 저장하지 못했습니다."),
  });

  useEffect(() => {
    setConnectionMode(data?.connection?.connectionMode ?? "automatic");
    setTheoryContentIds(data?.connection?.theoryContentIds ?? []);
    setWorkbookQuestionIds(data?.connection?.workbookQuestionIds ?? []);
  }, [data?.connection?.connectionMode, data?.connection?.theoryContentIds, data?.connection?.workbookQuestionIds, courseType, lessonLevel, lessonIndex]);

  if (user?.role !== "admin") return <div className="min-h-screen bg-slate-50 p-12 text-center text-slate-700">관리자 전용 페이지입니다.</div>;

  const managedTheoryContent = (data?.theoryContent ?? []).flatMap((item) => "id" in item ? [item] : []);
  const automaticTheoryId = managedTheoryContent[lessonIndex]?.id;
  const visibleTheoryIds = connectionMode === "manual" ? theoryContentIds : automaticTheoryId ? [automaticTheoryId] : [];
  const visibleQuestionIds = connectionMode === "manual" ? workbookQuestionIds : (data?.workbookQuestions.map((item) => item.id) ?? []);

  return <main className="min-h-screen bg-slate-50 px-4 py-7 sm:px-6 lg:px-8"><div className="mx-auto max-w-5xl space-y-6">
    <section className="rounded-2xl bg-slate-950 px-5 py-6 text-white shadow-sm sm:px-7"><div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between"><div><p className="text-sm font-semibold text-sky-300">관리자 운영 콘솔 · 레슨 연결</p><h1 className="mt-2 text-2xl font-bold sm:text-3xl">추가 이론과 기출문제 연결 기준</h1><p className="mt-2 max-w-2xl text-sm leading-6 text-slate-300">레슨마다 자동 기준을 쓰거나, 학습자에게 보여 줄 추가 이론과 기출문제를 직접 선택할 수 있습니다.</p></div><Link href="/admin/theory-content"><Button variant="outline" className="border-slate-500 bg-slate-900 text-white hover:bg-slate-800 hover:text-white">이론 콘텐츠 관리</Button></Link></div></section>

    <Card><CardHeader><CardTitle className="flex items-center gap-2 text-lg"><Settings2 className="h-5 w-5 text-indigo-600" />설정할 레슨 선택</CardTitle><CardDescription>과정과 레슨을 선택하면 해당 레슨에서 연결할 후보를 확인할 수 있습니다.</CardDescription></CardHeader><CardContent className="grid gap-3 sm:grid-cols-3"><select aria-label="과정" value={courseType} onChange={(event) => setCourseType(event.target.value as CourseType)} className="h-10 rounded-md border border-slate-200 bg-white px-3 text-sm font-medium text-slate-800">{courseOptions.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select><select aria-label="레벨" value={lessonLevel} onChange={(event) => setLessonLevel(Number(event.target.value))} className="h-10 rounded-md border border-slate-200 bg-white px-3 text-sm font-medium text-slate-800">{[1, 2, 3, 4, 5].map((value) => <option key={value} value={value}>Level {value}</option>)}</select><select aria-label="레슨" value={lessonIndex} onChange={(event) => setLessonIndex(Number(event.target.value))} className="h-10 rounded-md border border-slate-200 bg-white px-3 text-sm font-medium text-slate-800">{lessonLabels.map((label, index) => <option key={label} value={index}>{label}</option>)}</select></CardContent></Card>

    {isLoading ? <Card><CardContent className="flex items-center justify-center gap-2 p-12 text-slate-500"><Loader2 className="h-5 w-5 animate-spin" />연결 후보를 불러오는 중입니다.</CardContent></Card> : <><Card className="border-indigo-200"><CardHeader><CardTitle className="flex items-center gap-2 text-lg"><Link2 className="h-5 w-5 text-indigo-600" />연결 기준</CardTitle><CardDescription>자동 기준은 레슨 순서에 맞춘 기본 이론과 해당 레슨의 고정 기출문제를 사용합니다.</CardDescription></CardHeader><CardContent className="grid gap-3 sm:grid-cols-2"><button type="button" onClick={() => setConnectionMode("automatic")} className={`rounded-xl border p-4 text-left transition-colors ${connectionMode === "automatic" ? "border-indigo-500 bg-indigo-50" : "border-slate-200 bg-white hover:border-indigo-200"}`}><p className="font-bold text-slate-900">기본 자동 연결</p><p className="mt-1 text-sm leading-6 text-slate-600">레슨 순서와 고정 기출문제 구성을 그대로 사용합니다.</p></button><button type="button" onClick={() => setConnectionMode("manual")} className={`rounded-xl border p-4 text-left transition-colors ${connectionMode === "manual" ? "border-indigo-500 bg-indigo-50" : "border-slate-200 bg-white hover:border-indigo-200"}`}><p className="font-bold text-slate-900">직접 선택</p><p className="mt-1 text-sm leading-6 text-slate-600">이 레슨에 노출할 추가 이론과 기출문제를 직접 고릅니다.</p></button></CardContent></Card>

    <div className="grid gap-6 lg:grid-cols-2"><Card><CardHeader><CardTitle className="text-lg">추가 이론 선택</CardTitle><CardDescription>{connectionMode === "manual" ? "선택한 항목만 기본 교재 아래에 표시됩니다." : "자동 기준으로 연결되는 이론을 확인합니다."}</CardDescription></CardHeader><CardContent className="space-y-3">{managedTheoryContent.length ? managedTheoryContent.map((item) => { const isSelected = visibleTheoryIds.includes(item.id); return <Label key={item.id} className={`flex cursor-pointer items-start gap-3 rounded-lg border p-3 ${isSelected ? "border-violet-300 bg-violet-50" : "border-slate-200 bg-white"}`}><Checkbox checked={isSelected} disabled={connectionMode === "automatic"} onCheckedChange={(checked) => setTheoryContentIds((ids) => toggleId(ids, item.id, checked === true))} /><span><span className="block text-sm font-semibold text-slate-900">{item.title}</span><span className="mt-1 block text-xs leading-5 text-slate-600">{item.theorySubcategory}</span></span></Label>; }) : <p className="rounded-lg bg-slate-50 p-4 text-sm text-slate-500">선택한 레벨에 공개된 추가 이론이 없습니다.</p>}</CardContent></Card>

    <Card><CardHeader><CardTitle className="text-lg">고정 기출문제 선택</CardTitle><CardDescription>{connectionMode === "manual" ? "선택한 항목만 레슨 마지막에 표시됩니다." : "이 레슨에 기본으로 연결된 기출문제를 확인합니다."}</CardDescription></CardHeader><CardContent className="space-y-3">{data?.workbookQuestions.length ? data.workbookQuestions.map((item) => { const isSelected = visibleQuestionIds.includes(item.id); return <Label key={item.id} className={`flex cursor-pointer items-start gap-3 rounded-lg border p-3 ${isSelected ? "border-amber-300 bg-amber-50" : "border-slate-200 bg-white"}`}><Checkbox checked={isSelected} disabled={connectionMode === "automatic"} onCheckedChange={(checked) => setWorkbookQuestionIds((ids) => toggleId(ids, item.id, checked === true))} /><span><span className="block text-sm font-semibold text-slate-900">{item.title}</span><span className="mt-1 block text-xs leading-5 text-slate-600">{item.questionType === "objective" ? "선택형" : "서술형"} · {item.prompt.slice(0, 80)}{item.prompt.length > 80 ? "…" : ""}</span></span></Label>; }) : <p className="rounded-lg bg-slate-50 p-4 text-sm text-slate-500">선택한 레슨에 등록된 기출문제가 없습니다.</p>}</CardContent></Card></div>

    <div className="flex flex-col gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-4 sm:flex-row sm:items-center sm:justify-between"><p className="flex items-start gap-2 text-sm leading-6 text-emerald-900"><CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />저장 후 학습자 워크북에는 선택한 기준이 바로 반영됩니다. 직접 선택 기준에서는 이론 또는 기출문제를 하나 이상 골라야 합니다.</p><Button disabled={saveMutation.isPending} onClick={() => saveMutation.mutate({ ...input, connectionMode, theoryContentIds, workbookQuestionIds })} className="shrink-0 bg-emerald-700 text-white hover:bg-emerald-800">{saveMutation.isPending ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />저장 중</> : "연결 기준 저장"}</Button></div></>}
  </div></main>;
}
