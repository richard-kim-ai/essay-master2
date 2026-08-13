import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { trpc } from "@/lib/trpc";
import { Link, useRoute } from "wouter";
import { BookOpen, Loader2, CheckCircle, ArrowRight } from "lucide-react";
import { useState, useEffect } from "react";
import { toast } from "sonner";

const WORKBOOK_CONTENT = {
  elementary: {
    1: {
      title: "Level 1: 문장 쓰기 기초",
      lessons: [
        {
          id: 1,
          title: "올바른 문장의 구조",
          content: "문장은 주어와 술어로 이루어집니다. 주어는 '누가', 술어는 '무엇을 하는가'를 나타냅니다.",
          example: "예: 나는 책을 읽는다. (주어: 나, 술어: 읽는다)",
        },
        {
          id: 2,
          title: "띄어쓰기의 중요성",
          content: "올바른 띄어쓰기는 글을 읽기 쉽게 만듭니다.",
          example: "예: '다시 한번' (O) / '다시한번' (X)",
        },
        {
          id: 3,
          title: "마침표와 쉼표 사용법",
          content: "마침표(.)는 문장의 끝, 쉼표(,)는 문장 내의 자연스러운 쉼을 나타냅니다.",
          example: "예: 나는 학교에 가고, 친구를 만나고, 함께 공부한다.",
        },
      ],
    },
    2: {
      title: "Level 2: 문단 작성",
      lessons: [
        {
          id: 1,
          title: "주제문과 뒷받침문",
          content: "주제문은 문단의 중심 생각이고, 뒷받침문은 이를 설명하는 문장들입니다.",
          example: "주제: 독서는 좋다. 뒷받침: 상식을 늘려주고, 상상력을 키워준다.",
        },
        {
          id: 2,
          title: "문단의 통일성",
          content: "한 문단은 하나의 주제만 다루어야 합니다.",
          example: "좋은 예: 모든 문장이 '운동의 중요성'에 대해 이야기함",
        },
      ],
    },
  },
  middle_high: {
    1: {
      title: "Level 1: 논증의 기초",
      lessons: [
        {
          id: 1,
          title: "주장과 근거",
          content: "논술은 주장(thesis)과 이를 뒷받침하는 근거(evidence)로 이루어집니다.",
          example: "주장: 스마트폰 사용을 제한해야 한다. 근거: 집중력 저하, 수면 방해",
        },
        {
          id: 2,
          title: "귀납법과 연역법",
          content: "귀납법은 구체적 사례에서 일반적 결론으로, 연역법은 일반적 원리에서 구체적 결론으로 나아갑니다.",
          example: "귀납: 여러 사례 → 결론 / 연역: 일반 원리 → 구체적 적용",
        },
      ],
    },
    2: {
      title: "Level 2: 논술 구조",
      lessons: [
        {
          id: 1,
          title: "서론, 본론, 결론",
          content: "효과적인 논술은 명확한 구조를 가집니다.",
          example: "서론: 문제 제시 → 본론: 주장과 근거 → 결론: 종합 및 제안",
        },
      ],
    },
  },
};

export default function Workbook() {
  const { user, isAuthenticated } = useAuth();
  const [match, params] = useRoute("/workbook/:courseType/:level");
  const courseType = (params?.courseType as "elementary" | "middle_high") || "elementary";
  const level = params?.level ? parseInt(params.level) : 1;

  const [currentLesson, setCurrentLesson] = useState(0);
  const [completedLessons, setCompletedLessons] = useState<number[]>([]);
  const [loading, setLoading] = useState(false);

  const progressMutation = trpc.progress.upsert.useMutation();

  if (!isAuthenticated) {
    return <div className="text-center py-12">로그인이 필요합니다.</div>;
  }

  const workbookData = WORKBOOK_CONTENT[courseType]?.[level as keyof typeof WORKBOOK_CONTENT[typeof courseType]] as any;
  if (!workbookData) {
    return (
      <div className="min-h-screen bg-gray-50 py-12 text-center">
        <p className="text-gray-600">해당 워크북을 찾을 수 없습니다.</p>
      </div>
    );
  }

  const lesson = workbookData.lessons[currentLesson];

  const handleCompleteLesson = async () => {
    setLoading(true);
    try {
      if (!completedLessons.includes(currentLesson)) {
        setCompletedLessons([...completedLessons, currentLesson]);
      }

      // 진도 저장
      const progress = Math.round(
        ((completedLessons.length + 1) / workbookData.lessons.length) * 100
      );
      await progressMutation.mutateAsync({
        curriculumId: level,
        score: 100,
        completed: progress,
      });

      if (currentLesson < workbookData.lessons.length - 1) {
        setCurrentLesson(currentLesson + 1);
        toast.success("다음 레슨으로 이동합니다.");
      } else {
        toast.success("모든 레슨을 완료했습니다!");
      }
    } catch (error) {
      console.error("Error completing lesson:", error);
      toast.error("진도 저장 중 오류가 발생했습니다.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 py-12">
      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="mb-8">
          <Link href="/curriculum">
            <span className="text-indigo-600 hover:text-indigo-700 cursor-pointer">
              ← 커리큘럼으로 돌아가기
            </span>
          </Link>
        </div>

        <h1 className="text-4xl font-bold text-gray-900 mb-2">{workbookData.title}</h1>
        <p className="text-gray-600 mb-8">
          진도: {completedLessons.length + 1} / {workbookData.lessons.length}
        </p>

        <div className="grid lg:grid-cols-4 gap-8">
          {/* Lesson List */}
          <div className="lg:col-span-1">
            <Card>
              <CardHeader>
                <CardTitle>레슨 목록</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {workbookData.lessons.map((l: any, idx: number) => (
                  <button
                    key={l.id}
                    onClick={() => setCurrentLesson(idx)}
                    className={`w-full text-left p-3 rounded-lg border transition-colors flex items-center gap-2 ${
                      currentLesson === idx
                        ? "bg-indigo-50 border-indigo-300"
                        : "bg-white border-gray-200 hover:bg-gray-50"
                    }`}
                  >
                    {completedLessons.includes(idx) && (
                      <CheckCircle className="w-4 h-4 text-green-600 flex-shrink-0" />
                    )}
                    <span className="text-sm font-medium truncate">
                      {idx + 1}. {l.title}
                    </span>
                  </button>
                ))}
              </CardContent>
            </Card>
          </div>

          {/* Lesson Content */}
          <div className="lg:col-span-3 space-y-6">
            {lesson && (
              <>
                <Card>
                  <CardHeader>
                    <CardTitle>{lesson.title}</CardTitle>
                    <CardDescription>
                      레슨 {currentLesson + 1} / {workbookData.lessons.length}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    {/* Content */}
                    <div>
                      <h3 className="text-lg font-semibold text-gray-900 mb-3">
                        설명
                      </h3>
                      <p className="text-gray-700 leading-relaxed">
                        {lesson.content}
                      </p>
                    </div>

                    {/* Example */}
                    <div>
                      <h3 className="text-lg font-semibold text-gray-900 mb-3">
                        예시
                      </h3>
                      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                        <p className="text-gray-700">{lesson.example}</p>
                      </div>
                    </div>

                    {/* Progress Bar */}
                    <div>
                      <div className="flex justify-between items-center mb-2">
                        <span className="text-sm font-medium text-gray-700">
                          학습 진도
                        </span>
                        <span className="text-sm text-gray-600">
                          {Math.round(
                            ((completedLessons.length + 1) /
                              workbookData.lessons.length) *
                              100
                          )}
                          %
                        </span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div
                          className="bg-indigo-600 h-2 rounded-full transition-all"
                          style={{
                            width: `${
                              ((completedLessons.length + 1) /
                                workbookData.lessons.length) *
                              100
                            }%`,
                          }}
                        />
                      </div>
                    </div>

                    {/* Action Buttons */}
                    <div className="flex gap-3 pt-4">
                      <Button
                        onClick={() =>
                          setCurrentLesson(Math.max(0, currentLesson - 1))
                        }
                        disabled={currentLesson === 0}
                        variant="outline"
                        className="flex-1"
                      >
                        이전
                      </Button>
                      <Button
                        onClick={handleCompleteLesson}
                        disabled={loading || completedLessons.includes(currentLesson)}
                        className="flex-1 bg-indigo-600 hover:bg-indigo-700"
                      >
                        {loading ? (
                          <>
                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                            저장 중...
                          </>
                        ) : completedLessons.includes(currentLesson) ? (
                          <>
                            <CheckCircle className="w-4 h-4 mr-2" />
                            완료됨
                          </>
                        ) : (
                          <>
                            완료하기
                            <ArrowRight className="w-4 h-4 ml-2" />
                          </>
                        )}
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
