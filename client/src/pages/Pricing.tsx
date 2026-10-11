import React from "react";
import { ArrowRight, CheckCircle2, Clock3, LockKeyhole, MessageCircle, Sparkles } from "lucide-react";
import { Link } from "wouter";
import { CONTACT_EMAIL, CONTACT_MAILTO } from "@/lib/contact";
import { PLANS, TEACHER_FEEDBACK_ELIGIBILITY_NOTICE, TEACHER_FEEDBACK_PASSES, TEACHER_FEEDBACK_PURCHASE_OPEN, formatKrw } from "@shared/plans";

const FOCUS_RING = "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2";
const PRIMARY_BUTTON = `inline-flex items-center justify-center rounded-xl bg-indigo-700 font-extrabold text-white transition hover:bg-indigo-800 ${FOCUS_RING}`;
const OUTLINE_BUTTON = `inline-flex items-center justify-center rounded-xl border border-indigo-200 bg-white font-extrabold text-indigo-700 transition hover:bg-indigo-50 ${FOCUS_RING}`;

const SECTION_LINKS = [
  { href: "#trial-title", label: "무료 체험" },
  { href: "#price-guide-title", label: "이용권" },
  { href: "#teacher-pass-title", label: "교사 첨삭지도권" },
  { href: "#privacy-title", label: "개인정보 보호" },
] as const;

const TRIAL_BENEFITS = [
  "선택한 과정의 커리큘럼과 레슨 탐색",
  "AI 학습 도구와 개인 학습 기록",
  "AI 평가·첨삭 총 3회(샘플 체험 1회 + 체험 2회)",
];

const USE_STEPS = [
  { title: "무료 체험", text: "7일 동안 학습 흐름을 먼저 경험합니다." },
  { title: "이용권 결제", text: "학습량과 AI 첨삭 횟수에 맞는 이용권을 고릅니다." },
  { title: "유료 이용 시작", text: "30일 이용권은 시작 버튼을 누른 날부터 기간이 계산됩니다." },
] as const;

// 가격·횟수는 shared/plans.ts의 이용권 정의를 그대로 쓴다(결제 화면과 서버 한도와 같은 값).
const PRICE_CARDS = PLANS.map((plan) => ({
  key: plan.key,
  name: plan.name,
  price: formatKrw(plan.priceKrw),
  period: `/${plan.periodDays}일`,
  description: plan.description,
  features: plan.features,
  featured: Boolean(plan.featured),
  href: `/checkout?plan=${plan.key}`,
}));

const TEACHER_PASS_CARDS = TEACHER_FEEDBACK_PASSES.map((product) => ({
  key: product.key,
  sessions: product.sessions,
  price: formatKrw(product.priceKrw),
  perSession: formatKrw(Math.round(product.priceKrw / product.sessions)),
  periodDays: product.periodDays,
  description: product.description,
  features: [product.description, `1회 약 ${formatKrw(Math.round(product.priceKrw / product.sessions))}`, `구매일부터 ${product.periodDays}일 이용`, "결과 전달 전 취소 시 1회 복원"],
  featured: Boolean(product.featured),
}));

const PRIVACY_CONTROLS = [
  { title: "최소 수집", text: "계정과 학습 제공에 필요한 정보와 답안만 목적에 맞게 처리합니다." },
  { title: "접근 권한", text: "학생 답안은 본인과 배정된 교사, 업무 권한이 있는 관리자만 확인할 수 있습니다." },
  { title: "AI 전송 안내", text: "AI 평가에 필요한 최소한의 텍스트만 외부 AI 제공자에게 전송합니다." },
  { title: "삭제·철회", text: `학습 데이터 삭제와 AI 품질 개선 활용 철회는 ${CONTACT_EMAIL}으로 요청하실 수 있습니다.` },
] as const;

function SectionHeading({ eyebrow, id, title, children }: { eyebrow: string; id: string; title: string; children?: React.ReactNode }) {
  return (
    <div className="mx-auto max-w-3xl text-center">
      <p className="text-xs font-extrabold tracking-[0.16em] text-indigo-700 sm:text-sm">{eyebrow}</p>
      <h2 id={id} className="mt-3 scroll-mt-24 text-2xl font-black tracking-[-0.04em] sm:text-4xl">{title}</h2>
      {children && <p className="mt-4 text-sm leading-7 text-slate-600 sm:text-base">{children}</p>}
    </div>
  );
}

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
            <p className="mx-auto mt-5 max-w-2xl text-base leading-7 text-slate-600 sm:text-lg">먼저 7일 동안 학습 흐름을 경험한 뒤, 필요한 학습량과 AI 첨삭 횟수에 맞춰 선택하세요.</p>
            <nav aria-label="요금 안내 바로가기" className="mt-7 flex flex-wrap justify-center gap-2">
              {SECTION_LINKS.map((link) => (
                <a key={link.href} href={link.href} className={`rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-700 shadow-sm transition hover:border-indigo-200 hover:text-indigo-700 ${FOCUS_RING}`}>{link.label}</a>
              ))}
            </nav>
          </section>

          <section className="mx-auto mt-10 max-w-5xl overflow-hidden rounded-[2rem] border border-indigo-100 bg-white shadow-[0_20px_70px_-35px_rgba(67,56,202,0.42)]" aria-labelledby="trial-title">
            <div>
              <div className="p-6 sm:p-9 lg:p-11">
                <div className="inline-flex items-center gap-2 rounded-full bg-indigo-50 px-3 py-1.5 text-sm font-extrabold text-indigo-700"><Clock3 className="h-4 w-4" aria-hidden="true" /> 7일 무료 체험</div>
                <h2 id="trial-title" className="mt-5 scroll-mt-24 text-2xl font-black tracking-[-0.035em] sm:text-3xl">로그인 후 내 과정으로 시작</h2>
                <p className="mt-3 max-w-2xl text-sm leading-7 text-slate-600 sm:text-base">샘플 체험은 저장 없이 기능을 둘러보는 용도이고, 로그인하면 7일 동안 개인 학습 기록과 AI 평가·첨삭 2회를 이용할 수 있습니다(샘플 체험 1회와 합쳐 무료 총 3회). 카드 등록과 자동 결제는 없습니다.</p>
                <ul className="mt-7 grid gap-3 sm:grid-cols-3">
                  {TRIAL_BENEFITS.map((benefit) => <li key={benefit} className="flex items-start gap-2 text-sm font-semibold leading-6 text-slate-700"><CheckCircle2 className="mt-1 h-4 w-4 shrink-0 text-emerald-600" aria-hidden="true" /> <span>{benefit}</span></li>)}
                </ul>
                <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                  <Link href="/login?trial=1" className={`group h-12 w-full gap-2 px-5 text-sm shadow-lg shadow-indigo-200 hover:-translate-y-0.5 sm:w-auto ${PRIMARY_BUTTON}`}>지금 시작하기 <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" aria-hidden="true" /></Link>
                  <Link href="/sample" className={`h-12 w-full px-5 text-sm sm:w-auto ${OUTLINE_BUTTON}`}>나에게 맞는 과정 찾기</Link>
                </div>
              </div>
            </div>
          </section>

          <section className="mt-16" aria-labelledby="price-guide-title">
            <SectionHeading eyebrow="PRICE GUIDE" id="price-guide-title" title="이용권 요금 안내">
              정식 이용권은 학습량에 맞춰 선택할 수 있습니다.
            </SectionHeading>
            <ol className="mx-auto mt-8 grid max-w-4xl gap-3 sm:grid-cols-3" aria-label="이용 순서">
              {USE_STEPS.map((step, index) => (
                <li key={step.title} className="flex items-start gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-indigo-700 text-xs font-black text-white" aria-hidden="true">{index + 1}</span>
                  <div><p className="text-sm font-extrabold text-slate-900">{step.title}</p><p className="mt-1 text-xs leading-5 text-slate-600">{step.text}</p></div>
                </li>
              ))}
            </ol>
            <div className="mt-8 grid items-stretch gap-4 sm:grid-cols-2 xl:grid-cols-4">
              {PRICE_CARDS.map((plan) => (
                <article key={plan.key} className={`relative flex min-w-0 flex-col rounded-2xl border p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md sm:p-6 ${plan.featured ? "border-indigo-300 bg-indigo-50/65" : "border-indigo-200 bg-indigo-50/55"}`}>
                  {plan.featured && <span className="absolute right-4 top-4 rounded-full bg-indigo-700 px-2.5 py-1 text-[11px] font-extrabold text-white">추천</span>}
                  <div className="w-fit rounded-lg bg-indigo-100 px-2.5 py-1 text-xs font-extrabold text-indigo-700">{plan.name}</div>
                  <p className="mt-4 min-h-[3rem] text-sm leading-6 text-slate-600">{plan.description}</p>
                  <div className="mt-5 flex min-w-0 flex-wrap items-baseline gap-x-1.5 gap-y-1 border-b border-slate-200/80 pb-5"><span className="text-2xl font-black tracking-tight text-slate-950 sm:text-3xl">{plan.price}</span><span className="text-xs font-bold text-slate-500">{plan.period}</span></div>
                  <ul className="mt-5 flex-1 space-y-3">{plan.features.map((feature) => <li key={feature} className="flex items-start gap-2 text-sm font-semibold leading-5 text-slate-700"><CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" aria-hidden="true" /><span>{feature}</span></li>)}</ul>
                  <Link href={plan.href} className={`mt-5 h-10 px-4 text-sm ${PRIMARY_BUTTON}`}>이용권 시작하기</Link>
                </article>
              ))}
            </div>
            <p className="mx-auto mt-5 max-w-3xl text-center text-xs leading-6 text-slate-500">표시 가격은 최종 결제금액이며, 청약철회·환불 기준은 화면 하단 푸터의 '가격·환불정책'에서 확인하세요. 교사·기관 도입은 아래 문의 영역에서 안내합니다.</p>
          </section>

          <section className="mt-16" aria-labelledby="teacher-pass-title" data-testid="teacher-feedback-pricing">
            <SectionHeading eyebrow="TEACHER FEEDBACK" id="teacher-pass-title" title="교사 첨삭지도권">
              이용권(학습형·AI 기본형·AI 집중형·AI 추가권)을 이용 중인 학습자가 서비스 안에서 첨삭지도권을 구매하고, 교사 첨삭을 신청할 때마다 1회씩 사용합니다. 담당 교사가 논리·구성·근거에 대해 첨삭합니다.
            </SectionHeading>
            <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
              <span className="rounded-full bg-amber-100 px-2.5 py-1 text-xs font-extrabold text-amber-900">{TEACHER_FEEDBACK_ELIGIBILITY_NOTICE}</span>
              {!TEACHER_FEEDBACK_PURCHASE_OPEN && <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-extrabold text-slate-600">신청 기능 준비 중</span>}
            </div>
            <div className="mx-auto mt-8 grid max-w-5xl items-stretch gap-4 sm:grid-cols-3">
              {TEACHER_PASS_CARDS.map((product) => (
                <article key={product.key} className={`relative flex min-w-0 flex-col rounded-2xl border p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md sm:p-6 ${product.featured ? "border-indigo-300 bg-indigo-50/65" : "border-indigo-200 bg-indigo-50/55"}`}>
                  {product.featured && <span className="absolute right-4 top-4 rounded-full bg-indigo-700 px-2.5 py-1 text-[11px] font-extrabold text-white">추천</span>}
                  <div className="w-fit rounded-lg bg-indigo-100 px-2.5 py-1 text-xs font-extrabold text-indigo-700">첨삭지도권 {product.sessions}회분</div>
                  <p className="mt-4 min-h-[3rem] text-sm leading-6 text-slate-600">일반 첨삭 {product.sessions}회를 구매일부터 {product.periodDays}일 안에 사용합니다.</p>
                  <div className="mt-5 flex min-w-0 flex-wrap items-baseline gap-x-1.5 gap-y-1 border-b border-slate-200/80 pb-5"><span className="text-2xl font-black tracking-tight text-slate-950 sm:text-3xl">{product.price}</span><span className="text-xs font-bold text-slate-500">/{product.sessions}회</span></div>
                  <ul className="mt-5 flex-1 space-y-3">{product.features.map((feature) => <li key={feature} className="flex items-start gap-2 text-sm font-semibold leading-5 text-slate-700"><CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" aria-hidden="true" /><span>{feature}</span></li>)}</ul>
                  <Link href="/checkout" className={`mt-5 h-10 px-4 text-sm ${PRIMARY_BUTTON}`}>첨삭지도권 구매하기</Link>
                </article>
              ))}
            </div>
            <p className="mx-auto mt-5 max-w-3xl text-center text-xs leading-6 text-slate-500">신청 전에 피드백 범위와 완료 예정일(신청일부터 3영업일, 담당 교사가 결과를 전달하기로 한 날짜)을 안내합니다. AI 이용권에는 교사의 개별 첨삭지도·상담이 포함되지 않으며, AI 이용 횟수에 따라 교사 지도비가 자동으로 청구되지 않습니다.</p>
          </section>

          <section className="mt-16 grid items-stretch gap-6 lg:grid-cols-[1.12fr_0.88fr]" aria-labelledby="privacy-title">
            <div className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm sm:p-9">
              <div className="flex items-start gap-4"><div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700"><LockKeyhole className="h-5 w-5" aria-hidden="true" /></div><div><p className="text-xs font-extrabold tracking-[0.14em] text-emerald-700 sm:text-sm">PRIVACY & SECURITY</p><h2 id="privacy-title" className="mt-2 scroll-mt-24 text-2xl font-black tracking-[-0.035em]">개인정보 보호 안내</h2><p className="mt-3 text-sm leading-7 text-slate-600 sm:text-base">학생의 답안과 학습 기록은 학습 제공을 위해서만 사용하며, 아래 원칙에 따라 관리합니다.</p></div></div>
              <div className="mt-7 grid gap-3 sm:grid-cols-2">{PRIVACY_CONTROLS.map((control) => <div key={control.title} className="rounded-xl bg-slate-50 p-4"><h3 className="text-sm font-extrabold text-slate-900">{control.title}</h3><p className="mt-2 text-sm leading-6 text-slate-600">{control.text}</p></div>)}</div>
            </div>
            <div className="flex flex-col rounded-[2rem] bg-slate-950 p-6 text-slate-100 shadow-sm sm:p-9"><MessageCircle className="h-7 w-7 text-cyan-300" aria-hidden="true" /><h2 className="mt-5 text-2xl font-black tracking-[-0.035em]">정식 이용 및 기관 도입</h2><p className="mt-3 text-sm leading-7 text-slate-300 sm:text-base">교사·기관 도입 조건은 과정 구성, AI 평가량, 교사 첨삭 범위에 따라 달라집니다. 체험해 보신 뒤 문의해 주시면 도입 조건을 안내해 드립니다.</p><div className="mt-auto flex flex-col gap-3 pt-8"><Link href="/sample" className="inline-flex h-11 items-center justify-center rounded-xl bg-cyan-300 px-5 text-sm font-extrabold text-slate-950 transition hover:bg-cyan-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950">샘플 체험하기</Link><a href={CONTACT_MAILTO} className="inline-flex h-11 items-center justify-center rounded-xl border border-cyan-300/60 px-5 text-sm font-extrabold text-cyan-100 transition hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950">도입·운영 문의 {CONTACT_EMAIL}</a></div></div>
          </section>
        </div>
      </div>
    </div>
  );
}
