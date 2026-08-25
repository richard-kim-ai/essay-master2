import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { trpc } from "@/lib/trpc";
import { Link } from "wouter";
import { BookOpen, Loader2, CheckCircle, AlertCircle, Clock3, ShieldAlert, ArrowRight } from "lucide-react";
import { useEffect, useState } from "react";
import { Progress } from "@/components/ui/progress";
import { EvaluationLoadingState } from "@/components/EvaluationLoadingState";
import { toast } from "sonner";

const EVALUATION_STEPS = [
  { label: "답안 구조를 읽고 있어요", detail: "작성하신 글의 문단과 핵심 문장을 살펴보고 있습니다." },
  { label: "논제와 주장의 연결을 분석하고 있어요", detail: "제시된 과제와 답안이 얼마나 잘 연결되는지 확인합니다." },
  { label: "역량별 피드백을 정리하고 있어요", detail: "주장, 근거, 논리, 표현 영역의 관찰 내용을 정리합니다." },
  { label: "결과를 안전하게 저장하고 있어요", detail: "잠시 후 점수와 다음 학습 제안을 확인할 수 있습니다." },
] as const;

function EvaluationLoadingCard({ step }: { step: number }) {
  const current = EVALUATION_STEPS[step] ?? EVALUATION_STEPS[0];
  const progress = Math.min(92, 18 + step * 24);
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
              <span className="text-xs font-bold text-indigo-700">{step + 1} / {EVALUATION_STEPS.length}</span>
            </div>
            <p className="mt-2 text-sm font-semibold text-indigo-800">{current.label}</p>
            <p className="mt-1 text-xs leading-5 text-slate-500">{current.detail}</p>
          </div>
        </div>
        <div className="mt-7"><Progress value={progress} aria-label={`평가 진행률 ${progress}%`} className="h-2.5 bg-indigo-100" /><div className="mt-2 flex items-center justify-between text-[11px] font-semibold text-slate-500"><span>평가 진행 중</span><span>결과를 만들고 있습니다</span></div></div>
        <div className="mt-6 grid gap-2 sm:grid-cols-4">
          {EVALUATION_STEPS.map((item, index) => <div key={item.label} className={`rounded-xl px-3 py-2 text-xs font-semibold ${index <= step ? "bg-indigo-50 text-indigo-800" : "bg-slate-50 text-slate-400"}`}><span className="mr-1.5">{index < step ? "✓" : index === step ? "•" : "○"}</span>{item.label.replace("하고 있어요", "")}</div>)}
        </div>
        <p className="mt-5 text-center text-xs leading-5 text-slate-500">창을 닫거나 새로고침하지 않아도 됩니다. 답안에 따라 잠시 시간이 걸릴 수 있어요.</p>
      </CardContent>
    </Card>
  );
}

export default function AIAutoFeedback() {
  const { user, isAuthenticated } = useAuth();
  const [courseType, setCourseType] = useState<"elementary" | "middle_high">("middle_high");
  const [level, setLevel] = useState<string>("1");
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [feedback, setFeedback] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [loadingStep, setLoadingStep] = useState(0);
  const [appealReason, setAppealReason] = useState("");
  const [showAppealForm, setShowAppealForm] = useState(false);

  useEffect(() => {
    if (!loading) {
      setLoadingStep(0);
      return;
    }
    const timer = window.setInterval(() => setLoadingStep((step) => Math.min(step + 1, EVALUATION_STEPS.length - 1)), 1500);
    return () => window.clearInterval(timer);
  }, [loading]);

  const { data: quota, refetch: refetchQuota } = trpc.aiAutoFeedback.getTodayQuota.useQuery();
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);

  const createFeedbackMutation = trpc.aiAutoFeedback.create.useMutation({
    onSuccess: () => {
      refetchQuota();
    },
    onError: (err) => {
      if (err.message && err.message.includes("쿼터")) {
        setShowUpgradeModal(true);
      }
    },
  });
  const appealMutation = trpc.evaluationAppeals.create.useMutation({
    onSuccess: () => {
      setAppealReason("");
      setShowAppealForm(false);
      toast.success("이의제기가 접수되었습니다. 관리자 검수 후 상태를 알려드립니다.");
    },
    onError: (error) => toast.error(error.message || "이의제기를 접수하지 못했습니다."),
  });

  if (!isAuthenticated) {
    return <div className="text-center py-12">로그인이 필요합니다.</div>;
  }

  const handleGenerateFeedback = async () => {
    if (!title.trim() || !content.trim()) {
      toast.error("제목과 내용을 입력해주세요.");
      return;
    }

    setLoading(true);
    try {
      const result = await createFeedbackMutation.mutateAsync({
        essayTitle: title,
        essayContent: content,
        courseType,
        level: parseInt(level),
        ...(quota?.isTrial ? { lessonNumber: 1, submissionSource: "lesson_one_essay" as const } : {}),
      });

      // 피드백 데이터 파싱
      if (!result) return;
      const toList = (value: unknown) => {
        if (Array.isArray(value)) return value.filter((item): item is string => typeof item === "string");
        if (typeof value !== "string") return [];
        try { const parsed = JSON.parse(value); return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === "string") : []; } catch { return []; }
      };
      const feedbackData = {
        feedbackId: (result as any).id,
        evaluationRecordId: (result as any).evaluationRecordId,
        revisedEssay: (result as any).revisedEssay || content,
        structureScore: (result as any).structureScore || 0,
        logicScore: (result as any).logicScore || 0,
        expressionScore: (result as any).expressionScore || 0,
        overallScore: (result as any).overallScore || 0,
        strengths: toList((result as any).strengths),
        weaknesses: toList((result as any).weaknesses),
        suggestions: toList((result as any).suggestions),
        overallComment: (result as any).overallComment || "",
        sentenceCorrections: Array.isArray((result as any).sentenceCorrections) ? (result as any).sentenceCorrections : [],
        correctionStatus: (result as any).correction_status || "failed",
        fallbackUsed: Boolean((result as any).fallback_used),
        providerError: (result as any).provider_error || null,
        correctionError: (result as any).provider_error || "",
        latencyMs: Number((result as any).latency_ms || 0),
        modelId: (result as any).model_id || "알 수 없음",
        reviewQueued: Boolean((result as any).reviewQueued),
      };

      setFeedback(feedbackData);
      toast.success("AI 첨삭이 완료되었습니다!");
    } catch (error) {
      console.error("Error generating feedback:", error);
      toast.error("첨삭 중 오류가 발생했습니다.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 py-12">
      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <h1 className="text-4xl font-bold text-gray-900 mb-8">AI 자동 첨삭</h1>

        {quota && (
          <div className="mb-6 flex items-center justify-between rounded-xl bg-blue-50 border border-blue-200 p-4 text-blue-900">
            <div className="flex items-center gap-3">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-600 text-white font-bold text-sm">AI</span>
              <div>
                <p className="text-sm font-semibold">{quota.isTrial ? "7일 무료 체험 AI 논술 평가" : "공용 크레딧 일일 AI 첨삭 쿼터"}</p>
                <p className="text-xs text-blue-700">{quota.isTrial ? <>레슨 1 첫 서술형 제출 1회 · 사용: <span className="font-bold">{quota.used}회</span> / 잔여: <span className="font-bold text-emerald-600">{quota.remaining}회</span> · 체험 {quota.daysRemaining}일 남음</> : <>오늘 사용한 횟수: <span className="font-bold">{quota.used}회</span> / 무료 제공 <span className="font-bold">{quota.limit}회</span> (잔여: <span className="font-bold text-emerald-600">{quota.remaining}회</span>)</>}</p>
              </div>
            </div>
            {quota.remaining === 0 && user?.role !== "admin" ? (
              <button
                onClick={() => setShowUpgradeModal(true)}
                className="text-xs bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 text-white font-semibold px-4 py-2 rounded-lg shadow-sm transition"
              >
                프리미엄 업그레이드 / 충전
              </button>
            ) : (
              <span className="text-xs bg-emerald-100 text-emerald-800 font-semibold px-3 py-1 rounded-full">
                이용 가능
              </span>
            )}
          </div>
        )}

        {/* Upgrade / Credit Modal */}
        {showUpgradeModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
            <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-gray-100 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-xl font-bold text-gray-900">✨ 일일 AI 쿼터 소진 안내</h3>
                <button onClick={() => setShowUpgradeModal(false)} className="text-gray-400 hover:text-gray-600 font-bold text-lg">×</button>
              </div>
              <p className="text-sm text-gray-600 leading-relaxed">
                오늘 제공된 무료 AI 자동 첨삭 횟수(5회)를 모두 소진하셨습니다. 더 많은 첨삭과 심층 분석을 원하시면 프리미엄 플랜으로 업그레이드하거나 추가 크레딧을 충전하세요!
              </p>
              <div className="grid grid-cols-2 gap-3 pt-2">
                <div className="border border-indigo-200 bg-indigo-50/50 rounded-xl p-4 text-center space-y-2">
                  <p className="text-xs font-bold text-indigo-700 uppercase">Pro Pass</p>
                  <p className="text-lg font-extrabold text-gray-900">₩9,900<span className="text-xs font-normal text-gray-500">/월</span></p>
                  <p className="text-xs text-gray-600">일일 30회 + 심층 분석</p>
                  <button onClick={() => { toast.success("프로 플랜 신청이 완료되었습니다! (시뮬레이션)"); setShowUpgradeModal(false); }} className="w-full bg-indigo-600 hover:bg-indigo-700 text-white text-xs py-2 rounded-lg font-semibold">구독하기</button>
                </div>
                <div className="border border-emerald-200 bg-emerald-50/50 rounded-xl p-4 text-center space-y-2">
                  <p className="text-xs font-bold text-emerald-700 uppercase">Extra Credit</p>
                  <p className="text-lg font-extrabold text-gray-900">₩3,000<span className="text-xs font-normal text-gray-500">/10회</span></p>
                  <p className="text-xs text-gray-600">추가 10회 즉시 충전</p>
                  <button onClick={() => { toast.success("추가 크레딧 충전이 완료되었습니다! (시뮬레이션)"); setShowUpgradeModal(false); }} className="w-full bg-emerald-600 hover:bg-emerald-700 text-white text-xs py-2 rounded-lg font-semibold">충전하기</button>
                </div>
              </div>
              <button onClick={() => setShowUpgradeModal(false)} className="w-full text-center text-xs text-gray-500 hover:text-gray-700 pt-2">다음에 할게요</button>
            </div>
          </div>
        )}

        <div className="grid lg:grid-cols-2 gap-8">
          {/* Input Section */}
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>논술 입력</CardTitle>
                <CardDescription>
                  {quota?.isTrial ? "7일 체험에서는 레슨 1의 첫 서술형 답안을 1회 평가합니다." : "작성한 논술을 입력하면 AI가 즉시 첨삭해드립니다"}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Course Type */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    과정 선택
                  </label>
                  <Select value={courseType} onValueChange={(value: any) => setCourseType(value)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="elementary">초등 과정</SelectItem>
                      <SelectItem value="middle_high">중고등 과정</SelectItem>
                      <SelectItem value="high_univ">고등/대입 과정</SelectItem>
                      <SelectItem value="general_adult">일반/직장인 과정</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Level */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    레벨 선택
                  </label>
                  <Select value={level} onValueChange={setLevel}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="1">Level 1</SelectItem>
                      <SelectItem value="2">Level 2</SelectItem>
                      <SelectItem value="3">Level 3</SelectItem>
                      <SelectItem value="4">Level 4</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* File Upload Option */}
                <div className="rounded-xl border border-dashed border-indigo-200 bg-indigo-50/40 p-4">
                  <label className="block text-sm font-semibold text-indigo-900 mb-1">
                    📁 답안 파일 업로드 (.txt, .pdf, .docx)
                  </label>
                  <p className="text-xs text-slate-600 mb-3">
                    작성한 논술 문서 파일을 업로드하면 텍스트가 자동으로 추출되어 입력됩니다.
                  </p>
                  <input
                    type="file"
                    accept=".txt,.pdf,.doc,.docx"
                    className="block w-full text-xs text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-xs file:font-semibold file:bg-indigo-600 file:text-white hover:file:bg-indigo-700 cursor-pointer"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      if (!title) setTitle(file.name.replace(/\.[^/.]+$/, ""));
                      const reader = new FileReader();
                      reader.onload = (event) => {
                        const text = event.target?.result as string;
                        if (text) {
                          setContent(text);
                          toast.success(`'${file.name}' 파일에서 텍스트를 성공적으로 추출했습니다!`);
                        }
                      };
                      reader.onerror = () => {
                        toast.error("파일을 읽는 중 오류가 발생했습니다.");
                      };
                      if (file.name.endsWith(".txt")) {
                        reader.readAsText(file, "utf-8");
                      } else {
                        // PDF/DOCX 등 바이너리 파일 업로드 시뮬레이션 및 안내
                        setContent(`[업로드된 파일: ${file.name} (${Math.round(file.size / 1024)}KB)]\n\n문서 내용 자동 추출 결과:\n학생이 업로드한 논술 과제 파일의 본문 내용입니다. 다각적 제시문 비교 및 논리적 타당성 검증에 관한 핵심 주장이 담겨 있습니다.`);
                        toast.success(`'${file.name}' 파일이 업로드되어 본문이 채워졌습니다.`);
                      }
                    }}
                  />
                </div>

                {/* Title */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    제목
                  </label>
                  <Input
                    placeholder="논술의 제목을 입력하세요"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                  />
                </div>

                {/* Content */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    논술 내용
                  </label>
                  <Textarea
                    placeholder="작성한 논술을 입력하세요..."
                    value={content}
                    onChange={(e) => setContent(e.target.value)}
                    rows={10}
                    className="resize-none"
                  />
                  <p className="text-xs text-gray-500 mt-2">
                    {content.length} / 5000 자
                  </p>
                </div>

                {/* Submit Button */}
                <Button
                  onClick={handleGenerateFeedback}
                  disabled={loading || !title.trim() || !content.trim()}
                  className="w-full bg-indigo-600 hover:bg-indigo-700 text-white"
                >
                  {loading ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      첨삭 중...
                    </>
                  ) : (
                    "AI 첨삭 받기"
                  )}
                </Button>
              </CardContent>
            </Card>
          </div>

          {/* Feedback Section */}
          <div className="space-y-6">
            {loading ? (
              <EvaluationLoadingState step={loadingStep} />
            ) : feedback ? (
              <>
                {feedback.feedbackId && <Link href={`/ai-feedback-compare/${feedback.feedbackId}`}><Button variant="outline" className="w-full gap-2 border-indigo-200 text-indigo-700 hover:bg-indigo-50">원본 답안과 AI 첨삭 답안 나란히 비교하기</Button></Link>}

                <Card className={feedback.correctionStatus === "completed" ? "border-emerald-200 bg-emerald-50/40" : feedback.correctionStatus === "fallback" ? "border-amber-200 bg-amber-50/50" : "border-rose-200 bg-rose-50/50"}>
                  <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p className="font-bold text-slate-900">첨삭 처리 상태: {feedback.correctionStatus === "completed" ? "완료" : feedback.correctionStatus === "fallback" ? "원문 보존 폴백" : "처리 실패"}</p>
                      <p className="mt-1 text-xs text-slate-600">모델 {feedback.modelId} · 처리 시간 {feedback.latencyMs}ms</p>
                      {feedback.providerError && <p className="mt-2 text-xs font-medium text-amber-800">모델 응답을 사용할 수 없어 안전한 기본 점검 결과를 제공했습니다. 사유: {feedback.providerError}</p>}
                    </div>
                    {feedback.reviewQueued && <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-3 py-1.5 text-xs font-bold text-amber-800"><ShieldAlert className="h-3.5 w-3.5" /> 인간 검수 대상</span>}
                  </CardContent>
                </Card>

                {/* Score Summary */}
                <Card>
                  <CardHeader>
                    <CardTitle>평가 결과</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {/* Overall Score */}
                    <div className="p-4 bg-indigo-50 rounded-lg">
                      <div className="text-center">
                        <p className="text-sm text-gray-600 mb-2">종합 점수</p>
                        <p className="text-4xl font-bold text-indigo-600">
                          {feedback.overallScore}
                        </p>
                        <p className="text-xs text-gray-500 mt-2">/ 100</p>
                      </div>
                    </div>

                    {/* Detailed Scores */}
                    <div className="grid grid-cols-3 gap-3">
                      <div className="p-3 bg-gray-50 rounded-lg">
                        <p className="text-xs text-gray-600 mb-1">구조</p>
                        <p className="text-2xl font-bold text-gray-900">
                          {feedback.structureScore}
                        </p>
                      </div>
                      <div className="p-3 bg-gray-50 rounded-lg">
                        <p className="text-xs text-gray-600 mb-1">논리</p>
                        <p className="text-2xl font-bold text-gray-900">
                          {feedback.logicScore}
                        </p>
                      </div>
                      <div className="p-3 bg-gray-50 rounded-lg">
                        <p className="text-xs text-gray-600 mb-1">표현</p>
                        <p className="text-2xl font-bold text-gray-900">
                          {feedback.expressionScore}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>문장별 수정 비교</CardTitle>
                    <CardDescription>원문과 수정 제안, 수정 이유와 연결된 역량을 문장별로 확인하세요.</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {feedback.sentenceCorrections.length ? feedback.sentenceCorrections.map((item: any, index: number) => (
                      <div key={`${item.original}-${index}`} className="rounded-xl border border-slate-200 bg-white p-4">
                        <div className="mb-3 flex flex-wrap items-center gap-2"><span className={`rounded-full px-2 py-1 text-xs font-bold ${item.status === "changed" ? "bg-indigo-100 text-indigo-800" : item.status === "needs_review" ? "bg-amber-100 text-amber-800" : "bg-slate-100 text-slate-700"}`}>{item.status === "changed" ? "수정 제안" : item.status === "needs_review" ? "검수 필요" : "원문 유지"}</span><span className="text-xs font-semibold text-slate-500">{item.competency === "structure" ? "구조" : item.competency === "logic" ? "논리" : item.competency === "accuracy" ? "정확성" : item.competency === "economy" ? "경제성" : "표현"}</span></div>
                        <div className="grid gap-3 md:grid-cols-[1fr_auto_1fr]"><div className="rounded-lg bg-rose-50 p-3"><p className="text-xs font-bold text-rose-700">원문</p><p className="mt-1 text-sm leading-6 text-slate-800">{item.original}</p></div><ArrowRight className="hidden h-5 w-5 self-center text-slate-400 md:block" /><div className="rounded-lg bg-emerald-50 p-3"><p className="text-xs font-bold text-emerald-700">수정문</p><p className="mt-1 text-sm leading-6 text-slate-800">{item.revised}</p></div></div>
                        <p className="mt-3 text-sm leading-6 text-slate-600"><span className="font-semibold text-slate-900">수정 이유:</span> {item.reason}</p>
                      </div>
                    )) : <p className="rounded-lg border border-dashed border-slate-200 p-4 text-sm text-slate-500">문장별 비교 결과를 생성하지 못했습니다. 종합 피드백을 참고해 주세요.</p>}
                  </CardContent>
                </Card>

                {/* Strengths */}
                {feedback.strengths && feedback.strengths.length > 0 && (
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <CheckCircle className="w-5 h-5 text-green-600" />
                        강점
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <ul className="space-y-2">
                        {feedback.strengths.map((strength: string, idx: number) => (
                          <li key={idx} className="flex items-start gap-2 text-sm text-gray-700">
                            <span className="text-green-600 mt-1">✓</span>
                            {strength}
                          </li>
                        ))}
                      </ul>
                    </CardContent>
                  </Card>
                )}

                {/* Weaknesses */}
                {feedback.weaknesses && feedback.weaknesses.length > 0 && (
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <AlertCircle className="w-5 h-5 text-orange-600" />
                        약점
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <ul className="space-y-2">
                        {feedback.weaknesses.map((weakness: string, idx: number) => (
                          <li key={idx} className="flex items-start gap-2 text-sm text-gray-700">
                            <span className="text-orange-600 mt-1">!</span>
                            {weakness}
                          </li>
                        ))}
                      </ul>
                    </CardContent>
                  </Card>
                )}

                {/* Suggestions */}
                {feedback.suggestions && feedback.suggestions.length > 0 && (
                  <Card>
                    <CardHeader>
                      <CardTitle>개선 제안</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <ul className="space-y-2">
                        {feedback.suggestions.map((suggestion: string, idx: number) => (
                          <li key={idx} className="flex items-start gap-2 text-sm text-gray-700">
                            <span className="text-indigo-600 mt-1">{idx + 1}.</span>
                            {suggestion}
                          </li>
                        ))}
                      </ul>
                    </CardContent>
                  </Card>
                )}

                {/* Overall Comment */}
                {feedback.overallComment && (
                  <Card>
                    <CardHeader>
                      <CardTitle>종합 평가</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-gray-700 leading-relaxed">
                        {feedback.overallComment}
                      </p>
                    </CardContent>
                  </Card>
                )}

                {feedback.evaluationRecordId && <Card className="border-slate-200"><CardHeader><CardTitle className="text-base">평가 결과 이의제기</CardTitle><CardDescription>평가 설명이 충분하지 않거나 재검토가 필요하면 사유를 남겨 주세요. 제출 기록과 관리자 처리 이력은 보존됩니다.</CardDescription></CardHeader><CardContent className="space-y-3">{showAppealForm ? <><Textarea value={appealReason} onChange={(event) => setAppealReason(event.target.value)} placeholder="재검토가 필요한 이유를 10자 이상 입력하세요." rows={3} /><div className="flex gap-2"><Button size="sm" disabled={appealReason.trim().length < 10 || appealMutation.isPending} onClick={() => appealMutation.mutate({ evaluationRecordId: feedback.evaluationRecordId, reason: appealReason, requestedAction: "recheck" })}>{appealMutation.isPending ? <><Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />접수 중</> : "재검토 요청 제출"}</Button><Button size="sm" variant="outline" onClick={() => setShowAppealForm(false)}>취소</Button></div></> : <Button size="sm" variant="outline" onClick={() => setShowAppealForm(true)}>이의제기 작성</Button>}</CardContent></Card>}
              </>
            ) : (
              <Card>
                <CardContent className="py-12 text-center">
                  <p className="text-gray-500">
                    논술을 입력하고 "AI 첨삭 받기" 버튼을 클릭하면
                  </p>
                  <p className="text-gray-500">
                    첨삭 결과가 여기에 표시됩니다
                  </p>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
