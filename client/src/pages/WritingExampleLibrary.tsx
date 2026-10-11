import { useEffect, useMemo, useState } from "react";
import { Link } from "wouter";
import { trpc } from "@/lib/trpc";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { BookMarked, Filter, LibraryBig, Loader2, Search, ShieldCheck, Sparkles } from "lucide-react";
import { useLearningCourse } from "@/hooks/useLearningCourse";
import { buildWorkbookReturnPath } from "@/lib/workbookReturn";

export default function WritingExampleLibrary() {
  const { effectiveCourse, courseLabel, scopeKey, loading, isStudent, canLearn, canPersist, needsSelection } = useLearningCourse();
  const [search, setSearch] = useState("");
  const [skillTag, setSkillTag] = useState("");
  const input = useMemo(() => ({ courseType: effectiveCourse ?? undefined, search: search.trim() || undefined, skillTag: skillTag.trim() || undefined }), [effectiveCourse, search, skillTag]);
  const enabled = canPersist && !!effectiveCourse;
  const { data: examples = [], isLoading } = trpc.learningResources.publishedWritingExamples.useQuery(input, { enabled });
  const scopedExamples = useMemo(() => examples.filter((example) => example.courseType === effectiveCourse), [examples, effectiveCourse]);
  const tags = useMemo(() => Array.from(new Set(scopedExamples.flatMap((example) => (example.skillTags || "").split(",").map((tag) => tag.trim()).filter(Boolean)))), [scopedExamples]);

  useEffect(() => { setSearch(""); setSkillTag(""); }, [scopeKey]);

  if (loading) return <div role="status" className="py-16 text-center text-slate-600">학습 과정을 확인하고 있습니다.</div>;
  if (!isStudent) return <div className="py-16 text-center text-slate-600">우수 예시문 라이브러리는 가입한 학습자 계정에서 제공됩니다.</div>;
  if (needsSelection || !canLearn || !effectiveCourse) return <div role="alert" className="py-16 text-center text-slate-600">가입 과정을 확인한 뒤 우수 예시문 라이브러리를 이용할 수 있습니다.</div>;

  const workbookPath = buildWorkbookReturnPath(effectiveCourse, 1, 0) || "/curriculum";
  return (
    <div className="bg-slate-50 px-4 py-8 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-6xl space-y-6">
        <header className="rounded-2xl bg-gradient-to-r from-amber-600 to-orange-600 p-6 text-white shadow-lg sm:p-8"><div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between"><div className="flex gap-3"><div className="rounded-xl bg-white/15 p-3"><LibraryBig className="h-7 w-7" /></div><div><p className="text-sm font-semibold text-amber-100">{courseLabel} 과정 · 교사 승인 학습 자료</p><h1 className="mt-1 text-3xl font-bold">우수 예시문 라이브러리</h1><p className="mt-2 max-w-2xl text-sm leading-6 text-amber-50">같은 과정 학습자가 참고할 수 있도록 교사가 승인하고 개인정보를 제거한 예시문입니다.</p></div></div><Badge className="h-fit border-0 bg-white/15 text-white hover:bg-white/15"><ShieldCheck className="mr-1 h-3.5 w-3.5" />익명화·교사 승인</Badge></div></header>
        <Card className="border-amber-100 bg-white shadow-sm"><CardContent className="p-4 sm:p-5"><div className="flex flex-col gap-3 sm:flex-row"><div className="relative flex-1"><Search className="absolute left-3 top-3 h-4 w-4 text-slate-400" /><Input value={search} onChange={(event) => setSearch(event.target.value)} className="pl-9" placeholder="제목·주제·교사 코멘트 검색" /></div><div className="relative sm:w-56"><Filter className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-slate-400" /><select value={skillTag} onChange={(event) => setSkillTag(event.target.value)} className="h-10 w-full appearance-none rounded-md border border-slate-200 bg-white pl-9 pr-3 text-sm text-slate-700 outline-none ring-offset-background focus:ring-2 focus:ring-amber-500"><option value="">모든 논술 역량</option>{tags.map((tag) => <option key={tag} value={tag}>{tag}</option>)}</select></div></div></CardContent></Card>
        {isLoading ? <div role="status" className="py-20 text-center text-slate-500"><Loader2 className="mx-auto h-7 w-7 animate-spin" /><p className="mt-3">예시문을 불러오는 중입니다...</p></div> : scopedExamples.length === 0 ? <Card className="border-dashed border-slate-300 bg-white p-12 text-center"><BookMarked className="mx-auto h-12 w-12 text-slate-300" /><CardTitle className="mt-4">아직 공개된 예시문이 없습니다</CardTitle><CardDescription className="mt-2">담당 교사가 우수 답안을 익명화하고 승인하면, 가입한 과정에 맞는 예시문이 이곳에 표시됩니다.</CardDescription><Link href={workbookPath}><Button variant="outline" className="mt-5">나의 워크북 학습하기</Button></Link></Card> : <div className="grid gap-5 md:grid-cols-2">{scopedExamples.map((example) => <Card key={example.id} className="border-amber-100 bg-white shadow-sm"><CardHeader className="pb-3"><div className="flex flex-wrap items-center gap-2"><Badge className="bg-amber-100 text-amber-900 hover:bg-amber-100">{example.topic}</Badge>{(example.skillTags || "").split(",").map((tag) => tag.trim()).filter(Boolean).map((tag) => <Badge key={tag} variant="outline" className="border-amber-200 text-amber-800">{tag}</Badge>)}</div><CardTitle className="mt-3 text-xl text-slate-900">{example.title}</CardTitle><CardDescription className="flex items-center gap-1"><ShieldCheck className="h-3.5 w-3.5 text-emerald-600" />교사 승인 · 학생 식별 정보 제거</CardDescription></CardHeader><CardContent><details className="group rounded-xl border border-amber-100 bg-amber-50/60 p-4"><summary className="cursor-pointer list-none font-semibold text-amber-900"><span className="flex items-center gap-2"><Sparkles className="h-4 w-4" />예시문 읽기</span></summary><p className="mt-4 whitespace-pre-wrap border-t border-amber-100 pt-4 text-sm leading-7 text-slate-800">{example.anonymizedContent}</p>{example.teacherNote && <div className="mt-4 rounded-lg border border-amber-200 bg-white p-3"><p className="text-xs font-bold text-amber-800">교사 참고 포인트</p><p className="mt-1 text-sm leading-6 text-slate-700">{example.teacherNote}</p></div>}</details></CardContent></Card>)}</div>}
      </div>
    </div>
  );
}
