import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { getCourseTag, getCourseTypeFromUserTag } from "@shared/course";
import { toast } from "sonner";
import { ArrowDown, ArrowUp, Check, CheckCircle2, GripVertical, RotateCcw, Sparkles } from "lucide-react";
import { Link } from "wouter";
import BadgeCelebrationModal from "@/components/BadgeCelebrationModal";
import { readAdminPreviewCourse } from "@/lib/adminPreviewCourse";

type Paragraph = { id: string; content: string; correctOrder: number };
type ReorderingContent = { prompt: string; paragraphs: Paragraph[]; explanation: string; difficultyProfile?: { learningFocus?: string } };

const difficultyLabel = { easy: "기초", medium: "표준", hard: "심화" } as const;
const difficultyTone = { easy: "bg-emerald-50 text-emerald-700 border-emerald-200", medium: "bg-blue-50 text-blue-700 border-blue-200", hard: "bg-violet-50 text-violet-700 border-violet-200" } as const;

export default function ParagraphReordering() {
  const { user, isAuthenticated, loading: authLoading } = useAuth();
  const courseType = user?.role === "admin" ? readAdminPreviewCourse() : getCourseTypeFromUserTag(user?.tag);
  const courseLabel = getCourseTag(courseType);
  const { data: questions = [], isLoading, isError } = trpc.questionBank.reorderingPractice.useQuery({ courseType, limit: 10 }, { enabled: !authLoading && Boolean(user?.id) });
  const [sessionIndex, setSessionIndex] = useState(0);
  const [paragraphs, setParagraphs] = useState<Paragraph[]>([]);
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [result, setResult] = useState<{ score: number; passed: boolean } | null>(null);
  const [scores, setScores] = useState<number[]>([]);
  const [showCelebration, setShowCelebration] = useState(false);
  const [earnedBadgeName, setEarnedBadgeName] = useState("");
  const [isAdvancing, setIsAdvancing] = useState(false);
  const awardBadgeMutation = trpc.badges.award.useMutation();
  const recordMistakeMutation = trpc.questionBank.recordMistake.useMutation();
  const reorderingSubmitMutation = trpc.questionBank.reorderingSubmit.useMutation();
  const utils = trpc.useUtils();

  const currentQuestion = questions[sessionIndex];
  const content = useMemo<ReorderingContent | null>(() => {
    if (!currentQuestion) return null;
    try { return JSON.parse(currentQuestion.contentData) as ReorderingContent; } catch { return null; }
  }, [currentQuestion]);
  const sessionComplete = questions.length > 0 && scores.length >= questions.length;
  const averageScore = scores.length > 0 ? Math.round(scores.reduce((total, score) => total + score, 0) / scores.length) : 0;

  useEffect(() => {
    setSessionIndex(0);
    setScores([]);
    setResult(null);
    setIsAdvancing(false);
  }, [courseType]);

  useEffect(() => {
    if (!content?.paragraphs) return;
    setParagraphs([...content.paragraphs].sort(() => Math.random() - 0.5));
    setDraggedId(null);
    setResult(null);
  }, [currentQuestion?.id, content]);

  const moveParagraph = (id: string, direction: -1 | 1) => {
    if (result) return;
    setParagraphs((items) => {
      const index = items.findIndex((item) => item.id === id);
      const nextIndex = index + direction;
      if (index < 0 || nextIndex < 0 || nextIndex >= items.length) return items;
      const updated = [...items];
      [updated[index], updated[nextIndex]] = [updated[nextIndex], updated[index]];
      return updated;
    });
  };

  const handleDrop = (targetId: string) => {
    if (result || !draggedId || draggedId === targetId) return;
    setParagraphs((items) => {
      const from = items.findIndex((item) => item.id === draggedId);
      const to = items.findIndex((item) => item.id === targetId);
      if (from < 0 || to < 0) return items;
      const updated = [...items];
      const [moved] = updated.splice(from, 1);
      updated.splice(to, 0, moved);
      return updated;
    });
    setDraggedId(null);
  };

  const submit = async () => {
    if (result || paragraphs.length === 0) return;
    try {
      const verified = await reorderingSubmitMutation.mutateAsync({ questionId: currentQuestion.id, orderedParagraphIds: paragraphs.map((paragraph) => paragraph.id) });
      setResult({ score: verified.score, passed: verified.passed });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "단락 순서를 검증하지 못했습니다.");
    }
  };

  const resetCurrent = () => {
    if (!content?.paragraphs || result) return;
    setParagraphs([...content.paragraphs].sort(() => Math.random() - 0.5));
  };

  const nextQuestion = async () => {
    if (!result || !currentQuestion || isAdvancing) return;
    setIsAdvancing(true);
    if (result.score < 100) {
      try {
        await recordMistakeMutation.mutateAsync({
          questionBankId: currentQuestion.id,
          courseType,
          toolType: "reordering",
          userAnswer: paragraphs.map((paragraph, index) => `${index + 1}. ${paragraph.content}`).join("\n"),
          score: result.score,
          aiFeedback: `${content?.explanation || "논리적 연결과 단락의 기능을 다시 확인해 보세요."} (정답 위치: ${content?.paragraphs.map((paragraph) => paragraph.correctOrder).join(" → ") || ""})`,
        });
      } catch {
        toast.error("이번 실습 결과를 오답 노트에 저장하지 못했습니다.");
      }
    }
    const updatedScores = [...scores, result.score];
    setScores(updatedScores);
    if (sessionIndex + 1 < questions.length) {
      setSessionIndex((index) => index + 1);
      setIsAdvancing(false);
      return;
    }
    const passedCount = updatedScores.filter((score) => score >= 70).length;
    if (passedCount >= 7) {
      const badgeName = `${courseLabel} 단락 재구성 10회 완주`;
      try {
        await awardBadgeMutation.mutateAsync({ courseType, badgeType: "reordering_10_session", badgeName });
        setEarnedBadgeName(badgeName);
        setShowCelebration(true);
        utils.badges.getByUser.invalidate();
      } catch {
        toast.info("뱃지는 서버가 확인한 서로 다른 10문항 중 7문항 이상을 70점 이상으로 완료하면 수여됩니다.");
      }
    } else {
      toast.info("10회 실습을 완료했습니다. 다시 도전해 평균 점수를 높여보세요.");
    }
    setIsAdvancing(false);
  };

  const restartSession = () => {
    setSessionIndex(0);
    setScores([]);
    setResult(null);
    setIsAdvancing(false);
    utils.questionBank.reorderingPractice.invalidate({ courseType, limit: 10 });
  };

  if (authLoading) return <div className="py-12 text-center text-slate-600">학습자 정보를 확인하고 있습니다...</div>;
  if (!isAuthenticated) return <div className="py-12 text-center text-slate-600">로그인이 필요합니다.</div>;
  if (isLoading) return <div className="py-12 text-center text-slate-600">{courseLabel} 과정의 단락 재구성 실습을 준비하고 있습니다...</div>;
  if (isError || questions.length < 10 || !content) return <div className="mx-auto max-w-xl py-16 text-center"><p className="font-semibold text-slate-800">단락 재구성 문항을 준비하지 못했습니다.</p><p className="mt-2 text-sm text-slate-500">관리자에게 문제은행 상태를 확인해 달라고 요청해주세요.</p></div>;

  if (sessionComplete) {
    const passedCount = scores.filter((score) => score >= 70).length;
    return <div className="min-h-screen bg-slate-50 px-4 py-12 sm:px-6"><div className="mx-auto max-w-2xl"><Card className="border-indigo-100 shadow-sm"><CardContent className="p-8 text-center"><div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-indigo-100 text-indigo-700"><Sparkles className="h-7 w-7" /></div><h1 className="mt-4 text-2xl font-bold text-slate-900">10회 단락 재구성 실습 완료</h1><p className="mt-2 text-sm text-slate-600">{courseLabel} 과정의 서로 다른 주제와 난이도 문항을 모두 풀었습니다.</p><div className="mt-6 grid grid-cols-2 gap-3 text-left"><div className="rounded-xl bg-slate-50 p-4"><p className="text-xs text-slate-500">평균 점수</p><p className="mt-1 text-2xl font-bold text-slate-900">{averageScore}점</p></div><div className="rounded-xl bg-slate-50 p-4"><p className="text-xs text-slate-500">통과 횟수</p><p className="mt-1 text-2xl font-bold text-slate-900">{passedCount}/10</p></div></div><div className="mt-6 flex flex-col justify-center gap-2 sm:flex-row"><Button onClick={restartSession} className="bg-indigo-700 hover:bg-indigo-800"><RotateCcw className="mr-2 h-4 w-4" />새로운 10문항 풀기</Button><Link href="/mistake-notebook"><Button variant="outline">오답 노트로 복습하기</Button></Link></div></CardContent></Card></div><BadgeCelebrationModal isOpen={showCelebration} onClose={() => setShowCelebration(false)} badgeName={earnedBadgeName} courseName={`${courseLabel} 논술`} /></div>;
  }

  const difficulty = currentQuestion.difficulty as keyof typeof difficultyLabel;
  return (
    <div className="min-h-screen bg-slate-50 px-4 py-8 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-3xl space-y-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><Link href="/curriculum"><Button variant="ghost" className="-ml-3 text-slate-600">← 커리큘럼으로 돌아가기</Button></Link><div className="flex items-center gap-2"><span className="rounded-full border border-indigo-200 bg-indigo-50 px-3 py-1 text-xs font-bold text-indigo-700">{courseLabel} 과정</span><span className={`rounded-full border px-3 py-1 text-xs font-bold ${difficultyTone[difficulty]}`}>{difficultyLabel[difficulty]}</span></div></div>
        <Card className="border-indigo-100 shadow-sm"><CardHeader><div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between"><div><CardTitle className="text-2xl font-bold text-slate-900">단락 재구성 드래그 실습</CardTitle><CardDescription className="mt-1">실습 {sessionIndex + 1}/10 · 카드를 드래그하거나 화살표 버튼으로 논리적 순서로 배치하세요.</CardDescription></div><span className="text-sm font-semibold text-slate-600">완료 {Math.min(scores.length, questions.length)}/10</span></div><Progress className="mt-4 h-2" value={(Math.min(scores.length, questions.length) / 10) * 100} /></CardHeader><CardContent className="space-y-5"><div className="rounded-xl border border-slate-200 bg-slate-50 p-4"><p className="text-sm font-semibold text-slate-900">{content.prompt}</p>{content.difficultyProfile?.learningFocus && <p className="mt-2 text-xs text-slate-600">학습 초점: {content.difficultyProfile.learningFocus}</p>}</div><div className="space-y-3">{paragraphs.map((paragraph, index) => <div key={paragraph.id} draggable={!result} onDragStart={() => setDraggedId(paragraph.id)} onDragOver={(event) => event.preventDefault()} onDrop={() => handleDrop(paragraph.id)} className={`flex items-center gap-2 rounded-xl border bg-white p-3 shadow-sm transition ${result ? "cursor-default" : "cursor-grab active:cursor-grabbing hover:border-indigo-300"}`}><GripVertical className="h-5 w-5 shrink-0 text-slate-400" /><span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-indigo-100 text-xs font-bold text-indigo-700">{index + 1}</span><p className="flex-1 text-sm leading-6 text-slate-800">{paragraph.content}</p><div className="flex shrink-0 flex-col"><Button size="icon" variant="ghost" disabled={Boolean(result) || index === 0} aria-label="위로 이동" onClick={() => moveParagraph(paragraph.id, -1)}><ArrowUp className="h-3.5 w-3.5" /></Button><Button size="icon" variant="ghost" disabled={Boolean(result) || index === paragraphs.length - 1} aria-label="아래로 이동" onClick={() => moveParagraph(paragraph.id, 1)}><ArrowDown className="h-3.5 w-3.5" /></Button></div></div>)}</div>{result && <div className={`rounded-xl border p-4 ${result.passed ? "border-emerald-200 bg-emerald-50 text-emerald-900" : "border-amber-200 bg-amber-50 text-amber-900"}`}><p className="flex items-center gap-2 font-bold"><CheckCircle2 className="h-5 w-5" />이번 실습 {result.score}점 · {result.passed ? "통과" : "재도전 권장"}</p><p className="mt-1 text-sm">{content.explanation}</p></div>}<div className="flex flex-col-reverse gap-2 border-t border-slate-100 pt-4 sm:flex-row sm:justify-between"><Button variant="outline" disabled={Boolean(result)} onClick={resetCurrent}><RotateCcw className="mr-2 h-4 w-4" />현재 문항 다시 섞기</Button>{result ? <Button onClick={nextQuestion} disabled={isAdvancing} className="bg-indigo-700 hover:bg-indigo-800">{isAdvancing ? "결과 저장 중..." : sessionIndex === 9 ? "10회 결과 보기" : "다음 문항"}</Button> : <Button onClick={submit} className="bg-indigo-700 hover:bg-indigo-800"><Check className="mr-2 h-4 w-4" />정답 제출 및 검증</Button>}</div></CardContent></Card>
      </div>
    </div>
  );
}
