import React from "react";
import { Loader2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";

export const EVALUATION_STEPS = [
  { label: "답안 구조를 읽고 있어요", detail: "작성하신 글의 문단과 핵심 문장을 살펴보고 있습니다." },
  { label: "논제와 주장의 연결을 분석하고 있어요", detail: "제시된 과제와 답안이 얼마나 잘 연결되는지 확인합니다." },
  { label: "역량별 피드백을 정리하고 있어요", detail: "주장, 근거, 논리, 표현 영역의 관찰 내용을 정리합니다." },
  { label: "결과를 안전하게 저장하고 있어요", detail: "잠시 후 점수와 다음 학습 제안을 확인할 수 있습니다." },
] as const;

export function EvaluationLoadingState({ step }: { step: number }) {
  const safeStep = Math.max(0, Math.min(step, EVALUATION_STEPS.length - 1));
  const current = EVALUATION_STEPS[safeStep];
  const progress = Math.min(92, 18 + safeStep * 24);
  return (
    <Card className="overflow-hidden border-indigo-100 bg-white shadow-sm">
      <CardContent className="p-6 sm:p-8" role="status" aria-live="polite" aria-busy="true">
        <div className="flex items-start gap-4">
          <div className="relative flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-700">
            <Loader2 className="h-6 w-6 animate-spin" aria-hidden="true" />
            <span className="absolute inset-0 rounded-2xl ring-4 ring-indigo-100/60" aria-hidden="true" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="font-extrabold text-slate-950">AI가 답안을 차분히 읽고 있어요</p>
              <span className="text-xs font-bold text-indigo-700">{safeStep + 1} / {EVALUATION_STEPS.length}</span>
            </div>
            <p className="mt-2 text-sm font-semibold text-indigo-800">{current.label}</p>
            <p className="mt-1 text-xs leading-5 text-slate-500">{current.detail}</p>
          </div>
        </div>
        <div className="mt-7"><Progress value={progress} aria-label={`평가 진행률 ${progress}%`} className="h-2.5 bg-indigo-100" /><div className="mt-2 flex items-center justify-between text-[11px] font-semibold text-slate-500"><span>평가 진행 중</span><span>결과를 만들고 있습니다</span></div></div>
        <div className="mt-6 grid gap-2 sm:grid-cols-4">
          {EVALUATION_STEPS.map((item, index) => <div key={item.label} className={`rounded-xl px-3 py-2 text-xs font-semibold ${index <= safeStep ? "bg-indigo-50 text-indigo-800" : "bg-slate-50 text-slate-400"}`}><span className="mr-1.5">{index < safeStep ? "✓" : index === safeStep ? "•" : "○"}</span>{item.label.replace("하고 있어요", "")}</div>)}
        </div>
        <p className="mt-5 text-center text-xs leading-5 text-slate-500">창을 닫거나 새로고침하지 않아도 됩니다. 답안에 따라 잠시 시간이 걸릴 수 있어요.</p>
      </CardContent>
    </Card>
  );
}
