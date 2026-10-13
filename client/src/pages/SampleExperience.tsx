import React, { useEffect, useState } from "react";
import { CheckCircle2, ChevronRight, Loader2, LockKeyhole, Sparkles, Wand2 } from "lucide-react";
import { Link } from "wouter";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { trpc } from "@/lib/trpc";
import { SAMPLE_COURSE_CONTENT } from "@/lib/sampleCourseContent";

const SAMPLE_COURSES = [
  ["elementary", "초등 논술", "생각을 문장으로 표현하는 첫 단계"],
  ["middle_high", "중고등 논술", "근거를 연결해 설득력 있게 쓰기"],
  ["high_univ", "고등 / 대입 논술", "제시문 분석과 구조적 논증"],
  ["general_adult", "일반 / 직장인", "업무와 일상의 논리적 글쓰기"],
] as const;

// 서버의 SAMPLE_AI_SESSION_LIMIT(server/routers.ts)과 동일하게 유지해야 합니다.
const SAMPLE_AI_SESSION_LIMIT = 1;
const SAMPLE_AI_TEXT_MAX_LENGTH = 300;
const SAMPLE_SESSION_TOKEN_KEY = "essayMasterSampleSessionToken";

function getOrCreateSampleSessionToken(): string {
  if (typeof window === "undefined") return "";
  try {
    const existing = window.sessionStorage.getItem(SAMPLE_SESSION_TOKEN_KEY);
    if (existing && existing.length >= 10) return existing;
    const fresh =
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID().replace(/-/g, "")
        : `sample-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    window.sessionStorage.setItem(SAMPLE_SESSION_TOKEN_KEY, fresh);
    return fresh;
  } catch {
    // sessionStorage를 쓸 수 없는 환경(프라이빗 모드 등)에서는 매 요청마다 새 토큰을 씁니다.
    return `sample-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  }
}

export default function SampleExperience() {
  const [selectedCourse, setSelectedCourse] = useState<(typeof SAMPLE_COURSES)[number][0]>("elementary");
  const [answer, setAnswer] = useState<string | null>(null);
  const [showTrialInvite, setShowTrialInvite] = useState(false);

  const [sessionToken, setSessionToken] = useState("");
  const [essayText, setEssayText] = useState("");
  const [usedCount, setUsedCount] = useState(0);
  const [limitReached, setLimitReached] = useState(false);
  // 선택한 과정에 따라 학습 방식 소개, 미니 연습, AI 첨삭 논제가 달라진다.
  const content = SAMPLE_COURSE_CONTENT[selectedCourse];

  // 샘플에서 둘러본 과정과 AI 첨삭 실체험 사용 여부를 가입 유도 링크에 실어 보냅니다.
  // 회원가입 화면은 이 값으로 과정을 미리 선택해두고, "이어가기" 메시지를 보여줍니다.
  const conversionParams = new URLSearchParams({ trial: "1", course: selectedCourse });
  if (usedCount > 0) conversionParams.set("aiTried", "1");
  const signupHref = `/signup?${conversionParams.toString()}`;
  const loginHref = `/login?${conversionParams.toString()}`;

  useEffect(() => {
    setSessionToken(getOrCreateSampleSessionToken());
  }, []);

  const evaluateMutation = trpc.sampleEvaluation.evaluate.useMutation({
    onSuccess: () => {
      setUsedCount((count) => count + 1);
    },
    onError: (error) => {
      if (error.data?.code === "TOO_MANY_REQUESTS") {
        setLimitReached(true);
      }
    },
  });

  const remaining = Math.max(0, SAMPLE_AI_SESSION_LIMIT - usedCount);
  const canSubmit = !limitReached && remaining > 0 && essayText.trim().length > 0 && sessionToken.length >= 10;

  const handleEvaluate = () => {
    if (!canSubmit) return;
    evaluateMutation.mutate({
      sessionToken,
      task: content.aiTask,
      courseType: selectedCourse,
      essayText: essayText.trim(),
    });
  };

  const result = evaluateMutation.data;

  return (
    <div className="bg-slate-50 text-slate-950">
      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        <section className="max-w-3xl">
          <p className="text-sm font-extrabold tracking-[0.14em] text-indigo-700">SAMPLE EXPERIENCE</p>
          <h1 className="mt-3 text-4xl font-black tracking-[-0.045em] sm:text-5xl">회원가입 전, 학습 방식을 먼저 둘러보세요.</h1>
          <p className="mt-5 text-lg leading-8 text-slate-600">샘플 체험은 가입 전에 로그인 없이 이용합니다. 과정 소개와 짧은 연습을 둘러보고, 실제 AI 평가·첨삭을 방문당 1회 체험해 나에게 맞는지 확인하세요. 입력한 글과 결과는 저장되지 않으며, 레슨·학습 도구와 학습 기록 저장은 가입 후 7일 무료 체험에서 이용할 수 있습니다.</p>
        </section>

        <section className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4" aria-label="샘플 과정 선택">
          {SAMPLE_COURSES.map(([value, title, description]) => (
            <button key={value} type="button" aria-pressed={selectedCourse === value} onClick={() => { setSelectedCourse(value); setAnswer(null); evaluateMutation.reset(); }} className={`rounded-2xl border p-5 text-left transition focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-indigo-200 ${selectedCourse === value ? "border-indigo-500 bg-indigo-50 shadow-sm" : "border-slate-200 bg-white hover:border-indigo-200"}`}>
              <h2 className="font-extrabold text-slate-950">{title}</h2>
              <p className="mt-2 text-sm leading-6 text-slate-600">{description}</p>
            </button>
          ))}
        </section>

        <section className="mt-8 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8" aria-label={`${content.label} 학습 방식`}>
          <p className="text-sm font-bold text-indigo-700">{content.label} 학습 방식</p>
          <h2 className="mt-2 text-2xl font-black">{content.audience}을 위한 과정입니다.</h2>
          <p className="mt-3 leading-7 text-slate-600">{content.goal}</p>
          <ol className="mt-6 grid gap-3 sm:grid-cols-2">
            {content.levels.map((level) => (
              <li key={level.title} className="rounded-xl bg-slate-50 p-4">
                <p className="font-extrabold text-slate-900">{level.title}</p>
                <p className="mt-1 text-sm leading-6 text-slate-600">{level.summary}</p>
              </li>
            ))}
          </ol>
          <p className="mt-4 text-sm text-slate-500">각 레벨은 이론 학습, 확인 문제, 서술형 제출과 AI 평가 순서로 진행됩니다. 레슨 학습은 회원가입 후 7일 무료 체험에서 시작할 수 있습니다.</p>
        </section>

        <section className="mt-8 grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
          <article className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
            <div className="flex items-center gap-2 text-sm font-bold text-indigo-700"><Sparkles className="h-4 w-4" />무저장 미니 연습 · {content.label}</div>
            <h2 className="mt-3 text-2xl font-black">{content.practice.heading}</h2>
            <p className="mt-4 whitespace-pre-line leading-7 text-slate-600">{content.practice.passage}</p>
            <p className="mt-6 font-bold text-slate-800">{content.practice.question}</p>
            <div className="mt-4 space-y-3">
              {content.practice.choices.map((choice, index) => {
                const isCorrect = index === content.practice.correctIndex;
                const isSelected = answer === choice;
                return <button key={choice} type="button" onClick={() => { setAnswer(choice); setShowTrialInvite(true); }} className={`flex w-full items-center justify-between rounded-xl border px-4 py-3 text-left font-medium transition ${isSelected ? isCorrect ? "border-emerald-400 bg-emerald-50 text-emerald-950" : "border-rose-300 bg-rose-50 text-rose-950" : "border-slate-200 hover:border-indigo-300"}`}>{choice}{isSelected && <CheckCircle2 className={`h-5 w-5 ${isCorrect ? "text-emerald-600" : "text-rose-500"}`} />}</button>;
              })}
            </div>
            {answer && <p className={`mt-4 rounded-xl px-4 py-3 text-sm ${answer === content.practice.choices[content.practice.correctIndex] ? "bg-emerald-50 text-emerald-900" : "bg-rose-50 text-rose-900"}`}>{answer === content.practice.choices[content.practice.correctIndex] ? content.practice.correctMessage : content.practice.wrongMessage}</p>}
          </article>
          <aside className="rounded-3xl bg-slate-950 p-6 text-white sm:p-8">
            <LockKeyhole className="h-7 w-7 text-cyan-300" />
            <h2 className="mt-4 text-2xl font-black">샘플 체험에서는</h2>
            <ul className="mt-5 space-y-3 text-sm leading-6 text-slate-300"><li>과정별 학습 구조와 짧은 연습을 둘러볼 수 있습니다.</li><li>바로 아래에서 실제 AI 평가·첨삭을 방문당 {SAMPLE_AI_SESSION_LIMIT}회 직접 체험할 수 있습니다.</li><li>답안·진도·AI 첨삭 결과는 개인 DB에 저장되지 않습니다.</li><li>가입하면 7일 무료 체험에서 AI 평가·첨삭 2회를 별도로 더 이용할 수 있습니다.</li></ul>
            <Link href={loginHref} className="mt-7 inline-flex h-12 w-full items-center justify-center rounded-xl bg-white px-5 font-bold text-slate-950 transition hover:bg-cyan-50">로그인하고 7일 무료 체험 시작<ChevronRight className="ml-1 h-4 w-4" /></Link>
          </aside>
        </section>

        <section id="ai-trial" className="mt-8 rounded-3xl border border-indigo-200 bg-white p-6 shadow-sm sm:p-8">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-sm font-bold text-indigo-700"><Wand2 className="h-4 w-4" />AI 첨삭 실체험</div>
            <span className="rounded-full bg-indigo-50 px-3 py-1 text-xs font-bold text-indigo-700">이번 방문 {remaining}/{SAMPLE_AI_SESSION_LIMIT}회 남음 · 결과 저장 안 함</span>
          </div>
          <h2 className="mt-3 text-2xl font-black">직접 써보고, 실제 AI 첨삭을 받아보세요.</h2>
          <p className="mt-3 leading-7 text-slate-600">예시가 아니라 실제 서비스와 같은 AI 논술 평가 엔진이 첨삭합니다. 로그인 없이 지금 바로 체험할 수 있고, 입력한 글과 결과는 계정에 저장되지 않습니다.</p>
          <p className="mt-4 rounded-xl bg-slate-50 px-4 py-3 text-sm font-medium text-slate-700">논제({content.label}): {content.aiTask}</p>
          <p className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-950" role="note">
            <strong>입력 전 확인해 주세요.</strong> 작성한 글은 AI 평가를 위해 외부 AI 모델 제공자에게 전송됩니다. 이름·연락처·학교 등 개인을 알아볼 수 있는 정보는 쓰지 마세요. 답안과 첨삭 결과는 저장하지 않으며, 체험 횟수 제한을 위해 방문 식별값과 접속 IP를 암호화한 값, 사용 시각만 기록합니다.
          </p>

          {limitReached ? (
            <div className="mt-5 rounded-xl border border-amber-200 bg-amber-50 p-5">
              <p className="font-bold text-amber-900">이번 방문에서 체험 가능한 AI 첨삭을 모두 사용했습니다.</p>
              <p className="mt-2 text-sm leading-6 text-amber-800">로그인하고 7일 무료 체험을 시작하면 내 글로 AI 평가·첨삭을 2회 더 받아볼 수 있습니다.</p>
              <Link href={signupHref} className="mt-4 inline-flex h-11 items-center justify-center rounded-xl bg-slate-950 px-5 font-bold text-white transition hover:bg-slate-800">7일 무료 체험 시작<ChevronRight className="ml-1 h-4 w-4" /></Link>
            </div>
          ) : (
            <div className="mt-5">
              <Textarea value={essayText} onChange={(event) => setEssayText(event.target.value.slice(0, SAMPLE_AI_TEXT_MAX_LENGTH))} placeholder={content.aiPlaceholder} rows={5} className="resize-none" disabled={evaluateMutation.isPending} />
              <div className="mt-2 flex items-center justify-between text-xs text-slate-500">
                <span>{essayText.trim().length < 20 ? "20자 이상 작성하면 더 정확한 첨삭을 받을 수 있어요." : " "}</span>
                <span className={essayText.length >= SAMPLE_AI_TEXT_MAX_LENGTH ? "font-bold text-rose-600" : ""}>{essayText.length} / {SAMPLE_AI_TEXT_MAX_LENGTH}자</span>
              </div>
              <Button onClick={handleEvaluate} disabled={!canSubmit || evaluateMutation.isPending} className="mt-3 h-11">
                {evaluateMutation.isPending ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />AI가 첨삭하는 중...</> : "AI 첨삭 받기"}
              </Button>
              {evaluateMutation.isError && evaluateMutation.error?.data?.code !== "TOO_MANY_REQUESTS" && (
                <p className="mt-3 text-sm font-medium text-rose-600">{evaluateMutation.error?.message || "첨삭을 받아오지 못했습니다. 잠시 후 다시 시도해 주세요."}</p>
              )}
            </div>
          )}

          {result && (
            <div className="mt-6 rounded-2xl border border-indigo-100 bg-indigo-50/60 p-5 sm:p-6">
              <div className="flex flex-wrap items-center gap-3">
                <span className="rounded-full bg-indigo-600 px-3 py-1 text-sm font-bold text-white">{result.level}</span>
                <span className="text-sm font-bold text-slate-700">종합 점수 {result.total_score}점</span>
              </div>
              {result.dimension_scores.length > 0 && (
                <div className="mt-4 flex flex-wrap gap-2">
                  {result.dimension_scores.slice(0, 6).map((dimension) => (
                    <span key={dimension.competency} className="rounded-full border border-indigo-200 bg-white px-3 py-1 text-xs font-medium text-indigo-700">{dimension.competency} {dimension.score}</span>
                  ))}
                </div>
              )}
              <p className="mt-4 leading-7 text-slate-800">{result.feedback.summary}</p>
              {result.improvement_points.length > 0 && (
                <div className="mt-4">
                  <p className="text-sm font-bold text-slate-900">더 보완하면 좋은 점</p>
                  <ul className="mt-2 space-y-1 text-sm leading-6 text-slate-700">
                    {result.improvement_points.slice(0, 3).map((point, index) => <li key={index}>· {point}</li>)}
                  </ul>
                </div>
              )}
              <p className="mt-5 text-sm text-indigo-800">이 결과는 저장되지 않습니다. 방금 받은 첨삭을 내 계정에 저장하고 이어가려면 지금 가입하세요.</p>
              <Link href={signupHref} className="mt-3 inline-flex h-11 items-center justify-center rounded-xl bg-indigo-600 px-5 font-bold text-white transition hover:bg-indigo-700">이 결과 저장하고 7일 무료 체험 시작<ChevronRight className="ml-1 h-4 w-4" /></Link>
            </div>
          )}
        </section>
      </div>
      <Dialog open={showTrialInvite} onOpenChange={setShowTrialInvite}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>샘플 연습을 완료했어요.</DialogTitle>
            <DialogDescription>바로 아래 “AI 첨삭 실체험”에서 직접 쓴 글로 실제 AI 논술 평가를 받아볼 수 있습니다. 회원가입 후 7일 동안은 내 과정의 레슨과 학습 도구를 계속 사용할 수 있어요.</DialogDescription>
          </DialogHeader>
          <div className="rounded-xl bg-indigo-50 p-4 text-sm leading-6 text-indigo-950">샘플에서 푼 답안은 저장되지 않습니다. 회원가입 후부터 나의 진도와 학습 기록이 안전하게 저장됩니다.</div>
          <DialogFooter className="gap-2 sm:gap-0"><Button variant="outline" onClick={() => setShowTrialInvite(false)}>AI 첨삭 실체험 해보기</Button><Link href={signupHref}><Button>7일 무료 체험 시작</Button></Link></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
