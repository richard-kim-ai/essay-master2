import React, { type ReactNode } from "react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { WorkbookQuestionCardHeader } from "./WorkbookQuestionCardHeader";
import { WorkbookQuestionFeedback, type WorkbookQuestionResult } from "./WorkbookQuestionFeedback";

type WorkbookQuestionCardProps = {
  questionType: string;
  prompt: string;
  explanation: string;
  result?: WorkbookQuestionResult;
  children: ReactNode;
};

export function WorkbookQuestionCard({ questionType, prompt, explanation, result, children }: WorkbookQuestionCardProps) {
  return (
    <Card className="border-slate-200 bg-white shadow-sm">
      <CardHeader className="pb-3"><WorkbookQuestionCardHeader questionType={questionType} prompt={prompt} result={result} /></CardHeader>
      <CardContent className="space-y-4 pt-0">
        {children}
        <WorkbookQuestionFeedback questionType={questionType} result={result} explanation={explanation} />
      </CardContent>
    </Card>
  );
}
