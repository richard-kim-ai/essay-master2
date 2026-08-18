import { useMemo } from "react";
import { Link } from "wouter";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { BookOpenCheck, Clock3, GraduationCap, History, Lightbulb, Loader2 } from "lucide-react";

type SavedGuide = { learningGoal: string; thinkingSteps: string[]; sentenceFrame: string; practiceExample: string; selfCheck: string[] };

const COURSE_LABEL: Record<string, string> = { elementary: "초등", middle_high: "중고등", high_univ: "고등/대입", general_adult: "일반/직장인" };

function parseGuide(value: string): SavedGuide | null {
  try {
    const guide = JSON.parse(value) as SavedGuide;
    return guide.learningGoal && Array.isArray(guide.thinkingSteps) ? guide : null;
  } catch { return null; }
}

export default function AiGuideHistory() {
  const { isAuthenticated, user } = useAuth();
  const enabled = isAuthenticated && user?.role === "user";
  const { data: histories = [], isLoading } = trpc.learningResources.myLessonGuideHistory.useQuery(undefined, { enabled });
  const parsedHistories = useMemo(() => histories.map((history) => ({ ...history, guide: parseGuide(history.guideJson) })), [histories]);

  if (!isAuthenticated) return <div className="py-16 text-center text-slate-600">로그인 후 AI 레슨 가이드 이력을 확인할 수 있습니다.</div>;
  if (user?.role !== "user") return <div className="py-16 text-center text-slate-600">학습자 계정에서 제공되는 학습 이력입니다.</div>;

  return (
    <div className="min-h-screen bg-gradient-to-br from-violet-50 via-white to-indigo-50 px-4 py-8 sm:px-6 lg:px-8">
      <main className="mx-auto max-w-4xl space-y-6">
        <header className="rounded-2xl bg-gradient-to-r from-violet-800 to-indigo-700 p-6 text-white shadow-lg sm:p-8"><div className="flex items-start gap-3"><div className="rounded-xl bg-white/15 p-3"><History className="h-7 w-7" /></div><div><p className="text-sm font-semibold text-violet-100">나의 학습 기록</p><h1 className="mt-1 text-3xl font-bold">AI 레슨 가이드 이력</h1><p className="mt-2 max-w-2xl text-sm leading-6 text-violet-100">참고했던 사고 순서, 문장 틀, 연습 예시를 레슨별로 다시 열어 다음 답안에 활용하세요.</p></div></div></header>
        {isLoading ? <div className="py-20 text-center text-slate-500"><Loader2 className="mx-auto h-7 w-7 animate-spin" /><p className="mt-3">가이드 이력을 불러오는 중입니다...</p></div> : parsedHistories.length === 0 ? <Card className="border-dashed border-slate-300 bg-white p-10 text-center"><BookOpenCheck className="mx-auto h-12 w-12 text-slate-300" /><CardTitle className="mt-4">아직 저장된 AI 가이드가 없습니다</CardTitle><CardDescription className="mt-2">워크북 레슨에서 <strong>AI 가이드 받기</strong>를 누르면, 해당 레슨의 가이드가 이곳에 자동으로 저장됩니다.</CardDescription><Link href="/curriculum"><Button className="mt-5 bg-violet-700 hover:bg-violet-800">커리큘럼으로 이동</Button></Link></Card> : <div className="space-y-4">{parsedHistories.map((history) => <Card key={history.id} className="border-violet-100 bg-white shadow-sm"><CardHeader className="pb-4"><div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between"><div><div className="flex flex-wrap items-center gap-2"><Badge className="bg-violet-100 text-violet-800 hover:bg-violet-100">{COURSE_LABEL[history.courseType] || history.courseType}</Badge><Badge variant="outline">Level {history.level} · Lesson {history.lessonIndex + 1}</Badge></div><CardTitle className="mt-3 text-xl">{history.lessonTitle}</CardTitle><CardDescription className="mt-1 flex items-center gap-1"><Clock3 className="h-3.5 w-3.5" />{new Date(history.createdAt).toLocaleString("ko-KR")}</CardDescription></div><Link href={`/workbook/${history.courseType}/${history.level}`}><Button variant="outline" size="sm">레슨 다시 보기</Button></Link></div></CardHeader><CardContent>{history.guide ? <details className="group rounded-xl border border-violet-100 bg-violet-50/60 p-4"><summary className="cursor-pointer list-none font-semibold text-violet-900"><span className="flex items-center gap-2"><Lightbulb className="h-4 w-4" />저장된 AI 가이드 펼쳐 보기</span></summary><div className="mt-4 grid gap-4 border-t border-violet-100 pt-4 md:grid-cols-2"><div><p className="text-xs font-bold uppercase tracking-wide text-violet-700">학습 목표</p><p className="mt-1 text-sm leading-6 text-slate-800">{history.guide.learningGoal}</p><p className="mt-4 text-xs font-bold uppercase tracking-wide text-violet-700">생각 순서</p><ol className="mt-2 space-y-2 text-sm leading-6 text-slate-700">{history.guide.thinkingSteps.map((step, index) => <li key={`${history.id}-${index}`} className="flex gap-2"><span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-violet-200 text-xs font-bold text-violet-800">{index + 1}</span>{step}</li>)}</ol></div><div><div className="rounded-lg border border-violet-200 bg-white p-3"><p className="text-xs font-bold text-violet-800">문장 틀</p><p className="mt-1 whitespace-pre-wrap text-sm leading-6 text-slate-800">{history.guide.sentenceFrame}</p></div><div className="mt-3 rounded-lg border border-violet-200 bg-white p-3"><p className="text-xs font-bold text-violet-800">연습 예시</p><p className="mt-1 whitespace-pre-wrap text-sm leading-6 text-slate-800">{history.guide.practiceExample}</p></div></div></div></details> : <p className="rounded-lg bg-slate-50 p-4 text-sm text-slate-600">이전 형식의 가이드라 본문을 불러오지 못했습니다. 레슨에서 새 가이드를 생성해 주세요.</p>}</CardContent></Card>)}</div>}
      </main>
    </div>
  );
}
