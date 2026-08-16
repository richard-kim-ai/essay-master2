import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { trpc } from "@/lib/trpc";
import { Link } from "wouter";
import { BookOpen, Loader2, AlertCircle, CheckCircle } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

const QUIZ_QUESTIONS = [
  {
    id: 1,
    level: "elementary",
    sentence: "나는 학교에 가고 친구를 만나고 함께 공부한다.",
    correct: true,
    feedback: "올바른 문장입니다. 주어와 술어가 명확하고 띄어쓰기가 정확합니다.",
  },
  {
    id: 2,
    level: "elementary",
    sentence: "나는책을읽는다.",
    correct: false,
    feedback: "띄어쓰기가 잘못되었습니다. 올바른 문장: '나는 책을 읽는다.'",
  },
  {
    id: 3,
    level: "elementary",
    sentence: "그 영화는 정말 재미있었고 감동적이었다.",
    correct: true,
    feedback: "좋은 문장입니다. 두 개의 형용사를 자연스럽게 연결했습니다.",
  },
  {
    id: 4,
    level: "middle_high",
    sentence: "스마트폰 사용을 제한해야 하는 이유는 집중력 저하와 수면 방해 때문이다.",
    correct: true,
    feedback: "논리적이고 명확한 문장입니다. 주장과 근거가 잘 연결되어 있습니다.",
  },
  {
    id: 5,
    level: "middle_high",
    sentence: "현대 사회에서 기술의 발전은 우리의 삶을 변화시키고 있으며 앞으로도 계속될 것이다.",
    correct: true,
    feedback: "구조가 명확하고 시간 관계를 잘 표현한 문장입니다.",
  },
];

export default function QuizPage() {
  const { user, isAuthenticated } = useAuth();
  const [courseType, setCourseType] = useState<"elementary" | "middle_high">("elementary");
  const [currentQuizIndex, setCurrentQuizIndex] = useState(0);
  const [userAnswer, setUserAnswer] = useState("");
  const [feedback, setFeedback] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [score, setScore] = useState(0);
  const [completed, setCompleted] = useState(0);

  const submitAnswerMutation = trpc.quiz.submitAnswer.useMutation();

  if (!isAuthenticated) {
    return <div className="text-center py-12">로그인이 필요합니다.</div>;
  }

  const filteredQuizzes = QUIZ_QUESTIONS.filter((q) => q.level === courseType);
  const currentQuiz = filteredQuizzes[currentQuizIndex];

  if (!currentQuiz) {
    return (
      <div className="min-h-screen bg-gray-50 py-12 text-center">
        <p className="text-gray-600">퀴즈를 찾을 수 없습니다.</p>
      </div>
    );
  }

  const handleSubmitAnswer = async () => {
    if (!userAnswer.trim()) {
      toast.error("답변을 입력해주세요.");
      return;
    }

    setLoading(true);
    try {
      const isCorrect = userAnswer.toLowerCase() === currentQuiz.correct.toString().toLowerCase() ? 1 : 0;

      await submitAnswerMutation.mutateAsync({
        quizId: currentQuiz.id,
        userAnswer,
        isCorrect,
        feedback: currentQuiz.feedback,
        economyScore: "0.85",
        clarityScore: "0.90",
        accuracyScore: "0.88",
      });

      setFeedback({
        isCorrect,
        feedback: currentQuiz.feedback,
        economyScore: 85,
        clarityScore: 90,
        accuracyScore: 88,
      });

      if (isCorrect) {
        setScore(score + 1);
        toast.success("정답입니다!");
      } else {
        toast.info("오답입니다. 피드백을 확인해주세요.");
      }

      setCompleted(completed + 1);
    } catch (error) {
      console.error("Error submitting answer:", error);
      toast.error("답변 제출 중 오류가 발생했습니다.");
    } finally {
      setLoading(false);
    }
  };

  const handleNextQuiz = () => {
    if (currentQuizIndex < filteredQuizzes.length - 1) {
      setCurrentQuizIndex(currentQuizIndex + 1);
      setUserAnswer("");
      setFeedback(null);
    } else {
      toast.success("모든 퀴즈를 완료했습니다!");
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 py-12">
      {/* Main Content */}
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <h1 className="text-4xl font-bold text-gray-900 mb-8">AI 문장 교정 퀴즈</h1>

        <div className="grid gap-8">
          {/* Quiz Card */}
          <Card>
            <CardHeader>
              <CardTitle>문장 평가</CardTitle>
              <CardDescription>
                다음 문장이 올바른지 판단하고 이유를 설명해주세요.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Progress */}
              <div>
                <div className="flex justify-between items-center mb-2">
                  <span className="text-sm font-medium text-gray-700">진도</span>
                  <span className="text-sm text-gray-600">
                    {completed} / {filteredQuizzes.length}
                  </span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div
                    className="bg-indigo-600 h-2 rounded-full transition-all"
                    style={{
                      width: `${(completed / filteredQuizzes.length) * 100}%`,
                    }}
                  />
                </div>
              </div>

              {/* Quiz Question */}
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
                <p className="text-lg text-gray-900 font-medium mb-2">
                  문장:
                </p>
                <p className="text-gray-700 text-lg leading-relaxed">
                  "{currentQuiz.sentence}"
                </p>
              </div>

              {/* Answer Input */}
              {!feedback ? (
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      이 문장이 올바른가요? (예/아니오)
                    </label>
                    <Textarea
                      placeholder="예 또는 아니오로 답하고, 이유를 설명해주세요."
                      value={userAnswer}
                      onChange={(e) => setUserAnswer(e.target.value)}
                      rows={4}
                      className="resize-none"
                    />
                  </div>
                  <Button
                    onClick={handleSubmitAnswer}
                    disabled={loading || !userAnswer.trim()}
                    className="w-full bg-indigo-600 hover:bg-indigo-700"
                  >
                    {loading ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        검토 중...
                      </>
                    ) : (
                      "답변 제출"
                    )}
                  </Button>
                </div>
              ) : (
                <>
                  {/* Feedback */}
                  <div
                    className={`p-6 rounded-lg border-2 ${
                      feedback.isCorrect
                        ? "bg-green-50 border-green-200"
                        : "bg-orange-50 border-orange-200"
                    }`}
                  >
                    <div className="flex items-start gap-3 mb-4">
                      {feedback.isCorrect ? (
                        <CheckCircle className="w-6 h-6 text-green-600 flex-shrink-0 mt-1" />
                      ) : (
                        <AlertCircle className="w-6 h-6 text-orange-600 flex-shrink-0 mt-1" />
                      )}
                      <div>
                        <p
                          className={`font-semibold mb-2 ${
                            feedback.isCorrect
                              ? "text-green-900"
                              : "text-orange-900"
                          }`}
                        >
                          {feedback.isCorrect ? "정답!" : "오답"}
                        </p>
                        <p className="text-gray-700">
                          {feedback.feedback}
                        </p>
                      </div>
                    </div>

                    {/* Detailed Scores */}
                    <div className="grid grid-cols-3 gap-3 mt-4 pt-4 border-t">
                      <div>
                        <p className="text-xs text-gray-600 mb-1">경제성</p>
                        <p className="text-2xl font-bold text-gray-900">
                          {feedback.economyScore}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-600 mb-1">명료성</p>
                        <p className="text-2xl font-bold text-gray-900">
                          {feedback.clarityScore}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-600 mb-1">정확성</p>
                        <p className="text-2xl font-bold text-gray-900">
                          {feedback.accuracyScore}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Next Button */}
                  <Button
                    onClick={handleNextQuiz}
                    className="w-full bg-indigo-600 hover:bg-indigo-700"
                  >
                    {currentQuizIndex < filteredQuizzes.length - 1
                      ? "다음 문제"
                      : "완료"}
                  </Button>
                </>
              )}

              {/* Score Summary */}
              <div className="bg-gray-100 rounded-lg p-4">
                <p className="text-sm text-gray-600">
                  현재 점수: <span className="font-bold text-gray-900">{score} / {completed}</span>
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
