import { useState } from "react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Mail, ArrowLeft, Send } from "lucide-react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import AuthLayout from "@/components/AuthLayout";

export default function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const mutation = trpc.auth.requestPasswordReset.useMutation({
    onSuccess: () => setSent(true),
    onError: (error) => toast.error(error.message || "메일을 보내지 못했습니다."),
  });

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!email) {
      toast.error("가입한 이메일을 입력해주세요.");
      return;
    }
    mutation.mutate({ email, origin: window.location.origin });
  };

  return (
    <AuthLayout>
      <Card className="w-full max-w-md p-6 sm:p-8">
        {sent ? (
          <div className="text-center">
            <Mail className="mx-auto h-14 w-14 text-indigo-600" />
            <h1 className="mt-5 text-2xl font-bold text-slate-900">메일을 확인해 주세요</h1>
            <p className="mt-3 text-sm leading-6 text-slate-600">입력한 주소가 가입된 계정이라면 비밀번호 재설정 링크를 보냈습니다. 링크는 1시간 동안 유효합니다.</p>
            <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-4 text-left text-sm leading-6 text-slate-600">
              <p className="font-semibold text-slate-800">메일이 오지 않나요?</p>
              <ul className="mt-1 list-disc space-y-0.5 pl-5">
                <li>스팸함·프로모션함을 확인해 주세요.</li>
                <li>가입할 때 사용한 이메일 주소가 맞는지 확인해 주세요.</li>
                <li>10분이 지나도 오지 않으면 잠시 후 다시 요청해 주세요(1시간에 3번까지 요청할 수 있습니다).</li>
                <li>계속 받지 못하면 관리자에게 문의해 주세요. 메일 발송 점검 중일 수 있습니다.</li>
              </ul>
            </div>
            <Link href="/login" className="mt-6 inline-flex items-center gap-2 text-sm font-semibold text-indigo-600 hover:underline"><ArrowLeft className="h-4 w-4" />로그인으로 돌아가기</Link>
          </div>
        ) : (
          <>
            <Mail className="h-12 w-12 text-indigo-600" />
            <h1 className="mt-5 text-2xl font-bold text-slate-900">비밀번호 찾기</h1>
            <p className="mt-2 text-sm leading-6 text-slate-600">가입한 이메일을 입력하면 안전한 재설정 링크를 보내드립니다.</p>
            <form onSubmit={submit} className="mt-6 space-y-4">
              <label className="block text-sm font-medium text-slate-700">이메일<Input type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="your@email.com" className="mt-2" disabled={mutation.isPending} /></label>
              <Button type="submit" disabled={mutation.isPending} className="w-full gap-2 bg-indigo-600 hover:bg-indigo-700"><Send className="h-4 w-4" />{mutation.isPending ? "보내는 중..." : "재설정 메일 보내기"}</Button>
            </form>
            <Link href="/login" className="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-indigo-600 hover:underline"><ArrowLeft className="h-4 w-4" />로그인으로 돌아가기</Link>
          </>
        )}
      </Card>
    </AuthLayout>
  );
}
