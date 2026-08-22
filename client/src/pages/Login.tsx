import { useState } from "react";
import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { Mail, Lock, ArrowRight, BookOpen } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { TermsAndPrivacyModal } from "@/components/TermsAndPrivacyModal";

export default function Login() {
  const [, setLocation] = useLocation();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [modalType, setModalType] = useState<"terms" | "privacy" | null>(null);

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
              <Link href="/forgot-password" className="text-slate-500 hover:underline">비밀번호 찾기</Link>
            </div>

            <Button type="submit" className="w-full bg-blue-600 hover:bg-blue-700" disabled={loginMutation.isPending}>
              {loginMutation.isPending ? "로그인 중..." : "이메일 로그인"} <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </form>

          <div className="relative my-6">
            <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-slate-200" /></div>
            <div className="relative flex justify-center"><span className="bg-white px-3 text-sm text-slate-500">또는</span></div>
          </div>

          <div className="space-y-3">
            <div className="rounded-xl bg-gradient-to-r from-indigo-50 to-purple-50 p-3.5 border border-indigo-100 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-indigo-900 flex items-center gap-1.5">
                  ✨ 원클릭 샘플 체험 모드
                </span>
                <span className="text-[10px] bg-indigo-200/60 text-indigo-800 px-2 py-0.5 rounded-full font-semibold">로그인 없이 전체 체험</span>
              </div>
              <p className="text-[11px] text-slate-600">아이디 입력 없이 학생 또는 교사 샘플 권한으로 커리큘럼, 대시보드, 퀴즈와 수료증을 체험해보세요.</p>
              <div className="grid grid-cols-2 gap-2 pt-1">
                <Button
                  size="sm"
                  type="button"
                  className="bg-blue-600 hover:bg-blue-700 text-white text-[11px] h-8 px-1"
                  onClick={() => {
                    setEmail("student@sample.com");
                    setPassword("sample1234");
                    loginMutation.mutate({ email: "student@sample.com", password: "sample1234" });
                  }}
                >
                  🎓 학생 샘플
                </Button>
                <Button
                  size="sm"
                  type="button"
                  className="bg-indigo-600 hover:bg-indigo-700 text-white text-[11px] h-8 px-1"
                  onClick={() => {
                    setEmail("teacher@sample.com");
                    setPassword("sample1234");
                    loginMutation.mutate({ email: "teacher@sample.com", password: "sample1234" });
                  }}
                >
                  👩‍🏫 교사 샘플
                </Button>
              </div>
            </div>
          </div>
          <div className="mt-3 grid grid-cols-3 gap-2">
            {(["google", "kakao", "naver"] as const).map((provider) => {
              const available = socialProviders.data?.find((item) => item.provider === provider)?.enabled;
              const label = provider === "google" ? "Google" : provider === "kakao" ? "카카오" : "네이버";
              return <Button key={provider} type="button" variant="outline" disabled={!available} onClick={() => { window.location.href = `/api/social/${provider}/start?origin=${encodeURIComponent(window.location.origin)}`; }}>{label}</Button>;
            })}
          </div>
          <p className="mt-2 text-center text-xs text-slate-500">소셜 로그인은 관리자 설정이 완료된 제공자만 활성화됩니다.</p>
          <div className="mt-6 space-y-3">
            <p className="text-center text-xs font-semibold text-slate-500 uppercase tracking-wider">아직 계정이 없으신가요?</p>
            <div className="grid grid-cols-2 gap-3">
              <Link href="/signup" className="flex items-center justify-center rounded-xl bg-blue-50 border border-blue-200 py-2.5 text-xs font-bold text-blue-700 hover:bg-blue-100 transition shadow-sm">
                🎓 학생 회원가입
              </Link>
              <Link href="/teacher-signup" className="flex items-center justify-center rounded-xl bg-indigo-50 border border-indigo-200 py-2.5 text-xs font-bold text-indigo-700 hover:bg-indigo-100 transition shadow-sm">
                👩‍🏫 교사 회원가입
              </Link>
            </div>
          </div>

          <div className="mt-6 border-t border-slate-100 pt-4 text-center text-xs text-slate-400 flex justify-center gap-4">
            <button type="button" onClick={() => setModalType("terms")} className="hover:text-slate-600 hover:underline">이용약관</button>
            <span>·</span>
            <button type="button" onClick={() => setModalType("privacy")} className="hover:text-slate-600 hover:underline">개인정보처리방침</button>
          </div>
        </Card>
      </div>
      <TermsAndPrivacyModal type={modalType} onClose={() => setModalType(null)} />
    </div>
  );
}
