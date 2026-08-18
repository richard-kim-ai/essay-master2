import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { trpc } from "@/lib/trpc";
import { Link, useRoute } from "wouter";
import { Loader2, CheckCircle, BookOpen, Lightbulb, MessageSquare } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { useAuth } from "@/_core/hooks/useAuth";

const WORKBOOK_CONTENT: Record<string, Record<number, { title: string; lessons: { id: number; title: string; content: string; example: string }[] }>> = {
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
  high_univ: {
    1: {
      title: "Level 1: 대학별 논술 유형 분석",
      lessons: [
        {
          id: 1,
          title: "인문·사회계열 제시문 비교 분석",
          content: "공통 주제에 대한 입장 차이를 비교하고 도표와 통계 자료를 해석하는 역량을 배양합니다.",
          example: "예시: 두 제시문의 개인주의 관점 비교 및 비판적 평가",
        },
      ],
    },
  },
  general_adult: {
    1: {
      title: "Level 1: 비즈니스 설득 글쓰기",
      lessons: [
        {
          id: 1,
          title: "보고서 및 기획서 핵심 요약",
          content: "복잡한 업무 데이터를 간결하고 명확한 구조로 요약하여 의사결정자를 설득하는 글쓰기입니다.",
          example: "예시: 1페이지 기획서(One-page Proposal) 구조화 실습",
        },
      ],
    },
  },
};

type WorkbookLesson = {
  id: number;
  title: string;
  content: string;
  example: string;
  theoryCategory?: string;
  theorySubcategory?: string;
  textbookAnchor?: { kind?: string; text?: string };
  wrongExample?: string;
  improvedExample?: string;
  checkQuestion?: string;
  checkAnswer?: string;
  answerFeedback?: string;
  nextStep?: string;
  sourceBoundary?: string;
};

export default function Workbook() {
  const { isAuthenticated } = useAuth();
  const [, params] = useRoute("/workbook/:courseType/:level");
  const courseType = (params?.courseType as string) || "elementary";
  const level = params?.level ? parseInt(params.level) : 1;

  const [currentLesson, setCurrentLesson] = useState(0);
  const [completedLessons, setCompletedLessons] = useState<number[]>([]);
  const [loading, setLoading] = useState(false);

  const progressMutation = trpc.progress.upsert.useMutation();
  const { data: theoryContent } = trpc.curriculum.getTheoryContent.useQuery(
    { courseType: courseType as "elementary" | "middle_high" | "high_univ" | "general_adult", lessonLevel: level },
    { enabled: isAuthenticated },
  );

  if (!isAuthenticated) {
    return <div className="text-center py-12">로그인이 필요합니다.</div>;
  }

  const dbLessons: WorkbookLesson[] = (theoryContent || []).map((item: any, index: number) => {
    let parsed: any = {};
    try {
      parsed = JSON.parse(item.contentData);
    } catch {
      parsed = {};
    }
    return {
      id: item.id ?? index + 1,
      title: item.title,
      content: parsed.core_concept || "",
      example: parsed.textbook_similar_example?.text || parsed.improved_example || "",
      theoryCategory: item.theoryCategory,
      theorySubcategory: item.theorySubcategory,
      textbookAnchor: parsed.textbook_anchor,
      wrongExample: parsed.wrong_example,
      improvedExample: parsed.improved_example,
      checkQuestion: parsed.in_lesson_check?.question,
      checkAnswer: parsed.in_lesson_check?.answer,
      answerFeedback: parsed.answer_feedback,
      nextStep: parsed.next_step,
      sourceBoundary: parsed.source_boundary,
    };
  });

  const fallbackWorkbookData: { title: string; lessons: WorkbookLesson[] } = WORKBOOK_CONTENT[courseType]?.[level] || {
    title: `Level ${level}: 맞춤형 논술 실습`,
    lessons: [
      {
        id: 1,
        title: "핵심 개념 정리",
        content: "해당 과정의 핵심 개념을 학습하고 실전 논술 문항에 적용해 봅니다.",
        example: "예시 문항: 주제에 대한 논리적 찬반 근거 서술하기",
      },
    ],
  };
  const workbookData = dbLessons.length > 0
    ? { title: `Level ${level}: 교재 연동 이론학습`, lessons: dbLessons }
    : fallbackWorkbookData;

  const lesson = workbookData.lessons[currentLesson] || workbookData.lessons[0];

  const handleCompleteLesson = async () => {
    setLoading(true);
    try {
      if (!completedLessons.includes(currentLesson)) {
        setCompletedLessons([...completedLessons, currentLesson]);
      }
      await progressMutation.mutateAsync({
        curriculumId: level,
        completed: currentLesson === workbookData.lessons.length - 1 ? 1 : 0,
        score: Math.round(((completedLessons.length + 1) / workbookData.lessons.length) * 100),
      });
      toast.success("학습 진도가 성공적으로 저장되었습니다.");
    } catch (err: any) {
      toast.error(err.message || "진도 저장 중 오류가 발생했습니다.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <Link href="/curriculum">
            <Button variant="ghost" className="gap-2 text-slate-600 pl-0">
              ← 커리큘럼으로 돌아가기
            </Button>
          </Link>
          <span className="px-3 py-1 bg-indigo-100 text-indigo-700 text-sm font-semibold rounded-full">
            {courseType === "elementary" ? "초등 논술" : courseType === "middle_high" ? "중고등 논술" : courseType === "high_univ" ? "고등 / 대입" : "일반 / 직장인"} 워크북
          </span>
        </div>

        <Card className="border-indigo-100 shadow-sm">
          <CardHeader>
            <CardTitle className="text-2xl font-bold text-slate-900">{workbookData.title}</CardTitle>
            <CardDescription>과정별 맞춤 핵심 개념과 예시를 학습하고 진도를 체크하세요.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex gap-2 border-b border-slate-200 pb-4 overflow-x-auto">
              {workbookData.lessons.map((l: any, idx: number) => (
                <Button
                  key={l.id}
                  variant={currentLesson === idx ? "default" : "outline"}
                  size="sm"
                  onClick={() => setCurrentLesson(idx)}
                  className={currentLesson === idx ? "bg-indigo-600 text-white" : ""}
                >
                  Lesson {idx + 1}: {l.title}
                </Button>
              ))}
            </div>

            <div className="rounded-xl border border-indigo-100 bg-indigo-50/50 p-6 space-y-4">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="text-xl font-bold text-slate-900">{lesson.title}</h3>
                {lesson.theoryCategory && <span className="rounded-full bg-white px-2.5 py-1 text-xs font-semibold text-indigo-700">{lesson.theoryCategory} · {lesson.theorySubcategory}</span>}
              </div>
              <p className="text-base text-slate-700 leading-relaxed">{lesson.content}</p>
              {lesson.textbookAnchor && (
                <div className="rounded-lg bg-white p-4 border border-indigo-100 text-sm text-slate-700">
                  <div className="mb-2 flex items-center gap-2 font-bold text-indigo-800"><BookOpen className="h-4 w-4" /> 교재 기준</div>
                  <p className="leading-6"><span className="font-semibold">{lesson.textbookAnchor.kind}</span>: {lesson.textbookAnchor.text}</p>
                </div>
              )}
              <div className="grid gap-3 md:grid-cols-2">
                <div className="rounded-lg bg-white p-4 border border-rose-100 text-sm text-rose-900">
                  <div className="mb-2 font-bold">잘못된 예</div>
                  {lesson.wrongExample || lesson.example}
                </div>
                <div className="rounded-lg bg-white p-4 border border-emerald-100 text-sm text-emerald-900">
                  <div className="mb-2 font-bold">개선 예 / 유사 예시</div>
                  {lesson.improvedExample || lesson.example}
                </div>
              </div>
              {lesson.checkQuestion && (
                <div className="rounded-lg border border-amber-100 bg-amber-50 p-4 text-sm text-amber-950">
                  <div className="mb-2 flex items-center gap-2 font-bold"><MessageSquare className="h-4 w-4" /> 강의 중 확인문제</div>
                  <p className="leading-6">{lesson.checkQuestion}</p>
                  <details className="mt-3">
                    <summary className="cursor-pointer font-semibold">정답과 해설 보기</summary>
                    <div className="mt-2 space-y-1 leading-6">
                      <p><span className="font-semibold">정답:</span> {lesson.checkAnswer}</p>
                      <p>{lesson.answerFeedback}</p>
                    </div>
                  </details>
                </div>
              )}
              {lesson.nextStep && (
                <div className="rounded-lg border border-slate-200 bg-white p-4 text-sm text-slate-700">
                  <div className="mb-2 flex items-center gap-2 font-bold text-slate-900"><Lightbulb className="h-4 w-4 text-amber-500" /> 다음 단계</div>
                  <p className="leading-6">{lesson.nextStep}</p>
                </div>
              )}
              {lesson.sourceBoundary && <p className="text-xs leading-5 text-slate-500">{lesson.sourceBoundary}</p>}
            </div>

            <div className="flex items-center justify-between pt-4">
              <Button
                variant="outline"
                disabled={currentLesson === 0}
                onClick={() => setCurrentLesson(currentLesson - 1)}
              >
                이전 레슨
              </Button>
              <Button
                onClick={handleCompleteLesson}
                disabled={loading}
                className="bg-emerald-600 hover:bg-emerald-700 text-white gap-2"
              >
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle className="h-4 w-4" />}
                레슨 완료 및 진도 저장
              </Button>
              <Button
                variant="outline"
                disabled={currentLesson === workbookData.lessons.length - 1}
                onClick={() => setCurrentLesson(currentLesson + 1)}
              >
                다음 레슨
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
