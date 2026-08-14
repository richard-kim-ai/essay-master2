import { ArrowLeft, CheckCircle2, Lightbulb, MessageSquareText, Sparkles } from "lucide-react";
import { Link, useParams } from "wouter";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

function parseList(value: string | null | undefined) {
  if (!value) return [] as string[];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === "string") : [];
  } catch {
    return [];
  }
}

export default function AIFeedbackCompare() {
  const { isAuthenticated } = useAuth();
  const params = useParams<{ id: string }>();
  const feedbackId = Number(params.id || 0);
  const { data: feedbackList, isLoading } = trpc.aiAutoFeedback.getByUser.useQuery(undefined, { enabled: isAuthenticated && feedbackId > 0 });
  const feedback = feedbackList?.find((item) => item.id === feedbackId);

  if (!isAuthenticated) return <div className="p-12 text-center text-slate-600">로그인이 필요합니다.</div>;
  if (isLoading) return <div className="p-12 text-center text-slate-600">비교 결과를 불러오는 중입니다...</div>;
  if (!feedback) return <div className="p-12 text-center text-slate-600">해당 AI 첨삭 결과를 찾을 수 없습니다.</div>;

  const suggestions = parseList(feedback.suggestions);
  const strengths = parseList(feedback.strengths);
  const weaknesses = parseList(feedback.weaknesses);
  const revisedEssay = feedback.revisedEssay || feedback.essayContent;

  return (
    <div className="min-h-screen bg-slate-50 px-4 py-8 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <Link href="/ai-auto-feedback"><Button variant="ghost" className="mb-2 gap-2 px-0 text-slate-600 hover:text-indigo-700"><ArrowLeft className="h-4 w-4" /> AI 첨삭으로 돌아가기</Button></Link>
            <h1 className="text-3xl font-bold text-slate-900">원본 답안과 AI 첨삭 비교</h1>
            <p className="mt-1 text-sm text-slate-600">{feedback.essayTitle} · {new Date(feedback.createdAt).toLocaleString()}</p>
          </div>
          <div className="flex items-center gap-2 rounded-full border border-indigo-100 bg-indigo-50 px-4 py-2 text-sm font-semibold text-indigo-700"><Sparkles className="h-4 w-4" /> 종합 점수 {feedback.overallScore ?? 0}점</div>
        </div>

        <div className="grid gap-6 xl:grid-cols-2">
          <Card className="border-slate-200 bg-white shadow-sm">
            <CardHeader className="border-b border-slate-100 bg-slate-50/80"><CardTitle className="flex items-center gap-2 text-lg text-slate-900"><MessageSquareText className="h-5 w-5 text-slate-600" /> 학생 원본 답안</CardTitle><CardDescription>AI 첨삭 전 작성한 원문입니다.</CardDescription></CardHeader>
            <CardContent><div className="max-h-[620px] min-h-[360px] overflow-y-auto whitespace-pre-wrap rounded-xl bg-white p-5 text-sm leading-8 text-slate-700">{feedback.essayContent}</div></CardContent>
          </Card>

          <Card className="border-indigo-200 bg-white shadow-sm">
            <CardHeader className="border-b border-indigo-100 bg-indigo-50/60"><CardTitle className="flex items-center gap-2 text-lg text-indigo-950"><Sparkles className="h-5 w-5 text-indigo-600" /> AI 첨삭 답안</CardTitle><CardDescription>원문의 핵심 의도와 학생의 목소리를 유지하면서 개선한 답안입니다.</CardDescription></CardHeader>
            <CardContent><div className="max-h-[620px] min-h-[360px] overflow-y-auto whitespace-pre-wrap rounded-xl bg-indigo-50/30 p-5 text-sm leading-8 text-slate-800">{revisedEssay}</div></CardContent>
          </Card>
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          <Card><CardHeader><CardTitle className="text-base text-emerald-800">강점</CardTitle></CardHeader><CardContent>{strengths.length ? <ul className="space-y-2 text-sm text-slate-700">{strengths.map((item) => <li key={item} className="flex gap-2"><CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />{item}</li>)}</ul> : <p className="text-sm text-slate-500">기록된 강점이 없습니다.</p>}</CardContent></Card>
          <Card><CardHeader><CardTitle className="text-base text-amber-800">보완할 점</CardTitle></CardHeader><CardContent>{weaknesses.length ? <ul className="space-y-2 text-sm text-slate-700">{weaknesses.map((item) => <li key={item} className="flex gap-2"><span className="mt-0.5 font-bold text-amber-600">!</span>{item}</li>)}</ul> : <p className="text-sm text-slate-500">기록된 보완점이 없습니다.</p>}</CardContent></Card>
          <Card><CardHeader><CardTitle className="flex items-center gap-2 text-base text-indigo-800"><Lightbulb className="h-4 w-4" /> 개선 제안</CardTitle></CardHeader><CardContent>{suggestions.length ? <ul className="space-y-2 text-sm text-slate-700">{suggestions.map((item, index) => <li key={item} className="flex gap-2"><span className="font-bold text-indigo-600">{index + 1}.</span>{item}</li>)}</ul> : <p className="text-sm text-slate-500">기록된 개선 제안이 없습니다.</p>}</CardContent></Card>
        </div>

        {feedback.overallComment && <Card className="border-indigo-100 bg-indigo-50/50"><CardHeader><CardTitle className="text-base text-indigo-950">AI 종합 코멘트</CardTitle></CardHeader><CardContent><p className="whitespace-pre-wrap text-sm leading-7 text-slate-700">{feedback.overallComment}</p></CardContent></Card>}
      </div>
    </div>
  );
}
