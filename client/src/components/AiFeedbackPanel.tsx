import React from "react";
import { AlertTriangle, CheckCircle2, Lightbulb, Sparkles } from "lucide-react";
import { Link } from "wouter";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

type Correction = { original?: string; revised?: string; reason?: string };

function asList(value: unknown): string[] {
  if (Array.isArray(value)) return value.filter((item): item is string => typeof item === "string" && item.trim().length > 0);
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === "string" && item.trim().length > 0) : [];
    } catch {
      return [];
    }
  }
  return [];
}

const asCorrections = (value: unknown): Correction[] =>
  Array.isArray(value) ? value.filter((item): item is Correction => Boolean(item) && typeof item === "object" && typeof (item as Correction).original === "string" && typeof (item as Correction).revised === "string") : [];

const same = (a: unknown, b: unknown) => String(a ?? "").trim() === String(b ?? "").trim();

// 내 글 아래에 보여 주는 AI 첨삭 피드백. 방금 받은 결과(fallback_used)와 저장된 기록(fallbackUsed)을 모두 받는다.
export default function AiFeedbackPanel({ ai, essayContent, onRetry, retryDisabled }: { ai: any; essayContent?: string | null; onRetry?: () => void; retryDisabled?: boolean }) {
  if (!ai) return null;
  // AI 모델 호출에 실패해 기본 규칙 점검으로 대체된 결과인지.
  const fallback = Boolean(ai.fallback_used ?? ai.fallbackUsed);
  const strengths = asList(ai.strengths);
  const weaknesses = asList(ai.weaknesses);
  const suggestions = asList(ai.suggestions);
  const corrections = asCorrections(ai.sentenceCorrections);
  const revised: string = typeof ai.revisedEssay === "string" ? ai.revisedEssay : "";
  const hasRevision = !fallback && revised.trim().length > 0 && !same(revised, essayContent ?? ai.essayContent);
  const scores: Array<[string, unknown]> = [["종합", ai.overallScore], ["구조", ai.structureScore], ["논리", ai.logicScore], ["표현", ai.expressionScore]];

  return (
    <section className="space-y-4 rounded-xl border border-indigo-100 bg-indigo-50/50 p-4" data-testid="ai-feedback-panel">
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="flex items-center gap-1.5 font-bold text-indigo-950"><Sparkles className="h-4 w-4 text-indigo-600" aria-hidden="true" /> AI 첨삭 피드백</h3>
        {fallback ? <Badge className="bg-amber-100 text-amber-900 hover:bg-amber-100">기본 점검 결과</Badge> : <Badge className="bg-emerald-100 text-emerald-800 hover:bg-emerald-100">AI 모델 첨삭</Badge>}
      </div>

      {fallback && (
        <div role="alert" className="flex gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm leading-6 text-amber-900" data-testid="ai-fallback-notice">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          <div>
            <p className="font-bold">AI 모델 연결에 실패해 기본 규칙 점검 결과만 제공되었습니다.</p>
            <p>항목별 점수와 수정 답안은 제공되지 않았고, AI 사용 횟수는 차감되지 않았습니다. 잠시 후 다시 요청해 주세요.</p>
            {onRetry && <Button size="sm" variant="outline" className="mt-2 bg-white" onClick={onRetry} disabled={retryDisabled}>AI 첨삭 다시 요청</Button>}
          </div>
        </div>
      )}

      {!fallback && (
        <ul className="flex flex-wrap gap-2" aria-label="점수">
          {scores.filter(([, value]) => typeof value === "number").map(([label, value]) => (
            <li key={label} className="rounded-lg border border-indigo-100 bg-white px-3 py-1.5 text-sm"><span className="text-slate-500">{label}</span> <span className="font-extrabold text-indigo-700">{value as number}점</span></li>
          ))}
        </ul>
      )}
      {fallback && typeof ai.overallScore === "number" && <p className="text-sm text-slate-600">기본 점검 점수 <span className="font-bold">{ai.overallScore}점</span> (참고용)</p>}

      {ai.overallComment && <p className="whitespace-pre-wrap text-sm leading-6 text-slate-700">{ai.overallComment}</p>}

      <div className="grid gap-3 md:grid-cols-3">
        {strengths.length > 0 && (
          <div className="rounded-lg bg-white p-3"><h4 className="flex items-center gap-1 text-sm font-bold text-emerald-800"><CheckCircle2 className="h-4 w-4" aria-hidden="true" /> 잘한 점</h4><ul className="mt-2 space-y-1.5 text-sm text-slate-700">{strengths.map((item, index) => <li key={index}>• {item}</li>)}</ul></div>
        )}
        {weaknesses.length > 0 && (
          <div className="rounded-lg bg-white p-3"><h4 className="text-sm font-bold text-amber-800">보완할 점</h4><ul className="mt-2 space-y-1.5 text-sm text-slate-700">{weaknesses.map((item, index) => <li key={index}>• {item}</li>)}</ul></div>
        )}
        {suggestions.length > 0 && (
          <div className="rounded-lg bg-white p-3"><h4 className="flex items-center gap-1 text-sm font-bold text-indigo-800"><Lightbulb className="h-4 w-4" aria-hidden="true" /> 이렇게 고쳐 보세요</h4><ul className="mt-2 space-y-1.5 text-sm text-slate-700">{suggestions.map((item, index) => <li key={index}>{index + 1}. {item}</li>)}</ul></div>
        )}
      </div>

      {corrections.length > 0 && (
        <div className="rounded-lg bg-white p-3" data-testid="ai-corrections">
          <h4 className="text-sm font-bold text-slate-900">문장별 교정 ({corrections.length}곳)</h4>
          <ul className="mt-2 space-y-3 text-sm leading-6">
            {corrections.map((item, index) => (
              <li key={index}>
                <p><span className="rounded bg-rose-100 px-1 text-rose-800 line-through">{item.original}</span></p>
                <p className="mt-0.5"><span className="mr-1 text-slate-400" aria-hidden="true">→</span><span className="rounded bg-emerald-100 px-1 font-medium text-emerald-900">{item.revised}</span></p>
                {item.reason && <p className="mt-0.5 text-xs text-slate-500">{item.reason}</p>}
              </li>
            ))}
          </ul>
        </div>
      )}

      {hasRevision ? (
        <details className="rounded-lg bg-white p-3" data-testid="ai-revised-essay">
          <summary className="cursor-pointer text-sm font-bold text-indigo-800">AI 수정 답안 보기</summary>
          <p className="mt-2 whitespace-pre-wrap text-sm leading-7 text-slate-800">{revised}</p>
          {ai.id ? <Link href={`/ai-feedback-compare/${ai.id}`} className="mt-3 inline-block text-sm font-bold text-indigo-700 underline">원문과 비교해 고친 곳 보기</Link> : null}
        </details>
      ) : (
        !fallback && <p className="text-xs text-slate-500" data-testid="ai-no-revision">이 첨삭에는 수정 답안이 없습니다. 평가 점수와 개선 제안을 참고해 직접 고쳐 써 보세요.</p>
      )}
    </section>
  );
}
