import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { getCourseTag, getCourseTypeFromUserTag } from "@shared/course";
import { toast } from "sonner";
import { CheckCircle2, ChevronLeft, ChevronRight, ClipboardCheck, Copy, Lightbulb, Loader2, RotateCcw } from "lucide-react";
import { Link } from "wouter";
import { getWorkbookReturnPath } from "@/lib/workbookReturn";
import { findConflictingTopicCategories, getTopicCategoryGuidance, TOPIC_CATEGORY_GUIDANCE, type TopicCategory } from "@/lib/topicCategoryGuidance";

type Step = 1 | 2 | 3 | 4;
type TopicData = { category: string; topic: string; mainIdea: string; outline: string };
type Guide = { headline: string; guidance: string; example: string; tips: string[] };

const CATEGORIES = Object.keys(TOPIC_CATEGORY_GUIDANCE) as TopicCategory[];

const STEP_COPY: Record<Step, { title: string; description: string }> = {
  1: { title: "카테고리 선택", description: "관심 있는 사회·문화 영역을 하나 골라 탐구의 출발점을 만드세요." },
  2: { title: "주제 구체화", description: "누가, 무엇을, 어떤 조건에서 논의할지 드러나는 주제를 작성하세요." },
  3: { title: "주제문 작성", description: "자신의 판단과 그 판단의 기준을 한 문장으로 분명히 표현하세요." },
  4: { title: "글의 개요 작성", description: "서론·본론·결론의 역할을 나누고, 근거가 이어지는 순서를 정리하세요." },
};

export default function TopicWizard() {
  const { user, isAuthenticated, loading } = useAuth();
  const courseType = getCourseTypeFromUserTag(user?.tag);
  const courseLabel = getCourseTag(courseType);
  const [step, setStep] = useState<Step>(1);
  const [data, setData] = useState<TopicData>({ category: "", topic: "", mainIdea: "", outline: "" });
  const [guide, setGuide] = useState<Guide | null>(null);
  const [completed, setCompleted] = useState(false);
  const guideMutation = trpc.questionBank.topicWizardGuide.useMutation();
  const workbookReturnPath = getWorkbookReturnPath(window.location.search);

  const update = (field: keyof TopicData, value: string) => setData((previous) => ({ ...previous, [field]: value }));
  const currentStep = STEP_COPY[step];
  const inProgressPercent = Math.round(((step - 1) / 4) * 100);
  const categoryGuidance = getTopicCategoryGuidance(data.category);
  const topicConflicts = findConflictingTopicCategories(data.category, data.topic);

  const validateCurrentStep = () => {
    const field: Record<Step, keyof TopicData> = { 1: "category", 2: "topic", 3: "mainIdea", 4: "outline" };
    if (!data[field[step]].trim()) {
      toast.error(`${currentStep.title} 내용을 입력하거나 선택해주세요.`);
      return false;
    }
    if (step === 2 && topicConflicts.length > 0) {
      toast.error(`선택한 ‘${data.category}’ 카테고리와 다른 ‘${topicConflicts.join("·")}’ 관련 주제로 보입니다. 카테고리를 바꾸거나 주제를 다듬어 주세요.`);
      return false;
    }
    return true;
  };

  const handleNext = () => {
    if (!validateCurrentStep()) return;
    setGuide(null);
    setStep((previous) => Math.min(4, previous + 1) as Step);
  };

  const handleGuide = async () => {
    if (step === 2 && !validateCurrentStep()) return;
    try {
      const result = await guideMutation.mutateAsync({ step, courseType, ...data });
      setGuide(result);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "AI 가이드를 준비하지 못했습니다.");
    }
  };

  const copyResult = async () => {
    const text = `[논술 주제 설정 결과]\n과정: ${courseLabel}\n카테고리: ${data.category}\n주제: ${data.topic}\n주제문: ${data.mainIdea}\n\n개요\n${data.outline}`;
    try {
      await navigator.clipboard.writeText(text);
      toast.success("주제 설정 결과가 클립보드에 복사되었습니다.");
    } catch {
      toast.error("텍스트를 복사하지 못했습니다. 브라우저 권한을 확인해주세요.");
    }
  };

  const reset = () => {
    setData({ category: "", topic: "", mainIdea: "", outline: "" });
    setGuide(null);
    setStep(1);
    setCompleted(false);
  };

  if (loading) return <div className="py-12 text-center text-slate-600">학습자 정보를 확인하고 있습니다...</div>;
  if (!isAuthenticated) return <div className="py-12 text-center text-slate-600">로그인 후 주제 설정 도구를 이용할 수 있습니다.</div>;

  if (completed) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-emerald-50 via-white to-teal-50 px-4 py-8 sm:px-6 lg:px-8">
        <main className="mx-auto max-w-4xl space-y-6">
          {workbookReturnPath && <Link href={workbookReturnPath}><Button variant="outline" className="mb-1"><ChevronLeft className="mr-1.5 h-4 w-4" />학습 중인 레슨으로 돌아가기</Button></Link>}
          <Card className="border-emerald-200 bg-white p-6 shadow-sm sm:p-8">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div className="flex gap-3"><div className="rounded-2xl bg-emerald-100 p-3 text-emerald-700"><ClipboardCheck className="h-7 w-7" /></div><div><Badge className="bg-emerald-100 text-emerald-800 hover:bg-emerald-100">{courseLabel} 과정</Badge><h1 className="mt-2 text-2xl font-bold text-slate-900 sm:text-3xl">주제 설정이 완료되었습니다</h1><p className="mt-2 text-sm leading-6 text-slate-600">작성한 내용을 한 화면에서 검토하고, 다음 글쓰기 단계에 사용할 수 있도록 복사하세요.</p></div></div>
              <Button onClick={copyResult} className="bg-emerald-700 hover:bg-emerald-800"><Copy className="mr-2 h-4 w-4" />결과 복사</Button>
            </div>
            <div className="mt-5 rounded-xl border border-emerald-100 bg-emerald-50 p-4"><div className="flex items-center justify-between text-sm font-semibold text-emerald-900"><span>주제 설정 진도</span><span>100%</span></div><div className="mt-2 h-2 overflow-hidden rounded-full bg-emerald-100"><div className="h-full w-full rounded-full bg-emerald-600" /></div></div>
          </Card>
          <div className="grid gap-4 sm:grid-cols-2">
            {([['카테고리', data.category], ['주제', data.topic], ['주제문', data.mainIdea], ['개요', data.outline]] as const).map(([label, value]) => <Card key={label} className="border-slate-200 bg-white p-5 shadow-sm"><p className="text-xs font-bold uppercase tracking-wider text-emerald-700">{label}</p><p className="mt-2 whitespace-pre-wrap text-sm leading-7 text-slate-800">{value}</p></Card>)}
          </div>
          <div className="flex flex-col gap-2 sm:flex-row sm:justify-end"><Button variant="outline" onClick={() => setCompleted(false)}>수정하기</Button><Button onClick={reset} className="bg-slate-800 hover:bg-slate-900"><RotateCcw className="mr-2 h-4 w-4" />새 주제 작성</Button></div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-50 via-white to-teal-50 px-4 py-8 sm:px-6 lg:px-8">
      <main className="mx-auto max-w-3xl">
        <header className="mb-6">{workbookReturnPath && <Link href={workbookReturnPath}><Button variant="ghost" className="mb-3 h-auto px-0 text-emerald-800 hover:bg-transparent hover:text-emerald-950"><ChevronLeft className="mr-1.5 h-4 w-4" />학습 중인 레슨으로 돌아가기</Button></Link>}<Badge className="bg-emerald-100 text-emerald-800 hover:bg-emerald-100">{courseLabel} 과정</Badge><h1 className="mt-3 text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">주제 설정</h1><p className="mt-2 text-base leading-7 text-slate-600">질문에 차례로 답하며 글쓰기의 출발점인 주제·주제문·개요를 완성해 보세요.</p></header>
        <Card className="mb-5 border-slate-200 bg-white p-5 shadow-sm"><div className="flex justify-between text-sm font-semibold text-slate-700"><span>단계 {step} / 4</span><span>{inProgressPercent}%</span></div><div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-emerald-600 transition-[width] duration-200" style={{ width: `${inProgressPercent}%` }} /></div></Card>
        <Card className="border-slate-200 bg-white p-5 shadow-sm sm:p-8">
          <h2 className="text-2xl font-bold text-slate-900">{`단계 ${step}. ${currentStep.title}`}</h2><p className="mt-2 text-sm leading-6 text-slate-600">{currentStep.description}</p>
          {step === 1 && <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3">{CATEGORIES.map((category) => <Button key={category} variant={data.category === category ? "default" : "outline"} onClick={() => { update("category", category); setGuide(null); }} className={data.category === category ? "border-emerald-700 bg-emerald-700 text-white hover:bg-emerald-800 hover:text-white" : "border-slate-300 bg-white text-slate-700 hover:bg-slate-50 hover:text-slate-900"}>{category}</Button>)}</div>}
          {step === 2 && <div className="mt-6 space-y-3"><div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4"><p className="text-xs font-bold uppercase tracking-wide text-emerald-700">선택한 카테고리</p><p className="mt-1 font-bold text-emerald-950">{data.category}</p><p className="mt-2 text-sm leading-6 text-emerald-900">{categoryGuidance?.hint}</p><p className="mt-2 rounded-lg bg-white px-3 py-2 text-sm leading-6 text-slate-800"><span className="font-semibold text-emerald-800">주제 예시: </span>{categoryGuidance?.example}</p><p className="mt-2 text-xs text-emerald-800">핵심어: {categoryGuidance?.keywords.slice(0, 5).join(" · ")}</p></div><div className="space-y-2"><label className="text-sm font-semibold text-slate-800">구체적인 주제</label><Input value={data.topic} onChange={(event) => update("topic", event.target.value)} placeholder={categoryGuidance ? `예: ${categoryGuidance.example}` : "카테고리를 먼저 선택해 주세요."} className="h-12" /><p className="text-xs text-slate-500">대상·상황·쟁점 중 두 가지 이상이 드러나도록 작성해 보세요.</p>{topicConflicts.length > 0 && <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs leading-5 text-amber-900">입력한 주제가 ‘{topicConflicts.join("·")}’ 카테고리와 더 가깝게 보입니다. ‘{data.category}’에 맞게 다듬거나 카테고리를 변경해 주세요.</p>}</div></div>}
          {step === 3 && <div className="mt-6 space-y-2"><label className="text-sm font-semibold text-slate-800">나의 주제문</label><Textarea value={data.mainIdea} onChange={(event) => update("mainIdea", event.target.value)} placeholder="예: 학교는 학습 목적과 개인정보 보호 기준을 갖춘 경우에만 생성형 AI 사용을 허용해야 한다." className="min-h-32" /><p className="text-xs text-slate-500">대상, 나의 주장, 판단 기준을 한 문장에 담아 보세요.</p></div>}
          {step === 4 && <div className="mt-6 space-y-2"><label className="text-sm font-semibold text-slate-800">글의 개요</label><Textarea value={data.outline} onChange={(event) => update("outline", event.target.value)} placeholder={"서론: 쟁점과 나의 입장\n본론 1: 첫 번째 근거와 사례\n본론 2: 반론 검토와 보완 근거\n결론: 판단 기준과 제안"} className="min-h-52" /><p className="text-xs text-slate-500">각 단락이 맡을 역할을 한 줄씩 적으면 논리의 빈틈을 쉽게 찾을 수 있습니다.</p></div>}
          <div className="mt-6 rounded-xl border border-amber-200 bg-amber-50 p-4"><div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><div className="flex gap-2"><Lightbulb className="mt-0.5 h-5 w-5 shrink-0 text-amber-700" /><div><p className="font-semibold text-amber-950">AI 학습 가이드</p><p className="mt-1 text-sm text-amber-900">현재 작성 내용을 바탕으로 예시와 점검 포인트를 안내합니다.</p></div></div><Button size="sm" variant="outline" onClick={handleGuide} disabled={guideMutation.isPending} className="border-amber-300 bg-white text-amber-900 hover:bg-amber-100">{guideMutation.isPending ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />준비 중</> : "학습 가이드 보기"}</Button></div>{guide && <div className="mt-4 border-t border-amber-200 pt-4"><h3 className="font-bold text-slate-900">{guide.headline}</h3><p className="mt-2 text-sm leading-6 text-slate-700">{guide.guidance}</p><p className="mt-3 rounded-lg bg-white p-3 text-sm leading-6 text-slate-800"><span className="font-bold text-amber-800">예시: </span>{guide.example}</p><ul className="mt-3 space-y-1 text-sm text-slate-700">{guide.tips.map((tip) => <li key={tip}>• {tip}</li>)}</ul></div>}</div>
        </Card>
        <div className="mt-5 flex gap-3"><Button variant="outline" onClick={() => { setGuide(null); setStep((previous) => Math.max(1, previous - 1) as Step); }} disabled={step === 1} className="flex-1"><ChevronLeft className="mr-2 h-4 w-4" />이전</Button>{step < 4 ? <Button onClick={handleNext} className="flex-1 bg-emerald-700 hover:bg-emerald-800">다음<ChevronRight className="ml-2 h-4 w-4" /></Button> : <Button onClick={() => { if (validateCurrentStep()) setCompleted(true); }} className="flex-1 bg-emerald-700 hover:bg-emerald-800"><CheckCircle2 className="mr-2 h-4 w-4" />완료 결과 보기</Button>}</div>
      </main>
    </div>
  );
}
