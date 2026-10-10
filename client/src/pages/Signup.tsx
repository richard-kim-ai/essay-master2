import { useState } from "react";
import { Link, useLocation, useSearch } from "wouter";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { Mail, Lock, User, ArrowRight, BookOpen, CheckCircle2, Sparkles } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { PolicyConsentChecklist, type PolicyConsentValue } from "@/components/PolicyConsentChecklist";
import { COURSE_OPTIONS, COURSE_TYPES, type CourseType } from "@shared/course";

export default function Signup() {
  const [, setLocation] = useLocation();
  const search = useSearch();
  // 샘플 체험(/sample)에서 넘어온 경우 둘러본 과정을 그대로 이어서 선택해두고,
  // "저장하고 이어가기" 메시지로 샘플-가입 사이의 연속성을 보여줍니다.
  const searchParams = new URLSearchParams(search);
  const sampleCourseParam = searchParams.get("course");
  const cameFromSample = (COURSE_TYPES as readonly string[]).includes(sampleCourseParam ?? "");
  const sampleAiTried = searchParams.get("aiTried") === "1";
  const sampleCourseLabel = cameFromSample ? COURSE_OPTIONS.find((course) => course.value === sampleCourseParam)?.label : undefined;

  const [formData, setFormData] = useState({ name: "", email: "", password: "", confirmPassword: "" });
  const [accountType, setAccountType] = useState<"student" | "parent">("student");
  const [courseType, setCourseType] = useState<CourseType>(cameFromSample ? (sampleCourseParam as CourseType) : "elementary");
  const [preferredTeacherId, setPreferredTeacherId] = useState("");
  const [consents, setConsents] = useState<PolicyConsentValue[]>([]);
  const socialProviders = trpc.social.providers.useQuery();
  const recommendedTeachers = trpc.auth.recommendedTeachers.useQuery({ courseType }, { enabled: accountType === "student" });
  const signupMutation = trpc.auth.signup.useMutation({
    onSuccess: () => {
      toast.success("인증 메일 보냈습니다.");
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
    if (formData.password !== formData.confirmPassword) return toast.error("비밀번호가 일치하觀 않습니다.");
    if (consents.length === 0) return toast.error("필수 문서를 확인하고 동의해주세요.");
    signupMutation.mutate({ name: formData.name, email: formData.email, password: formData.password, accountType, courseType: accountType === "student" ? courseType : undefined, preferredTeacherId: accountType === "student" && preferredTeacherId ? Number(preferredTeacherId) : undefined, consents });
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
          <h1 className="text-2xl font-bold text-slate-900">샘플가입</h1>
          <p className="mt-2 text-sm text-slate-500">인증이 완료된 계정으로 학습 기록을 안전하게 저장합니다.</p>
          {cameFromSample && (
            <div className="mt-4 flex items-start gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm leading-6 text-emerald-900">
              <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
              <span>
                샘플에서 둘러보신 <strong>{sampleCourseLabel} 논술</strong> 과정으로 바로 시작하도록 미리 선택해 두었습니다.
                {sampleAiTried && " 방금 체험한 AI 첨삭도 가입 후에는 계정에 저장되어 이어볼 수 있어요."}
              </span>
            </div>
          )}
          <form onSubmit={handleSignup} className="mt-6 space-y-4">
            <div className="rounded-xl border border-emerald-100 bg-emerald-50/60 p-3">
              <p className="text-xs font-bold text-emerald-900">가입 유형</p>
              <div className="mt-2 grid grid-cols-2 gap-2">
                <Button type="button" size="sm" variant={accountType === "student" ? "default" : "outline"} className={accountType === "student" ? "bg-emerald-600 hover:bg-emerald-700" : "bg-white"} onClick={() => setAccountType("student")}>학생 회원</Button>
                <Button type="button" size="sm" variant={accountType === "parent" ? "default" : "outline"} className={accountType === "parent" ? "bg-emerald-600 hover:bg-emerald-700" : "bg-white"} onClick={() => setAccountType("parent")}>학부모 회원</Button>
              </div>
              <p className="mt-2 text-[11px] leading-relaxed text-emerald-800">학부모 계정은 연결된 학생의 학습 상황 확인과 코멘트 기능에 사용됩니다.</p>
            </div>
            {accountType === "student" && <><label className="block text-sm font-medium text-slate-700">학습 과정<select value={courseType} onChange={(event) => { setCourseType(event.target.value as CourseType); setPreferredTeacherId(""); }} className="mt-2 h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm outline-none ring-emerald-500 focus:ring-2">{COURSE_OPTIONS.map((course) => <option key={course.value} value={course.value}>{course.label} 논술</option>)}</select><span className="mt-1 block text-[11px] font-normal text-slate-500">로그인 후 선택한 과정의 커리큘럼과 레슨을 기본으로 안내합니다.</span></label><label className="block text-sm font-medium text-slate-700">추천 교사 선택 <span className="font-normal text-slate-400">(선택)</span><select value={preferredTeacherId} onChange={(event) => setPreferredTeacherId(event.target.value)} className="mt-2 h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm outline-none ring-emerald-500 focus:ring-2" disabled={recommendedTeachers.isLoading}><option value="">선택하지 않음 — AI 첨삭 전용 봇 기본 배정</option>{recommendedTeachers.data?.map((teacher) => <option key={teacher.id} value={teacher.id}>{teacher.name} · Level {teacher.teacherLevel}{teacher.courseMatch ? " · 선택 과정 추천" : ""}</option>)}</select><span className="mt-1 block text-[11px] font-normal text-slate-500">교사를 선택하지 않으면 AI 첨삭 전용 봇이 기본 담당으로 지정됩니다.</span></label></>}
            <label className="block text-sm font-medium text-slate-700">이름<span className="relative mt-2 block"><User className="absolute left-3 top-3 h-5 w-5 text-slate-400" /><Input name="name" value={formData.name} onChange={handleChange} placeholder="홍길동" className="pl-10" disabled={signupMutation.isPending} /></span></label>
            <label className="block text-sm font-medium text-slate-700">이메일<span className="relative mt-2 block"><Mail className="absolute left-3 top-3 h-5 w-5 text-slate-400" /><Input type="email" name="email" value={formData.email} onChange={handleChange} placeholder="your@email.com" className="pl-10" disabled={signupMutation.isPending} /></span></label>
            <label className="block text-sm font-medium text-slate-700">비밀번호<span className="relative mt-2 block"><Lock className="absolute left-3 top-3 h-5 w-5 text-slate-400" /><Input type="password" name="password" value={formData.password} onChange={handleChange} placeholder="8자 이상" className="pl-10" disabled={signupMutation.isPending} /></span></label>
            <label className="block text-sm font-medium text-slate-700">비밀번호 확인<span className="relative mt-2 block"><Lock className="absolute left-3 top-3 h-5 w-5 text-slate-400" /><Input type="password" name="confirmPassword" value={formData.confirmPassword} onChange={handleChange} placeholder="비밀번호를 다시 입력" className="pl-10" disabled={signupMutation.isPending} /></span></label>
            <PolicyConsentChecklist accountType={accountType} value={consents} onChange={setConsents} disabled={signupMutation.isPending} />
            <Button type="submit" disabled={signupMutation.isPending} className="w-full gap-2 bg-emerald-600 hover:bg-emerald-700">{signupMutation.isPending ? "가입 중..." : "회원가입"}<ArrowRight className="h-4 w-4" /></Button>
          </form>

          <div className="relative my-6"><div className="absolute inset-0 flex items-center"><div className="w-full border-t border-slate-200" /></div><div className="relative flex justify-center"><span className="bg-white px-3 text-sm text-slate-500">또는</span></div></div>
          <div className="mt-3 grid grid-cols-3 gap-2">{(["google", "kakao", "naver"] as const).map((provider) => { const available = socialProviders.data?.find((item) => item.provider === provider)?.enabled; const label = provider === "google" ? "Google" : provider === "kakao" ? "카카오" : "네이버"; return <Button key={provider} type="button" variant="outline" disabled={!available} onClick={() => { window.location.href = `/api/social/${provider}/start?origin=${encodeURIComponent(window.location.origin)}`; }}>{label}</Button>; })}</div>
          <p className="mt-2 text-center text-xs text-slate-500">소셜 로그인은 관리자 설정이 완료된 제공자만 활성화됩니다.</p>
          <p className="mt-6 text-center text-sm text-slate-600">이미 계정이 있으신가요? <Link href="/login" className="font-semibold text-emerald-700 hover:underline">로그인</Link></p>
        </Card>

        <div className="mt-8 space-y-3 text-sm text-slate-700"><div className="flex items-center gap-3"><CheckCircle2 className="h-5 w-5 text-emerald-600" />AI 기반 맞춤형 피드백</div><div className="flex items-center gap-3"><CheckCircle2 className="h-5 w-5 text-emerald-600" />14개 이상의 학습 도구</div><div className="flex items-center gap-3"><CheckCircle2 className="h-5 w-5 text-emerald-600" />이메일 인증으로 안전한 학습 기록</div></div>
      </div>
    </div>
  );
}
