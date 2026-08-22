import { useState } from "react";
import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Mail, Lock, User, ArrowRight, GraduationCap, CheckCircle2 } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { PolicyConsentChecklist, type PolicyConsentValue } from "@/components/PolicyConsentChecklist";

export default function TeacherSignup() {
  const [, setLocation] = useLocation();
  const [formData, setFormData] = useState({ name: "", email: "", password: "", confirmPassword: "" });
  const [consents, setConsents] = useState<PolicyConsentValue[]>([]);
  const signupMutation = trpc.auth.teacherSignup.useMutation({
    onSuccess: () => {
      toast.success("교사회원 가입 신청이 완료되었습니다. 이메일 인증을 진행해주세요.");
      setLocation(`/verify-email?email=${encodeURIComponent(formData.email)}`);
    },
    onError: (error) => toast.error(error.message || "교사 회원가입에 실패했습니다."),
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
    if (consents.length === 0) return toast.error("필수 문서를 확인하고 동의해주세요.");
    signupMutation.mutate({ name: formData.name, email: formData.email, password: formData.password, teacherLevel: 1, consents });
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 to-blue-100 px-4 py-10 sm:py-16">
      <div className="mx-auto w-full max-w-md">
        <div className="mb-8 text-center">
          <Link href="/" className="inline-flex items-center gap-2">
            <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-600 to-blue-800"><GraduationCap className="h-6 w-6 text-white" /></span>
            <span className="text-3xl font-bold text-slate-900">논술 마스터 교사포털</span>
          </Link>
          <p className="mt-4 text-slate-600">첨삭 지도 및 학생 관리 권한을 위한 교사회원 가입</p>
        </div>

        <Card className="bg-white p-6 shadow-xl sm:p-8">
          <h1 className="text-2xl font-bold text-slate-900">교사 회원가입</h1>
          <p className="mt-2 text-sm text-slate-500">담당 교사 권한 레벨을 선택하고 학생 지도를 시작하세요.</p>
          <form onSubmit={handleSignup} className="mt-6 space-y-4">
            <label className="block text-sm font-medium text-slate-700">이름<span className="relative mt-2 block"><User className="absolute left-3 top-3 h-5 w-5 text-slate-400" /><Input name="name" value={formData.name} onChange={handleChange} placeholder="김선생" className="pl-10" disabled={signupMutation.isPending} /></span></label>
            <label className="block text-sm font-medium text-slate-700">이메일<span className="relative mt-2 block"><Mail className="absolute left-3 top-3 h-5 w-5 text-slate-400" /><Input type="email" name="email" value={formData.email} onChange={handleChange} placeholder="teacher@school.edu" className="pl-10" disabled={signupMutation.isPending} /></span></label>
            <label className="block text-sm font-medium text-slate-700">비밀번호<span className="relative mt-2 block"><Lock className="absolute left-3 top-3 h-5 w-5 text-slate-400" /><Input type="password" name="password" value={formData.password} onChange={handleChange} placeholder="8자 이상" className="pl-10" disabled={signupMutation.isPending} /></span></label>
            <label className="block text-sm font-medium text-slate-700">비밀번호 확인<span className="relative mt-2 block"><Lock className="absolute left-3 top-3 h-5 w-5 text-slate-400" /><Input type="password" name="confirmPassword" value={formData.confirmPassword} onChange={handleChange} placeholder="비밀번호 재입력" className="pl-10" disabled={signupMutation.isPending} /></span></label>
            <div className="rounded-lg bg-indigo-50/60 p-3 text-xs text-indigo-900 border border-indigo-100 space-y-1">
              <p className="font-bold">💡 교사 권한 레벨 안내</p>
              <p className="text-slate-600">교사회원 가입 신청 후 <strong>관리자 승인 과정</strong>에서 권한 레벨(Level 1~3)이 최종 배정됩니다.</p>
            </div>
            <PolicyConsentChecklist accountType="teacher" value={consents} onChange={setConsents} disabled={signupMutation.isPending} />
            <Button type="submit" disabled={signupMutation.isPending} className="w-full gap-2 bg-indigo-600 hover:bg-indigo-700">{signupMutation.isPending ? "가입 중..." : "교사회원 가입 신청"}<ArrowRight className="h-4 w-4" /></Button>
          </form>

          <p className="mt-6 text-center text-sm text-slate-600">이미 교사 계정이 있으신가요? <Link href="/login" className="font-semibold text-indigo-700 hover:underline">로그인</Link></p>
        </Card>

        <div className="mt-8 space-y-3 text-sm text-slate-700"><div className="flex items-center gap-3"><CheckCircle2 className="h-5 w-5 text-indigo-600" />담당 학생 논술 실시간 모니터링</div><div className="flex items-center gap-3"><CheckCircle2 className="h-5 w-5 text-indigo-600" />문장별 상세 첨삭 및 점수 부여</div><div className="flex items-center gap-3"><CheckCircle2 className="h-5 w-5 text-indigo-600" />레벨별 권한에 따른 맞춤 관리</div></div>
      </div>
    </div>
  );
}
