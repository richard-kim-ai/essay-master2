import { useState } from "react";
import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { Mail, Lock, User, ArrowRight, BookOpen, CheckCircle2 } from "lucide-react";
import { startLogin } from "@/const";
import { trpc } from "@/lib/trpc";

export default function Signup() {
  const [, setLocation] = useLocation();
  const [formData, setFormData] = useState({ name: "", email: "", password: "", confirmPassword: "", agreeTerms: false });
  const signupMutation = trpc.auth.signup.useMutation({
    onSuccess: () => {
      toast.success("인증 메일을 보냈습니다.");
      setLocation(`/verify-email?email=${encodeURIComponent(formData.email)}`);
    },
    onError: (error) => toast.error(error.message || "회원가입에 실패했습니다."),
  });

  const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value, type, checked } = event.target;
    setFormData((current) => ({ ...current, [name]: type === "checkbox" ? checked : value }));
  };

  const handleSignup = (event: React.FormEvent) => {
    event.preventDefault();
    if (!formData.name || !formData.email || !formData.password) return toast.error("모든 필드를 입력해주세요.");
    if (formData.password.length < 8) return toast.error("비밀번호는 8자 이상이어야 합니다.");
    if (formData.password !== formData.confirmPassword) return toast.error("비밀번호가 일치하지 않습니다.");
    if (!formData.agreeTerms) return toast.error("이용약관과 개인정보처리방침에 동의해주세요.");
    signupMutation.mutate({ name: formData.name, email: formData.email, password: formData.password });
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-50 to-green-100 px-4 py-10 sm:py-16">
      <div className="mx-auto w-full max-w-md">
        <div className="mb-8 text-center">
          <Link href="/" className="inline-flex items-center gap-2">
            <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-600 to-green-800"><BookOpen className="h-6 w-6 text-white" /></span>
            <span className="text-3xl font-bold text-slate-900">논술 마스터</span>
          </Link>
          <p className="mt-4 text-slate-600">회원가입 후 이메일 인증을 완료해 주세요.</p>
        </div>

        <Card className="bg-white p-6 shadow-xl sm:p-8">
          <h1 className="text-2xl font-bold text-slate-900">회원가입</h1>
          <p className="mt-2 text-sm text-slate-500">인증이 완료된 계정으로 학습 기록을 안전하게 저장합니다.</p>
          <form onSubmit={handleSignup} className="mt-6 space-y-4">
            <label className="block text-sm font-medium text-slate-700">이름<span className="relative mt-2 block"><User className="absolute left-3 top-3 h-5 w-5 text-slate-400" /><Input name="name" value={formData.name} onChange={handleChange} placeholder="홍길동" className="pl-10" disabled={signupMutation.isPending} /></span></label>
            <label className="block text-sm font-medium text-slate-700">이메일<span className="relative mt-2 block"><Mail className="absolute left-3 top-3 h-5 w-5 text-slate-400" /><Input type="email" name="email" value={formData.email} onChange={handleChange} placeholder="your@email.com" className="pl-10" disabled={signupMutation.isPending} /></span></label>
            <label className="block text-sm font-medium text-slate-700">비밀번호<span className="relative mt-2 block"><Lock className="absolute left-3 top-3 h-5 w-5 text-slate-400" /><Input type="password" name="password" value={formData.password} onChange={handleChange} placeholder="8자 이상" className="pl-10" disabled={signupMutation.isPending} /></span></label>
            <label className="block text-sm font-medium text-slate-700">비밀번호 확인<span className="relative mt-2 block"><Lock className="absolute left-3 top-3 h-5 w-5 text-slate-400" /><Input type="password" name="confirmPassword" value={formData.confirmPassword} onChange={handleChange} placeholder="비밀번호를 다시 입력" className="pl-10" disabled={signupMutation.isPending} /></span></label>
            <label className="flex items-start gap-3 text-sm text-slate-600"><input type="checkbox" name="agreeTerms" checked={formData.agreeTerms} onChange={handleChange} className="mt-1" disabled={signupMutation.isPending} /><span><a href="#" className="text-blue-600 hover:underline">이용약관</a>과 <a href="#" className="text-blue-600 hover:underline">개인정보처리방침</a>에 동의합니다.</span></label>
            <Button type="submit" disabled={signupMutation.isPending} className="w-full gap-2 bg-emerald-600 hover:bg-emerald-700">{signupMutation.isPending ? "가입 중..." : "회원가입"}<ArrowRight className="h-4 w-4" /></Button>
          </form>

          <div className="relative my-6"><div className="absolute inset-0 flex items-center"><div className="w-full border-t border-slate-200" /></div><div className="relative flex justify-center"><span className="bg-white px-3 text-sm text-slate-500">또는</span></div></div>
          <Button onClick={() => startLogin()} variant="outline" className="w-full border-2 border-emerald-600 text-emerald-700 hover:bg-emerald-50">Manus 계정으로 시작하기</Button>
          <p className="mt-6 text-center text-sm text-slate-600">이미 계정이 있으신가요? <Link href="/login" className="font-semibold text-emerald-700 hover:underline">로그인</Link></p>
        </Card>

        <div className="mt-8 space-y-3 text-sm text-slate-700"><div className="flex items-center gap-3"><CheckCircle2 className="h-5 w-5 text-emerald-600" />AI 기반 맞춤형 피드백</div><div className="flex items-center gap-3"><CheckCircle2 className="h-5 w-5 text-emerald-600" />14개 이상의 학습 도구</div><div className="flex items-center gap-3"><CheckCircle2 className="h-5 w-5 text-emerald-600" />이메일 인증으로 안전한 학습 기록</div></div>
      </div>
    </div>
  );
}
