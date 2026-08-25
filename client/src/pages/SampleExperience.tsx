import { useState } from "react";
import { CheckCircle2, ChevronRight, LockKeyhole, Sparkles } from "lucide-react";
import { Link } from "wouter";
import Navigation from "@/components/Navigation";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

const SAMPLE_COURSES = [
  ["elementary", "초등 논술", "생각을 문장으로 표현하는 첫 단계"],
  ["middle_high", "중고등 논술", "근거를 연결해 설득력 있게 쓰기"],
  ["high_univ", "고등 / 대입 논술", "제시문 분석과 구조적 논증"],
  ["general_adult", "일반 / 직장인", "업무와 일상의 논리적 글쓰기"],
] as const;

export default function SampleExperience() {
  const [selectedCourse, setSelectedCourse] = useState<(typeof SAMPLE_COURSES)[number][0]>("elementary");
  const [answer, setAnswer] = useState<string | null>(null);
  const [showTrialInvite, setShowTrialInvite] = useState(false);

  return (
    <div className="min-h-screen bg-slate-50 text-slate-950">
      <Navigation />
      <main className="mx-auto max-w-6xl px-4 py-12 sm:px-6 lg:px-8">
        <section className="max-w-3xl">
          <p className="text-sm font-extrabold tracking-[0.14em] text-indigo-700">SAMPLE EXPERIENCE</p>
          <h1 className="mt-3 text-4xl font-black tracking-[-0.045em] sm:text-5xl">회원가입 전, 학습 방식을 먼저 둘러보세요.</h1>
          <p className="mt-5 text-lg leading-8 text-slate-600">샘플 체험은 개인 학습 기록이나 AI 평가 결과를 저장하지 않습니다. 과정 소개와 짧은 연습으로 학습 방식이 나에게 맞는지 확인할 수 있습니다.</p>
        </section>

        <section className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4" aria-label="샘플 과정 선택">
          {SAMPLE_COURSES.map(([value, title, description]) => (
            <button key={value} type="button" onClick={() => { setSelectedCourse(value); setAnswer(null); }} className={`rounded-2xl border p-5 text-left transition focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-indigo-200 ${selectedCourse === value ? "border-indigo-500 bg-indigo-50 shadow-sm" : "border-slate-200 bg-white hover:border-indigo-200"}`}>
              <h2 className="font-extrabold text-slate-950">{title}</h2>
              <p className="mt-2 text-sm leading-6 text-slate-600">{description}</p>
            </button>
          ))}
        </section>

        <section className="mt-8 grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
          <article className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
            <div className="flex items-center gap-2 text-sm font-bold text-indigo-700"><Sparkles className="h-4 w-4" />무저장 미니 연습</div>
            <h2 className="mt-3 text-2xl font-black">주장과 근거를 구분해 보세요.</h2>
            <p className="mt-4 leading-7 text-slate-600">“학교 급식에 지역 농산물 사용을 늘려야 한다. 학생에게 더 신선한 식재료를 제공하고 지역 농가에도 도움이 되기 때문이다.”</p>
            <p className="mt-6 font-bold text-slate-800">위 문장에서 주장을 가장 잘 나타내는 문장은 무엇인가요?</p>
            <div className="mt-4 space-y-3">
              {["학교 급식에 지역 농산물 사용을 늘려야 한다.", "학생에게 더 신선한 식재료를 제공한다.", "지역 농가에도 도움이 된다."].map((choice, index) => {
                const isCorrect = index === 0;
                const isSelected = answer === choice;
                return <button key={choice} type="button" onClick={() => { setAnswer(choice); setShowTrialInvite(true); }} className={`flex w-full items-center justify-between rounded-xl border px-4 py-3 text-left font-medium transition ${isSelected ? isCorrect ? "border-emerald-400 bg-emerald-50 text-emerald-950" : "border-rose-300 bg-rose-50 text-rose-950" : "border-slate-200 hover:border-indigo-300"}`}>{choice}{isSelected && <CheckCircle2 className={`h-5 w-5 ${isCorrect ? "text-emerald-600" : "text-rose-500"}`} />}</button>;
              })}
            </div>
            {answer && <p className={`mt-4 rounded-xl px-4 py-3 text-sm ${answer.startsWith("학교 급식") ? "bg-emerald-50 text-emerald-900" : "bg-rose-50 text-rose-900"}`}>{answer.startsWith("학교 급식") ? "맞았습니다. ‘늘려야 한다’가 글쓴이의 주장이고, 뒤 문장은 이유입니다." : "다시 살펴보세요. ‘늘려야 한다’처럼 해야 할 일을 말한 문장이 주장입니다."}</p>}
          </article>
          <aside className="rounded-3xl bg-slate-950 p-6 text-white sm:p-8">
            <LockKeyhole className="h-7 w-7 text-cyan-300" />
            <h2 className="mt-4 text-2xl font-black">샘플 체험에서는</h2>
            <ul className="mt-5 space-y-3 text-sm leading-6 text-slate-300"><li>과정별 학습 구조와 짧은 연습을 둘러볼 수 있습니다.</li><li>답안·진도·결과는 개인 DB에 저장되지 않습니다.</li><li>AI 논술 평가와 첨삭 지도는 제공하지 않습니다.</li></ul>
            <Link href="/login?trial=1" className="mt-7 inline-flex h-12 w-full items-center justify-center rounded-xl bg-white px-5 font-bold text-slate-950 transition hover:bg-cyan-50">로그인하고 7일 무료 체험 시작<ChevronRight className="ml-1 h-4 w-4" /></Link>
          </aside>
        </section>
      </main>
      <Dialog open={showTrialInvite} onOpenChange={setShowTrialInvite}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>샘플 연습을 완료했어요.</DialogTitle>
            <DialogDescription>회원가입 후 7일 동안 내 과정의 레슨과 학습 도구를 사용하고, 레슨 1 첫 서술형 답안에 대한 AI 논술 평가를 1회 받아 보세요.</DialogDescription>
          </DialogHeader>
          <div className="rounded-xl bg-indigo-50 p-4 text-sm leading-6 text-indigo-950">샘플에서 푼 답안은 저장되지 않습니다. 회원가입 후부터 나의 진도와 학습 기록이 안전하게 저장됩니다.</div>
          <DialogFooter className="gap-2 sm:gap-0"><Button variant="outline" onClick={() => setShowTrialInvite(false)}>더 둘러보기</Button><Link href="/signup?trial=1"><Button>7일 무료 체험 시작</Button></Link></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
