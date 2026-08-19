import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { trpc } from "@/lib/trpc";
import { Link } from "wouter";
import { BookOpen, Loader2, AlertCircle, CheckCircle, Award } from "lucide-react";
import BadgeCelebrationModal from "@/components/BadgeCelebrationModal";
import { useState, useEffect } from "react";
import { toast } from "sonner";
import { useAuth } from "@/_core/hooks/useAuth";
import QuestionFeedbackBox from "@/components/QuestionFeedbackBox";
import { readAdminPreviewCourse } from "@/lib/adminPreviewCourse";

export default function QuizPage() {
  const { isAuthenticated, user } = useAuth();
  const [courseType, setCourseType] = useState<"elementary" | "middle_high" | "high_univ" | "general_adult">("elementary");
  useEffect(() => {
    if (user?.role === "admin") setCourseType(readAdminPreviewCourse());
  }, [user?.role]);
  const { data: qList, isLoading: qLoading } = trpc.questionBank.random.useQuery({ courseType, toolType: "quiz", limit: 10 });
  const [currentIndex, setCurrentIndex] = useState(0);
  const [draftAnswer, setDraftAnswer] = useState("");
  const [optionsUnlocked, setOptionsUnlocked] = useState(false);
  const [selectedAnswer, setSelectedAnswer] = useState<string>("");
  const [submitted, setSubmitted] = useState(false);
  const [score, setScore] = useState(0);
  const [finished, setFinished] = useState(false);
  const [showCelebration, setShowCelebration] = useState(false);
  const [earnedBadgeName, setEarnedBadgeName] = useState("");

  const submitMutation = trpc.quiz.submitAnswer.useMutation();
  const recordMistakeMutation = trpc.questionBank.recordMistake.useMutation();
  const awardBadgeMutation = trpc.badges.award.useMutation();
  const utils = trpc.useUtils();

  useEffect(() => {
    setCurrentIndex(0);
    setDraftAnswer("");
    setOptionsUnlocked(false);
    setSelectedAnswer("");
    setSubmitted(false);
    setScore(0);
    setFinished(false);
  }, [courseType]);

  if (!isAuthenticated) {
    return <div className="text-center py-12 text-slate-600">로그인이 필요합니다.</div>;
  }

  if (qLoading) {
    return <div className="text-center py-12 text-slate-600">문제은행에서 맞춤 퀴즈를 불러오는 중입니다...</div>;
  }

  const questions = qList || [];
  const currentQ = questions[currentIndex];

  let parsedData: any = {};
  try {
    parsedData = currentQ ? JSON.parse(currentQ.contentData) : {};
  } catch {
    parsedData = { prompt: currentQ?.title || "문항", options: ["보기 1", "보기 2", "보기 3", "보기 4"], answer: "보기 1", explanation: "해설" };
  }

  const handleVerify = async () => {
    if (!selectedAnswer) {
      toast.error("작성한 문장과 비교할 선택지를 골라주세요.");
      return;
    }
    setSubmitted(true);
    const isCorrect = selectedAnswer === parsedData.answer ? 1 : 0;
    if (isCorrect) setScore(s => s + 10);

    try {
      await submitMutation.mutateAsync({
        quizId: currentQ?.id || 1,
        userAnswer: selectedAnswer,
      });
    } catch (e) {
      // ignore offline/fallback error
    }

    if (isCorrect === 0 && currentQ) {
      try {
        await recordMistakeMutation.mutateAsync({
          questionBankId: currentQ.id,
          courseType,
          toolType: "quiz",
          userAnswer: selectedAnswer,
          score: 0,
          aiFeedback: parsedData.explanation || "정답과 해설을 다시 확인해 보세요.",
        });
      } catch {
        toast.error("오답 노트를 저장하지 못했습니다. 잠시 후 다시 시도해주세요.");
      }
    }
  };

  const handleDraftComplete = () => {
    if (draftAnswer.trim().length < 5) {
      toast.error("먼저 고친 문장을 한 문장 이상 작성해주세요.");
      return;
    }
    setOptionsUnlocked(true);
    setSelectedAnswer("");
    toast.success("작성한 문장을 바탕으로 선택지와 비교해 보세요.");
  };

  const handleNext = async () => {
    if (currentIndex < questions.length - 1) {
      setCurrentIndex(i => i + 1);
      setDraftAnswer("");
      setOptionsUnlocked(false);
      setSelectedAnswer("");
      setSubmitted(false);
    } else {
      setFinished(true);
      const bName = `${courseType === "elementary" ? "초등" : courseType === "middle_high" ? "중고등" : courseType === "high_univ" ? "고등/대입" : "일반"} AI 퀴즈 마스터 뱃지`;
      try {
        await awardBadgeMutation.mutateAsync({ courseType, badgeType: "quiz", badgeName: bName });
        setEarnedBadgeName(bName);
        setShowCelebration(true);
        utils.badges.getByUser.invalidate();
        toast.success("퀴즈 10문항을 모두 정답으로 완료해 뱃지를 획득했습니다.");
      } catch {
        toast.info("퀴즈 뱃지는 서로 다른 10문항을 모두 정답으로 완료하면 수여됩니다.");
      }
    }
  };

  if (questions.length === 0) {
    return (
      <div className="min-h-screen bg-slate-50 py-12 px-4 text-center">
        <p className="text-slate-600">등록된 퀴즈 문항이 없습니다. 관리자 문제은행에서 문항을 추가해주세요.</p>
        <Link href="/curriculum"><Button className="mt-4">커리큘럼으로 돌아가기</Button></Link>
      </div>
    );
  }

  if (finished) {
    return (
      <div className="min-h-screen bg-slate-50 py-16 px-4">
        <div className="max-w-md mx-auto text-center space-y-6 bg-white p-8 rounded-2xl shadow-sm border border-slate-200">
          <div className="w-16 h-16 bg-amber-100 text-amber-600 rounded-full flex items-center justify-center mx-auto text-2xl font-bold">
            🏆
          </div>
          <h2 className="text-2xl font-bold text-slate-900">퀴즈 학습 완료!</h2>
          <p className="text-slate-600">총 10문제 중 최종 획득 점수: <span className="font-bold text-indigo-600 text-lg">{score}점</span></p>
          <div className="p-4 bg-indigo-50 rounded-xl text-indigo-900 text-sm font-medium flex items-center justify-center gap-2">
            <Award className="h-5 w-5 text-indigo-600" /> 과정별 뱃지가 마이페이지에 자동 적립되었습니다.
          </div>
          <div className="flex gap-3 justify-center pt-4">
            <Link href="/dashboard"><Button className="bg-indigo-600 hover:bg-indigo-700 text-white">대시보드로 이동</Button></Link>
            <Button variant="outline" onClick={() => { setCurrentIndex(0); setScore(0); setFinished(false); setSubmitted(false); setSelectedAnswer(""); }}>다시 풀기</Button>
          </div>
        </div>
        <BadgeCelebrationModal
          isOpen={showCelebration}
          onClose={() => setShowCelebration(false)}
          badgeName={earnedBadgeName}
          courseName={courseType === "elementary" ? "초등 논술" : courseType === "middle_high" ? "중고등 논술" : courseType === "high_univ" ? "고등/대입" : "일반/직장인"}
        />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-3xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <Link href="/curriculum">
            <Button variant="ghost" className="gap-2 text-slate-600 pl-0">
              ← 커리큘럼으로 돌아가기
            </Button>
          </Link>
          <div className="flex gap-2">
            {(["elementary", "middle_high", "high_univ", "general_adult"] as const).map(c => (
              <Button
                key={c}
                size="sm"
                variant={courseType === c ? "default" : "outline"}
                className={courseType === c ? "bg-indigo-600 text-white" : ""}
                onClick={() => setCourseType(c)}
              >
                {c === "elementary" ? "초등" : c === "middle_high" ? "중고등" : c === "high_univ" ? "고등/대입" : "일반"}
              </Button>
            ))}
          </div>
        </div>

        <Card className="border-indigo-100 shadow-sm">
          <CardHeader>
            <div className="flex justify-between items-center text-sm font-semibold text-indigo-600 mb-2">
              <span>AI 문장 교정 및 논증 퀴즈</span>
              <span>문제 {currentIndex + 1} / {questions.length}</span>
            </div>
            <CardTitle className="text-xl font-bold text-slate-900">{currentQ.title}</CardTitle>
            <CardDescription>{parsedData.prompt || "문장을 읽고 올바른 답을 선택하세요."}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="p-5 bg-indigo-50/70 border border-indigo-100 rounded-xl text-slate-900 font-medium leading-relaxed">
              {parsedData.sentence || currentQ.title}
            </div>

            <section className="rounded-xl border border-slate-200 bg-white p-4 sm:p-5">
              <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h3 className="font-bold text-slate-900">먼저 내 문장으로 고쳐 보기</h3>
                  <p className="mt-1 text-sm leading-6 text-slate-600">제시문을 직접 다듬어 작성한 뒤, AI 비교 선택지를 열어 보세요.</p>
                </div>
                {optionsUnlocked && <span className="w-fit rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700">작성 완료</span>}
              </div>
              <Textarea value={draftAnswer} disabled={submitted} onChange={(event) => { setDraftAnswer(event.target.value); if (optionsUnlocked) setOptionsUnlocked(false); }} placeholder="예: 불필요하게 반복된 표현을 줄이고, 핵심 주장이 선명하게 드러나도록 문장을 고쳐 보세요." className="mt-4 min-h-28 resize-y border-slate-300 bg-white text-slate-900 placeholder:text-slate-400" />
              {!submitted && <div className="mt-3 flex justify-end"><Button variant="outline" onClick={handleDraftComplete} className="border-indigo-200 text-indigo-700 hover:bg-indigo-50">작성 완료 · 선택지 비교하기</Button></div>}
            </section>

            {optionsUnlocked && <section className="space-y-3 rounded-xl border border-indigo-100 bg-indigo-50/40 p-4 sm:p-5">
              <div><h3 className="font-bold text-slate-900">AI 비교 선택지</h3><p className="mt-1 text-sm leading-6 text-slate-600">내 문장과 비교한 뒤 가장 자연스럽고 정확한 교정문을 선택하세요.</p></div>
              {(parsedData.options || ["보기 1", "보기 2", "보기 3", "보기 4"]).map((opt: string, idx: number) => (
                <button key={idx} disabled={submitted} onClick={() => setSelectedAnswer(opt)} className={`w-full text-left p-4 rounded-xl border transition-all flex items-center justify-between ${selectedAnswer === opt ? "border-indigo-600 bg-white text-indigo-900 font-bold shadow-sm" : "border-slate-200 bg-white hover:border-indigo-300 text-slate-700"}`}>
                  <span>{opt}</span>{selectedAnswer === opt && <span className="w-3 h-3 rounded-full bg-indigo-600"></span>}
                </button>
              ))}
            </section>}

            {submitted && (
              <div className={`p-4 rounded-xl border ${selectedAnswer === parsedData.answer ? "bg-emerald-50 border-emerald-200 text-emerald-900" : "bg-rose-50 border-rose-200 text-rose-900"}`}>
                <div className="flex items-center gap-2 font-bold mb-1">
                  {selectedAnswer === parsedData.answer ? <CheckCircle className="h-5 w-5 text-emerald-600" /> : <AlertCircle className="h-5 w-5 text-rose-600" />}
                  {selectedAnswer === parsedData.answer ? "정답입니다!" : "틀렸습니다."}
                </div>
                <p className="text-sm leading-6 mt-1">{parsedData.explanation}</p>
              </div>
            )}

            <div className="flex justify-end pt-4">
              {submitted ? (
                <Button onClick={handleNext} className="bg-emerald-600 hover:bg-emerald-700 text-white">
                  {currentIndex === questions.length - 1 ? "결과 보기" : "다음 문제 →"}
                </Button>
              ) : optionsUnlocked ? (
                <Button onClick={handleVerify} className="bg-indigo-600 hover:bg-indigo-700 text-white">
                  정답 확인
                </Button>
              ) : (
                <span className="text-sm text-slate-500">문장을 작성하면 선택지가 표시됩니다.</span>
              )}
            </div>

            {currentQ && <QuestionFeedbackBox questionId={currentQ.id} />}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
