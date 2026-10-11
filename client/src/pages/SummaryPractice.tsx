import React from "react";
import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import PreviewGate from "@/components/PreviewGate";
import { getPreviewSummaryQuestions } from "@/lib/previewSamples";
import { useLearningCourse } from "@/hooks/useLearningCourse";
import { COURSE_OPTIONS } from "@shared/course";
import { toast } from "sonner";
import { BookOpen, Send, RotateCcw, CheckCircle2, Award } from "lucide-react";
import { Link } from "wouter";
import BadgeCelebrationModal from "@/components/BadgeCelebrationModal";

export default function SummaryPractice() {
  const { isAuthenticated } = useAuth();
  const { effectiveCourse, courseLabel, scopeKey, loading, canSelectCourse, canLearn, canPersist, needsSelection, mode, setCourseType } = useLearningCourse();
  const preview = mode === "public-preview";
  // 과정이 없으면 query는 disabled이며 fallback은 tRPC 입력 타입을 맞추기 위해서만 사용한다.
  const queryCourse = effectiveCourse ?? "elementary";
  const { data: qListData, isLoading } = trpc.questionBank.random.useQuery(
    { courseType: queryCourse, toolType: "summary", limit: 1 },
    { enabled: Boolean(isAuthenticated && canLearn && !loading) },
  );
  const rawQuestions = preview && effectiveCourse ? getPreviewSummaryQuestions(effectiveCourse) : qListData;
  const qList = (rawQuestions || []).filter((question) => question.courseType === effectiveCourse && question.toolType === "summary" && (preview ? question.id < 0 : question.id > 0));

  const [articleTitle, setArticleTitle] = useState("");
  const [articleContent, setArticleContent] = useState("");
  const [summary, setSummary] = useState("");
  const [feedback, setFeedback] = useState<any>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [showCelebration, setShowCelebration] = useState(false);
  const [earnedBadgeName, setEarnedBadgeName] = useState("");
  const scopeRef = useRef(scopeKey);
  const questionIdRef = useRef<number | null>(null);
  // effect 실행 전 완료되는 이전 요청도 새 범위에서 상태를 바꾸지 못하게 한다.
  scopeRef.current = scopeKey;

  const awardBadgeMutation = trpc.badges.award.useMutation();
  const gradeEssayMutation = trpc.questionBank.gradeEssay.useMutation();
  const recordMistakeMutation = trpc.questionBank.recordMistake.useMutation();
  const utils = trpc.useUtils();

  const currentQuestion = qList[0];
  const currentQId = currentQuestion?.id;
  questionIdRef.current = currentQId ?? null;

  useEffect(() => {
    scopeRef.current = scopeKey;
    questionIdRef.current = null;
    setArticleTitle("");
    setArticleContent("");
    setSummary("");
    setFeedback(null);
    setIsAnalyzing(false);
    setShowCelebration(false);
    setEarnedBadgeName("");
    return () => { scopeRef.current = "disposed"; };
  }, [scopeKey]);

  useEffect(() => {
    questionIdRef.current = currentQuestion?.id ?? null;
    setIsAnalyzing(false);
    if (currentQuestion) {
      try {
        const parsed = JSON.parse(currentQuestion.contentData);
        setArticleTitle(currentQuestion.title);
        setArticleContent(parsed.prompt || parsed.content || "요약할 제시문 본문 내용입니다.");
        setSummary("");
        setFeedback(null);
      } catch {
        setArticleTitle(currentQuestion.title);
        setArticleContent("문항 본문을 불러오지 못했습니다. 관리자에게 문의해 주세요.");
      }
    }
  }, [currentQuestion]);

  if (loading) return <div role="status" className="text-center py-12 text-slate-600">학습 과정을 확인하고 있습니다...</div>;
  if (needsSelection) return <div className="bg-slate-50 py-12 px-4 text-center"><p className="font-semibold text-slate-800">수강 과정 선택이 필요합니다.</p><p className="mt-2 text-sm text-slate-500">가입 과정이 확인되면 요약 연습을 시작할 수 있습니다.</p><Link href="/curriculum"><Button className="mt-4">커리큘럼으로 돌아가기</Button></Link></div>;
  if (!canLearn || !effectiveCourse) return <div className="bg-slate-50 py-12 px-4 text-center"><p className="font-semibold text-slate-800">이 계정은 학습 과정이 배정되지 않았습니다.</p><p className="mt-2 text-sm text-slate-500">학습자 계정으로 로그인하거나 담당자에게 과정 배정을 요청해 주세요.</p></div>;
  if (isLoading) return <div className="text-center py-12 text-slate-600">문제은행에서 요약 지문을 불러오는 중...</div>;
  if (!currentQuestion) return <div className="mx-auto max-w-xl py-12 text-center text-slate-700">{courseLabel} 과정의 요약 문항을 준비하고 있습니다.</div>;

  const analyzeSummary = async () => {
    if (!summary.trim() || summary.trim().length < 15) {
      toast.error("핵심 내용이 포함된 15자 이상의 요약문을 작성해주세요.");
      return;
    }
    if (!currentQuestion || !currentQId || currentQuestion.courseType !== effectiveCourse || currentQuestion.toolType !== "summary" || (preview ? currentQuestion.id >= 0 : currentQuestion.id <= 0)) return;
    // 공개 미리보기는 PreviewGate가 입력을 막지만, 직접 호출해도 인증·AI 요청이 일어나지 않도록 막는다.
    if (preview) return;

    const requestScope = scopeRef.current;
    const question = currentQuestion;
    const submittedSummary = summary.trim();
    setIsAnalyzing(true);
    try {
      // staff의 원본 문항 AI 검토 정책은 유지한다. 문항은 현재 effectiveCourse query에서 온 것만 사용한다.
      const res = await gradeEssayMutation.mutateAsync({
        questionId: question.id,
        userAnswer: submittedSummary,
      });
      if (scopeRef.current !== requestScope || questionIdRef.current !== question.id) return;

      setFeedback({
        score: res.overallScore,
        logicFlow: res.feedback,
        keywords: res.strengths || ["논리성 우수", "표현력 탁월"],
        suggestions: res.improvements || ["추가 보완 필요"],
      });
      setIsAnalyzing(false);
      toast.success("AI 실시간 채점 및 분석이 완료되었습니다!");

      if (res.overallScore < 100 && canPersist) {
        try {
          await recordMistakeMutation.mutateAsync({
            questionBankId: question.id,
            courseType: effectiveCourse,
            toolType: "summary",
            userAnswer: submittedSummary,
            score: res.overallScore,
            aiFeedback: res.feedback || "핵심 쟁점과 결론의 조건을 다시 확인해 보세요.",
          });
        } catch {
          if (scopeRef.current === requestScope && questionIdRef.current === question.id) toast.error("요약 결과를 오답 노트에 저장하지 못했습니다.");
        }
        if (scopeRef.current !== requestScope || questionIdRef.current !== question.id) return;
      }

      if (res.overallScore >= 80 && canPersist) {
        const bName = `${courseLabel} 요약 전문가 뱃지`;
        try {
          await awardBadgeMutation.mutateAsync({ courseType: effectiveCourse, badgeType: "summary", badgeName: bName });
          if (scopeRef.current !== requestScope || questionIdRef.current !== question.id) return;
          setEarnedBadgeName(bName);
          setShowCelebration(true);
          utils.badges.getByUser.invalidate();
          toast.success("서로 다른 요약 3문항에서 80점 이상을 달성해 뱃지를 획득했습니다.");
        } catch {
          if (scopeRef.current !== requestScope || questionIdRef.current !== question.id) return;
          toast.info("요약 뱃지는 서로 다른 3문항에서 80점 이상을 달성하면 수여됩니다.");
        }
      } else if (scopeRef.current === requestScope && questionIdRef.current === question.id && canPersist) {
        toast.info("이번 점수는 뱃지 기준(80점 이상)에 도달하지 않았습니다. 핵심 주장과 근거를 다시 정리해 보세요.");
      }
    } catch (err: any) {
      if (scopeRef.current !== requestScope || questionIdRef.current !== question.id) return;
      setIsAnalyzing(false);
      toast.error(err.message || "AI 채점 중 오류가 발생했습니다.");
    }
  };

  return (
    <PreviewGate active={preview} title="요약 연습">
    <div className="bg-slate-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <Link href="/curriculum"><Button variant="ghost" className="text-slate-600 pl-0">← 커리큘럼으로 돌아가기</Button></Link>
          <div className="flex flex-wrap gap-2">
            {canSelectCourse && COURSE_OPTIONS.map(({ value, label }) => (
              <Button key={value} size="sm" variant={effectiveCourse === value ? "default" : "outline"} className={effectiveCourse === value ? "bg-indigo-600 text-white" : ""} onClick={() => setCourseType(value)}>
                {label}
              </Button>
            ))}
            {!canSelectCourse && <span className="rounded-full border border-indigo-200 bg-indigo-50 px-3 py-1 text-xs font-bold text-indigo-700">{courseLabel} 과정</span>}
          </div>
        </div>

        <Card className="border-indigo-100 shadow-sm">
          <CardHeader>
            <CardTitle className="text-2xl font-bold text-slate-900">실시간 요약 연습장</CardTitle>
            <CardDescription>제시문을 읽고 핵심 주장과 논거를 3문장 이내로 요약해 보세요.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="p-6 bg-indigo-50/70 border border-indigo-100 rounded-xl space-y-3">
              <h3 className="font-bold text-slate-900 text-lg">{articleTitle}</h3>
              <p className="text-slate-700 text-sm leading-relaxed whitespace-pre-line">{articleContent}</p>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-semibold text-slate-900">나의 요약문 작성</label>
              <Textarea
                rows={5}
                placeholder="제시문의 핵심 내용을 간결하고 명확하게 요약하세요..."
                value={summary}
                onChange={e => setSummary(e.target.value)}
                className="bg-white"
              />
            </div>

            {feedback && (
              <div className="p-5 bg-emerald-50 border border-emerald-200 rounded-xl space-y-3 text-emerald-900">
                <div className="flex items-center gap-2 font-bold text-base">
                  <CheckCircle2 className="h-5 w-5 text-emerald-600" /> AI 요약 분석 피드백 (점수: {feedback.score}점)
                </div>
                <p className="text-sm">{feedback.logicFlow}</p>
                <div className="flex flex-wrap gap-2 pt-1">
                  {feedback.keywords.map((kw: string) => (
                    <span key={kw} className="px-2.5 py-1 bg-emerald-100 text-emerald-800 text-xs font-semibold rounded-full">#{kw}</span>
                  ))}
                </div>
              </div>
            )}

            <div className="flex justify-end pt-4">
              <Button onClick={analyzeSummary} disabled={isAnalyzing} className="bg-indigo-600 hover:bg-indigo-700 text-white gap-2">
                {isAnalyzing ? "분석 중..." : "요약 제출 및 분석 받기"}
              </Button>
            </div>
          </CardContent>
        </Card>

        <BadgeCelebrationModal
          isOpen={showCelebration}
          onClose={() => setShowCelebration(false)}
          badgeName={earnedBadgeName}
          courseName={`${courseLabel} 논술`}
        />
      </div>
    </div>
    </PreviewGate>
  );
}
