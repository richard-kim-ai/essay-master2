import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { toast } from "sonner";
import { BookOpen, Send, RotateCcw, CheckCircle2, Award } from "lucide-react";
import { Link } from "wouter";
import BadgeCelebrationModal from "@/components/BadgeCelebrationModal";

export default function SummaryPractice() {
  const { isAuthenticated } = useAuth();
  const [courseType, setCourseType] = useState<"elementary" | "middle_high" | "high_univ" | "general_adult">("middle_high");
  const { data: qList, isLoading } = trpc.questionBank.random.useQuery({ courseType, toolType: "summary", limit: 1 });

  const [articleTitle, setArticleTitle] = useState("AI와 미래 사회의 명암");
  const [articleContent, setArticleContent] = useState("");
  const [summary, setSummary] = useState("");
  const [feedback, setFeedback] = useState<any>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [showCelebration, setShowCelebration] = useState(false);
  const [earnedBadgeName, setEarnedBadgeName] = useState("");

  const awardBadgeMutation = trpc.badges.award.useMutation();
  const gradeEssayMutation = trpc.questionBank.gradeEssay.useMutation();
  const utils = trpc.useUtils();

  const currentQId = qList && qList.length > 0 ? qList[0].id : 1;

  useEffect(() => {
    if (qList && qList.length > 0) {
      try {
        const parsed = JSON.parse(qList[0].contentData);
        setArticleTitle(qList[0].title);
        setArticleContent(parsed.prompt || parsed.content || "요약할 제시문 본문 내용입니다.");
        setSummary("");
        setFeedback(null);
      } catch {
        setArticleTitle("기본 제시문");
        setArticleContent("현대 사회에서 비판적 사고력과 논리적 글쓰기는 매우 중요합니다.");
      }
    }
  }, [qList]);

  if (!isAuthenticated) return <div className="text-center py-12 text-slate-600">로그인이 필요합니다.</div>;
  if (isLoading) return <div className="text-center py-12 text-slate-600">문제은행에서 요약 지문을 불러오는 중...</div>;

  const analyzeSummary = async () => {
    if (!summary.trim() || summary.length < 15) {
      toast.error("핵심 내용이 포함된 15자 이상의 요약문을 작성해주세요.");
      return;
    }

    setIsAnalyzing(true);
    try {
      const res = await gradeEssayMutation.mutateAsync({
        questionId: currentQId,
        userAnswer: summary,
      });

      setFeedback({
        score: res.overallScore,
        logicFlow: res.feedback,
        keywords: res.strengths || ["논리성 우수", "표현력 탁월"],
        suggestions: res.improvements || ["추가 보완 필요"],
      });
      setIsAnalyzing(false);
      toast.success("AI 실시간 채점 및 분석이 완료되었습니다!");

      const bName = `${courseType === "elementary" ? "초등" : courseType === "middle_high" ? "중고등" : courseType === "high_univ" ? "고등/대입" : "일반"} 요약 전문가 뱃지`;
      setEarnedBadgeName(bName);
      setShowCelebration(true);

      awardBadgeMutation.mutate({
        courseType,
        badgeType: "summary",
        badgeName: bName,
      }, {
        onSuccess: () => {
          utils.badges.getByUser.invalidate();
          toast.success("요약 연습 완료 뱃지가 발급되었습니다!");
        }
      });
    } catch (err: any) {
      setIsAnalyzing(false);
      toast.error(err.message || "AI 채점 중 오류가 발생했습니다.");
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <Link href="/curriculum"><Button variant="ghost" className="text-slate-600 pl-0">← 커리큘럼으로 돌아가기</Button></Link>
          <div className="flex gap-2">
            {(["elementary", "middle_high", "high_univ", "general_adult"] as const).map(c => (
              <Button key={c} size="sm" variant={courseType === c ? "default" : "outline"} className={courseType === c ? "bg-indigo-600 text-white" : ""} onClick={() => setCourseType(c)}>
                {c === "elementary" ? "초등" : c === "middle_high" ? "중고등" : c === "high_univ" ? "고등/대입" : "일반"}
              </Button>
            ))}
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
          courseName={courseType === "elementary" ? "초등 논술" : courseType === "middle_high" ? "중고등 논술" : courseType === "high_univ" ? "고등/대입" : "일반/직장인"}
        />
      </div>
    </div>
  );
}
