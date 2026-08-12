import { useMemo, useState } from "react";
import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { KeyRound, CheckCircle2, ArrowRight } from "lucide-react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";

export default function ResetPassword() {
  const [, setLocation] = useLocation();
  const query = useMemo(() => new URLSearchParams(typeof window === "undefined" ? "" : window.location.search), []);
  const token = query.get("token") || "";
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [done, setDone] = useState(false);
  const mutation = trpc.auth.resetPassword.useMutation({
    onSuccess: () => setDone(true),
    onError: (error) => toast.error(error.message || "재설정 링크를 확인해주세요."),
  });

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!token) return toast.error("재설정 링크가 없습니다.");
    if (password.length < 8) return toast.error("비밀번호는 8자 이상이어야 합니다.");
    if (password !== confirm) return toast.error("비밀번호가 일치하지 않습니다.");
    mutation.mutate({ token, password });
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-indigo-50 p-4">
      <Card className="w-full max-w-md p-6 sm:p-8">
        {done ? (
          <div className="text-center"><CheckCircle2 className="mx-auto h-14 w-14 text-emerald-600" /><h1 className="mt-5 text-2xl font-bold text-slate-900">비밀번호 변경 완료</h1><p className="mt-3 text-sm leading-6 text-slate-600">새 비밀번호로 로그인해 주세요.</p><Button onClick={() => setLocation("/login")} className="mt-6 w-full gap-2 bg-indigo-600 hover:bg-indigo-700">로그인하러 가기<ArrowRight className="h-4 w-4" /></Button></div>
        ) : (
          <><KeyRound className="h-12 w-12 text-indigo-600" /><h1 className="mt-5 text-2xl font-bold text-slate-900">새 비밀번호 설정</h1><p className="mt-2 text-sm leading-6 text-slate-600">새 비밀번호를 8자 이상 입력해 주세요.</p><form onSubmit={submit} className="mt-6 space-y-4"><label className="block text-sm font-medium text-slate-700">새 비밀번호<Input type="password" value={password} onChange={(event) => setPassword(event.target.value)} className="mt-2" placeholder="8자 이상" disabled={mutation.isPending} /></label><label className="block text-sm font-medium text-slate-700">새 비밀번호 확인<Input type="password" value={confirm} onChange={(event) => setConfirm(event.target.value)} className="mt-2" placeholder="다시 입력" disabled={mutation.isPending} /></label><Button type="submit" disabled={mutation.isPending} className="w-full bg-indigo-600 hover:bg-indigo-700">{mutation.isPending ? "변경 중..." : "비밀번호 변경"}</Button></form><Link href="/login" className="mt-5 block text-center text-sm font-semibold text-indigo-600 hover:underline">로그인으로 돌아가기</Link></>
        )}
      </Card>
    </div>
  );
}
