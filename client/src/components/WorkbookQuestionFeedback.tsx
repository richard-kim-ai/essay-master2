import React from "react";
import { Lightbulb, ListChecks } from "lucide-react";

type EvaluationCriterion = {
  key: string;
  label: string;
  score: number;
  maxScore: number;
  quote: string;
  explanation: string;
};

type SubjectiveEvaluation = {
  verdict: "excellent" | "adequate" | "needs_revision" | "off_topic" | "insufficient";
  summary: string;
  characterCount: number;
  validReasonCount: number;
  criteria: EvaluationCriterion[];
  priorityImprovements: string[];
  isOnTopic: boolean;
  hasClearClaim: boolean;
  hasComparativeAnalysis: boolean;
  missingRequirements: string[];
};

export type WorkbookQuestionResult = {
  isCorrect: number;
  score: number;
  aiFeedback: string;
  evaluation?: SubjectiveEvaluation | null;
};

type WorkbookQuestionFeedbackProps = {
  questionType: string;
  result?: WorkbookQuestionResult;
  explanation: string;
};

export function WorkbookQuestionFeedback({ questionType, result, explanation }: WorkbookQuestionFeedbackProps) {
  if (!result) return null;

  if (questionType === "subjective" && result.evaluation) {
    const evaluation = result.evaluation;
    return (
      <div className={`mt-3 space-y-4 rounded-xl border p-4 ${evaluation.verdict === "excellent" ? "border-emerald-200 bg-emerald-50" : evaluation.verdict === "adequate" ? "border-indigo-200 bg-indigo-50" : "border-amber-200 bg-amber-50"}`}>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <div><p className="font-bold text-slate-900">AI 근거 기반 서술형 평가</p><p className="mt-1 text-sm leading-6 text-slate-700">{evaluation.summary}</p></div>
          <span className="shrink-0 rounded-full bg-white px-2.5 py-1 text-xs font-bold text-slate-700 shadow-sm">{evaluation.characterCount}자 · 근거 {evaluation.validReasonCount}개</span>
        </div>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
          {evaluation.criteria.map((criterion) => <div key={criterion.key} className="rounded-lg border border-white/80 bg-white/80 p-2.5"><div className="flex items-center justify-between gap-2"><span className="text-xs font-semibold text-slate-600">{criterion.label}</span><span className="text-sm font-extrabold text-slate-900">{criterion.score}<span className="text-[11px] font-medium text-slate-500">/{criterion.maxScore}</span></span></div><p className="mt-1.5 text-[11px] leading-4 text-slate-600">{criterion.explanation}</p><p className="mt-2 rounded bg-slate-50 px-1.5 py-1 text-[10px] leading-4 text-slate-500">근거 인용: {criterion.quote}</p></div>)}
        </div>
        <div className="grid gap-3 md:grid-cols-2">
          <div className="rounded-lg border border-amber-200 bg-white/80 p-3"><p className="flex items-center gap-1.5 text-xs font-bold text-amber-900"><Lightbulb className="h-3.5 w-3.5" /> 다음 답안에서 우선 보완할 점</p><ol className="mt-2 list-decimal space-y-1 pl-4 text-xs leading-5 text-slate-700">{evaluation.priorityImprovements.map((item, index) => <li key={index}>{item}</li>)}</ol></div>
          <div className="rounded-lg border border-slate-200 bg-white/80 p-3"><p className="flex items-center gap-1.5 text-xs font-bold text-slate-800"><ListChecks className="h-3.5 w-3.5" /> 평가 확인</p><ul className="mt-2 space-y-1 text-xs leading-5 text-slate-700"><li>{evaluation.isOnTopic ? "주제 적합성 확인" : "주제 적합성 부족"}</li><li>{evaluation.hasClearClaim ? "명확한 주장 확인" : "주장·입장 제시 필요"}</li><li>{evaluation.hasComparativeAnalysis ? "비교·분석 확인" : "비교·분석 보완 필요"}</li>{evaluation.missingRequirements.slice(0, 2).map((item, index) => <li key={index}>보완: {item}</li>)}</ul></div>
        </div>
      </div>
    );
  }

  return <div className={`p-4 rounded-xl border text-sm space-y-1 mt-3 ${result.isCorrect ? "bg-emerald-50 border-emerald-200 text-emerald-900" : "bg-amber-50 border-amber-200 text-amber-900"}`}><p className="font-bold">{result.aiFeedback}</p><p className="text-xs opacity-90">해설: {explanation}</p></div>;
}
