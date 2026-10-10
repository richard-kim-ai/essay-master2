import React, { useState } from "react";
import { Link, useLocation, useSearch } from "wouter";
import { sanitizeNextPath } from "@/lib/loginRedirect";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { Mail, Lock, ArrowRight } from "lucide-react";
import { trpc } from "@/lib/trpc";
import AuthLayout from "@/components/AuthLayout";

const PROVIDER_LABELS = { google: "Google", kakao: "카카오", naver: "네이버" } as const;

export default function Login() {
  const [, setLocation] = useLocation();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  // 보호자(법정대리인) 동의가 끝나지 않아 로그인이 막힌 경우 동의 메일 재발송을 안내한다.
  const [guardianPending, setGuardianPending] = useState(false);
  const resendGuardian = trpc.guardian.resendConsent.useMutation({
    onSuccess: () => toast.success("보호자 이메일로 동의 요청을 다시 보냈습니다. 5분 안에 다시 요청하면 발송되지 않을 수 있습니다."),
    onError: (error) => toast.error(error.message || "재발송 요청에 실패했습니다."),
  });

  const socialProviders = trpc.social.providers.useQuery();
  const enabledProviders = (["google", "kakao", "naver"] as const).filter((provider) => socialProviders.data?.find((item) => item.provider === provider)?.enabled);
  // 로그인이 필요한 화면에서 넘어온 경우 로그인 뒤 그 화면으로 돌아간다(같은 사이트 경로만 허용).
  const search = useSearch();
  const nextPath = sanitizeNextPath(new URLSearchParams(search).get("next"));
  // 소셜 로그인은 next가 주소에 있을 때만 넘긴다(없으면 기존처럼 첫 화면으로 이동).
  const socialNext = sanitizeNextPath(new URLSearchParams(search).get("next"), "");
  const loginMutation = trpc.auth.loginWithEmail.useMutation({
    onSuccess: () => {
      toast.success("로그인되었습니다.");
      setLocation(nextPath);
    },
    onError: (error) => {
      if (error.message === "EMAIL_NOT_VERIFIED") {
        setLocation(`/verify-email?email=${encodeURIComponent(email)}`);
        return;
      }
      setGuardianPending(error.message.includes("보호자(법정대리인)의 동의"));
      toast.error(error.message || "로그인에 실패했습니다.");
    },
  });

  const handleLogin = (event: React.FormEvent) => {
    event.preventDefault();
    if (!email || !password) {
      toast.error("이메일과 비밀번호를 입력해주세요.");
      return;
    }
    loginMutation.mutate({ email, password });
  };

  return (
    <AuthLayout tagline="AI 기반 맞춤형 논술 학습 플랫폼">
        <Card className="bg-white p-6 shadow-xl sm:p-8">
          <h1 className="text-2xl font-bold text-slate-900">로그인</h1>
          <p className="mt-2 text-sm text-slate-500">학습 기록을 이어서 확인해 보세요.</p>

          {guardianPending && (
            <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-950" role="alert">
              <p className="font-semibold">보호자(법정대리인)의 동의를 기다리는 중입니다.</p>
              <p className="mt-1 text-xs leading-relaxed">보호자 이메일로 발송된 동의 요청 메일에서 동의를 완료하면 로그인할 수 있습니다. 메일이 없거나 링크가 만료되었다면 다시 받을 수 있습니다.</p>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="mt-2 bg-white"
                disabled={!email || resendGuardian.isPending}
                onClick={() => resendGuardian.mutate({ email })}
              >
                {resendGuardian.isPending ? "요청 중..." : "보호자 동의 메일 다시 받기"}
              </Button>
            </div>
          )}
          <form onSubmit={handleLogin} className="mt-6 space-y-4">
            <label className="block text-sm font-medium text-slate-700">
              이메일
              <span className="relative mt-2 block">
                <Mail className="absolute left-3 top-3 h-5 w-5 text-slate-400" />
                <Input
                  type="email"
                  required
                  placeholder="name@example.com"
                  className="pl-10"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </span>
            </label>

            <label className="block text-sm font-medium text-slate-700">
              비밀번호
              <span className="relative mt-2 block">
                <Lock className="absolute left-3 top-3 h-5 w-5 text-slate-400" />
                <Input
                  type="password"
                  required
                  placeholder="••••••••"
                  className="pl-10"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </span>
            </label>

            <div className="flex items-center justify-end text-sm">
              <Link href="/forgot-password" className="font-medium text-indigo-700 hover:underline">비밀번호 찾기</Link>
            </div>

            <Button type="submit" className="w-full bg-indigo-600 hover:bg-indigo-700" disabled={loginMutation.isPending}>
              {loginMutation.isPending ? "로그인 중..." : "이메일 로그인"} <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </form>

          {/* 사용 가능한 소셜 로그인 제공자만 보여준다(설정되지 않은 제공자는 숨긴다) */}
          {enabledProviders.length > 0 && (
            <>
              <div className="relative my-6">
                <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-slate-200" /></div>
                <div className="relative flex justify-center"><span className="bg-white px-3 text-sm text-slate-500">또는</span></div>
              </div>
              <div className={`grid gap-2 ${enabledProviders.length === 1 ? "grid-cols-1" : enabledProviders.length === 2 ? "grid-cols-2" : "grid-cols-3"}`}>
                {enabledProviders.map((provider) => (
                  <Button key={provider} type="button" variant="outline" onClick={() => { window.location.href = `/api/social/${provider}/start?origin=${encodeURIComponent(window.location.origin)}${socialNext ? `&next=${encodeURIComponent(socialNext)}` : ""}`; }}>{PROVIDER_LABELS[provider]}</Button>
                ))}
              </div>
            </>
          )}
          <div className="mt-6 space-y-3">
            <p className="text-center text-xs font-semibold text-slate-500 uppercase tracking-wider">아직 계정이 없으신가요?</p>
            <div className="grid grid-cols-2 gap-3">
              <Link href="/signup" className="flex items-center justify-center rounded-xl bg-indigo-50 border border-indigo-200 py-2.5 text-xs font-bold text-indigo-700 hover:bg-indigo-100 transition shadow-sm">
                🎓 학생 회원가입
              </Link>
              <Link href="/teacher-signup" className="flex items-center justify-center rounded-xl bg-indigo-50 border border-indigo-200 py-2.5 text-xs font-bold text-indigo-700 hover:bg-indigo-100 transition shadow-sm">
                👩‍🏫 교사 회원가입
              </Link>
            </div>
          </div>
        </Card>
    </AuthLayout>
  );
}
