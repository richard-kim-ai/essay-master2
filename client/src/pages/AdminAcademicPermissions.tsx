import { useEffect, useMemo, useState } from "react";
import { Link } from "wouter";
import { toast } from "sonner";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { TabsContent } from "@/components/ui/tabs";
import { AcademicApprovalTabs } from "@/components/AcademicApprovalTabs";
import { Award, CheckCircle2, ChevronLeft, GraduationCap, ShieldCheck, SlidersHorizontal, UsersRound } from "lucide-react";

const courseNames: Record<string, string> = {
  elementary: "초등",
  middle_high: "중고등",
  high_univ: "고등/대입",
  general_adult: "일반/직장인",
};

type PermissionForm = {
  teacherId: string;
  scopeType: "organization" | "student";
  organizationName: string;
  studentId: string;
  canManageProgress: boolean;
  canRequestCertificate: boolean;
};

export default function AdminAcademicPermissions() {
  const { user, loading } = useAuth();
  const isAdmin = user?.role === "admin";
  const utils = trpc.useUtils();
  const { data: users = [] } = trpc.admin.getAllUsersMasterAdmin.useQuery(undefined, { enabled: isAdmin });
  const { data: grants = [], isLoading: grantsLoading } = trpc.admin.getTeacherPermissionGrants.useQuery(undefined, { enabled: isAdmin });
  const { data: policies = [] } = trpc.admin.getCertificateApprovalPolicies.useQuery(undefined, { enabled: isAdmin });
  const { data: requests = [] } = trpc.admin.getCertificateApprovalRequests.useQuery(undefined, { enabled: isAdmin });
  const [form, setForm] = useState<PermissionForm>({
    teacherId: "",
    scopeType: "organization",
    organizationName: "",
    studentId: "",
    canManageProgress: true,
    canRequestCertificate: true,
  });
  const [policyDrafts, setPolicyDrafts] = useState<Record<string, { minimumCompletionRate: number; minimumAverageScore: number; teacherReviewRequired: boolean; adminApprovalRequired: boolean; isActive: boolean }>>({});

  const teachers = useMemo(() => users.filter((item) => item.role === "teacher" && item.teacherStatus === "approved"), [users]);
  const students = useMemo(() => users.filter((item) => item.role === "user" && item.tag !== "학부모"), [users]);

  useEffect(() => {
    if (policies.length === 0) return;
    setPolicyDrafts(Object.fromEntries(policies.map((policy) => [policy.courseType, {
      minimumCompletionRate: policy.minimumCompletionRate,
      minimumAverageScore: policy.minimumAverageScore,
      teacherReviewRequired: policy.teacherReviewRequired === 1,
      adminApprovalRequired: policy.adminApprovalRequired === 1,
      isActive: policy.isActive === 1,
    }])));
  }, [policies]);

  const saveGrant = trpc.admin.saveTeacherPermissionGrant.useMutation({
    onSuccess: () => {
      toast.success("교사 관리 권한이 저장되었습니다.");
      setForm({ teacherId: "", scopeType: "organization", organizationName: "", studentId: "", canManageProgress: true, canRequestCertificate: true });
      utils.admin.getTeacherPermissionGrants.invalidate();
    },
    onError: (error) => toast.error(error.message || "권한 저장에 실패했습니다."),
  });
  const toggleGrant = trpc.admin.setTeacherPermissionGrantActive.useMutation({
    onSuccess: () => {
      utils.admin.getTeacherPermissionGrants.invalidate();
      toast.success("권한 상태가 변경되었습니다.");
    },
    onError: (error) => toast.error(error.message || "권한 상태 변경에 실패했습니다."),
  });
  const savePolicy = trpc.admin.saveCertificateApprovalPolicy.useMutation({
    onSuccess: () => {
      utils.admin.getCertificateApprovalPolicies.invalidate();
      toast.success("수료증 공동 승인 조건을 저장했습니다.");
    },
    onError: (error) => toast.error(error.message || "조건 저장에 실패했습니다."),
  });
  const resolveRequest = trpc.admin.resolveCertificateApprovalRequest.useMutation({
    onSuccess: (result) => {
      utils.admin.getCertificateApprovalRequests.invalidate();
      utils.admin.getAllCertificatesAdmin.invalidate();
      toast.success(result.approved ? "최종 승인 후 수료증을 발급했습니다." : "수료증 요청을 반려했습니다.");
    },
    onError: (error) => toast.error(error.message || "요청 처리에 실패했습니다."),
  });

  const handleSaveGrant = () => {
    if (!form.teacherId) return toast.error("권한을 부여할 승인 교사를 선택해주세요.");
    if (form.scopeType === "organization" && !form.organizationName.trim()) return toast.error("조직 또는 학급 이름을 입력해주세요.");
    if (form.scopeType === "student" && !form.studentId) return toast.error("대상 학생을 선택해주세요.");
    if (!form.canManageProgress && !form.canRequestCertificate) return toast.error("진도 또는 수료증 권한을 하나 이상 선택해주세요.");
    saveGrant.mutate({
      teacherId: Number(form.teacherId),
      scopeType: form.scopeType,
      organizationName: form.scopeType === "organization" ? form.organizationName : undefined,
      studentId: form.scopeType === "student" ? Number(form.studentId) : undefined,
      canManageProgress: form.canManageProgress,
      canRequestCertificate: form.canRequestCertificate,
      isActive: true,
    });
  };

  if (loading) return <div className="p-12 text-center text-slate-500">권한을 확인하는 중입니다...</div>;
  if (!isAdmin) return <div className="mx-auto max-w-lg p-12 text-center"><ShieldCheck className="mx-auto mb-3 h-12 w-12 text-amber-500" /><h1 className="text-xl font-bold">관리자 권한이 필요합니다</h1></div>;

  return (
    <div className="min-h-screen bg-slate-50 px-4 py-7 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <Link href="/admin" className="mb-3 inline-flex items-center text-sm font-medium text-slate-600 hover:text-blue-700"><ChevronLeft className="mr-1 h-4 w-4" />관리자 대시보드</Link>
            <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl"><ShieldCheck className="h-7 w-7 text-blue-700" />학습 권한·수료 공동 승인</h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">교사의 진도 관리와 수료증 요청 권한을 조직 또는 학생 단위로 부여하고, 과정별 수료 조건과 교사 검토·관리자 최종 승인 단계를 함께 운영합니다.</p>
          </div>
          <Link href="/admin/certificates"><Button variant="outline" className="gap-2 bg-white"><Award className="h-4 w-4" />수료증 발급 이력</Button></Link>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <Card className="border-blue-100 bg-blue-50/60"><CardContent className="flex items-center gap-3 p-5"><UsersRound className="h-8 w-8 text-blue-700" /><div><p className="text-xs font-semibold text-blue-700">활성 교사 권한</p><p className="text-2xl font-bold text-slate-900">{grants.filter((grant) => grant.isActive === 1).length}건</p></div></CardContent></Card>
          <Card className="border-violet-100 bg-violet-50/60"><CardContent className="flex items-center gap-3 p-5"><GraduationCap className="h-8 w-8 text-violet-700" /><div><p className="text-xs font-semibold text-violet-700">교사 검토 대기</p><p className="text-2xl font-bold text-slate-900">{requests.filter((request) => request.status === "pending_teacher").length}건</p></div></CardContent></Card>
          <Card className="border-emerald-100 bg-emerald-50/60"><CardContent className="flex items-center gap-3 p-5"><CheckCircle2 className="h-8 w-8 text-emerald-700" /><div><p className="text-xs font-semibold text-emerald-700">관리자 최종 승인 대기</p><p className="text-2xl font-bold text-slate-900">{requests.filter((request) => request.status === "pending_admin").length}건</p></div></CardContent></Card>
        </div>

        <AcademicApprovalTabs>

          <TabsContent value="permissions" className="space-y-5">
            <Card><CardHeader><CardTitle>교사 관리 권한 부여</CardTitle><CardDescription>조직 단위는 해당 교사에게 배정된 학생 전체에, 학생 단위는 선택한 한 명에게만 적용됩니다.</CardDescription></CardHeader><CardContent className="grid gap-4 lg:grid-cols-3">
              <label className="text-sm font-medium text-slate-700">승인 교사<select className="mt-1.5 h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm" value={form.teacherId} onChange={(event) => setForm((current) => ({ ...current, teacherId: event.target.value }))}><option value="">교사 선택</option>{teachers.map((teacher) => <option key={teacher.id} value={teacher.id}>{teacher.name || teacher.email} · Level {teacher.teacherLevel || 1}</option>)}</select></label>
              <label className="text-sm font-medium text-slate-700">관리 범위<select className="mt-1.5 h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm" value={form.scopeType} onChange={(event) => setForm((current) => ({ ...current, scopeType: event.target.value as PermissionForm["scopeType"] }))}><option value="organization">조직·학급 단위</option><option value="student">학생 단위</option></select></label>
              {form.scopeType === "organization" ? <label className="text-sm font-medium text-slate-700">조직 또는 학급 이름<Input className="mt-1.5" value={form.organizationName} placeholder="예: 중등 A반" onChange={(event) => setForm((current) => ({ ...current, organizationName: event.target.value }))} /></label> : <label className="text-sm font-medium text-slate-700">대상 학생<select className="mt-1.5 h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm" value={form.studentId} onChange={(event) => setForm((current) => ({ ...current, studentId: event.target.value }))}><option value="">학생 선택</option>{students.map((student) => <option key={student.id} value={student.id}>{student.name || student.email} · {student.tag || "과정 미설정"}</option>)}</select></label>}
              <div className="flex flex-wrap items-center gap-5 lg:col-span-2"><label className="flex items-center gap-2 text-sm font-medium text-slate-700"><input type="checkbox" checked={form.canManageProgress} onChange={(event) => setForm((current) => ({ ...current, canManageProgress: event.target.checked }))} />진도 관리 권한</label><label className="flex items-center gap-2 text-sm font-medium text-slate-700"><input type="checkbox" checked={form.canRequestCertificate} onChange={(event) => setForm((current) => ({ ...current, canRequestCertificate: event.target.checked }))} />수료증 요청·검토 권한</label></div>
              <div className="flex items-end"><Button className="w-full bg-blue-700 hover:bg-blue-800" disabled={saveGrant.isPending} onClick={handleSaveGrant}>{saveGrant.isPending ? "저장 중..." : "권한 부여"}</Button></div>
            </CardContent></Card>
            <Card><CardHeader><CardTitle>부여된 권한 목록</CardTitle><CardDescription>권한을 해제하면 교사 화면과 수료 승인 단계에서 즉시 접근이 차단됩니다.</CardDescription></CardHeader><CardContent className="space-y-3">{grantsLoading ? <p className="py-8 text-center text-sm text-slate-500">권한 목록을 불러오는 중입니다...</p> : grants.length === 0 ? <p className="py-8 text-center text-sm text-slate-500">아직 부여된 교사 권한이 없습니다.</p> : grants.map((grant) => <div key={grant.id} className="flex flex-col gap-3 rounded-xl border border-slate-200 p-4 lg:flex-row lg:items-center lg:justify-between"><div><p className="font-semibold text-slate-900">{grant.teacherName} <span className="text-sm font-normal text-slate-500">· {grant.scopeType === "organization" ? grant.organizationName : `${grant.studentName} (${grant.studentCourseLabel})`}</span></p><p className="mt-1 text-xs text-slate-600">{grant.canManageProgress === 1 ? "진도 관리" : ""}{grant.canManageProgress === 1 && grant.canRequestCertificate === 1 ? " · " : ""}{grant.canRequestCertificate === 1 ? "수료증 요청·검토" : ""}</p></div><Button size="sm" variant={grant.isActive === 1 ? "outline" : "default"} className={grant.isActive === 1 ? "border-rose-200 text-rose-700 hover:bg-rose-50" : "bg-emerald-700 hover:bg-emerald-800"} onClick={() => toggleGrant.mutate({ grantId: grant.id, isActive: grant.isActive !== 1 })}>{grant.isActive === 1 ? "권한 해제" : "다시 활성화"}</Button></div>)}</CardContent></Card>
          </TabsContent>

          <TabsContent value="policies" className="space-y-4">{policies.map((policy) => {
            const draft = policyDrafts[policy.courseType] || { minimumCompletionRate: policy.minimumCompletionRate, minimumAverageScore: policy.minimumAverageScore, teacherReviewRequired: policy.teacherReviewRequired === 1, adminApprovalRequired: policy.adminApprovalRequired === 1, isActive: policy.isActive === 1 };
            const setDraft = (patch: Partial<typeof draft>) => setPolicyDrafts((current) => ({ ...current, [policy.courseType]: { ...draft, ...patch } }));
            return <Card key={policy.id}><CardHeader><CardTitle>{courseNames[policy.courseType]} 과정 수료증 발급 조건</CardTitle><CardDescription>교사 검토와 관리자 최종 승인은 모든 과정에서 필수인 공동 승인 절차이며, 아래 기준만 운영 정책에 맞춰 조정합니다.</CardDescription></CardHeader><CardContent className="grid gap-4 md:grid-cols-2 lg:grid-cols-4"><label className="text-sm font-medium text-slate-700">최소 진도율<Input type="number" min="0" max="100" className="mt-1.5" value={draft.minimumCompletionRate} onChange={(event) => setDraft({ minimumCompletionRate: Number(event.target.value) })} /></label><label className="text-sm font-medium text-slate-700">최소 평균 점수<Input type="number" min="0" max="100" className="mt-1.5" value={draft.minimumAverageScore} onChange={(event) => setDraft({ minimumAverageScore: Number(event.target.value) })} /></label><div className="flex items-end"><div className="w-full rounded-lg border border-violet-100 bg-violet-50 px-3 py-2 text-xs font-semibold text-violet-800">교사 검토 → 관리자 최종 승인 필수</div></div><div className="flex items-end gap-2"><Button className="flex-1 bg-violet-700 hover:bg-violet-800" disabled={savePolicy.isPending} onClick={() => savePolicy.mutate({ courseType: policy.courseType, ...draft, teacherReviewRequired: true, adminApprovalRequired: true })}>조건 저장</Button><Button size="sm" variant="outline" className={draft.isActive ? "text-rose-700" : "text-emerald-700"} onClick={() => setDraft({ isActive: !draft.isActive })}>{draft.isActive ? "비활성" : "활성"}</Button></div></CardContent></Card>;
          })}</TabsContent>

          <TabsContent value="approvals"><Card><CardHeader><CardTitle>수료증 공동 승인 요청</CardTitle><CardDescription>교사가 검토한 요청만 관리자 최종 승인 후 실제 수료증으로 발급됩니다.</CardDescription></CardHeader><CardContent className="space-y-3">{requests.length === 0 ? <p className="py-10 text-center text-sm text-slate-500">현재 공동 승인 요청이 없습니다.</p> : requests.map((request) => <div key={request.id} className="flex flex-col gap-3 rounded-xl border border-slate-200 p-4 lg:flex-row lg:items-center lg:justify-between"><div><p className="font-semibold text-slate-900">{request.studentName} · {request.courseLabel} {request.level ? `Level ${request.level}` : ""}</p><p className="mt-1 text-xs text-slate-600">진도 {request.evidenceCompletionRate}% · 평균 {request.evidenceAverageScore}점 · 요청 교사 {request.requestedByName}</p><p className="mt-1 text-xs font-medium text-violet-700">{request.status === "pending_teacher" ? "교사 검토 대기" : request.status === "pending_admin" ? "관리자 최종 승인 대기" : request.status === "approved" ? "발급 완료" : "반려됨"}</p></div>{request.status === "pending_admin" && <div className="flex gap-2"><Button size="sm" variant="outline" className="border-rose-200 text-rose-700 hover:bg-rose-50" onClick={() => resolveRequest.mutate({ requestId: request.id, approved: false, note: "관리자 검토 후 발급 조건 미충족" })}>반려</Button><Button size="sm" className="bg-emerald-700 hover:bg-emerald-800" onClick={() => resolveRequest.mutate({ requestId: request.id, approved: true })}>최종 승인·발급</Button></div>}</div>)}</CardContent></Card></TabsContent>
        </AcademicApprovalTabs>
      </div>
    </div>
  );
}
