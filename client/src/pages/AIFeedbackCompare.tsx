import React, { useState } from "react";
import { ArrowLeft, CheckCircle2, Lightbulb, MessageSquareText, Sparkles, Highlighter } from "lucide-react";
import { Link, useParams } from "wouter";
import { useAuth } from "@/_core/hooks/useAuth";
import LoginRequired from "@/components/LoginRequired";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { diffTexts, type DiffResult } from "@/lib/textDiff";

function parseList(value: string | null | undefined) {
  if (!value) return [] as string[];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === "string") : [];
  } catch {
    return [];
  }
}

// 같은 글을 다시 그릴 때(체크 표시 등) 비교를 다시 계산하지 않도록 마지막 결과를 기억한다.
let lastDiff: { original: string; revised: string; result: DiffResult } | null = null;
function cachedDiff(original: string, revised: string): DiffResult {
  if (lastDiff && lastDiff.original === original && lastDiff.revised === revised) return lastDiff.result;
  const result = diffTexts(original, revised);
  lastDiff = { original, revised, result };
  return result;
}

const KIND_LABEL = { replace: "바꿈", insert: "추가", delete: "삭제" } as const;

export default function AIFeedbackCompare() {
  const { isAuthenticated } = useAuth();
  const params = useParams<{ id: string }>();
  const feedbackId = Number(params.id || 0);
  const [highlightMode, setHighlightMode] = useState<boolean>(true);
  const [checked, setChecked] = useState<Set<number>>(new Set());

  const { data: feedbackList, isLoading } = trpc.aiAutoFeedback.getByUser.useQuery(undefined, { enabled: isAuthenticated && feedbackId > 0 });
  const feedback = feedbackList?.find((item) => item.id === feedbackId);

  if (!isAuthenticated) return <LoginRequired />;
  if (isLoading) return <div className="p-12 text-center text-slate-600">비교 결과를 불러오는 중입니다...</div>;
  if (!feedback) return <div className="p-12 text-center text-slate-600">해당 AI 첨삭 결과를 찾을 수 없습니다.</div>;

  const suggestions = parseList(feedback.suggestions);
  const strengths = parseList(feedback.strengths);
  const weaknesses = parseList(feedback.weaknesses);
  const revisedEssay = feedback.revisedEssay || feedback.essayContent;
  const originalEssay = feedback.essayContent || "";

  // 원문과 첨삭 답안을 단어 단위로 비교한다: 삭제·바뀐 부분은 원문에서 빨강, 추가·바뀐 부분은 첨삭 답안에서 초록으로 표시하고 번호를 붙인다.
  const diff = cachedDiff(originalEssay, revisedEssay);
  const toggleChecked = (id: number) => setChecked((current) => {
    const next = new Set(current);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    return next;
  });
  const allChecked = diff.changes.length > 0 && checked.size >= diff.changes.length;

  return (
    <div className="bg-slate-50 px-4 py-8 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <Link href="/ai-auto-feedback"><Button variant="ghost" className="mb-2 gap-2 px-0 text-slate-600 hover:text-indigo-700"><ArrowLeft className="h-4 w-4" /> AI 첨삭으로 돌아가기</Button></Link>
            <h1 className="text-3xl font-bold text-slate-900">원본 답안과 AI 첨삭 비교 (변경점 하이라이트)</h1>
            <p className="mt-1 text-sm text-slate-600">{feedback.essayTitle} · {new Date(feedback.createdAt).toLocaleString()}</p>
          </div>
          <div className="flex items-center gap-3">
            <Button
              variant={highlightMode ? "default" : "outline"}
              size="sm"
              onClick={() => setHighlightMode(!highlightMode)}
              className={`gap-2 ${highlightMode ? "bg-emerald-600 hover:bg-emerald-700 text-white" : ""}`}
            >
              <Highlighter className="h-4 w-4" />
              {highlightMode ? "변경점 하이라이트 켜짐" : "하이라이트 끄기"}
            </Button>
            <div className="flex items-center gap-2 rounded-full border border-indigo-100 bg-indigo-50 px-4 py-2 text-sm font-semibold text-indigo-700"><Sparkles className="h-4 w-4" /> 종합 점수 {feedback.overallScore ?? 0}점</div>
          </div>
        </div>

        {(feedback as { fallbackUsed?: boolean }).fallbackUsed && (
          <div role="alert" className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-900" data-testid="compare-fallback-notice">
            <p className="font-bold">이 첨삭은 AI 모델 연결에 실패해 기본 규칙 점검 결과만 제공되었습니다.</p>
            <p>수정 답안과 항목별 점수가 없어 원문과 비교할 내용이 없습니다. AI 자동 첨삭에서 다시 요청해 주세요.</p>
          </div>
        )}
        <Card className="border-slate-200 bg-white shadow-sm" data-testid="diff-summary">
          <CardContent className="flex flex-wrap items-center gap-x-5 gap-y-2 p-4 text-sm">
            {diff.identical ? (
              <p className="font-semibold text-slate-700">AI가 원문을 고치지 않았거나 수정 답안이 원문과 같습니다. 아래 강점·보완점·제안을 참고해 주세요.</p>
            ) : (
              <>
                <span className="font-extrabold text-slate-900">수정 {diff.changes.length}곳</span>
                <span className="text-emerald-700">추가 {diff.addedWords}단어</span>
                <span className="text-rose-700">삭제 {diff.removedWords}단어</span>
                <span className="text-slate-600">원문의 약 {diff.changedPercent}% 변경</span>
              </>
            )}
            <span className="ml-auto flex flex-wrap items-center gap-3 text-xs font-semibold text-slate-600">
              <span className="inline-flex items-center gap-1"><span className="inline-block h-3 w-3 rounded bg-rose-200" aria-hidden="true" /> 삭제·바뀐 원문</span>
              <span className="inline-flex items-center gap-1"><span className="inline-block h-3 w-3 rounded bg-emerald-200" aria-hidden="true" /> 추가·바뀐 표현</span>
            </span>
          </CardContent>
        </Card>

        <div className="grid gap-6 xl:grid-cols-2">
          <Card className="border-slate-200 bg-white shadow-sm">
            <CardHeader className="border-b border-slate-100 bg-slate-50/80"><CardTitle className="flex items-center gap-2 text-lg text-slate-900"><MessageSquareText className="h-5 w-5 text-slate-600" /> 학생 원본 답안</CardTitle><CardDescription>AI 첨삭 전 작성한 원문입니다. 고쳐진 부분은 빨간 취소선과 번호로 표시했습니다.</CardDescription></CardHeader>
            <CardContent><div data-testid="diff-original" className="max-h-[620px] min-h-[360px] overflow-y-auto whitespace-pre-wrap rounded-xl bg-white p-5 text-sm leading-8 text-slate-700">{diff.ops.map((op, index) => {
              if (op.type === "insert") return null;
              if (op.type === "equal" || !highlightMode) return <span key={index}>{op.before}</span>;
              return <span key={index} className={`rounded bg-rose-100 px-0.5 text-rose-800 line-through decoration-rose-500 ${checked.has(op.changeId!) ? "opacity-40" : ""}`} title={`수정 ${op.changeId}번: 고쳐진 원문`}>{op.before?.trimEnd()}<sup className="ml-0.5 text-[10px] font-extrabold text-rose-600 no-underline">{op.changeId}</sup>{" "}</span>;
            })}</div></CardContent>
          </Card>

          <Card className="border-indigo-200 bg-white shadow-sm">
            <CardHeader className="border-b border-indigo-100 bg-indigo-50/60"><CardTitle className="flex items-center gap-2 text-lg text-indigo-950"><Sparkles className="h-5 w-5 text-indigo-600" /> AI 첨삭 답안</CardTitle><CardDescription>추가되거나 바뀐 표현을 초록색 밑줄과 번호로 표시했습니다. 번호는 아래 수정 내역과 같습니다.</CardDescription></CardHeader>
            <CardContent><div data-testid="diff-revised" className="max-h-[620px] min-h-[360px] overflow-y-auto whitespace-pre-wrap rounded-xl bg-indigo-50/30 p-5 text-sm leading-8 text-slate-800">{diff.ops.map((op, index) => {
              if (op.type === "delete") return null;
              if (op.type === "equal" || !highlightMode) return <span key={index}>{op.after}</span>;
              return <span key={index} className={`rounded border-b-2 border-emerald-500 bg-emerald-100 px-0.5 font-medium text-emerald-950 ${checked.has(op.changeId!) ? "opacity-50" : ""}`} title={`수정 ${op.changeId}번: AI가 추가·변경한 표현`}>{op.after?.trimEnd()}<sup className="ml-0.5 text-[10px] font-extrabold text-emerald-700">{op.changeId}</sup>{" "}</span>;
            })}</div></CardContent>
          </Card>
        </div>

        {diff.changes.length > 0 && (
          <Card className="border-slate-200 bg-white shadow-sm" data-testid="diff-changes">
            <CardHeader className="flex flex-row items-center justify-between gap-3 border-b border-slate-100">
              <div><CardTitle className="text-lg text-slate-900">수정 내역 ({checked.size}/{diff.changes.length} 확인)</CardTitle><CardDescription>하나씩 읽고 체크하면 본문에서 흐리게 표시됩니다.</CardDescription></div>
              <Button size="sm" variant="outline" onClick={() => setChecked(allChecked ? new Set() : new Set(diff.changes.map((change) => change.id)))}>{allChecked ? "확인 모두 해제" : "모두 확인"}</Button>
            </CardHeader>
            <CardContent className="p-0">
              <ul className="divide-y divide-slate-100">
                {diff.changes.map((change) => (
                  <li key={change.id} className="flex items-start gap-3 px-5 py-3">
                    <input type="checkbox" className="mt-1.5 h-4 w-4 shrink-0 accent-emerald-600" checked={checked.has(change.id)} onChange={() => toggleChecked(change.id)} aria-label={`수정 ${change.id}번 확인함`} />
                    <span className="mt-0.5 inline-flex h-6 min-w-6 shrink-0 items-center justify-center rounded-full bg-slate-900 px-1.5 text-xs font-extrabold text-white">{change.id}</span>
                    <div className="min-w-0 flex-1 text-sm leading-7">
                      <Badge variant="outline" className="mr-2 align-middle">{KIND_LABEL[change.kind]}</Badge>
                      {change.before && <span className="rounded bg-rose-100 px-1 text-rose-800 line-through decoration-rose-500">{change.before}</span>}
                      {change.before && change.after && <span className="mx-2 text-slate-400" aria-hidden="true">→</span>}
                      {change.after && <span className="rounded bg-emerald-100 px-1 font-medium text-emerald-900">{change.after}</span>}
                    </div>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        )}

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
