import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { getCourseTag, getCourseTypeFromUserTag } from "@shared/course";
import { toast } from "sonner";
import { AlertCircle, CheckCircle2, Lightbulb, Loader2, RefreshCw, Sparkles, XCircle } from "lucide-react";

type CriterionId = "clear" | "arguable" | "specific" | "supportable" | "relevant" | "original" | "balanced" | "grammatical";
type Status = "pass" | "warn" | "fail";
type AnalysisItem = { id: CriterionId; status: Status; rationale: string; suggestion: string };
type Analysis = { score: number; summary: string; items: AnalysisItem[]; recommendedThesis: string; source: "ai" | "fallback" };

const CHECKLIST_ITEMS: { id: CriterionId; label: string; description: string }[] = [
  { id: "clear", label: "명확성", description: "주장과 대상이 한 번에 이해되는가?" },
  { id: "arguable", label: "논쟁성", description: "사실 소개가 아니라 판단·주장을 담고 있는가?" },
  { id: "specific", label: "구체성", description: "범위와 조건이 지나치게 넓거나 모호하지 않은가?" },
  { id: "supportable", label: "뒷받침 가능성", description: "사례·자료·논거로 설득할 수 있는가?" },
  { id: "relevant", label: "관련성", description: "입력한 주제와 중심 쟁점이 이어지는가?" },
  { id: "original", label: "관점성", description: "자신의 판단 기준이나 관점이 드러나는가?" },
  { id: "balanced", label: "균형성", description: "반론이나 조건을 고려할 여지가 있는가?" },
  { id: "grammatical", label: "문장성", description: "문법과 어휘가 자연스럽고 정확한가?" },
];

const statusStyle: Record<Status, { card: string; badge: string; label: string; icon: typeof CheckCircle2 }> = {
  pass: { card: "border-emerald-200 bg-emerald-50", badge: "bg-emerald-100 text-emerald-800", label: "충족", icon: CheckCircle2 },
  warn: { card: "border-amber-200 bg-amber-50", badge: "bg-amber-100 text-amber-900", label: "보완", icon: AlertCircle },
  fail: { card: "border-rose-200 bg-rose-50", badge: "bg-rose-100 text-rose-800", label: "재작성", icon: XCircle },
};

export default function ThesisChecklist() {
  const { user, isAuthenticated, loading } = useAuth();
  const courseType = getCourseTypeFromUserTag(user?.tag);
  const courseLabel = getCourseTag(courseType);
  const [topic, setTopic] = useState("");
  const [thesis, setThesis] = useState("");
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const analyzeMutation = trpc.questionBank.analyzeThesis.useMutation();

  const itemById = useMemo(() => new Map(analysis?.items.map((item) => [item.id, item]) || []), [analysis]);

  const handleAnalyze = async () => {
    if (thesis.trim().length < 10) {
      toast.error("10자 이상으로 자신의 판단이 담긴 주제문을 작성해주세요.");
      return;
    }
    try {
      const result = await analyzeMutation.mutateAsync({ thesis: thesis.trim(), courseType, topic: topic.trim() || undefined });
      setAnalysis(result as Analysis);
      toast.success(result.source === "ai" ? "AI 주제문 분석이 완료되었습니다." : "임시 점검 결과를 표시했습니다. 다시 분석하면 AI 피드백을 받을 수 있습니다.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "주제문 분석을 준비하지 못했습니다.");
    }
  };

  const handleReset = () => { setTopic(""); setThesis(""); setAnalysis(null); };
  const scoreTone = !analysis ? "text-slate-700" : analysis.score >= 80 ? "text-emerald-700" : analysis.score >= 60 ? "text-amber-700" : "text-rose-700";

  if (loading) return <div className="py-12 text-center text-slate-600">학습자 정보를 확인하고 있습니다...</div>;
  if (!isAuthenticated) return <div className="py-12 text-center text-slate-600">로그인 후 주제문 점검을 이용할 수 있습니다.</div>;

  return (
    <div className="min-h-screen bg-gradient-to-br from-violet-50 via-white to-fuchsia-50 px-4 py-8 sm:px-6 lg:px-8">
      <main className="mx-auto max-w-5xl">
        <header className="mb-6"><Badge className="bg-violet-100 text-violet-800 hover:bg-violet-100">{courseLabel} 과정</Badge><h1 className="mt-3 text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">주제문 점검</h1><p className="mt-2 text-base leading-7 text-slate-600">입력한 주제문을 여덟 가지 기준으로 살피고, 보완 방향과 개선 예시를 안내합니다.</p></header>
        <div className="grid gap-6 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.4fr)]">
          <Card className="h-fit border-slate-200 bg-white p-5 shadow-sm lg:sticky lg:top-6">
            <h2 className="text-lg font-bold text-slate-900">주제문 입력</h2><p className="mt-1 text-sm text-slate-600">주제는 선택 사항이지만, 함께 입력하면 관련성 평가가 더 정확해집니다.</p>
            <div className="mt-5 space-y-4"><div className="space-y-2"><label className="text-sm font-semibold text-slate-800">연결된 주제 <span className="font-normal text-slate-500">(선택)</span></label><Textarea value={topic} onChange={(event) => setTopic(event.target.value)} placeholder="예: 학교에서 생성형 AI를 활용하는 기준" className="min-h-20 resize-none" /></div><div className="space-y-2"><label className="text-sm font-semibold text-slate-800">나의 주제문</label><Textarea value={thesis} onChange={(event) => { setThesis(event.target.value); setAnalysis(null); }} placeholder="예: 학교는 학습 목적과 개인정보 보호 기준을 갖춘 경우에만 생성형 AI 사용을 허용해야 한다." className="min-h-40" /></div></div>
            <div className="mt-5 space-y-2"><Button onClick={handleAnalyze} disabled={analyzeMutation.isPending} className="w-full bg-violet-700 hover:bg-violet-800">{analyzeMutation.isPending ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />분석 중</> : <><Sparkles className="mr-2 h-4 w-4" />주제문 분석하기</>}</Button><Button variant="outline" onClick={handleReset} className="w-full"><RefreshCw className="mr-2 h-4 w-4" />다시 작성하기</Button></div>
            {analysis && <div className="mt-5 rounded-xl border border-violet-200 bg-violet-50 p-4"><p className="text-xs font-bold uppercase tracking-wide text-violet-700">AI 종합 점수</p><p className={`mt-1 text-4xl font-bold ${scoreTone}`}>{analysis.score}<span className="text-lg">점</span></p><p className="mt-2 text-sm leading-6 text-slate-700">{analysis.summary}</p></div>}
          </Card>
          <section className="space-y-4">
            {!analysis ? <Card className="border-dashed border-slate-300 bg-white p-10 text-center shadow-sm"><AlertCircle className="mx-auto h-12 w-12 text-slate-300" /><h2 className="mt-4 text-lg font-bold text-slate-800">주제문을 분석해 보세요</h2><p className="mt-2 text-sm leading-6 text-slate-500">입력한 문장을 기준으로 각 항목을 녹색·주황·빨강으로 표시하고, 보완 방향을 안내합니다.</p></Card> : <>
              <Card className="border-violet-200 bg-violet-50 p-5 shadow-sm"><div className="flex items-start gap-3"><Lightbulb className="mt-0.5 h-5 w-5 shrink-0 text-violet-700" /><div className="flex-1"><p className="font-bold text-slate-900">개선 예시</p><p className="mt-2 text-sm leading-7 text-slate-800">{analysis.recommendedThesis}</p><Button size="sm" variant="outline" onClick={() => { setThesis(analysis.recommendedThesis); setAnalysis(null); toast.success("개선 예시를 입력창에 적용했습니다. 자신의 표현으로 다듬어 다시 분석해 보세요."); }} className="mt-3 border-violet-300 bg-white text-violet-800 hover:bg-violet-100">예시를 다듬어 보기</Button></div></div></Card>
              <div className="grid gap-3 sm:grid-cols-2">{CHECKLIST_ITEMS.map((criterion) => { const item = itemById.get(criterion.id); const status = item?.status ?? "warn"; const style = statusStyle[status]; const Icon = style.icon; return <Card key={criterion.id} onClick={handleAnalyze} className={`cursor-pointer border p-4 shadow-sm transition hover:shadow-md ${style.card}`}><div className="flex items-start gap-3"><Checkbox checked={status === "pass"} aria-label={`${criterion.label} AI 재분석`} onCheckedChange={() => handleAnalyze()} disabled={analyzeMutation.isPending} className="mt-1" /><div className="min-w-0 flex-1"><div className="flex items-center justify-between gap-2"><h3 className="font-bold text-slate-900">{criterion.label}</h3><Badge className={style.badge}>{style.label}</Badge></div><p className="mt-1 text-xs leading-5 text-slate-600">{criterion.description}</p><p className="mt-3 text-sm font-medium leading-6 text-slate-800">{item?.rationale}</p><p className="mt-2 text-xs leading-5 text-slate-700"><span className="font-bold">다음 수정: </span>{item?.suggestion}</p></div><Icon className="mt-1 h-5 w-5 shrink-0 text-slate-700" /></div></Card>; })}</div>
              <p className="text-center text-xs text-slate-500">기준 항목이나 카드를 누르면 현재 문장을 다시 분석합니다. 녹색은 충족, 주황은 보완, 빨강은 다시 쓰기를 권장합니다.</p>
            </>}
          </section>
        </div>
        <Card className="mt-6 border-violet-200 bg-gradient-to-r from-violet-50 to-fuchsia-50 p-5"><h2 className="font-bold text-slate-900">좋은 주제문을 만드는 간단한 공식</h2><p className="mt-2 text-sm leading-6 text-slate-700"><strong>대상</strong> + <strong>판단·주장</strong> + <strong>판단 기준 또는 조건</strong>을 한 문장으로 연결해 보세요. 분석 결과의 예시는 출발점이므로 그대로 제출하기보다 자신의 근거와 표현으로 다시 다듬는 것이 좋습니다.</p></Card>
      </main>
    </div>
  );
}
