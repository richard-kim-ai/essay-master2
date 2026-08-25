import React from "react";
import { CheckCircle2, Clock3, ExternalLink, LockKeyhole, MessageCircle, ShieldCheck } from "lucide-react";
import { Link } from "wouter";
import Navigation from "@/components/Navigation";

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
  },
  {
    name: "스타터",
    price: "9,900원",
    period: "/월 (검토안)",
    description: "개인 학습을 꾸준히 이어가는 학습자",
    features: ["전체 커리큘럼 이용", "AI 평가 월 5회 기준", "기본 학습 리포트"],
    tone: "border-indigo-200 bg-indigo-50/40",
  },
  {
    name: "성장",
    price: "24,900원",
    period: "/월 (검토안)",
    description: "첨삭과 분석을 집중적으로 활용하는 학습자",
    features: ["스타터의 모든 기능", "AI 평가 월 20회 기준", "상세 취약점 분석"],
    tone: "border-blue-300 bg-blue-50/50",
  },
  {
    name: "교사·기관",
    price: "문의",
    period: "맞춤 안내",
    description: "반 운영과 교사 피드백이 필요한 기관",
    features: ["반·학생 관리", "교사 첨삭 운영", "도입 규모별 견적"],
    tone: "border-slate-200 bg-white",
  },
] as const;

const PRIVACY_CONTROLS = [
  { title: "최소 수집", text: "계정·학습 제공에 필요한 정보와 답안만 목적별로 처리합니다." },
  { title: "접근 권한", text: "학생 답안은 본인·배정 교사·업무 권한을 가진 관리자 범위에서 확인합니다." },
  { title: "AI 전송 고지", text: "AI 평가에 필요한 최소 텍스트만 외부 모델 제공자에게 전송하며, 공급자와 보관 기준을 별도 고지합니다." },
  { title: "삭제·철회", text: "학습 데이터 삭제와 AI 품질 개선 활용 철회를 요청할 수 있도록 운영 절차를 둡니다." },
] as const;

export default function Pricing() {
  return (
    <div className="min-h-screen bg-slate-50 text-slate-950">
      <Navigation />
      <main className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8 lg:py-20">
        <section className="mx-auto max-w-3xl text-center">
          <p className="text-sm font-extrabold tracking-[0.14em] text-indigo-700">PRICING & TRIAL</p>
          <h1 className="mt-3 text-4xl font-black tracking-[-0.045em] sm:text-5xl">내 학습량에 맞는 이용 가이드</h1>
          <p className="mt-5 text-lg leading-8 text-slate-600">먼저 7일 동안 학습 흐름을 경험한 뒤, 필요한 첨삭량과 교사 지원 범위에 맞춰 선택하세요.</p>
        </section>

        <section className="mx-auto mt-12 max-w-4xl rounded-3xl border border-indigo-100 bg-white p-7 shadow-xl shadow-indigo-100/40 sm:p-10">
          <div className="flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full bg-indigo-50 px-3 py-1 text-sm font-bold text-indigo-700"><Clock3 className="h-4 w-4" />7일 무료 체험</div>
              <h2 className="mt-4 text-3xl font-black">로그인 후 내 과정으로 시작</h2>
              <p className="mt-3 max-w-2xl leading-7 text-slate-600">비로그인 샘플은 저장 없이 기능을 둘러보고, 로그인하면 7일 동안 개인 학습 기록과 레슨 1 AI 평가 1회를 경험할 수 있습니다.</p>
            </div>
            <ShieldCheck className="h-12 w-12 shrink-0 text-indigo-600" aria-hidden="true" />
          </div>
          <ul className="mt-7 grid gap-3 sm:grid-cols-3">
            {TRIAL_BENEFITS.map((benefit) => <li key={benefit} className="flex items-start gap-2 text-sm font-medium text-slate-700"><CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />{benefit}</li>)}
          </ul>
          <div className="mt-8 flex w-full flex-col gap-3 sm:flex-row">
            <Link href="/login?trial=1" className="inline-flex h-12 w-full items-center justify-center whitespace-nowrap rounded-xl bg-indigo-700 px-6 font-bold text-white transition hover:bg-indigo-800 sm:w-auto">지금 시작하기</Link>
            <Link href="/sample" className="inline-flex h-12 w-full items-center justify-center whitespace-nowrap rounded-xl border border-indigo-200 bg-white px-6 font-bold text-indigo-700 transition hover:bg-indigo-50 sm:w-auto">나에게 맞는 과정 찾기</Link>
          </div>
        </section>

        <section className="mt-16" aria-labelledby="price-guide-title">
          <div className="mx-auto max-w-3xl text-center">
            <p className="text-sm font-extrabold tracking-[0.14em] text-indigo-700">PRICE GUIDE</p>
            <h2 id="price-guide-title" className="mt-3 text-3xl font-black tracking-[-0.035em] sm:text-4xl">서비스 원가 검토를 위한 금액 가이드라인</h2>
            <p className="mt-4 text-base leading-7 text-slate-600">아래 금액은 결제 확정가가 아닌 검토안입니다. AI 사용량, 교사 첨삭 원가, 기관 운영 범위를 확인한 뒤 최종 가격을 확정합니다.</p>
          </div>
          <div className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {PRICE_GUIDE.map((plan) => (
              <article key={plan.name} className={`flex h-full flex-col rounded-2xl border p-6 shadow-sm ${plan.tone}`}>
                <h3 className="text-xl font-extrabold text-slate-950">{plan.name}</h3>
                <p className="mt-2 min-h-10 text-sm leading-5 text-slate-600">{plan.description}</p>
                <div className="mt-6 flex items-baseline gap-1"><span className="text-3xl font-black tracking-tight text-slate-950">{plan.price}</span><span className="text-xs font-bold text-slate-500">{plan.period}</span></div>
                <ul className="mt-6 flex-1 space-y-3 border-t border-slate-200/80 pt-5">{plan.features.map((feature) => <li key={feature} className="flex items-start gap-2 text-sm font-medium text-slate-700"><CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />{feature}</li>)}</ul>
              </article>
            ))}
          </div>
          <p className="mx-auto mt-5 max-w-3xl text-center text-xs leading-5 text-slate-500">참고: <a href="https://www.grammarly.com/plans" target="_blank" rel="noreferrer" className="font-semibold text-indigo-700 underline underline-offset-2 hover:text-indigo-900">Grammarly 공식 요금 페이지</a>는 무료 플랜과 Pro의 7일 체험을 안내하며, 표시 가격은 지역·시점·결제 조건에 따라 달라질 수 있습니다. Essay Master 금액은 해당 서비스의 가격을 복제한 것이 아닌 국내 운영 원가 검토용 범위입니다.</p>
        </section>

        <section className="mt-16 grid gap-6 lg:grid-cols-[1.1fr_0.9fr]" aria-labelledby="privacy-title">
          <div className="rounded-3xl border border-slate-200 bg-white p-7 shadow-sm sm:p-9">
            <div className="flex items-start gap-4"><div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700"><LockKeyhole className="h-5 w-5" /></div><div><p className="text-sm font-extrabold tracking-[0.12em] text-emerald-700">PRIVACY & SECURITY</p><h2 id="privacy-title" className="mt-2 text-2xl font-black">현재 플랫폼에 적용 가능한 보호 원칙</h2><p className="mt-3 leading-7 text-slate-600">현재 계정 역할·교사 권한·정책 동의·AI 운영 구조에 맞춰 적용 가능한 항목입니다. 법률 자문이나 보안 인증을 받은 사실을 의미하지 않으며, 실제 공개 전 계약과 점검이 필요합니다.</p></div></div>
            <div className="mt-7 grid gap-4 sm:grid-cols-2">{PRIVACY_CONTROLS.map((control) => <div key={control.title} className="rounded-xl bg-slate-50 p-4"><h3 className="font-extrabold text-slate-900">{control.title}</h3><p className="mt-2 text-sm leading-6 text-slate-600">{control.text}</p></div>)}</div>
            <div className="mt-7 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-950"><strong>출시 전 필수 확인:</strong> 개인정보 보유 기간, 외부 AI 제공자·DPA, 청소년·학부모 동의, 삭제 요청 처리, 접근 로그와 API 키 회전 정책을 운영 문서와 실제 설정에 맞춰 확정해야 합니다.</div>
          </div>
          <div className="rounded-3xl bg-slate-950 p-7 text-slate-100 shadow-sm sm:p-9"><MessageCircle className="h-7 w-7 text-cyan-300" /><h2 className="mt-5 text-2xl font-black">정식 이용 및 기관 도입</h2><p className="mt-3 leading-7 text-slate-300">개인 학습 이용권과 교사·기관 운영 정책은 과정 구성, AI 평가량, 사람 첨삭 범위에 따라 달라집니다. 결제 기능이 준비되기 전에는 체험 후 운영 문의로 도입 조건을 확인할 수 있습니다.</p><div className="mt-7 flex flex-col gap-3"><Link href="/sample" className="inline-flex h-11 items-center justify-center rounded-xl bg-cyan-300 px-5 font-bold text-slate-950 transition hover:bg-cyan-200">샘플 체험하기</Link><a href="https://www.grammarly.com/plans" target="_blank" rel="noreferrer" className="inline-flex items-center justify-center gap-2 text-sm font-semibold text-cyan-200 hover:text-white">공개 요금 비교 기준 보기 <ExternalLink className="h-4 w-4" /></a></div></div>
        </section>
      </main>
    </div>
  );
}
