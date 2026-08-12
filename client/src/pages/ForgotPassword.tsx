import { useState } from "react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Mail, ArrowLeft, Send } from "lucide-react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";

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
    <div className="flex min-h-screen items-center justify-center bg-blue-50 p-4">
      <Card className="w-full max-w-md p-6 sm:p-8">
        {sent ? (
          <div className="text-center">
            <Mail className="mx-auto h-14 w-14 text-blue-600" />
            <h1 className="mt-5 text-2xl font-bold text-slate-900">메일을 확인해 주세요</h1>
            <p className="mt-3 text-sm leading-6 text-slate-600">입력한 주소가 가입된 계정이라면 비밀번호 재설정 링크를 보냈습니다. 스팸함도 확인해 주세요.</p>
            <Link href="/login" className="mt-6 inline-flex items-center gap-2 text-sm font-semibold text-blue-600 hover:underline"><ArrowLeft className="h-4 w-4" />로그인으로 돌아가기</Link>
          </div>
        ) : (
          <>
            <Mail className="h-12 w-12 text-blue-600" />
            <h1 className="mt-5 text-2xl font-bold text-slate-900">비밀번호 찾기</h1>
            <p className="mt-2 text-sm leading-6 text-slate-600">가입한 이메일을 입력하면 안전한 재설정 링크를 보내드립니다.</p>
            <form onSubmit={submit} className="mt-6 space-y-4">
              <label className="block text-sm font-medium text-slate-700">이메일<Input type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="your@email.com" className="mt-2" disabled={mutation.isPending} /></label>
              <Button type="submit" disabled={mutation.isPending} className="w-full gap-2 bg-blue-600 hover:bg-blue-700"><Send className="h-4 w-4" />{mutation.isPending ? "보내는 중..." : "재설정 메일 보내기"}</Button>
            </form>
            <Link href="/login" className="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-blue-600 hover:underline"><ArrowLeft className="h-4 w-4" />로그인으로 돌아가기</Link>
          </>
        )}
      </Card>
    </div>
  );
}
