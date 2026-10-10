import React from "react";
import { ArrowRight, CheckCircle2, Clock3, LockKeyhole, MessageCircle, ShieldCheck, Sparkles } from "lucide-react";
import { Link } from "wouter";
import { CONTACT_EMAIL, CONTACT_MAILTO } from "@/lib/contact";

const TRIAL_BENEFITS = [
  "선택한 과정의 커리큘럼과 레슨 탐색",
  "AI 학습 도구와 개인 학습 기록",
  "레슨 1 첫 서술형 제출 AI 평가 1회",
];

const PRICE_GUIDE = [
  {
    name: "무료 체험",
    price: "0원",
    period: "7일",
    description: "처음 시작하는 학습자",
    features: ["내 과정 레슨 이용", "학습 도구 이용", "AI 평가 1회"],
    tone: "border-slate-200 bg-white",
    accent: "bg-slate-100 text-slate-700",
  },
  {
    name: "스타터",
    price: "9,900원",
    period: "/월",
    description: "개인 학습을 꾸준히 이어가는 학습자",
    features: ["전체 커리큘럼 이용", "AI 평가 월 5회", "기본 학습 리포트"],
    tone: "border-indigo-200 bg-indigo-50/55",
    accent: "bg-indigo-100 text-indigo-700",
  },
  {
    name: "성장",
    price: "24,900원",
    period: "/월",
    description: "첨삭과 분석을 집중적으로 활용하는 학습자",
    features: ["스타터의 모든 기능", "AI 평가 월 20회", "상세 취약점 분석"],
    tone: "border-indigo-300 bg-indigo-50/65",
    accent: "bg-indigo-100 text-indigo-700",
    featured: true,
  },
  {
    name: "교사·기관",
    price: "문의",
    period: "맞춤 안내",
    description: "반 운영과 교사 피드백이 필요한 기관",
    features: ["반·학생 관리", "교사 첨삭 운영", "도입 규모별 견적"],
    tone: "border-slate-200 bg-white",
    accent: "bg-slate-100 text-slate-700",
  },
] as const;

const PRIVACY_CONTROLS = [
  { title: "최소 수집", text: "계정과 학습 제공에 필요한 정보와 답안만 목적에 맞게 처리합니다." },
  { title: "접근 권한", text: "학생 답안은 본인과 배정된 교사, 업무 권한이 있는 관리자만 확인할 수 있습니다." },
  { title: "AI 전송 안내", text: "AI 평가에 필요한 최소한의 텍스트만 외부 AI 제공자에게 전송합니다." },
  { title: "삭제·철회", text: `학습 데이터 삭제와 AI 품질 개선 활용 철회는 ${CONTACT_EMAIL}으로 요청하실 수 있습니다.` },
] as const;

export default function Pricing() {
  return (
    <div className="overflow-x-hidden bg-[#f7f9fc] text-slate-950">
      <div className="relative isolate">
        <div className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[30rem] bg-[radial-gradient(circle_at_15%_5%,rgba(99,102,241,0.14),transparent_38%),radial-gradient(circle_at_85%_18%,rgba(56,189,248,0.12),transparent_38%)]" />
        <div className="mx-auto w-full max-w-6xl px-4 pb-16 pt-12 sm:px-6 sm:pb-24 sm:pt-16 lg:px-8">
          <section className="mx-auto max-w-3xl text-center" aria-labelledby="pricing-page-title">
            <div className="inline-flex items-center gap-2 rounded-full border border-indigo-100 bg-white/80 px-3 py-1.5 text-xs font-extrabold tracking-[0.14em] text-indigo-700 shadow-sm backdrop-blur">
              <Sparkles className="h-3.5 w-3.5" aria-hidden="true" /> PRICING & TRIAL
            </div>
            <h1 id="pricing-page-title" className="mt-5 text-[clamp(2rem,5vw,3.6rem)] font-black leading-[1.12] tracking-[-0.055em] text-slate-950">내 학습량에 맞는 이용 가이드</h1>
            <p className="mx-auto mt-5 max-w-2xl text-base leading-7 text-slate-600 sm:text-lg">먼저 7일 동안 학습 흐름을 경험한 뒤, 필요한 첨삭량과 교사 지원 범위에 맞춰 선택하세요.</p>
          </section>

          <section className="mx-auto mt-10 max-w-5xl overflow-hidden rounded-[2rem] border border-indigo-100 bg-white shadow-[0_20px_70px_-35px_rgba(67,56,202,0.42)]" aria-labelledby="trial-title">
            <div className="grid gap-0 lg:grid-cols-[1.2fr_0.8fr]">
              <div className="p-6 sm:p-9 lg:p-11">
                <div className="inline-flex items-center gap-2 rounded-full bg-indigo-50 px-3 py-1.5 text-sm font-extrabold text-indigo-700"><Clock3 className="h-4 w-4" aria-hidden="true" /> 7일 무료 체험</div>
                <h2 id="trial-title" className="mt-5 text-2xl font-black tracking-[-0.035em] sm:text-3xl">로그인 후 내 과정으로 시작</h2>
                <p className="mt-3 max-w-2xl text-sm leading-7 text-slate-600 sm:text-base">샘플 체험은 저장 없이 기능을 둘러보는 용도이고, 로그인하면 7일 동안 개인 학습 기록과 레슨 1 AI 평가 1회를 이용할 수 있습니다.</p>
                <ul className="mt-7 grid gap-3 sm:grid-cols-3">
                  {TRIAL_BENEFITS.map((benefit) => <li key={benefit} className="flex items-start gap-2 text-sm font-semibold leading-6 text-slate-700"><CheckCircle2 className="mt-1 h-4 w-4 shrink-0 text-emerald-600" aria-hidden="true" /> <span>{benefit}</span></li>)}
                </ul>
                <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                  <Link href="/login?trial=1" className="group inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-indigo-700 px-5 text-sm font-extrabold text-white shadow-lg shadow-indigo-200 transition hover:-translate-y-0.5 hover:bg-indigo-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 sm:w-auto">지금 시작하기 <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" aria-hidden="true" /></Link>
                  <Link href="/sample" className="inline-flex h-12 w-full items-center justify-center rounded-xl border border-indigo-200 bg-white px-5 text-sm font-extrabold text-indigo-700 transition hover:bg-indigo-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 sm:w-auto">나에게 맞는 과정 찾기</Link>
                </div>
              </div>
              <div className="flex items-center bg-gradient-to-br from-indigo-50 via-white to-cyan-50 p-6 sm:p-9 lg:p-11">
                <div className="w-full rounded-2xl border border-white/90 bg-white/80 p-5 shadow-sm backdrop-blur sm:p-6">
                  <div className="flex items-center gap-3"><div className="flex h-11 w-11 items-center justify-center rounded-xl bg-indigo-100 text-indigo-700"><ShieldCheck className="h-6 w-6" aria-hidden="true" /></div><div><p className="text-sm font-extrabold text-slate-900">체험 범위가 분명해요</p><p className="mt-1 text-xs leading-5 text-slate-500">샘플과 개인 학습을 구분합니다.</p></div></div>
                  <div className="mt-5 space-y-2.5 text-sm font-semibold text-slate-700"><div className="rounded-xl bg-slate-50 px-4 py-3">샘플 체험 · 저장 없음</div><div className="rounded-xl bg-indigo-50 px-4 py-3 text-indigo-800">로그인 체험 · 개인 기록 저장</div><div className="rounded-xl bg-emerald-50 px-4 py-3 text-emerald-800">AI 평가 · 레슨 1에서 1회</div></div>
                </div>
              </div>
            </div>
          </section>

          <section className="mt-16" aria-labelledby="price-guide-title">
            <div className="mx-auto max-w-3xl text-center"><p className="text-xs font-extrabold tracking-[0.16em] text-indigo-700 sm:text-sm">PRICE GUIDE</p><h2 id="price-guide-title" className="mt-3 text-2xl font-black tracking-[-0.04em] sm:text-4xl">이용권 요금 안내</h2><p className="mt-4 text-sm leading-7 text-slate-600 sm:text-base">정식 이용권은 학습량에 맞춰 선택할 수 있습니다. 결제 기능은 준비 중이며, 최종 요금은 정식 오픈 시 다시 안내해 드립니다.</p></div>
            <div className="mt-8 grid items-stretch gap-4 sm:grid-cols-2 xl:grid-cols-4">
              {PRICE_GUIDE.map((plan) => <article key={plan.name} className={`relative flex min-w-0 flex-col rounded-2xl border p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md sm:p-6 ${plan.tone}`}>
                {"featured" in plan && plan.featured && <span className="absolute right-4 top-4 rounded-full bg-indigo-700 px-2.5 py-1 text-[11px] font-extrabold text-white">추천</span>}
                <div className={`w-fit rounded-lg px-2.5 py-1 text-xs font-extrabold ${plan.accent}`}>{plan.name}</div>
                <p className="mt-4 min-h-[3rem] text-sm leading-6 text-slate-600">{plan.description}</p>
                <div className="mt-5 flex min-w-0 flex-wrap items-baseline gap-x-1.5 gap-y-1 border-b border-slate-200/80 pb-5"><span className="text-2xl font-black tracking-tight text-slate-950 sm:text-3xl">{plan.price}</span><span className="text-xs font-bold text-slate-500">{plan.period}</span></div>
                <ul className="mt-5 flex-1 space-y-3">{plan.features.map((feature) => <li key={feature} className="flex items-start gap-2 text-sm font-semibold leading-5 text-slate-700"><CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" aria-hidden="true" /><span>{feature}</span></li>)}</ul>
              </article>)}
            </div>
          </section>

          <section className="mt-16 grid items-stretch gap-6 lg:grid-cols-[1.12fr_0.88fr]" aria-labelledby="privacy-title">
            <div className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm sm:p-9">
              <div className="flex items-start gap-4"><div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700"><LockKeyhole className="h-5 w-5" aria-hidden="true" /></div><div><p className="text-xs font-extrabold tracking-[0.14em] text-emerald-700 sm:text-sm">PRIVACY & SECURITY</p><h2 id="privacy-title" className="mt-2 text-2xl font-black tracking-[-0.035em]">개인정보 보호 안내</h2><p className="mt-3 text-sm leading-7 text-slate-600 sm:text-base">학생의 답안과 학습 기록은 학습 제공을 위해서만 사용하며, 아래 원칙에 따라 관리합니다.</p></div></div>
              <div className="mt-7 grid gap-3 sm:grid-cols-2">{PRIVACY_CONTROLS.map((control) => <div key={control.title} className="rounded-xl bg-slate-50 p-4"><h3 className="text-sm font-extrabold text-slate-900">{control.title}</h3><p className="mt-2 text-sm leading-6 text-slate-600">{control.text}</p></div>)}</div>            </div>
            <div className="flex flex-col rounded-[2rem] bg-slate-950 p-6 text-slate-100 shadow-sm sm:p-9"><MessageCircle className="h-7 w-7 text-cyan-300" aria-hidden="true" /><h2 className="mt-5 text-2xl font-black tracking-[-0.035em]">정식 이용 및 기관 도입</h2><p className="mt-3 text-sm leading-7 text-slate-300 sm:text-base">교사·기관 도입 조건은 과정 구성, AI 평가량, 교사 첨삭 범위에 따라 달라집니다. 체험해 보신 뒤 문의해 주시면 도입 조건을 안내해 드립니다.</p><div className="mt-auto flex flex-col gap-3 pt-8"><Link href="/sample" className="inline-flex h-11 items-center justify-center rounded-xl bg-cyan-300 px-5 text-sm font-extrabold text-slate-950 transition hover:bg-cyan-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950">샘플 체험하기</Link><a href={CONTACT_MAILTO} className="inline-flex h-11 items-center justify-center rounded-xl border border-cyan-300/60 px-5 text-sm font-extrabold text-cyan-100 transition hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950">도입·운영 문의 {CONTACT_EMAIL}</a></div></div>
          </section>
        </div>
      </div>
    </div>
  );
}
