import React from "react";
import { Sparkles } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { trpc } from "@/lib/trpc";
import { AI_COST_ASSUMPTIONS, describeAiCost, estimateAiCostKrw } from "@shared/aiCost";

// AI 호출 비용(토큰)이 어느 기능에서 얼마나 쓰이는지 보여 주는 관리자용 집계. 서버가 AI를 호출한 요청마다 자동으로 기록한다.
export const AI_FEATURE_LABELS: Record<string, string> = {
  "aiAutoFeedback.create": "AI 자동 첨삭(학생)",
  "writingEvaluationEngine.evaluate": "글쓰기 평가 엔진",
  "writingEvaluationEngine.evaluateAndCorrect": "글쓰기 평가·교정",
  "writingEvaluationEngine.reevaluate": "글쓰기 재평가",
  "teacherAi.generateDraft": "교사 AI 첨삭 초안",
  "teacherOperations.generateClassAssignmentAiFeedback": "반 과제 AI 피드백",
  "quiz.getDetailedSentenceFeedback": "문장 상세 피드백",
  "questionBank.topicWizardGuide": "주제 마법사 가이드",
  "questionBank.lessonWritingGuide": "레슨 글쓰기 가이드",
  "questionBank.analyzeThesis": "주제문 분석",
  "questionBank.difficultyLearningGuide": "맞춤 학습 가이드",
  "questionBank.gradeEssay": "요약 AI 채점",
  "questionBank.generateAiQuestions": "AI 문제 출제(관리자)",
  "curriculum.submitWorkbookAnswer": "워크북 주관식 채점",
  "theoryContent.generatePreviews": "이론 콘텐츠 AI 생성(관리자)",
};

export const aiFeatureLabel = (feature: string) => AI_FEATURE_LABELS[feature] ?? feature;

const formatDate = (value: string | Date | null) => (value ? new Date(value).toLocaleDateString("ko-KR", { month: "short", day: "numeric" }) : "–");

export default function AiUsageSummary({ days = 30 }: { days?: number }) {
  const summary = trpc.admin.aiUsageSummary.useQuery({ days });
  const rows = summary.data ?? [];
  const totalTokens = rows.reduce((sum, row) => sum + row.tokens, 0);
  const totalCalls = rows.reduce((sum, row) => sum + row.calls, 0);

  return (
    <Card data-testid="ai-usage-summary">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg"><Sparkles className="h-5 w-5 text-indigo-600" aria-hidden="true" />AI 토큰 사용량 (최근 {days}일)</CardTitle>
        <CardDescription>AI를 호출한 기능별 호출 수와 토큰입니다. 로그인한 사용자의 요청만 집계하고, 비로그인 샘플 체험은 포함하지 않습니다.</CardDescription>
      </CardHeader>
      <CardContent>
        {summary.isLoading ? (
          <p className="py-6 text-center text-sm text-slate-500">불러오는 중입니다...</p>
        ) : rows.length === 0 ? (
          <p className="py-6 text-center text-sm text-slate-500" data-testid="ai-usage-empty">아직 집계된 AI 사용 기록이 없습니다.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead><tr className="border-b text-xs text-slate-500"><th className="py-2 pr-4 font-medium">기능</th><th className="py-2 pr-4 text-right font-medium">호출</th><th className="py-2 pr-4 text-right font-medium">토큰</th><th className="py-2 pr-4 text-right font-medium">추정 비용</th><th className="py-2 pr-4 text-right font-medium">사용자</th><th className="py-2 text-right font-medium">마지막 사용</th></tr></thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.feature} className="border-b border-slate-100">
                    <td className="py-2 pr-4 text-slate-800">{aiFeatureLabel(row.feature)}</td>
                    <td className="py-2 pr-4 text-right tabular-nums">{row.calls.toLocaleString("ko-KR")}</td>
                    <td className="py-2 pr-4 text-right tabular-nums">{row.tokens.toLocaleString("ko-KR")}</td>
                    <td className="py-2 pr-4 text-right tabular-nums text-slate-700" data-testid="ai-usage-row-cost">{describeAiCost(estimateAiCostKrw(row.tokens))}</td>
                    <td className="py-2 pr-4 text-right tabular-nums">{row.users}</td>
                    <td className="py-2 text-right text-slate-500">{formatDate(row.lastAt)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot><tr className="font-semibold"><td className="pt-2">합계</td><td className="pt-2 text-right tabular-nums">{totalCalls.toLocaleString("ko-KR")}</td><td className="pt-2 text-right tabular-nums" data-testid="ai-usage-total-tokens">{totalTokens.toLocaleString("ko-KR")}</td><td className="pt-2 pr-4 text-right tabular-nums" data-testid="ai-usage-total-cost">{describeAiCost(estimateAiCostKrw(totalTokens))}</td><td /><td /></tr></tfoot>
            </table>
            <p className="mt-3 text-xs text-slate-500" data-testid="ai-usage-cost-note">
              추정 비용은 {AI_COST_ASSUMPTIONS.model} 공개 API 정가(입력 ${AI_COST_ASSUMPTIONS.inputUsdPerMillion}·출력 ${AI_COST_ASSUMPTIONS.outputUsdPerMillion} / 100만 토큰)와 환율 {AI_COST_ASSUMPTIONS.krwPerUsd.toLocaleString("ko-KR")}원/$, 출력 비중 {AI_COST_ASSUMPTIONS.outputShareLow * 100}~{AI_COST_ASSUMPTIONS.outputShareHigh * 100}%를 가정한 값입니다. 실제 응답 모델과 입력·출력 토큰은 기록되지 않아 청구액과 다를 수 있으며, Manus 플랫폼 크레딧·개발 작업 비용은 포함하지 않습니다.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
