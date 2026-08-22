import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";
import DashboardLayout from "@/components/DashboardLayout";
import { BookOpen, AlertCircle, CheckCircle2, Sparkles, Trash2, ArrowRight, RefreshCcw, HelpCircle, Link2, Share2, Trophy } from "lucide-react";
import { useLocation } from "wouter";
import { useState } from "react";
import { toast } from "sonner";
import { Textarea } from "@/components/ui/textarea";

type QuizSessionResult = {
  reviewed: number;
  total: number;
  completedAt: string;
};

export default function MistakeNotebook() {
  const [, setLocation] = useLocation();
  const utils = trpc.useUtils();

  const { data: mistakes = [], isLoading: mistakesLoading } = trpc.curriculum.getMistakes.useQuery();
  const { data: recommended = [], isLoading: recLoading } = trpc.curriculum.getRecommendedQuestions.useQuery();

  const removeMutation = trpc.curriculum.removeMistake.useMutation({
    onSuccess: () => {
      toast.success("오답 노트에서 항목이 삭제되었습니다.");
      utils.curriculum.getMistakes.invalidate();
    },
  });

  const awardBadgeMutation = trpc.curriculum.awardReviewKing.useMutation({
    onSuccess: (data) => {
      toast.success(`🎉 축하합니다! '${data.badgeName}' 뱃지를 획득하셨습니다!`);
    },
  });

  // Quiz Mode State
  const [isQuizMode, setIsQuizMode] = useState(false);
  const [quizIndex, setQuizIndex] = useState(0);
  const [quizAnswer, setQuizAnswer] = useState("");
  const [showAnswer, setShowAnswer] = useState(false);
  const [quizResult, setQuizResult] = useState<QuizSessionResult | null>(null);
  const [isSharingResult, setIsSharingResult] = useState(false);
  const [sharedQuizResult] = useState<QuizSessionResult | null>(() => {
    const params = new URLSearchParams(window.location.search);
    const reviewed = Number(params.get("reviewed"));
    const total = Number(params.get("total"));
    const completedAt = params.get("completedAt");
    if (!Number.isInteger(reviewed) || reviewed < 1 || !Number.isInteger(total) || total < reviewed || !completedAt || Number.isNaN(Date.parse(completedAt))) return null;
    return { reviewed, total, completedAt };
  });

  const startQuizMode = () => {
    if (mistakes.length === 0) {
      toast.error("풀이할 오답 문항이 없습니다.");
      return;
    }
    // Randomize or reset
    setIsQuizMode(true);
    setQuizIndex(0);
    setQuizAnswer("");
    setShowAnswer(false);
    setQuizResult(null);
  };

  const currentMistake = mistakes[quizIndex];
  const displayedQuizResult = quizResult || sharedQuizResult;

  const getQuizResultShareUrl = (result: QuizSessionResult) => {
    const url = new URL(`${window.location.origin}/mistake-notebook`);
    url.searchParams.set("reviewed", String(result.reviewed));
    url.searchParams.set("total", String(result.total));
    url.searchParams.set("completedAt", result.completedAt);
    return url.toString();
  };

  const copyText = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      const textarea = document.createElement("textarea");
      textarea.value = text;
      textarea.style.position = "fixed";
      textarea.style.opacity = "0";
      document.body.appendChild(textarea);
      textarea.select();
      const copied = document.execCommand("copy");
      document.body.removeChild(textarea);
      return copied;
    }
  };

  const handleCopyQuizResultLink = async () => {
    if (!quizResult) return;
    const copied = await copyText(getQuizResultShareUrl(quizResult));
    if (copied) toast.success("복습 결과 링크가 클립보드에 복사되었습니다.", { description: "친구나 선생님에게 붙여넣어 공유해 보세요." });
    else toast.error("링크를 복사하지 못했습니다. 브라우저 권한을 확인해주세요.");
  };

  const handleShareQuizResult = async () => {
    if (!quizResult) return;
    setIsSharingResult(true);
    const shareUrl = getQuizResultShareUrl(quizResult);
    const shareTitle = "논술 마스터 오답 노트 퀴즈 결과";
    const shareDescription = `오답 노트 퀴즈 ${quizResult.total}문항을 모두 복습했어요. 함께 다음 복습 계획을 세워보세요.`;
    try {
      if ((window as any).Kakao?.Share?.sendDefault) {
        (window as any).Kakao.Share.sendDefault({
          objectType: "feed",
          content: {
            title: shareTitle,
            description: shareDescription,
            imageUrl: "https://images.unsplash.com/photo-1455390582262-044cdead277a?w=800&auto=format&fit=crop&q=60",
            link: { mobileWebUrl: shareUrl, webUrl: shareUrl },
          },
          buttons: [{ title: "복습 결과 확인", link: { mobileWebUrl: shareUrl, webUrl: shareUrl } }],
        });
        toast.success("카카오톡 공유 창을 열었습니다.");
        return;
      }
      if (navigator.share) {
        await navigator.share({ title: shareTitle, text: shareDescription, url: shareUrl });
        toast.success("공유 메뉴를 열었습니다. 카카오톡을 선택해 전송하세요.");
        return;
      }
      const copied = await copyText(shareUrl);
      if (copied) toast.success("카카오톡에 붙여넣을 복습 결과 링크를 복사했습니다.");
      else toast.error("공유 링크를 준비하지 못했습니다.");
    } catch (error) {
      if ((error as DOMException)?.name !== "AbortError") {
        console.error(error);
        toast.error("결과 공유 중 오류가 발생했습니다.");
      }
    } finally {
      setIsSharingResult(false);
    }
  };

  return (
    <DashboardLayout>
      <div className="p-6 md:p-10 space-y-8 max-w-7xl mx-auto">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 bg-gradient-to-r from-amber-600 to-rose-700 text-white p-8 rounded-3xl shadow-xl">
          <div>
            <span className="px-3 py-1 bg-white/25 rounded-full text-xs font-bold text-white tracking-wide">
              오답 복습 및 맞춤 추천
            </span>
            <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight mt-2">
              나만의 오답 노트 & 취약점 클리닉
            </h1>
            <p className="text-xs md:text-sm text-amber-100 mt-1">
              워크북과 AI 퀴즈·단락 재구성·요약 연습에서 보완이 필요한 결과를 모아 복습하고, 랜덤 퀴즈 모드로 다시 풀어보세요.
            </p>
          </div>
          <div className="flex items-center gap-3">
            {mistakes.length > 0 && !isQuizMode && (
              <Button
                onClick={startQuizMode}
                className="bg-amber-400 hover:bg-amber-50 text-slate-900 font-bold gap-2 shadow-md"
              >
                <RefreshCcw className="w-4 h-4" /> 오답 랜덤 퀴즈 모드 시작
              </Button>
            )}
            <Button
              onClick={() => setLocation("/mypage")}
              className="bg-white text-amber-900 hover:bg-amber-50 font-bold"
            >
              마이페이지 허브
            </Button>
          </div>
        </div>

        {displayedQuizResult && !isQuizMode && (
          <Card className="border-emerald-200 bg-gradient-to-br from-emerald-50 to-white shadow-sm overflow-hidden">
            <CardContent className="p-5 sm:p-6 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
              <div className="flex items-start gap-3">
                <div className="shrink-0 rounded-full bg-emerald-100 p-2.5 text-emerald-700"><Trophy className="w-5 h-5" /></div>
                <div>
                  <p className="text-xs font-bold uppercase tracking-wide text-emerald-700">오답 노트 퀴즈 결과</p>
                  <h2 className="mt-1 text-lg font-extrabold text-slate-900">{displayedQuizResult.reviewed}개 문항 복습을 완료했습니다.</h2>
                  <p className="mt-1 text-sm text-slate-600">총 {displayedQuizResult.total}개 문항 · 완료 {new Date(displayedQuizResult.completedAt).toLocaleDateString("ko-KR")}</p>
                </div>
              </div>
              {quizResult && (
                <div className="flex flex-col sm:flex-row gap-2 w-full lg:w-auto">
                  <Button variant="outline" onClick={handleCopyQuizResultLink} className="border-emerald-300 bg-white text-emerald-800 hover:bg-emerald-100 gap-1.5"><Link2 className="w-4 h-4" /> 링크 복사</Button>
                  <Button onClick={handleShareQuizResult} disabled={isSharingResult} className="bg-yellow-400 text-slate-900 hover:bg-yellow-300 gap-1.5">{isSharingResult ? <span className="h-4 w-4 animate-spin rounded-full border-2 border-slate-700 border-t-transparent" /> : <Share2 className="w-4 h-4" />} 카카오톡 공유</Button>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* 퀴즈 모드 진행 창 */}
        {isQuizMode && currentMistake && (
          <Card className="border-2 border-amber-300 bg-amber-50/40 shadow-lg">
            <CardHeader className="bg-amber-100/60 rounded-t-xl pb-3 flex flex-row items-center justify-between">
              <div>
                <span className="text-xs font-bold px-2.5 py-1 bg-amber-600 text-white rounded-md">
                  랜덤 퀴즈 모드 ({quizIndex + 1} / {mistakes.length})
                </span>
                <CardTitle className="text-lg font-extrabold text-slate-900 mt-2">
                  {currentMistake.questionTitle || `오답 복습 문제 #${currentMistake.id}`}
                </CardTitle>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsQuizMode(false)}
                className="text-slate-700 border-amber-300 hover:bg-amber-100"
              >
                퀴즈 종료
              </Button>
            </CardHeader>
            <CardContent className="space-y-6 pt-6">
              <div className="rounded-xl bg-white p-5 border border-amber-200 shadow-sm space-y-2">
                <p className="text-xs font-semibold text-amber-800">이전에 제출했던 오답 및 피드백</p>
                <p className="text-sm text-slate-700 font-medium">내 답안: "{currentMistake.userAnswer}"</p>
                <p className="text-xs text-rose-700">AI 피드백: {currentMistake.aiFeedback}</p>
              </div>

              <div className="space-y-3">
                <label className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <HelpCircle className="w-4 h-4 text-amber-700" /> 다시 올바른 정답이나 논증을 작성해보세요:
                </label>
                <Textarea
                  placeholder="정답 및 해설을 참고하여 다시 서술해주세요..."
                  value={quizAnswer}
                  onChange={(e) => setQuizAnswer(e.target.value)}
                  className="min-h-[100px] bg-white text-sm"
                />
              </div>

              <div className="flex items-center justify-between pt-2">
                <Button
                  variant="outline"
                  onClick={() => setShowAnswer(!showAnswer)}
                  className="border-amber-300 text-amber-900 hover:bg-amber-100"
                >
                  {showAnswer ? "해설 숨기기" : "정답 및 해설 보기"}
                </Button>

                <Button
                  onClick={() => {
                    toast.success("훌륭합니다! 오답 복습이 완료되었습니다.");
                    if (quizIndex < mistakes.length - 1) {
                      setQuizIndex(quizIndex + 1);
                      setQuizAnswer("");
                      setShowAnswer(false);
                    } else {
                      toast.success("모든 오답 퀴즈를 완벽하게 완료했습니다!");
                      awardBadgeMutation.mutate();
                      setQuizResult({ reviewed: mistakes.length, total: mistakes.length, completedAt: new Date().toISOString() });
                      setIsQuizMode(false);
                    }
                  }}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold gap-2"
                >
                  <CheckCircle2 className="w-4 h-4" /> 정답 제출 및 다음 문제
                </Button>
              </div>

              {showAnswer && (
                <div className="rounded-xl bg-emerald-50 border border-emerald-200 p-4 text-sm text-emerald-900 space-y-1">
                  <p className="font-bold">💡 정답 해설 가이드</p>
                  <p className="text-xs leading-relaxed">
                    본 문제는 논리적 인과관계와 핵심 쟁점을 명확히 파악하는 것이 중요합니다. 위 오답 피드백과 비교하여 핵심 키워드가 포함되었는지 확인하세요.
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* 오답 노트 리스트 */}
        {!isQuizMode && (
          <div className="space-y-4">
            <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
              <AlertCircle className="w-5 h-5 text-rose-600" /> 축적된 오답 문항 ({mistakes.length}개)
            </h2>

            {mistakesLoading ? (
              <div className="py-12 text-center text-slate-500">오답 노트를 불러오는 중입니다...</div>
            ) : mistakes.length === 0 ? (
              <Card className="border-slate-200 bg-white shadow-sm p-12 text-center">
                <CheckCircle2 className="w-12 h-12 text-emerald-500 mx-auto mb-3" />
                <h3 className="text-lg font-bold text-slate-800">축적된 오답이 없습니다!</h3>
                <p className="text-sm text-slate-600 mt-1">커리큘럼 워크북 문제를 풀고 학습 능력을 높여보세요.</p>
              </Card>
            ) : (
              <div className="grid gap-4 md:grid-cols-2">
                {mistakes.map((m: any) => (
                  <Card key={m.id} className="border-rose-100 bg-rose-50/30 shadow-sm flex flex-col justify-between">
                    <CardHeader className="pb-3">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold px-2.5 py-1 bg-rose-100 text-rose-800 rounded-md">
                          {m.source === "learning_tool" ? `${m.toolType === "quiz" ? "AI 문장 교정" : m.toolType === "reordering" ? "단락 재구성" : "요약 연습"} · ${m.score}점` : `워크북 오답 #${m.id}`}
                        </span>
                        <span className="text-xs text-slate-500">
                          {new Date(m.createdAt).toLocaleDateString()}
                        </span>
                      </div>
                      <CardTitle className="text-base font-bold text-slate-900 mt-2">
                        {m.questionTitle ? `${m.questionTitle} — ` : ""}제출 답안: {m.userAnswer}
                      </CardTitle>
                      <CardDescription className="text-slate-700 text-sm mt-1">
                        {m.aiFeedback}
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="pt-0 flex items-center justify-end gap-2 border-t border-rose-100/50 pt-3">
                      <Button
                        size="sm"
                        variant="outline"
                        className="text-rose-700 border-rose-200 hover:bg-rose-100 gap-1"
                        onClick={() => removeMutation.mutate({ mistakeId: m.id, source: m.source || "workbook" })}
                      >
                        <Trash2 className="w-4 h-4" /> 복습 완료 (삭제)
                      </Button>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>
        )}

        {/* AI 취약 영역 맞춤 문제 추천 */}
        <div className="space-y-4 pt-6 border-t border-slate-200">
          <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-indigo-600" /> 취약 영역 맞춤 추천 기출문제
          </h2>

          {recLoading ? (
            <div className="py-8 text-center text-slate-500">추천 문제를 분석 중입니다...</div>
          ) : recommended.length === 0 ? (
            <p className="text-sm text-slate-500">추천할 문제가 없습니다.</p>
          ) : (
            <div className="grid gap-4 md:grid-cols-3">
              {recommended.map((q: any) => (
                <Card key={q.id} className="border-indigo-100 bg-white shadow-sm flex flex-col justify-between">
                  <CardHeader className="pb-3">
                    <span className="text-xs font-semibold px-2.5 py-1 bg-indigo-50 text-indigo-700 rounded-md w-fit">
                      {q.courseType} · Level {q.level}
                    </span>
                    <CardTitle className="text-base font-bold text-slate-900 mt-2 line-clamp-1">
                      {q.title}
                    </CardTitle>
                    <CardDescription className="text-slate-600 text-xs line-clamp-2 mt-1">
                      {q.prompt}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="pt-0 border-t border-slate-100 pt-3">
                    <Button
                      size="sm"
                      className="w-full bg-indigo-600 hover:bg-indigo-700 text-white gap-1"
                      onClick={() => setLocation(`/workbook/${q.courseType}/${q.level}`)}
                    >
                      지금 풀러 가기 <ArrowRight className="w-4 h-4" />
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}
