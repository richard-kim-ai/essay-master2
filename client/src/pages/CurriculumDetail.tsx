import { ArrowLeft, BookOpen, Download, FileText, Sparkles } from "lucide-react";
import { Link, useRoute } from "wouter";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

const courseLabels = {
  elementary: "초등 논술",
  middle_high: "중고등 논술",
  high_univ: "고등 / 대입",
  general_adult: "일반 / 직장인",
} as const;

type CourseType = keyof typeof courseLabels;

export default function CurriculumDetail() {
  const { isAuthenticated } = useAuth();
  const [, params] = useRoute("/curriculum/:courseType/:level");
  const courseType = (params?.courseType as CourseType) || "middle_high";
  const level = Number(params?.level || 1);
  const { data: curriculum, isLoading } = trpc.curriculum.getDynamicByType.useQuery(courseType, { enabled: isAuthenticated });
  const item = curriculum?.find((entry) => entry.level === level);

  if (!isAuthenticated) return <div className="p-12 text-center text-slate-600">로그인이 필요합니다.</div>;
  if (isLoading) return <div className="p-12 text-center text-slate-600">강의 정보를 불러오는 중입니다...</div>;
  if (!item) return <div className="p-12 text-center text-slate-600">강의 정보를 찾을 수 없습니다.</div>;

  return (
    <div className="min-h-screen bg-slate-50 px-4 py-8 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-4xl space-y-6">
        <Link href="/curriculum"><Button variant="ghost" className="gap-2 px-0 text-slate-600 hover:text-indigo-700"><ArrowLeft className="h-4 w-4" /> 커리큘럼으로 돌아가기</Button></Link>
        <Card className="overflow-hidden border-indigo-100 shadow-sm">
          {item.thumbnailUrl && <img src={item.thumbnailUrl} alt="" className="h-56 w-full object-cover sm:h-72" />}
          <CardHeader className="space-y-4 p-6 sm:p-8">
            <div className="flex flex-wrap items-center gap-2 text-sm font-semibold text-indigo-700"><span className="rounded-full bg-indigo-100 px-3 py-1">{courseLabels[courseType]}</span><span className="rounded-full bg-slate-100 px-3 py-1">Level {item.level}</span></div>
            <CardTitle className="text-3xl leading-tight text-slate-900 sm:text-4xl">{item.title}</CardTitle>
            <CardDescription className="text-base leading-7 text-slate-600">{item.description}</CardDescription>
            {item.aiSummary && <div className="rounded-xl border border-indigo-100 bg-indigo-50/70 p-4"><div className="mb-1 flex items-center gap-2 text-sm font-bold text-indigo-700"><Sparkles className="h-4 w-4" /> AI 강의 요약</div><p className="text-sm leading-7 text-slate-700">{item.aiSummary}</p></div>}
            {item.aiTags?.length > 0 && <div className="flex flex-wrap gap-2" aria-label="강의 특징 태그">{item.aiTags.map((tag) => <span key={tag} className="rounded-full border border-indigo-200 bg-white px-3 py-1.5 text-xs font-semibold text-indigo-700">#{tag}</span>)}</div>}
          </CardHeader>
          <CardContent className="space-y-7 p-6 pt-0 sm:p-8 sm:pt-0">
            <section><h2 className="mb-3 flex items-center gap-2 text-lg font-bold text-slate-900"><BookOpen className="h-5 w-5 text-indigo-600" /> 학습 주제</h2><div className="grid gap-3 sm:grid-cols-2">{item.topics.map((topic) => <div key={topic} className="rounded-lg border border-slate-200 bg-white p-3 text-sm text-slate-700">{topic}</div>)}</div></section>
            <section className="rounded-xl border border-amber-100 bg-amber-50/70 p-5"><div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"><div><h2 className="flex items-center gap-2 text-lg font-bold text-amber-900"><FileText className="h-5 w-5" /> 샘플 학습 자료</h2><p className="mt-1 text-sm leading-6 text-amber-900/75">강의의 핵심 개념과 미니 실습을 담은 PDF 워크시트를 내려받아 직접 작성해 보세요.</p></div>{item.samplePdfUrl ? <a href={item.samplePdfUrl} download target="_blank" rel="noreferrer"><Button className="shrink-0 gap-2 bg-amber-600 text-white hover:bg-amber-700"><Download className="h-4 w-4" /> PDF 다운로드</Button></a> : <span className="text-sm text-amber-900/60">준비 중입니다.</span>}</div></section>
            <Link href="/essay-submission"><Button className="w-full bg-indigo-600 text-white hover:bg-indigo-700">이 주제로 논술 작성 시작하기</Button></Link>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
