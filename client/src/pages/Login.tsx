import { useState } from "react";
import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { Mail, Lock, ArrowRight, BookOpen } from "lucide-react";
import { startLogin } from "@/const";
import { trpc } from "@/lib/trpc";

export default function Login() {
  const [, setLocation] = useLocation();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const socialProviders = trpc.social.providers.useQuery();
  const loginMutation = trpc.auth.loginWithEmail.useMutation({
    onSuccess: () => {
      toast.success("로그인되었습니다.");
      setLocation("/dashboard");
    },
    onError: (error) => {
      if (error.message === "EMAIL_NOT_VERIFIED") {
        setLocation(`/verify-email?email=${encodeURIComponent(email)}`);
        return;
      }
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
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 px-4 py-10 sm:py-16">
      <div className="mx-auto w-full max-w-md">
        <div className="mb-8 text-center">
          <Link href="/" className="inline-flex items-center gap-2">
            <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-blue-600 to-blue-800">
              <BookOpen className="h-6 w-6 text-white" />
            </span>
            <span className="text-3xl font-bold text-slate-900">논술 마스터</span>
          </Link>
          <p className="mt-4 text-slate-600">AI 기반 맞춤형 논술 학습 플랫폼</p>
        </div>

        <Card className="bg-white p-6 shadow-xl sm:p-8">
          <h1 className="text-2xl font-bold text-slate-900">로그인</h1>
          <p className="mt-2 text-sm text-slate-500">학습 기록을 이어서 확인해 보세요.</p>

          <form onSubmit={handleLogin} className="mt-6 space-y-4">
            <label className="block text-sm font-medium text-slate-700">
              이메일
              <span className="relative mt-2 block">
                <Mail className="absolute left-3 top-3 h-5 w-5 text-slate-400" />
                <Input type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="your@email.com" className="pl-10" disabled={loginMutation.isPending} />
              </span>
            </label>
            <label className="block text-sm font-medium text-slate-700">
              비밀번호
              <span className="relative mt-2 block">
                <Lock className="absolute left-3 top-3 h-5 w-5 text-slate-400" />
                <Input type="password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="8자 이상" className="pl-10" disabled={loginMutation.isPending} />
              </span>
            </label>
            <Button type="submit" disabled={loginMutation.isPending} className="w-full gap-2 bg-blue-600 hover:bg-blue-700">
              {loginMutation.isPending ? "로그인 중..." : "이메일로 로그인"}
              <ArrowRight className="h-4 w-4" />
            </Button>
          </form>

          <Link href="/forgot-password" className="mt-3 block text-right text-sm font-medium text-blue-600 hover:underline">비밀번호를 잊으셨나요?</Link>

          <div className="relative my-6">
            <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-slate-200" /></div>
            <div className="relative flex justify-center"><span className="bg-white px-3 text-sm text-slate-500">또는</span></div>
          </div>

          <Button onClick={() => startLogin()} variant="outline" className="w-full border-2 border-blue-600 text-blue-600 hover:bg-blue-50">
            Manus 계정으로 로그인
          </Button>
          <div className="mt-3 grid grid-cols-3 gap-2">
            {(["google", "kakao", "naver"] as const).map((provider) => {
              const available = socialProviders.data?.find((item) => item.provider === provider)?.enabled;
              const label = provider === "google" ? "Google" : provider === "kakao" ? "카카오" : "네이버";
              return <Button key={provider} type="button" variant="outline" disabled={!available} onClick={() => { window.location.href = `/api/social/${provider}/start?origin=${encodeURIComponent(window.location.origin)}`; }}>{label}</Button>;
            })}
          </div>
          <p className="mt-2 text-center text-xs text-slate-500">소셜 로그인은 관리자 설정이 완료된 제공자만 활성화됩니다.</p>
          <p className="mt-6 text-center text-sm text-slate-600">
            아직 계정이 없으신가요? <Link href="/signup" className="font-semibold text-blue-600 hover:underline">회원가입</Link>
          </p>
        </Card>
      </div>
    </div>
  );
}
