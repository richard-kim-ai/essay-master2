import React from "react";
import { CardDescription } from "@/components/ui/card";
import { getWorkbookQuestionTypeLabel } from "@/lib/workbookQuestionPresentation";

type WorkbookQuestionResult = {
  isCorrect: number;
  score: number;
  evaluation?: unknown;
};

type WorkbookQuestionCardHeaderProps = {
  questionType: string;
  prompt: string;
  result?: WorkbookQuestionResult;
};

export function WorkbookQuestionCardHeader({ questionType, prompt, result }: WorkbookQuestionCardHeaderProps) {
  return (
    <>
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold px-2.5 py-1 bg-indigo-50 text-indigo-700 rounded-md">
          {getWorkbookQuestionTypeLabel(questionType)}
        </span>
        {result && (
          <span className={`text-xs font-bold px-2.5 py-1 rounded-md ${result.isCorrect ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-800"}`}>
            {questionType === "subjective" ? `평가 점수: ${result.score}/100점` : result.isCorrect ? "정답 (100점)" : `점수: ${result.score}점`}
          </span>
        )}
      </div>
      <CardDescription className="text-slate-700 font-medium whitespace-pre-line mt-1">{prompt}</CardDescription>
    </>
  );
}
