import React from "react";
import { useAuth } from "@/_core/hooks/useAuth";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import InstallPrompt from "@/components/InstallPrompt";
import Navigation from "@/components/Navigation";
import OfflineStatus from "@/components/OfflineStatus";
import {
  getHomePrimaryAction,
  getHomeSecondaryAction,
} from "@/lib/homeExperience";
import { Link } from "wouter";
import {
  ArrowRight,
  BookOpen,
  CheckCircle2,
  ChevronRight,
  ClipboardCheck,
  FileText,
  GraduationCap,
  MessageSquareText,
  PenLine,
  Sparkles,
  Target,
} from "lucide-react";

const LEARNING_STEPS = [
  {
    number: "01",
    icon: Target,
    title: "나의 단계 선택",
    description: "현재 수준과 목표에 맞는 과정을 고르고 학습 순서를 확인합니다.",
  },
  {
    number: "02",
    icon: PenLine,
    title: "직접 쓰고 다듬기",
    description: "논제 분석부터 문장 교정까지, 필요한 연습을 차례로 진행합니다.",
  },
  {
    number: "03",
    icon: MessageSquareText,
    title: "피드백으로 완성",
    description: "AI와 교사 피드백을 바탕으로 다음 학습의 방향을 정리합니다.",
  },
] as const;

const LEARNING_TOOLS = [
  {
    href: "/quiz",
    icon: Sparkles,
    eyebrow: "문장 표현",
    title: "AI 문장 교정",
    description: "내가 먼저 고쳐 쓴 뒤, 표현의 정확성과 명료성을 비교해 봅니다.",
  },
  {
    href: "/paragraph-reordering",
    icon: FileText,
    eyebrow: "글의 구조",
    title: "단락 재구성",
    description: "흩어진 근거와 결론을 연결하며 논리적인 글의 순서를 익힙니다.",
  },
  {
    href: "/summary-practice",
    icon: BookOpen,
    eyebrow: "핵심 파악",
    title: "요약 연습",
    description: "제시문의 쟁점과 주장, 조건을 남기는 요약의 기준을 연습합니다.",
  },
  {
    href: "/topic-wizard",
    icon: ClipboardCheck,
    eyebrow: "주장 설계",
    title: "주제 설정",
    description: "관심 있는 주제에서 근거 있는 논제를 만들고 글의 방향을 정합니다.",
  },
] as const;

const LEARNING_PROMISES = [
  "과정별 학습 순서와 다음 할 일을 한눈에 확인",
  "작성 전·후를 비교하며 글의 변화를 스스로 점검",
  "학습 기록을 모아 약점을 복습하고 다음 단계로 연결",
] as const;

export default function Home() {
  const { user, isAuthenticated } = useAuth();
  const primaryAction = getHomePrimaryAction(isAuthenticated, user?.role);
  const secondaryAction = getHomeSecondaryAction(isAuthenticated);

  return (
    <div className="min-h-screen bg-[#fbfcff] text-slate-950">
      <Navigation />
      <OfflineStatus />

      {!isAuthenticated && (
        <div className="border-b border-indigo-100 bg-indigo-50 px-4 py-2.5 text-center text-sm text-indigo-950">
          <span className="font-semibold">처음이신가요?</span> 로그인 전에도 과정을 살펴보고 학습 도구를 체험할 수 있습니다.
          <Link href="/login" className="ml-2 font-bold underline underline-offset-4 hover:text-indigo-700">
            계정 만들기
          </Link>
        </div>
      )}

      <main>
        <section className="relative overflow-hidden border-b border-slate-100 bg-[radial-gradient(circle_at_84%_12%,rgba(199,210,254,0.72),transparent_25rem),radial-gradient(circle_at_5%_90%,rgba(219,234,254,0.72),transparent_28rem)]">
          <div aria-hidden="true" className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-indigo-700 via-blue-500 to-cyan-400" />
          <div className="mx-auto grid max-w-7xl items-center gap-10 px-4 py-14 sm:px-6 sm:py-20 lg:grid-cols-[1.05fr_0.95fr] lg:px-8 lg:py-24">
            <div className="relative z-10 max-w-2xl">
              <Badge className="mb-6 border border-indigo-100 bg-white/80 px-3 py-1.5 text-xs font-bold tracking-wide text-indigo-700 shadow-sm">
                <GraduationCap className="mr-1.5 h-3.5 w-3.5" />
                단계별 논술 학습
              </Badge>
              <p className="mb-4 text-sm font-semibold tracking-[0.16em] text-indigo-700">읽고 · 생각하고 · 설득력 있게 쓰는 힘</p>
              <h1 className="text-balance text-4xl font-black leading-[1.16] tracking-[-0.055em] text-slate-950 sm:text-5xl lg:text-6xl">
                좋은 글은,
                <br />
                <span className="text-indigo-600">좋은 순서</span>에서 시작됩니다.
              </h1>
              <p className="mt-6 max-w-xl text-pretty text-lg leading-8 text-slate-600 sm:text-xl">
                논제 이해부터 구조 설계, 문장 다듬기까지. 논술 마스터가 당신의 글쓰기 과정을 한 단계씩 함께 정리합니다.
              </p>

              <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
                <Button asChild className="h-12 w-full rounded-xl bg-indigo-700 px-5 text-base font-bold text-white shadow-lg shadow-indigo-200 transition hover:bg-indigo-800 sm:w-auto">
                  <Link href={primaryAction.href}>
                    {primaryAction.label}
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Link>
                </Button>
                <Button asChild variant="outline" className="h-12 w-full rounded-xl border-slate-200 bg-white/80 px-5 text-base font-bold text-slate-800 hover:border-indigo-200 hover:bg-indigo-50 sm:w-auto">
                  <Link href={secondaryAction.href}>
                    {secondaryAction.label}
                    <ChevronRight className="ml-1 h-4 w-4" />
                  </Link>
                </Button>
              </div>
              <p className="mt-3 text-sm text-slate-500">{primaryAction.description}</p>
            </div>

            <div className="relative mx-auto w-full max-w-xl lg:max-w-none">
              <div aria-hidden="true" className="absolute -inset-5 rounded-[2.5rem] bg-indigo-200/45 blur-3xl" />
              <div className="relative overflow-hidden rounded-[1.75rem] border border-slate-200/80 bg-white p-4 shadow-[0_22px_70px_-30px_rgba(49,46,129,0.36)] sm:p-6">
                <div className="mb-5 flex items-center justify-between border-b border-slate-100 pb-4">
                  <div>
                    <p className="text-xs font-bold tracking-[0.12em] text-indigo-600">WRITING STUDIO</p>
                    <p className="mt-1 text-base font-extrabold text-slate-900">내 글을 고치는 순간</p>
                  </div>
                  <div className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-700">학습 중</div>
                </div>
                <div className="grid gap-4 sm:grid-cols-[1.06fr_0.94fr]">
                  <article className="rounded-2xl bg-slate-50 p-4">
                    <p className="mb-3 text-xs font-bold text-slate-500">작성한 문장</p>
                    <p className="font-serif text-[1.04rem] leading-7 text-slate-800">
                      “주장에 맞는 근거를 차례로 제시하면, 독자는 글의 흐름을 더 분명히 이해할 수 있다.”
                    </p>
                    <div className="mt-4 h-1.5 w-full rounded-full bg-slate-200">
                      <div className="h-full w-3/4 rounded-full bg-indigo-500" />
                    </div>
                  </article>
                  <article className="rounded-2xl border border-indigo-100 bg-indigo-50/75 p-4">
                    <p className="mb-3 text-xs font-bold text-indigo-700">다음 점검</p>
                    <ul className="space-y-2.5 text-sm leading-5 text-slate-700">
                      <li className="flex gap-2"><CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />주장과 근거의 연결</li>
                      <li className="flex gap-2"><CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />문장의 핵심어 선택</li>
                      <li className="flex gap-2"><span className="mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full bg-amber-400" />구체적 사례 보완</li>
                    </ul>
                  </article>
                </div>
                <div className="mt-4 flex items-center gap-3 rounded-xl border border-slate-100 bg-white px-4 py-3 text-sm text-slate-600 shadow-sm">
                  <Sparkles className="h-4 w-4 shrink-0 text-indigo-600" />
                  <span><strong className="text-slate-900">AI 가이드</strong>가 다음에 다듬을 한 가지를 먼저 제안합니다.</span>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8 lg:py-20" aria-labelledby="journey-title">
          <div className="max-w-2xl">
            <p className="text-sm font-bold tracking-[0.14em] text-indigo-700">LEARNING JOURNEY</p>
            <h2 id="journey-title" className="mt-3 text-3xl font-black tracking-[-0.035em] text-slate-950 sm:text-4xl">막연한 연습 대신, 다음 한 걸음을 알 수 있도록</h2>
            <p className="mt-4 text-lg leading-8 text-slate-600">각 도구는 독립적인 기능이 아니라 한 편의 글을 완성하는 학습 흐름으로 연결됩니다.</p>
          </div>
          <ol className="mt-10 grid gap-4 md:grid-cols-3">
            {LEARNING_STEPS.map((step) => {
              const Icon = step.icon;
              return (
                <li key={step.number} className="group rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition duration-200 hover:-translate-y-1 hover:border-indigo-200 hover:shadow-lg hover:shadow-indigo-100/70">
                  <div className="flex items-start justify-between">
                    <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-indigo-50 text-indigo-700"><Icon className="h-5 w-5" /></div>
                    <span className="text-sm font-black text-indigo-300">{step.number}</span>
                  </div>
                  <h3 className="mt-7 text-xl font-extrabold text-slate-900">{step.title}</h3>
                  <p className="mt-3 leading-7 text-slate-600">{step.description}</p>
                </li>
              );
            })}
          </ol>
        </section>

        <section className="border-y border-slate-100 bg-slate-950 py-16 text-white sm:py-20" aria-labelledby="tools-title">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="flex flex-col justify-between gap-5 md:flex-row md:items-end">
              <div className="max-w-2xl">
                <p className="text-sm font-bold tracking-[0.14em] text-cyan-300">PRACTICE TOOLKIT</p>
                <h2 id="tools-title" className="mt-3 text-3xl font-black tracking-[-0.035em] sm:text-4xl">글쓰기에 필요한 힘을, 필요한 방식으로</h2>
              </div>
              <Link href="/curriculum" className="inline-flex items-center font-bold text-cyan-200 hover:text-white">전체 과정 보기 <ArrowRight className="ml-2 h-4 w-4" /></Link>
            </div>
            <div className="mt-10 grid gap-4 md:grid-cols-2">
              {LEARNING_TOOLS.map((tool) => {
                const Icon = tool.icon;
                return (
                  <Link key={tool.href} href={tool.href} className="group rounded-2xl border border-slate-800 bg-slate-900/70 p-6 transition duration-200 hover:border-indigo-400 hover:bg-slate-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300">
                    <div className="flex items-start gap-4">
                      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-indigo-500/15 text-indigo-200 transition group-hover:bg-indigo-500/25"><Icon className="h-5 w-5" /></div>
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-bold tracking-[0.12em] text-cyan-300">{tool.eyebrow}</p>
                        <h3 className="mt-1 text-xl font-extrabold text-white">{tool.title}</h3>
                        <p className="mt-2 leading-6 text-slate-300">{tool.description}</p>
                      </div>
                      <ArrowRight className="mt-1 h-5 w-5 shrink-0 text-slate-500 transition group-hover:translate-x-1 group-hover:text-cyan-300" />
                    </div>
                  </Link>
                );
              })}
            </div>
          </div>
        </section>

        <section className="mx-auto grid max-w-7xl gap-8 px-4 py-16 sm:px-6 lg:grid-cols-[0.82fr_1.18fr] lg:px-8 lg:py-20">
          <div className="rounded-[1.75rem] bg-indigo-700 p-7 text-white sm:p-9">
            <p className="text-sm font-bold tracking-[0.14em] text-indigo-200">WHY ESSAY MASTER</p>
            <h2 className="mt-4 text-3xl font-black leading-tight tracking-[-0.035em]">한 번의 답보다,
              <br />다음에 더 잘 쓰는 힘을 만듭니다.</h2>
            <Link href={primaryAction.href} className="mt-8 inline-flex items-center font-bold text-white underline decoration-indigo-300 underline-offset-4 hover:decoration-white">
              {primaryAction.label}<ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </div>
          <div className="grid content-center gap-4 sm:grid-cols-3">
            {LEARNING_PROMISES.map((promise, index) => (
              <div key={promise} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <span className="text-sm font-black text-indigo-300">0{index + 1}</span>
                <p className="mt-5 font-semibold leading-7 text-slate-800">{promise}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="border-t border-slate-100 bg-white px-4 py-16 text-center sm:px-6 lg:px-8">
          <div className="mx-auto max-w-2xl">
            <p className="text-sm font-bold tracking-[0.14em] text-indigo-700">START YOUR FIRST STEP</p>
            <h2 className="mt-3 text-3xl font-black tracking-[-0.035em] text-slate-950 sm:text-4xl">오늘의 한 문장부터 시작해 보세요.</h2>
            <p className="mt-4 text-lg leading-8 text-slate-600">과정을 선택하고, 첫 레슨에서 글쓰기의 기준을 세워 보세요.</p>
            <Button asChild className="mt-8 h-12 rounded-xl bg-indigo-700 px-6 text-base font-bold text-white shadow-lg shadow-indigo-100 hover:bg-indigo-800">
              <Link href={primaryAction.href}>
                {primaryAction.label}<ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
          </div>
        </section>
      </main>

      <footer className="bg-slate-950 px-4 py-10 text-slate-400 sm:px-6 lg:px-8">
        <div className="mx-auto flex max-w-7xl flex-col justify-between gap-8 md:flex-row md:items-end">
          <div>
            <div className="flex items-center gap-2 font-extrabold text-white"><BookOpen className="h-5 w-5 text-cyan-300" />논술 마스터</div>
            <p className="mt-3 max-w-sm text-sm leading-6">읽고, 생각하고, 설득력 있게 쓰는 과정을 함께하는 단계별 논술 학습 플랫폼입니다.</p>
          </div>
          <div className="flex flex-wrap justify-start gap-x-5 gap-y-3 text-sm font-semibold md:justify-end">
            <Link href="/curriculum" className="hover:text-white">커리큘럼</Link>
            <Link href="/essay-archive" className="hover:text-white">추천 아카이브</Link>
            <Link href="/topic-wizard" className="hover:text-white">주제 설정</Link>
            <Link href="/mypage" className="hover:text-white">마이페이지</Link>
          </div>
        </div>
        <div className="mx-auto mt-8 max-w-7xl border-t border-slate-800 pt-6 text-sm">© 2026 논술 마스터. All rights reserved.</div>
      </footer>
      <InstallPrompt />
    </div>
  );
}
