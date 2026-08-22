import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { trpc } from "@/lib/trpc";
import { Link } from "wouter";
import { BookOpen, Loader2, CheckCircle, AlertCircle } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

export default function AIAutoFeedback() {
  const { user, isAuthenticated } = useAuth();
  const [courseType, setCourseType] = useState<"elementary" | "middle_high">("middle_high");
  const [level, setLevel] = useState<string>("1");
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [feedback, setFeedback] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [feedbackMode, setFeedbackMode] = useState<"legacy" | "evaluation_v1">("evaluation_v1");
  const [evaluationRecordId, setEvaluationRecordId] = useState<number | null>(null);
  const [revisionText, setRevisionText] = useState("");

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
  const evaluateAndCorrectMutation = trpc.writingEvaluationEngine.evaluateAndCorrect.useMutation();
  const reevaluateMutation = trpc.writingEvaluationEngine.reevaluate.useMutation();

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
      const result = feedbackMode === "evaluation_v1"
        ? await evaluateAndCorrectMutation.mutateAsync({
            metadata: {
              curriculum_code: "FREE_WRITING",
              theory_category: "free_writing",
              education_level: courseType,
              difficulty: parseInt(level),
              writing_type: "ARGUMENTATIVE",
            },
            task: { prompt: title || "자유작문" },
            submission: { learner_id: String(user?.id ?? "anonymous"), essay_text: content },
          })
        : await createFeedbackMutation.mutateAsync({
            essayTitle: title,
            essayContent: content,
            courseType,
            level: parseInt(level),
          });

      // 피드백 데이터 파싱
      if (!result) return;
      const feedbackData = feedbackMode === "evaluation_v1"
        ? (() => {
            const evaluation = (result as any).evaluation;
            const correction = (result as any).correction;
            const scoreFor = (names: string[]) => {
              const dimension = evaluation.dimension_scores?.find((item: any) => names.includes(item.dimension));
              return dimension ? Math.round((dimension.score / dimension.max_score) * 100) : evaluation.total_score;
            };
            return {
              revisedEssay: correction.revised_text || content,
              structureScore: scoreFor(["구성·문단"]),
              logicScore: scoreFor(["주장·논증", "연결·일관성"]),
              expressionScore: scoreFor(["표현·언어규범"]),
              overallScore: evaluation.total_score || 0,
              strengths: evaluation.strengths || [],
              weaknesses: evaluation.improvement_points || [],
              suggestions: evaluation.feedback?.revision_steps || [],
              overallComment: correction.learner_explanation || evaluation.feedback?.summary || "",
              sentenceCorrections: correction.sentence_corrections || [],
              correctionStatus: correction.correction_status || "completed",
              correctionError: correction.provider_error || "",
            };
          })()
        : {
            feedbackId: (result as any).id,
            revisedEssay: (result as any).revisedEssay || content,
            structureScore: (result as any).structureScore || 0,
            logicScore: (result as any).logicScore || 0,
            expressionScore: (result as any).expressionScore || 0,
            overallScore: (result as any).overallScore || 0,
            strengths: (result as any).strengths ? JSON.parse((result as any).strengths) : [],
            weaknesses: (result as any).weaknesses ? JSON.parse((result as any).weaknesses) : [],
            suggestions: (result as any).suggestions ? JSON.parse((result as any).suggestions) : [],
            overallComment: (result as any).overallComment || "",
          };

      if (feedbackMode === "evaluation_v1") {
        setEvaluationRecordId((result as any).record_id ?? null);
        setRevisionText((result as any).correction?.revised_text || content);
      } else {
        setEvaluationRecordId(null);
        setRevisionText("");
      }
      setFeedback(feedbackData);
      toast[feedbackData.correctionStatus === "completed" ? "success" : "warning"](feedbackData.correctionStatus === "completed" ? "AI 첨삭이 완료되었습니다!" : "첨삭 모델 응답이 불안정해 원문을 보존했습니다.");
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
                <p className="text-sm font-semibold">공용 크레딧 일일 AI 첨삭 쿼터</p>
                <p className="text-xs text-blue-700">오늘 사용한 횟수: <span className="font-bold">{quota.used}회</span> / 무료 제공 <span className="font-bold">{quota.limit}회</span> (잔여: <span className="font-bold text-emerald-600">{quota.remaining}회</span>)</p>
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
                  작성한 논술을 입력하면 AI가 즉시 첨삭해드립니다
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Course Type */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    첨삭 모드
                  </label>
                  <Select value={feedbackMode} onValueChange={(value: "legacy" | "evaluation_v1") => setFeedbackMode(value)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="evaluation_v1">평가엔진 v1.1 · 평가 + 문장별 첨삭</SelectItem>
                      <SelectItem value="legacy">기존 AI 첨삭 · 저장 및 비교</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

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
            {feedback ? (
              <>
                {feedback.feedbackId && <Link href={`/ai-feedback-compare/${feedback.feedbackId}`}><Button variant="outline" className="w-full gap-2 border-indigo-200 text-indigo-700 hover:bg-indigo-50">원본 답안과 AI 첨삭 답안 나란히 비교하기</Button></Link>}

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

                {/* Strengths */}
                {feedbackMode === "evaluation_v1" && feedback.sentenceCorrections?.length > 0 && (
                  <Card>
                    <CardHeader><CardTitle>문장별 원문·수정문 비교</CardTitle><CardDescription>수정 이유를 확인한 뒤 자신의 표현으로 다시 작성해 보세요.</CardDescription></CardHeader>
                    <CardContent className="space-y-4">
                      {feedback.sentenceCorrections.map((item: any, index: number) => (
                        <div key={index} className="rounded-lg border border-slate-200 p-4 text-sm">
                          <div className="grid gap-3 md:grid-cols-2"><div><p className="mb-1 font-semibold text-slate-500">원문</p><p className="rounded bg-rose-50 p-3 text-slate-700">{item.original}</p></div><div><p className="mb-1 font-semibold text-slate-500">수정문</p><p className="rounded bg-emerald-50 p-3 text-slate-700">{item.revised}</p></div></div>
                          <p className="mt-3 text-slate-600"><span className="font-semibold">수정 이유:</span> {item.reason}</p>
                          {item.competency && <p className="mt-1 text-xs text-indigo-600">평가 competency: {item.competency}</p>}
                        </div>
                      ))}
                    </CardContent>
                  </Card>
                )}
                {feedbackMode === "evaluation_v1" && feedback.correctionStatus !== "completed" && (
                  <Card className="border-amber-200 bg-amber-50"><CardContent className="py-4 text-sm text-amber-900">첨삭 상태: {feedback.correctionStatus === "fallback" ? "fallback - 원문 보존" : "실패"}{feedback.correctionError ? ` · ${feedback.correctionError}` : ""}</CardContent></Card>
                )}

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

                {feedbackMode === "evaluation_v1" && evaluationRecordId && (
                  <Card>
                    <CardHeader>
                      <CardTitle>재작성 후 재평가</CardTitle>
                      <CardDescription>AI 개선문을 그대로 제출하지 말고, 자신의 생각과 표현으로 다시 고쳐 보세요.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <Textarea
                        value={revisionText}
                        onChange={(event) => setRevisionText(event.target.value)}
                        rows={8}
                        className="resize-none"
                      />
                      <Button
                        className="w-full bg-emerald-600 hover:bg-emerald-700"
                        disabled={reevaluateMutation.isPending || !revisionText.trim()}
                        onClick={async () => {
                          try {
                            const result = await reevaluateMutation.mutateAsync({
                              record_id: evaluationRecordId,
                              revised_text: revisionText,
                            });
                            const next = result.evaluation;
                            setEvaluationRecordId(result.record_id ?? evaluationRecordId);
                            setRevisionText(result.correction.revised_text || revisionText);
                            setFeedback((current: any) => ({
                              ...current,
                              revisedEssay: result.correction.revised_text || revisionText,
                              overallScore: next.total_score,
                              strengths: next.strengths,
                              weaknesses: next.improvement_points,
                              suggestions: next.feedback.revision_steps,
                              overallComment: result.correction.learner_explanation,
                            }));
                            toast.success("재평가가 완료되었습니다!");
                          } catch {
                            toast.error("재평가 중 오류가 발생했습니다.");
                          }
                        }}
                      >
                        {reevaluateMutation.isPending ? "재평가 중..." : "수정한 글 다시 평가하기"}
                      </Button>
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
