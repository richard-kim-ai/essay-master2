import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { trpc } from "@/lib/trpc";
import { Link, useRoute } from "wouter";
import { Loader2, CheckCircle, HelpCircle, Send, Award, ListChecks, Lightbulb, Sparkles, ArrowRight } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

type SubjectiveCriterion = {
  key: "topicRelevance" | "claim" | "evidence" | "analysis" | "expression";
  label: string;
  score: number;
  maxScore: number;
  quote: string;
  explanation: string;
};

type SubjectiveEvaluation = {
  status: "evaluated" | "insufficient";
  verdict: "excellent" | "adequate" | "needs_revision" | "off_topic" | "insufficient";
  score: number;
  isOnTopic: boolean;
  hasClearClaim: boolean;
  validReasonCount: number;
  hasComparativeAnalysis: boolean;
  characterCount: number;
  criteria: SubjectiveCriterion[];
  summary: string;
  priorityImprovements: string[];
  missingRequirements: string[];
};

type SubmittedWorkbookResult = {
  isCorrect: number;
  score: number;
  aiFeedback: string;
  evaluation?: SubjectiveEvaluation | null;
};

type LessonWritingGuide = {
  learningGoal: string;
  thinkingSteps: string[];
  sentenceFrame: string;
  practiceExample: string;
  selfCheck: string[];
};

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
        {
          id: 3,
          title: "문단과 문단의 연결",
          content: "이어지는 문단은 접속어나 문맥을 통해 자연스럽게 연결되어야 합니다.",
          example: "예: '따라서', '그러나', '게다가' 등의 접속사 활용",
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
        {
          id: 3,
          title: "타당성과 건전성",
          content: "논증이 형식적으로 올바른지(타당성), 전제가 실제로 참인지(건전성)를 검토합니다.",
          example: "예: 전제가 모두 참이고 결론이 필연적으로 도출되는가?",
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
        {
          id: 2,
          title: "반론 수용과 재반박",
          content: "상대방의 예상 반론을 미리 수용하고 이를 논리적으로 재반박합니다.",
          example: "예: '일각에서는 ~라고 주장하지만, 이는 ~측면을 간과한 것이다.'",
        },
        {
          id: 3,
          title: "비판적 독해",
          content: "제시문의 숨겨진 전제와 논리적 허점을 간파하는 독해법입니다.",
          example: "예: 권위의 오류, 성급한 일반화의 오류 파악하기",
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
        {
          id: 2,
          title: "도표 및 통계 자료 해석",
          content: "제시된 그래프와 표의 수치 변화 추이를 분석하여 논증의 근거로 활용합니다.",
          example: "예시: 출산율 저하와 고령화 속도 지표 분석",
        },
        {
          id: 3,
          title: "수리·과학 논술 접근법",
          content: "자연계열 논술에서 요구하는 수학적 모델링과 과학적 법칙 적용 능력을 다룹니다.",
          example: "예시: 확률과 통계를 활용한 사회 현상 설명",
        },
      ],
    },
    2: {
      title: "Level 2: 심화 논증과 대안 제시",
      lessons: [
        {
          id: 1,
          title: "철학적 딜레마와 윤리적 판단",
          content: "공리주의와 의무론 등 윤리학적 딜레마 상황에서 최선의 대안을 도출합니다.",
          example: "예시: 트롤리 딜레마와 자율주행차의 윤리적 알고리즘",
        },
        {
          id: 2,
          title: "경제·사회 이슈 융합 논술",
          content: "시장 실패와 정부 실패, 글로벌 경제 불평등 문제를 통합적으로 고찰합니다.",
          example: "예시: 기본소득 제도의 도입 찬반 논거 비교",
        },
        {
          id: 3,
          title: "최종 실전 답안 첨삭 훈련",
          content: "대학별 출제 경향에 맞춘 실전 답안 작성 및 자가 검토 요령을 익힙니다.",
          example: "예시: 1000자 분량의 완결된 논술문 작성",
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
        {
          id: 2,
          title: "이메일 및 비즈니스 커뮤니케이션",
          content: "상대방의 행동을 유도하는 명확하고 정중한 비즈니스 텍스트 작성법입니다.",
          example: "예시: 협상 제안서 및 피드백 이메일 작성",
        },
        {
          id: 3,
          title: "보도자료 및 PR 글쓰기",
          content: "기업의 핵심 메시지를 대중과 미디어에 효과적으로 전달하는 PR 문장술입니다.",
          example: "예시: 신제품 출시 보도자료 구조 작성",
        },
      ],
    },
    2: {
      title: "Level 2: 전략적 기획 및 논증",
      lessons: [
        {
          id: 1,
          title: "문제 해결적 사고와 논리 트리",
          content: "MECE 원칙을 적용하여 문제의 원인을 구조화하고 해결책을 도출합니다.",
          example: "예시: 로직 트리(Logic Tree)를 활용한 매출 부진 원인 분석",
        },
        {
          id: 2,
          title: "ESG 경영 전략 보고서",
          content: "환경, 사회, 지배구조 요소를 비즈니스 전략에 접목하는 기획안을 작성합니다.",
          example: "예시: 탄소 중립 달성을 위한 기업 내부 프로세스 개편안",
        },
        {
          id: 3,
          title: "경영자 프레젠테이션 스크립트",
          content: "복잡한 비즈니스 전략을 청중에게 각인시키는 스피치 원고를 작성합니다.",
          example: "예시: 투자 유치 피치 덱 스크립트 구성",
        },
      ],
    },
  },
};

export default function Workbook() {
  const { isAuthenticated } = useAuth();
  const [, params] = useRoute("/workbook/:courseType/:level");
  const courseType = (params?.courseType as string) || "elementary";
  const level = params?.level ? parseInt(params.level) : 1;

  const [currentLesson, setCurrentLesson] = useState(0);
  const [completedLessons, setCompletedLessons] = useState<number[]>([]);
  const [loading, setLoading] = useState(false);
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const [submittedResults, setSubmittedResults] = useState<Record<number, SubmittedWorkbookResult>>({});
  const [submittingQId, setSubmittingQId] = useState<number | null>(null);
  const [lessonGuide, setLessonGuide] = useState<LessonWritingGuide | null>(null);

  const progressMutation = trpc.progress.upsert.useMutation();
  const { data: workbookQuestions = [], isLoading: qLoading } = trpc.curriculum.getWorkbookQuestions.useQuery({
    courseType,
    level,
    lessonIndex: currentLesson,
  }, { enabled: isAuthenticated });

  const submitAnswerMutation = trpc.curriculum.submitWorkbookAnswer.useMutation();
  const lessonGuideMutation = trpc.questionBank.lessonWritingGuide.useMutation();

  if (!isAuthenticated) {
    return <div className="text-center py-12">로그인이 필요합니다.</div>;
  }

  const workbookData = WORKBOOK_CONTENT[courseType]?.[level] || {
    title: `Level ${level}: 맞춤형 논술 실습`,
    lessons: [
      {
        id: 1,
        title: "핵심 개념 정리",
        content: "해당 과정의 핵심 개념을 학습하고 실전 기출문항에 적용해 봅니다.",
        example: "예시 문항: 주제에 대한 논리적 찬반 근거 서술하기",
      },
    ],
  };

  const lesson = workbookData.lessons[currentLesson] || workbookData.lessons[0];

  const handleLessonGuide = async () => {
    try {
      const guide = await lessonGuideMutation.mutateAsync({
        courseType: courseType as "elementary" | "middle_high" | "high_univ" | "general_adult",
        level,
        lessonIndex: currentLesson,
        lessonTitle: lesson.title,
        lessonContent: lesson.content,
        lessonExample: lesson.example,
      });
      setLessonGuide(guide);
    } catch (error: any) {
      toast.error(error?.message || "AI 레슨 가이드를 불러오지 못했습니다.");
    }
  };

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
      toast.success("레슨 학습 완료 및 진도가 성공적으로 저장되었습니다.");
    } catch (err: any) {
      toast.error(err.message || "진도 저장 중 오류가 발생했습니다.");
    } finally {
      setLoading(false);
    }
  };

  const handleSubmitQuestion = async (qId: number) => {
    const ans = answers[qId];
    if (!ans || !ans.trim()) {
      toast.error("답안을 입력하거나 선택해주세요.");
      return;
    }
    setSubmittingQId(qId);
    try {
      const res = await submitAnswerMutation.mutateAsync({
        questionId: qId,
        userAnswer: ans,
      });
      setSubmittedResults(prev => ({ ...prev, [qId]: res as SubmittedWorkbookResult }));
      toast.success(res.evaluation?.status === "insufficient" ? "답안 보완 사항을 확인해주세요." : "근거 기반 AI 평가가 완료되었습니다.");
    } catch (err: any) {
      toast.error(err.message || "제출 중 오류가 발생했습니다.");
    } finally {
      setSubmittingQId(null);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <Link href="/curriculum">
            <Button variant="ghost" className="gap-2 text-slate-600 pl-0 hover:text-indigo-700">
              ← 커리큘럼으로 돌아가기
            </Button>
          </Link>
          <span className="px-3 py-1 bg-indigo-100 text-indigo-700 text-sm font-semibold rounded-full">
            {courseType === "elementary" ? "초등 논술" : courseType === "middle_high" ? "중고등 논술" : courseType === "high_univ" ? "고등 / 대입" : "일반 / 직장인"} 워크북 기출 레슨
          </span>
        </div>

        <Card className="border-indigo-100 shadow-sm">
          <CardHeader>
            <CardTitle className="text-2xl font-bold text-slate-900">{workbookData.title}</CardTitle>
            <CardDescription>과정별 맞춤 핵심 개념 학습 후, 고정 기출문제 3문항을 풀이하고 진도를 완료하세요.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex gap-2 border-b border-slate-200 pb-4 overflow-x-auto">
              {workbookData.lessons.map((l: any, idx: number) => (
                <Button
                  key={l.id}
                  variant={currentLesson === idx ? "default" : "outline"}
                  size="sm"
                  onClick={() => { setCurrentLesson(idx); setLessonGuide(null); }}
                  className={currentLesson === idx ? "bg-indigo-600 text-white" : ""}
                >
                  Lesson {idx + 1}: {l.title} {completedLessons.includes(idx) ? "✓" : ""}
                </Button>
              ))}
            </div>

            <div className="rounded-xl border border-indigo-100 bg-indigo-50/50 p-6 space-y-4">
              <h3 className="text-xl font-bold text-slate-900">{lesson.title}</h3>
              <p className="text-base text-slate-700 leading-relaxed">{lesson.content}</p>
              <div className="rounded-lg bg-white p-4 border border-indigo-100 text-sm font-medium text-indigo-900">
                {lesson.example}
              </div>
            </div>

            <div className="rounded-xl border border-violet-200 bg-violet-50/70 p-5">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex gap-3">
                  <div className="rounded-xl bg-violet-100 p-2.5 text-violet-700"><Sparkles className="h-5 w-5" /></div>
                  <div><p className="font-bold text-slate-900">AI 레슨 코치: 생각 순서와 연습 예시</p><p className="mt-1 text-sm leading-6 text-slate-600">현재 개념을 답안에 적용하는 방법을 안내합니다. 아래 기출문제의 정답은 공개하지 않습니다.</p></div>
                </div>
                <Button size="sm" onClick={handleLessonGuide} disabled={lessonGuideMutation.isPending} className="shrink-0 bg-violet-700 text-white hover:bg-violet-800">
                  {lessonGuideMutation.isPending ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />준비 중</> : <><Sparkles className="mr-2 h-4 w-4" />AI 가이드 받기</>}
                </Button>
              </div>
              {lessonGuide && <div className="mt-5 grid gap-4 border-t border-violet-200 pt-5 md:grid-cols-2">
                <div className="space-y-3"><div><p className="text-xs font-bold uppercase tracking-wide text-violet-700">이번 레슨 목표</p><p className="mt-1 text-sm leading-6 text-slate-800">{lessonGuide.learningGoal}</p></div><div><p className="text-xs font-bold uppercase tracking-wide text-violet-700">생각 순서</p><ol className="mt-2 space-y-2 text-sm leading-6 text-slate-700">{lessonGuide.thinkingSteps.map((item, index) => <li key={item} className="flex gap-2"><span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-violet-200 text-xs font-bold text-violet-800">{index + 1}</span>{item}</li>)}</ol></div></div>
                <div className="space-y-3"><div className="rounded-lg border border-violet-200 bg-white p-3"><p className="text-xs font-bold text-violet-800">문장 틀</p><p className="mt-1 text-sm leading-6 text-slate-800">{lessonGuide.sentenceFrame}</p></div><div className="rounded-lg border border-violet-200 bg-white p-3"><p className="text-xs font-bold text-violet-800">새 연습 예시</p><p className="mt-1 text-sm leading-6 text-slate-800">{lessonGuide.practiceExample}</p></div><div><p className="text-xs font-bold uppercase tracking-wide text-violet-700">제출 전 셀프 체크</p><ul className="mt-2 space-y-1 text-sm leading-6 text-slate-700">{lessonGuide.selfCheck.map((item) => <li key={item}>• {item}</li>)}</ul></div></div>
              </div>}
            </div>

            <div className="grid gap-3 rounded-xl border border-slate-200 bg-white p-5 sm:grid-cols-3">
              <div><p className="text-xs font-bold uppercase tracking-wide text-indigo-700">1. 개념 적용</p><p className="mt-1 text-sm text-slate-700">AI 가이드로 생각 순서를 확인한 뒤 기출문제를 풉니다.</p></div>
              <div><p className="text-xs font-bold uppercase tracking-wide text-indigo-700">2. 주제와 주장 설계</p><Link href="/topic-wizard"><Button variant="link" className="mt-1 h-auto p-0 text-sm text-indigo-700">주제 설정 위저드 <ArrowRight className="ml-1 h-3.5 w-3.5" /></Button></Link></div>
              <div><p className="text-xs font-bold uppercase tracking-wide text-indigo-700">3. 주제문 검토</p><Link href="/thesis-checklist"><Button variant="link" className="mt-1 h-auto p-0 text-sm text-indigo-700">AI 주제문 체크 <ArrowRight className="ml-1 h-3.5 w-3.5" /></Button></Link></div>
            </div>

            {/* 고정 기출문제 3문항 섹션 */}
            <div className="space-y-6 pt-4 border-t border-slate-200">
              <div className="flex items-center justify-between">
                <h4 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                  <Award className="w-5 h-5 text-indigo-600" /> 본 레슨 고정 기출문제 (3문항)
                </h4>
                <span className="text-xs text-slate-500 font-medium">학습도구와 분리된 커리큘럼 전용 기출 DB</span>
              </div>

              {qLoading ? (
                <div className="py-8 text-center text-slate-500 flex items-center justify-center gap-2">
                  <Loader2 className="w-5 h-5 animate-spin" /> 기출문제를 불러오는 중입니다...
                </div>
              ) : workbookQuestions.length === 0 ? (
                <div className="py-8 text-center text-slate-500 text-sm">등록된 기출문제가 없습니다.</div>
              ) : (
                workbookQuestions.map((q: any, qIdx: number) => {
                  const res = submittedResults[q.id];
                  const choices = q.choicesJson ? JSON.parse(q.choicesJson) : [];
                  return (
                    <Card key={q.id} className="border-slate-200 bg-white shadow-sm">
                      <CardHeader className="pb-3">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-semibold px-2.5 py-1 bg-indigo-50 text-indigo-700 rounded-md">
                            기출문제 #{qIdx + 1} ({q.questionType === "objective" ? "객관식" : "서술형"})
                          </span>
                          {res && (
                            <span className={`text-xs font-bold px-2.5 py-1 rounded-md ${res.isCorrect ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-800"}`}>
                              {q.questionType === "subjective" ? `평가 점수: ${res.score}/100점` : res.isCorrect ? "정답 (100점)" : `점수: ${res.score}점`}
                            </span>
                          )}
                        </div>
                        <CardTitle className="text-base font-bold text-slate-800 mt-2">{q.title}</CardTitle>
                        <CardDescription className="text-slate-700 font-medium whitespace-pre-line mt-1">{q.prompt}</CardDescription>
                      </CardHeader>
                      <CardContent className="space-y-4 pt-0">
                        {q.questionType === "objective" ? (
                          <div className="grid gap-2">
                            {choices.map((choice: string, cIdx: number) => (
                              <label
                                key={cIdx}
                                className={`flex items-center gap-3 p-3 rounded-xl border text-sm cursor-pointer transition-all ${
                                  answers[q.id] === choice
                                    ? "border-indigo-600 bg-indigo-50/60 font-semibold text-indigo-950"
                                    : "border-slate-200 hover:bg-slate-50 text-slate-700"
                                }`}
                              >
                                <input
                                  type="radio"
                                  name={`question-${q.id}`}
                                  value={choice}
                                  checked={answers[q.id] === choice}
                                  onChange={(e) => setAnswers({ ...answers, [q.id]: e.target.value })}
                                  className="text-indigo-600 focus:ring-indigo-500"
                                />
                                <span>{choice}</span>
                              </label>
                            ))}
                          </div>
                        ) : (
                          <Textarea
                            placeholder="제시된 주제에 대한 자신의 입장과 서로 다른 2개 이상의 근거를 300자 내외로 작성해 주세요."
                            value={answers[q.id] || ""}
                            onChange={(e) => setAnswers({ ...answers, [q.id]: e.target.value })}
                            className="min-h-[100px] text-sm"
                          />
                        )}

                        <div className="flex items-center justify-between pt-2">
                          <Button
                            size="sm"
                            onClick={() => handleSubmitQuestion(q.id)}
                            disabled={submittingQId === q.id}
                            className="bg-indigo-600 hover:bg-indigo-700 text-white gap-1.5"
                          >
                            {submittingQId === q.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                            정답 제출 및 AI 채점
                          </Button>
                        </div>

                        {res && q.questionType === "subjective" && res.evaluation ? (
                          <div className={`mt-3 space-y-4 rounded-xl border p-4 ${res.evaluation.verdict === "excellent" ? "border-emerald-200 bg-emerald-50" : res.evaluation.verdict === "adequate" ? "border-indigo-200 bg-indigo-50" : "border-amber-200 bg-amber-50"}`}>
                            <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                              <div>
                                <p className="font-bold text-slate-900">AI 근거 기반 서술형 평가</p>
                                <p className="mt-1 text-sm leading-6 text-slate-700">{res.evaluation.summary}</p>
                              </div>
                              <span className="shrink-0 rounded-full bg-white px-2.5 py-1 text-xs font-bold text-slate-700 shadow-sm">{res.evaluation.characterCount}자 · 근거 {res.evaluation.validReasonCount}개</span>
                            </div>

                            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
                              {res.evaluation.criteria.map((criterion) => (
                                <div key={criterion.key} className="rounded-lg border border-white/80 bg-white/80 p-2.5">
                                  <div className="flex items-center justify-between gap-2"><span className="text-xs font-semibold text-slate-600">{criterion.label}</span><span className="text-sm font-extrabold text-slate-900">{criterion.score}<span className="text-[11px] font-medium text-slate-500">/{criterion.maxScore}</span></span></div>
                                  <p className="mt-1.5 text-[11px] leading-4 text-slate-600">{criterion.explanation}</p>
                                  <p className="mt-2 rounded bg-slate-50 px-1.5 py-1 text-[10px] leading-4 text-slate-500">근거 인용: {criterion.quote}</p>
                                </div>
                              ))}
                            </div>

                            <div className="grid gap-3 md:grid-cols-2">
                              <div className="rounded-lg border border-amber-200 bg-white/80 p-3"><p className="flex items-center gap-1.5 text-xs font-bold text-amber-900"><Lightbulb className="h-3.5 w-3.5" /> 다음 답안에서 우선 보완할 점</p><ol className="mt-2 list-decimal space-y-1 pl-4 text-xs leading-5 text-slate-700">{res.evaluation.priorityImprovements.map((item, index) => <li key={index}>{item}</li>)}</ol></div>
                              <div className="rounded-lg border border-slate-200 bg-white/80 p-3"><p className="flex items-center gap-1.5 text-xs font-bold text-slate-800"><ListChecks className="h-3.5 w-3.5" /> 평가 확인</p><ul className="mt-2 space-y-1 text-xs leading-5 text-slate-700"><li>{res.evaluation.isOnTopic ? "주제 적합성 확인" : "주제 적합성 부족"}</li><li>{res.evaluation.hasClearClaim ? "명확한 주장 확인" : "주장·입장 제시 필요"}</li><li>{res.evaluation.hasComparativeAnalysis ? "비교·분석 확인" : "비교·분석 보완 필요"}</li>{res.evaluation.missingRequirements.slice(0, 2).map((item, index) => <li key={index}>보완: {item}</li>)}</ul></div>
                            </div>
                          </div>
                        ) : res ? (
                          <div className={`p-4 rounded-xl border text-sm space-y-1 mt-3 ${res.isCorrect ? "bg-emerald-50 border-emerald-200 text-emerald-900" : "bg-amber-50 border-amber-200 text-amber-900"}`}>
                            <p className="font-bold">{res.aiFeedback}</p>
                            <p className="text-xs opacity-90">해설: {q.explanation}</p>
                          </div>
                        ) : null}
                      </CardContent>
                    </Card>
                  );
                })
              )}
            </div>

            <div className="flex items-center justify-between pt-6 border-t border-slate-200">
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
