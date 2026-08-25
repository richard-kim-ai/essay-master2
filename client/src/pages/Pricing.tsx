import { CheckCircle2, Clock3, MessageCircle, ShieldCheck } from "lucide-react";
import { Link } from "wouter";
import Navigation from "@/components/Navigation";

const TRIAL_BENEFITS = [
  "선택한 과정의 커리큘럼과 레슨 탐색",
  "AI 학습 도구와 학습 기록 흐름 확인",
  "나에게 맞는 학습 경로와 다음 단계 안내",
];

export default function Pricing() {
  return (
    <div className="min-h-screen bg-slate-50 text-slate-950">
      <Navigation />
      <main className="mx-auto max-w-6xl px-4 py-14 sm:px-6 lg:px-8 lg:py-20">
        <section className="mx-auto max-w-3xl text-center">
          <p className="text-sm font-extrabold tracking-[0.14em] text-indigo-700">PRICING & TRIAL</p>
          <h1 className="mt-3 text-4xl font-black tracking-[-0.045em] sm:text-5xl">먼저 7일간, 내 학습 흐름을 확인하세요.</h1>
          <p className="mt-5 text-lg leading-8 text-slate-600">논술 마스터는 과정 탐색부터 시작합니다. 로그인 후 7일 무료 체험으로 내 과정의 레슨과 학습 도구가 맞는지 확인해 보세요.</p>
        </section>

        <section className="mx-auto mt-12 max-w-3xl rounded-3xl border border-indigo-100 bg-white p-7 shadow-xl shadow-indigo-100/40 sm:p-10">
          <div className="flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full bg-indigo-50 px-3 py-1 text-sm font-bold text-indigo-700"><Clock3 className="h-4 w-4" />7일 무료 체험</div>
              <h2 className="mt-4 text-3xl font-black">학습 흐름을 직접 경험</h2>
              <p className="mt-3 max-w-xl leading-7 text-slate-600">비로그인 상태에서는 과정별 샘플 레슨을 둘러볼 수 있고, 로그인 후에는 7일 동안 내 학습 기록과 도구 흐름을 확인할 수 있습니다.</p>
            </div>
            <ShieldCheck className="h-12 w-12 shrink-0 text-indigo-600" aria-hidden="true" />
          </div>
          <ul className="mt-7 grid gap-3 sm:grid-cols-2">
            {TRIAL_BENEFITS.map((benefit) => <li key={benefit} className="flex items-start gap-2 text-sm font-medium text-slate-700"><CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />{benefit}</li>)}
          </ul>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Link href="/login?trial=1" className="inline-flex h-12 items-center justify-center rounded-xl bg-indigo-700 px-6 font-bold text-white transition hover:bg-indigo-800">지금 시작하기</Link>
            <Link href="/sample" className="inline-flex h-12 items-center justify-center rounded-xl border border-indigo-200 bg-white px-6 font-bold text-indigo-700 transition hover:bg-indigo-50">나에게 맞는 과정 찾기</Link>
          </div>
        </section>

        <section className="mx-auto mt-10 max-w-3xl rounded-2xl border border-slate-200 bg-white p-6 sm:p-8">
          <div className="flex gap-4"><MessageCircle className="h-6 w-6 shrink-0 text-indigo-600" /><div><h2 className="text-xl font-extrabold">정식 이용 및 기관 도입 안내</h2><p className="mt-2 leading-7 text-slate-600">개인 학습 이용권과 교사·기관 운영 정책은 과정 구성, 첨삭 방식, 반 운영 범위에 따라 안내됩니다. 결제 기능이 준비되기 전까지는 체험 후 운영 문의를 통해 맞춤 이용 방법을 확인할 수 있습니다.</p></div></div>
        </section>
      </main>
    </div>
  );
}
