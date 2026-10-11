import { useEffect, useMemo, useState } from "react";
import { Link } from "wouter";
import { trpc } from "@/lib/trpc";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useLearningCourse } from "@/hooks/useLearningCourse";
import { formatLearningCourse } from "@/lib/learningLabels";
import { buildWorkbookReturnPath } from "@/lib/workbookReturn";
import { Archive, BookOpenCheck, Clock3, History, Lightbulb, Loader2 } from "lucide-react";

type SavedGuide = { learningGoal: string; thinkingSteps: string[]; sentenceFrame: string; practiceExample: string; selfCheck: string[] };

function parseGuide(value: string): SavedGuide | null {
  try {
    const guide = JSON.parse(value) as SavedGuide;
    return guide.learningGoal && Array.isArray(guide.thinkingSteps) ? guide : null;
  } catch { return null; }
}

export default function AiGuideHistory() {
  const { effectiveCourse, courseLabel, scopeKey, loading, isStudent, canLearn, canPersist, needsSelection } = useLearningCourse();
  const [showArchived, setShowArchived] = useState(false);
  const enabled = canPersist && !!effectiveCourse;
  const { data: histories = [], isLoading } = trpc.learningResources.myLessonGuideHistory.useQuery(undefined, { enabled });
  const parsedHistories = useMemo(() => histories.map((history) => ({ ...history, guide: parseGuide(history.guideJson) })), [histories]);
  const currentHistories = useMemo(() => parsedHistories.filter((history) => history.courseType === effectiveCourse), [parsedHistories, effectiveCourse]);
  const archivedHistories = useMemo(() => parsedHistories.filter((history) => history.courseType !== effectiveCourse), [parsedHistories, effectiveCourse]);
  const visibleHistories = showArchived ? [...currentHistories, ...archivedHistories] : currentHistories;

  useEffect(() => { setShowArchived(false); }, [scopeKey]);

  if (loading) return <div role="status" className="py-16 text-center text-slate-600">학습 과정을 확인하고 있습니다.</div>;
  if (!isStudent) return <div className="py-16 text-center text-slate-600">AI 레슨 가이드 이력은 가입한 학습자 계정에서 제공됩니다.</div>;
  if (needsSelection || !canLearn || !effectiveCourse) return <div role="alert" className="py-16 text-center text-slate-600">가입 과정을 확인한 뒤 AI 레슨 가이드 이력을 이용할 수 있습니다.</div>;

  return (
    <div className="bg-slate-50 px-4 py-8 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-4xl space-y-6">
        <header className="rounded-2xl bg-gradient-to-r from-indigo-800 to-indigo-700 p-6 text-white shadow-lg sm:p-8">
          <div className="flex items-start gap-3">
            <div className="rounded-xl bg-white/15 p-3"><History className="h-7 w-7" /></div>
            <div>
              <p className="text-sm font-semibold text-indigo-100">{courseLabel} 과정의 학습 기록</p>
              <h1 className="mt-1 text-3xl font-bold">AI 레슨 가이드 이력</h1>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-indigo-100">현재 과정에서 참고했던 사고 순서, 문장 틀, 연습 예시를 레슨별로 다시 열어 다음 답안에 활용하세요.</p>
            </div>
          </div>
        </header>

        {archivedHistories.length > 0 && (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3">
            <p className="text-sm text-slate-600">이전 과정 또는 과정 정보가 없는 가이드는 보관되어 있습니다.</p>
            <Button variant="outline" size="sm" onClick={() => setShowArchived((value) => !value)} className="gap-1.5">
              <Archive className="h-4 w-4" /> {showArchived ? "현재 과정 기록만 보기" : `보관 기록 보기 (${archivedHistories.length})`}
            </Button>
          </div>
        )}

        {isLoading ? <div role="status" className="py-20 text-center text-slate-500"><Loader2 className="mx-auto h-7 w-7 animate-spin" /><p className="mt-3">가이드 이력을 불러오는 중입니다...</p></div> : visibleHistories.length === 0 ? (
          <Card className="border-dashed border-slate-300 bg-white p-10 text-center">
            <BookOpenCheck className="mx-auto h-12 w-12 text-slate-300" />
            <CardTitle className="mt-4">{archivedHistories.length > 0 ? "현재 과정의 저장된 AI 가이드가 없습니다" : "아직 저장된 AI 가이드가 없습니다"}</CardTitle>
            <CardDescription className="mt-2">워크북 레슨에서 <strong>AI 가이드 받기</strong>를 누르면, 해당 레슨의 가이드가 이곳에 자동으로 저장됩니다.</CardDescription>
            <Link href="/curriculum"><Button className="mt-5 bg-indigo-700 hover:bg-indigo-800">커리큘럼으로 이동</Button></Link>
          </Card>
        ) : (
          <div className="space-y-4">
            {visibleHistories.map((history) => {
              const isCurrentCourse = history.courseType === effectiveCourse;
              const returnPath = isCurrentCourse && typeof history.courseType === "string"
                ? buildWorkbookReturnPath(history.courseType, history.level, history.lessonIndex)
                : null;
              return <Card key={history.id} className={isCurrentCourse ? "border-indigo-100 bg-white shadow-sm" : "border-slate-200 bg-slate-50 shadow-sm"}>
                <CardHeader className="pb-4">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge className="bg-indigo-100 text-indigo-800 hover:bg-indigo-100">{formatLearningCourse(typeof history.courseType === "string" ? history.courseType : "")}</Badge>
                        <Badge variant="outline">Level {history.level} · Lesson {history.lessonIndex + 1}</Badge>
                        {!isCurrentCourse && <Badge variant="outline" className="border-slate-300 text-slate-600">보관 기록</Badge>}
                      </div>
                      <CardTitle className="mt-3 text-xl">{history.lessonTitle}</CardTitle>
                      <CardDescription className="mt-1 flex items-center gap-1"><Clock3 className="h-3.5 w-3.5" />{new Date(history.createdAt).toLocaleString("ko-KR")}</CardDescription>
                    </div>
                    {returnPath ? <Link href={returnPath}><Button variant="outline" size="sm">레슨 다시 보기</Button></Link> : <Button variant="outline" size="sm" disabled title="현재 과정의 유효한 레슨에서만 다시 열 수 있습니다.">레슨 다시 보기</Button>}
                  </div>
                </CardHeader>
                <CardContent>
                  {history.guide ? <details className="group rounded-xl border border-indigo-100 bg-indigo-50/60 p-4"><summary className="cursor-pointer list-none font-semibold text-indigo-900"><span className="flex items-center gap-2"><Lightbulb className="h-4 w-4" />저장된 AI 가이드 펼쳐 보기</span></summary><div className="mt-4 grid gap-4 border-t border-indigo-100 pt-4 md:grid-cols-2"><div><p className="text-xs font-bold uppercase tracking-wide text-indigo-700">학습 목표</p><p className="mt-1 text-sm leading-6 text-slate-800">{history.guide.learningGoal}</p><p className="mt-4 text-xs font-bold uppercase tracking-wide text-indigo-700">생각 순서</p><ol className="mt-2 space-y-2 text-sm leading-6 text-slate-700">{history.guide.thinkingSteps.map((step, index) => <li key={`${history.id}-${index}`} className="flex gap-2"><span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-indigo-200 text-xs font-bold text-indigo-800">{index + 1}</span>{step}</li>)}</ol></div><div><div className="rounded-lg border border-indigo-200 bg-white p-3"><p className="text-xs font-bold text-indigo-800">문장 틀</p><p className="mt-1 whitespace-pre-wrap text-sm leading-6 text-slate-800">{history.guide.sentenceFrame}</p></div><div className="mt-3 rounded-lg border border-indigo-200 bg-white p-3"><p className="text-xs font-bold text-indigo-800">연습 예시</p><p className="mt-1 whitespace-pre-wrap text-sm leading-6 text-slate-800">{history.guide.practiceExample}</p></div></div></div></details> : <p className="rounded-lg bg-slate-50 p-4 text-sm text-slate-600">이전 형식의 가이드라 본문을 불러오지 못했습니다. 레슨에서 새 가이드를 생성해 주세요.</p>}
                </CardContent>
              </Card>;
            })}
          </div>
        )}
      </div>
    </div>
  );
}
