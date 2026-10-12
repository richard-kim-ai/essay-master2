import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { trpc } from "@/lib/trpc";
import { Link } from "wouter";
import {
  BookOpen,
  Loader2,
  CheckCircle,
  AlertCircle,
  Clock3,
  ShieldAlert,
  ArrowRight,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Progress } from "@/components/ui/progress";
import { EvaluationLoadingState } from "@/components/EvaluationLoadingState";
import { toast } from "sonner";
import { useLearningCourse } from "@/hooks/useLearningCourse";

const EVALUATION_STEPS = [
  {
    label: "답안 구조를 읽고 있어요",
    detail: "작성하신 글의 문단과 핵심 문장을 살펴보고 있습니다.",
  },
  {
    label: "논제와 주장의 연결을 분석하고 있어요",
    detail: "제시된 과제와 답안이 얼마나 잘 연결되는지 확인합니다.",
  },
  {
    label: "역량별 피드백을 정리하고 있어요",
    detail: "주장, 근거, 논리, 표현 영역의 관찰 내용을 정리합니다.",
  },
  {
    label: "결과를 안전하게 저장하고 있어요",
    detail: "잠시 후 점수와 다음 학습 제안을 확인할 수 있습니다.",
  },
] as const;

function EvaluationLoadingCard({ step }: { step: number }) {
  const current = EVALUATION_STEPS[step] ?? EVALUATION_STEPS[0];
  const progress = Math.min(92, 18 + step * 24);
  return (
    <Card className="overflow-hidden border-indigo-100 bg-white shadow-sm">
      <CardContent
        className="p-6 sm:p-8"
        role="status"
        aria-live="polite"
        aria-busy="true"
      >
        <div className="flex items-start gap-4">
          <div className="relative flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-700">
            <Loader2 className="h-6 w-6 animate-spin" aria-hidden="true" />
            <span
              className="absolute inset-0 rounded-2xl ring-4 ring-indigo-100/60"
              aria-hidden="true"
            />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="font-extrabold text-slate-950">
                AI가 답안을 차분히 읽고 있어요
              </p>
              <span className="text-xs font-bold text-indigo-700">
                {step + 1} / {EVALUATION_STEPS.length}
              </span>
            </div>
            <p className="mt-2 text-sm font-semibold text-indigo-800">
              {current.label}
            </p>
            <p className="mt-1 text-xs leading-5 text-slate-500">
              {current.detail}
            </p>
          </div>
        </div>
        <div className="mt-7">
          <Progress
            value={progress}
            aria-label={`평가 진행률 ${progress}%`}
            className="h-2.5 bg-indigo-100"
          />
          <div className="mt-2 flex items-center justify-between text-[11px] font-semibold text-slate-500">
            <span>평가 진행 중</span>
            <span>결과를 만들고 있습니다</span>
          </div>
        </div>
        <div className="mt-6 grid gap-2 sm:grid-cols-4">
          {EVALUATION_STEPS.map((item, index) => (
            <div
              key={item.label}
              className={`rounded-xl px-3 py-2 text-xs font-semibold ${index <= step ? "bg-indigo-50 text-indigo-800" : "bg-slate-50 text-slate-400"}`}
            >
              <span className="mr-1.5">
                {index < step ? "✓" : index === step ? "•" : "○"}
              </span>
              {item.label.replace("하고 있어요", "")}
            </div>
          ))}
        </div>
        <p className="mt-5 text-center text-xs leading-5 text-slate-500">
          창을 닫거나 새로고침하지 않아도 됩니다. 답안에 따라 잠시 시간이 걸릴
          수 있어요.
        </p>
      </CardContent>
    </Card>
  );
}

export default function AIAutoFeedback() {
  const { user, isAuthenticated } = useAuth();
  const {
    effectiveCourse: courseType,
    courseLabel,
    scopeKey,
    canLearn,
    canSelectCourse,
    mode,
    setCourseType,
  } = useLearningCourse();
  const [level, setLevel] = useState<string>("1");
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [feedback, setFeedback] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [loadingStep, setLoadingStep] = useState(0);
  const [appealReason, setAppealReason] = useState("");
  const [showAppealForm, setShowAppealForm] = useState(false);
  const scopeRef = useRef(scopeKey);
  const feedbackScopeRef = useRef<string | null>(null);
  const resetScopeRef = useRef(scopeKey);
  if (scopeRef.current !== scopeKey) scopeRef.current = scopeKey;
  const canRequestEvaluation = isAuthenticated && canLearn && !!courseType;

  useEffect(
    () => () => {
      scopeRef.current = "disposed";
    },
    []
  );

  useEffect(() => {
    if (resetScopeRef.current === scopeKey) return;
    resetScopeRef.current = scopeKey;
    setFeedback(null);
    setLoading(false);
    setAppealReason("");
    setShowAppealForm(false);
  }, [scopeKey]);

  useEffect(() => {
    if (!loading) {
      setLoadingStep(0);
      return;
    }
    const timer = window.setInterval(
      () =>
        setLoadingStep(step => Math.min(step + 1, EVALUATION_STEPS.length - 1)),
      1500
    );
    return () => window.clearInterval(timer);
  }, [loading]);

  const { data: quota, refetch: refetchQuota } =
    trpc.aiAutoFeedback.getTodayQuota.useQuery(undefined, {
      enabled: canRequestEvaluation,
    });

  const createFeedbackMutation = trpc.aiAutoFeedback.create.useMutation({
    onSuccess: () => {
      if (
        feedbackScopeRef.current === scopeRef.current &&
        scopeRef.current !== "disposed"
      )
        void refetchQuota();
    },
    onError: () => {
      // 한도·이용권 문제는 서버 메시지를 그대로 보여 주기 위해 아래 제출 처리에서 안내하고, 남은 횟수는 다시 불러온다.
      if (
        feedbackScopeRef.current === scopeRef.current &&
        scopeRef.current !== "disposed"
      )
        void refetchQuota();
    },
  });
  const appealMutation = trpc.evaluationAppeals.create.useMutation({
    onSuccess: () => {
      setAppealReason("");
      setShowAppealForm(false);
      toast.success(
        "이의제기가 접수되었습니다. 관리자 검수 후 상태를 알려드립니다."
      );
    },
    onError: error =>
      toast.error(error.message || "이의제기를 접수하지 못했습니다."),
  });

  const handleGenerateFeedback = async () => {
    if (!canRequestEvaluation || !courseType) {
      toast.info(
        isAuthenticated
          ? "학습 과정이 지정된 뒤 AI 첨삭을 이용할 수 있습니다."
          : "로그인 후 AI 첨삭을 이용할 수 있습니다."
      );
      return;
    }
    if (!title.trim() || !content.trim()) {
      toast.error("제목과 내용을 입력해주세요.");
      return;
    }

    setLoading(true);
    const requestScope = scopeKey;
    feedbackScopeRef.current = requestScope;
    try {
      const result = await createFeedbackMutation.mutateAsync({
        essayTitle: title,
        essayContent: content,
        courseType,
        level: parseInt(level),
      });

      // 피드백 데이터 파싱
      if (!result || scopeRef.current !== requestScope) return;
      const toList = (value: unknown) => {
        if (Array.isArray(value))
          return value.filter(
            (item): item is string => typeof item === "string"
          );
        if (typeof value !== "string") return [];
        try {
          const parsed = JSON.parse(value);
          return Array.isArray(parsed)
            ? parsed.filter((item): item is string => typeof item === "string")
            : [];
        } catch {
          return [];
        }
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
        sentenceCorrections: Array.isArray((result as any).sentenceCorrections)
          ? (result as any).sentenceCorrections
          : [],
        correctionStatus: (result as any).correction_status || "failed",
        fallbackUsed: Boolean((result as any).fallback_used),
        providerError: (result as any).provider_error || null,
        correctionError: (result as any).provider_error || "",
        latencyMs: Number((result as any).latency_ms || 0),
        modelId: (result as any).model_id || "알 수 없음",
        reviewQueued: Boolean((result as any).reviewQueued),
        personalized: Boolean((result as any).personalized),
      };

      setFeedback(feedbackData);
      toast.success("AI 첨삭이 완료되었습니다!");
    } catch (error) {
      if (scopeRef.current === requestScope)
        toast.error(
          error instanceof Error && error.message
            ? error.message
            : "첨삭 중 오류가 발생했습니다."
        );
    } finally {
      if (scopeRef.current === requestScope) setLoading(false);
    }
  };

  return (
    <div className="bg-slate-50 py-12">
      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="mb-8 flex flex-wrap items-end justify-between gap-3">
          <h1 className="text-4xl font-bold text-slate-900">AI 자동 첨삭</h1>
          <Link href="/my-writings" className="text-sm font-bold text-indigo-700 hover:underline">지난 글·AI 첨삭 내역 보기 →</Link>
        </div>

        {!canRequestEvaluation && (
          <div className="mb-6 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-900">
            {!isAuthenticated
              ? "미리보기에서는 AI 첨삭을 실행하지 않습니다. 로그인 후 학습 과정에 맞는 첨삭을 이용해 주세요."
              : !canLearn
                ? "이 계정에는 학습 과정이 지정되지 않아 AI 첨삭을 요청할 수 없습니다. 과정이 지정된 뒤 이용해 주세요."
                : "현재 계정에서는 AI 첨삭을 요청할 수 없습니다."}
          </div>
        )}

        {quota &&
          (() => {
            const institutional = quota.mode === "institution";
            const needsPlan =
              quota.mode === "none" ||
              ((quota.mode === "plan" || quota.mode === "trial") &&
                quota.remaining === 0);
            const title = institutional
              ? `${quota.contractName ?? "기관"} 계약 이용`
              : quota.mode === "trial"
                ? "7일 무료 체험 AI 논술 평가"
                : quota.mode === "plan"
                  ? `${quota.planKey === "growth" ? "성장" : "스타터"} 이용권 AI 논술 평가`
                  : quota.mode === "unlimited"
                    ? "AI 논술 평가"
                    : "AI 논술 평가는 이용권이 필요합니다";
            const detail = institutional ? (
              quota.canUse ? (
                <>
                  계약 기간{" "}
                  {quota.periodEnd
                    ? new Date(quota.periodEnd).toLocaleDateString("ko-KR", {
                        timeZone: "Asia/Seoul",
                      })
                    : "-"}{" "}
                  전까지 ·{" "}
                  {quota.periodOnly ? (
                    <>
                      계약 기간 동안 횟수 제한 없이 이용 (AI 첨삭 사용{" "}
                      <span className="font-bold">{quota.used}회</span>)
                    </>
                  ) : quota.overage > 0 ? (
                    <>
                      AI 첨삭 사용{" "}
                      <span className="font-bold">{quota.used}회</span> (계약
                      횟수 {quota.limit}회를 {quota.overage}회 넘었습니다. 기관
                      담당자에게 문의해 주세요)
                    </>
                  ) : (
                    <>
                      AI 첨삭 사용{" "}
                      <span className="font-bold">{quota.used}회</span> /{" "}
                      {quota.limit}회 (잔여{" "}
                      <span className="font-bold text-emerald-600">
                        {quota.remaining}회
                      </span>
                      )
                    </>
                  )}
                </>
              ) : (
                (quota.reason ?? "기관 담당자에게 문의해 주세요.")
              )
            ) : quota.mode === "trial" ? (
              <>
                7일 무료 체험 AI 평가·첨삭 2회 포함 · 사용{" "}
                <span className="font-bold">{quota.used}회</span> / 잔여{" "}
                <span className="font-bold text-emerald-600">
                  {quota.remaining}회
                </span>{" "}
                · 체험 {quota.daysRemaining}일 남음
              </>
            ) : quota.mode === "plan" ? (
              <>
                이용 기간{" "}
                {quota.periodEnd
                  ? new Date(quota.periodEnd).toLocaleDateString("ko-KR", {
                      timeZone: "Asia/Seoul",
                    })
                  : "-"}
                까지 · 사용 <span className="font-bold">{quota.used}회</span> /{" "}
                {quota.limit}회 (잔여{" "}
                <span className="font-bold text-emerald-600">
                  {quota.remaining}회
                </span>
                )
              </>
            ) : quota.mode === "unlimited" ? (
              "교사·관리자 계정은 사용 횟수에 제한이 없습니다."
            ) : (
              (quota.reason ?? "")
            );
            return (
              <div className="mb-6 flex flex-col gap-3 rounded-xl border border-indigo-200 bg-indigo-50 p-4 text-indigo-900 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-3">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-indigo-600 text-sm font-bold text-white">
                    AI
                  </span>
                  <div>
                    <p className="text-sm font-semibold">{title}</p>
                    <p className="text-xs text-indigo-700">{detail}</p>
                    {quota.reason &&
                      !institutional &&
                      quota.mode !== "none" &&
                      quota.remaining === 0 && (
                        <p className="mt-1 text-xs text-amber-800">
                          {quota.reason}
                        </p>
                      )}
                    {!institutional && quota.awaitingStartCount > 0 && (
                      <p className="mt-1 text-xs text-amber-800">
                        결제한 이용권 {quota.awaitingStartCount}개가 시작 대기
                        중입니다.{" "}
                        <Link
                          href="/checkout"
                          className="font-semibold underline"
                        >
                          결제 화면
                        </Link>
                        에서 '유료 이용 시작'을 눌러 주세요.
                      </p>
                    )}
                  </div>
                </div>
                {needsPlan && user?.role === "user" ? (
                  <Link href="/checkout">
                    <Button
                      size="sm"
                      className="bg-indigo-600 hover:bg-indigo-700"
                    >
                      이용권 선택
                    </Button>
                  </Link>
                ) : quota.canUse ? (
                  <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-800">
                    이용 가능
                  </span>
                ) : null}
              </div>
            );
          })()}

        <div className="grid lg:grid-cols-2 gap-8">
          {/* Input Section */}
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>논술 입력</CardTitle>
                <CardDescription>
                  {quota?.isTrial
                    ? "7일 무료 체험에서는 AI 평가·첨삭을 2회 이용할 수 있고, 쓴 글과 결과는 내 계정에 저장됩니다."
                    : "작성한 논술을 입력하면 AI가 즉시 첨삭해드립니다"}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Course Type */}
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    {canSelectCourse ? "미리볼 과정" : "현재 과정"}
                  </label>
                  <Select
                    value={courseType ?? undefined}
                    onValueChange={value =>
                      setCourseType(value as Exclude<typeof courseType, null>)
                    }
                    disabled={!canSelectCourse}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="elementary">초등 과정</SelectItem>
                      <SelectItem value="middle_high">중고등 과정</SelectItem>
                      <SelectItem value="high_univ">고등/대입 과정</SelectItem>
                      <SelectItem value="general_adult">
                        일반/직장인 과정
                      </SelectItem>
                    </SelectContent>
                  </Select>
                  {!canSelectCourse && (
                    <p className="mt-2 text-xs text-slate-500">
                      {courseType
                        ? `${courseLabel} 과정으로 첨삭 기준이 적용됩니다.`
                        : "과정 지정이 필요합니다."}
                    </p>
                  )}
                </div>

                {/* Level */}
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
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
                    📁 텍스트 파일 불러오기 (.txt)
                  </label>
                  <p className="text-xs text-slate-600 mb-3">
                    .txt 파일을 불러오면 내용이 아래 입력창에 채워집니다.
                    PDF·Word 문서는 내용을 복사해서 아래 입력창에 붙여 넣어
                    주세요.
                  </p>
                  <input
                    type="file"
                    accept=".txt,text/plain"
                    className="block w-full text-xs text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-xs file:font-semibold file:bg-indigo-600 file:text-white hover:file:bg-indigo-700 cursor-pointer"
                    onChange={e => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      if (!title) setTitle(file.name.replace(/\.[^/.]+$/, ""));
                      const reader = new FileReader();
                      reader.onload = event => {
                        const text = event.target?.result as string;
                        if (text) {
                          setContent(text);
                          toast.success(
                            `'${file.name}' 파일에서 텍스트를 성공적으로 추출했습니다!`
                          );
                        }
                      };
                      reader.onerror = () => {
                        toast.error("파일을 읽는 중 오류가 발생했습니다.");
                      };
                      if (file.name.toLowerCase().endsWith(".txt")) {
                        reader.readAsText(file, "utf-8");
                      } else {
                        // 파일 내용을 읽지 못하면 입력창을 채우지 않는다(임의 문장을 넣어 평가하지 않는다).
                        e.target.value = "";
                        toast.error(
                          "텍스트(.txt) 파일만 불러올 수 있어요. PDF·Word 문서는 내용을 복사해서 입력창에 붙여 넣어 주세요."
                        );
                      }
                    }}
                  />
                </div>

                {/* Title */}
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    제목
                  </label>
                  <Input
                    placeholder="논술의 제목을 입력하세요"
                    value={title}
                    onChange={e => setTitle(e.target.value)}
                  />
                </div>

                {/* Content */}
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    논술 내용
                  </label>
                  <Textarea
                    placeholder="작성한 논술을 입력하세요..."
                    value={content}
                    onChange={e => setContent(e.target.value)}
                    rows={10}
                    className="resize-none"
                  />
                  <p className="text-xs text-slate-500 mt-2">
                    {content.length} / 5000 자
                  </p>
                </div>

                {/* Submit Button */}
                <Button
                  onClick={handleGenerateFeedback}
                  disabled={
                    !canRequestEvaluation ||
                    loading ||
                    !title.trim() ||
                    !content.trim()
                  }
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
                {feedback.feedbackId && (
                  <Link href={`/ai-feedback-compare/${feedback.feedbackId}`}>
                    <Button
                      variant="outline"
                      className="w-full gap-2 border-indigo-200 text-indigo-700 hover:bg-indigo-50"
                    >
                      원본 답안과 AI 첨삭 답안 나란히 비교하기
                    </Button>
                  </Link>
                )}

                <Card
                  className={
                    feedback.correctionStatus === "completed"
                      ? "border-emerald-200 bg-emerald-50/40"
                      : feedback.correctionStatus === "fallback"
                        ? "border-amber-200 bg-amber-50/50"
                        : "border-rose-200 bg-rose-50/50"
                  }
                >
                  <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p className="font-bold text-slate-900">
                        첨삭 처리 상태:{" "}
                        {feedback.correctionStatus === "completed"
                          ? "완료"
                          : feedback.correctionStatus === "fallback"
                            ? "원문 보존 폴백"
                            : "처리 실패"}
                      </p>
                      <p className="mt-1 text-xs text-slate-600">
                        모델 {feedback.modelId} · 처리 시간 {feedback.latencyMs}
                        ms
                      </p>
                      {feedback.providerError && (
                        <p className="mt-2 text-xs font-medium text-amber-800">
                          모델 응답을 사용할 수 없어 안전한 기본 점검 결과를
                          제공했습니다. 사유: {feedback.providerError}
                        </p>
                      )}
                    </div>
                    {feedback.personalized && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-indigo-100 px-3 py-1.5 text-xs font-bold text-indigo-800">
                        개인 맞춤 첨삭 적용
                      </span>
                    )}
                    {feedback.reviewQueued && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-3 py-1.5 text-xs font-bold text-amber-800">
                        <ShieldAlert className="h-3.5 w-3.5" /> 인간 검수 대상
                      </span>
                    )}
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
                        <p className="text-sm text-slate-600 mb-2">종합 점수</p>
                        <p className="text-4xl font-bold text-indigo-600">
                          {feedback.overallScore}
                        </p>
                        <p className="text-xs text-slate-500 mt-2">/ 100</p>
                      </div>
                    </div>

                    {/* Detailed Scores */}
                    <div className="grid grid-cols-3 gap-3">
                      <div className="p-3 bg-slate-50 rounded-lg">
                        <p className="text-xs text-slate-600 mb-1">구조</p>
                        <p className="text-2xl font-bold text-slate-900">
                          {feedback.structureScore}
                        </p>
                      </div>
                      <div className="p-3 bg-slate-50 rounded-lg">
                        <p className="text-xs text-slate-600 mb-1">논리</p>
                        <p className="text-2xl font-bold text-slate-900">
                          {feedback.logicScore}
                        </p>
                      </div>
                      <div className="p-3 bg-slate-50 rounded-lg">
                        <p className="text-xs text-slate-600 mb-1">표현</p>
                        <p className="text-2xl font-bold text-slate-900">
                          {feedback.expressionScore}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>문장별 수정 비교</CardTitle>
                    <CardDescription>
                      원문과 수정 제안, 수정 이유와 연결된 역량을 문장별로
                      확인하세요.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {feedback.sentenceCorrections.length ? (
                      feedback.sentenceCorrections.map(
                        (item: any, index: number) => (
                          <div
                            key={`${item.original}-${index}`}
                            className="rounded-xl border border-slate-200 bg-white p-4"
                          >
                            <div className="mb-3 flex flex-wrap items-center gap-2">
                              <span
                                className={`rounded-full px-2 py-1 text-xs font-bold ${item.status === "changed" ? "bg-indigo-100 text-indigo-800" : item.status === "needs_review" ? "bg-amber-100 text-amber-800" : "bg-slate-100 text-slate-700"}`}
                              >
                                {item.status === "changed"
                                  ? "수정 제안"
                                  : item.status === "needs_review"
                                    ? "검수 필요"
                                    : "원문 유지"}
                              </span>
                              <span className="text-xs font-semibold text-slate-500">
                                {item.competency === "structure"
                                  ? "구조"
                                  : item.competency === "logic"
                                    ? "논리"
                                    : item.competency === "accuracy"
                                      ? "정확성"
                                      : item.competency === "economy"
                                        ? "경제성"
                                        : "표현"}
                              </span>
                            </div>
                            <div className="grid gap-3 md:grid-cols-[1fr_auto_1fr]">
                              <div className="rounded-lg bg-rose-50 p-3">
                                <p className="text-xs font-bold text-rose-700">
                                  원문
                                </p>
                                <p className="mt-1 text-sm leading-6 text-slate-800">
                                  {item.original}
                                </p>
                              </div>
                              <ArrowRight className="hidden h-5 w-5 self-center text-slate-400 md:block" />
                              <div className="rounded-lg bg-emerald-50 p-3">
                                <p className="text-xs font-bold text-emerald-700">
                                  수정문
                                </p>
                                <p className="mt-1 text-sm leading-6 text-slate-800">
                                  {item.revised}
                                </p>
                              </div>
                            </div>
                            <p className="mt-3 text-sm leading-6 text-slate-600">
                              <span className="font-semibold text-slate-900">
                                수정 이유:
                              </span>{" "}
                              {item.reason}
                            </p>
                          </div>
                        )
                      )
                    ) : (
                      <p className="rounded-lg border border-dashed border-slate-200 p-4 text-sm text-slate-500">
                        문장별 비교 결과를 생성하지 못했습니다. 종합 피드백을
                        참고해 주세요.
                      </p>
                    )}
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
                        {feedback.strengths.map(
                          (strength: string, idx: number) => (
                            <li
                              key={idx}
                              className="flex items-start gap-2 text-sm text-slate-700"
                            >
                              <span className="text-green-600 mt-1">✓</span>
                              {strength}
                            </li>
                          )
                        )}
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
                        {feedback.weaknesses.map(
                          (weakness: string, idx: number) => (
                            <li
                              key={idx}
                              className="flex items-start gap-2 text-sm text-slate-700"
                            >
                              <span className="text-orange-600 mt-1">!</span>
                              {weakness}
                            </li>
                          )
                        )}
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
                        {feedback.suggestions.map(
                          (suggestion: string, idx: number) => (
                            <li
                              key={idx}
                              className="flex items-start gap-2 text-sm text-slate-700"
                            >
                              <span className="text-indigo-600 mt-1">
                                {idx + 1}.
                              </span>
                              {suggestion}
                            </li>
                          )
                        )}
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
                      <p className="text-slate-700 leading-relaxed">
                        {feedback.overallComment}
                      </p>
                    </CardContent>
                  </Card>
                )}

                {feedback.evaluationRecordId && (
                  <Card className="border-slate-200">
                    <CardHeader>
                      <CardTitle className="text-base">
                        평가 결과 이의제기
                      </CardTitle>
                      <CardDescription>
                        평가 설명이 충분하지 않거나 재검토가 필요하면 사유를
                        남겨 주세요. 제출 기록과 관리자 처리 이력은 보존됩니다.
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      {showAppealForm ? (
                        <>
                          <Textarea
                            value={appealReason}
                            onChange={event =>
                              setAppealReason(event.target.value)
                            }
                            placeholder="재검토가 필요한 이유를 10자 이상 입력하세요."
                            rows={3}
                          />
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              disabled={
                                appealReason.trim().length < 10 ||
                                appealMutation.isPending
                              }
                              onClick={() =>
                                appealMutation.mutate({
                                  evaluationRecordId:
                                    feedback.evaluationRecordId,
                                  reason: appealReason,
                                  requestedAction: "recheck",
                                })
                              }
                            >
                              {appealMutation.isPending ? (
                                <>
                                  <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
                                  접수 중
                                </>
                              ) : (
                                "재검토 요청 제출"
                              )}
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => setShowAppealForm(false)}
                            >
                              취소
                            </Button>
                          </div>
                        </>
                      ) : (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setShowAppealForm(true)}
                        >
                          이의제기 작성
                        </Button>
                      )}
                    </CardContent>
                  </Card>
                )}
              </>
            ) : (
              <Card>
                <CardContent className="py-12 text-center">
                  <p className="text-slate-500">
                    논술을 입력하고 "AI 첨삭 받기" 버튼을 클릭하면
                  </p>
                  <p className="text-slate-500">
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
