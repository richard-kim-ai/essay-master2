import { useEffect, useMemo, useState } from "react";
import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { MailCheck, Loader2, RefreshCw, ArrowRight } from "lucide-react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";

export default function VerifyEmail() {
  const [, setLocation] = useLocation();
  const query = useMemo(() => new URLSearchParams(typeof window === "undefined" ? "" : window.location.search), []);
  const token = query.get("token") || "";
  const [email, setEmail] = useState(query.get("email") || "");
  const [verified, setVerified] = useState(false);
  const [checked, setChecked] = useState(!token);
  const verifyMutation = trpc.auth.verifyEmail.useMutation({
    onSuccess: () => {
      setVerified(true);
      setChecked(true);
      toast.success("이메일 인증이 완료되었습니다.");
    },
    onError: (error) => {
      setChecked(true);
      toast.error(error.message || "인증 링크를 확인해주세요.");
    },
  });
  const resendMutation = trpc.auth.resendVerification.useMutation({
    onSuccess: () => toast.success("인증 메일을 다시 보냈습니다."),
    onError: (error) => toast.error(error.message || "인증 메일을 보내지 못했습니다."),
  });

  useEffect(() => {
    if (token) verifyMutation.mutate({ token });
  }, [token]);

  const resend = (event: React.FormEvent) => {
    event.preventDefault();
    if (!email) {
      toast.error("가입한 이메일을 입력해주세요.");
      return;
    }
    resendMutation.mutate({ email });
  };

  if (token && !checked) {
    return <div className="flex min-h-screen items-center justify-center bg-slate-50 p-4"><Card className="w-full max-w-md p-8 text-center"><Loader2 className="mx-auto h-10 w-10 animate-spin text-blue-600" /><p className="mt-4 font-medium text-slate-800">이메일 인증을 확인하고 있습니다.</p></Card></div>;
  }

  if (verified) {
    return <div className="flex min-h-screen items-center justify-center bg-emerald-50 p-4"><Card className="w-full max-w-md p-8 text-center"><MailCheck className="mx-auto h-14 w-14 text-emerald-600" /><h1 className="mt-5 text-2xl font-bold text-slate-900">인증 완료</h1><p className="mt-2 text-slate-600">이제 로그인하고 논술 학습을 시작할 수 있습니다.</p><Button onClick={() => setLocation("/login")} className="mt-6 w-full gap-2 bg-emerald-600 hover:bg-emerald-700">로그인하러 가기<ArrowRight className="h-4 w-4" /></Button></Card></div>;
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-blue-50 p-4">
      <Card className="w-full max-w-md p-6 sm:p-8">
        <MailCheck className="h-12 w-12 text-blue-600" />
        <h1 className="mt-5 text-2xl font-bold text-slate-900">이메일을 인증해 주세요</h1>
        <p className="mt-2 text-sm leading-6 text-slate-600">가입을 완료하려면 이메일의 인증 링크를 눌러 주세요. 메일이 보이지 않으면 스팸함도 확인해 주세요.</p>
        <form onSubmit={resend} className="mt-6 space-y-3">
          <label className="block text-sm font-medium text-slate-700">가입한 이메일<Input type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="your@email.com" className="mt-2" /></label>
          <Button type="submit" disabled={resendMutation.isPending} className="w-full gap-2 bg-blue-600 hover:bg-blue-700"><RefreshCw className="h-4 w-4" />{resendMutation.isPending ? "발송 중..." : "인증 메일 다시 보내기"}</Button>
        </form>
        <Link href="/login" className="mt-5 block text-center text-sm font-medium text-blue-600 hover:underline">로그인으로 돌아가기</Link>
      </Card>
    </div>
  );
}
