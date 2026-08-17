import { useEffect, useMemo, useState } from "react";
import { Link } from "wouter";
import { Bot, CheckCircle2, ChevronLeft, FileCheck2, Save, ShieldCheck, Sparkles, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";

const toneLabels = { encouraging: "격려 중심", balanced: "균형형", direct: "직설·정밀형" } as const;

export default function AdminAIGovernance() {
  const utils = trpc.useUtils();
  const { data, isLoading, error } = trpc.aiGovernance.overview.useQuery();
  const [teacherId, setTeacherId] = useState<string>("");
  const [form, setForm] = useState({ displayName: "", tone: "balanced" as keyof typeof toneLabels, feedbackFocus: "논리·근거·표현의 균형", styleInstruction: "", forbiddenPhrases: "", isEnabled: false });

  const selectedTeacher = useMemo(() => data?.teachers.find((teacher) => String(teacher.id) === teacherId), [data?.teachers, teacherId]);
  const selectedProfile = useMemo(() => data?.profiles.find((profile) => String(profile.teacherId) === teacherId), [data?.profiles, teacherId]);

  useEffect(() => {
    if (!teacherId && data?.teachers[0]) setTeacherId(String(data.teachers[0].id));
  }, [data?.teachers, teacherId]);

  useEffect(() => {
    if (!selectedTeacher) return;
    let forbiddenPhrases = "";
    try { forbiddenPhrases = selectedProfile?.forbiddenPhrases ? JSON.parse(selectedProfile.forbiddenPhrases).join(", ") : ""; } catch { forbiddenPhrases = ""; }
    setForm({
      displayName: selectedProfile?.displayName ?? `${selectedTeacher.name ?? "첨삭교사"} AI 보조 봇`,
      tone: (selectedProfile?.tone ?? "balanced") as keyof typeof toneLabels,
      feedbackFocus: selectedProfile?.feedbackFocus ?? "논리·근거·표현의 균형",
      styleInstruction: selectedProfile?.styleInstruction ?? "학생의 답안에서 확인되는 근거만 인용하고, 개선 방향을 우선순위별로 제안합니다.",
      forbiddenPhrases,
      isEnabled: selectedProfile?.isEnabled === 1,
    });
  }, [selectedTeacher, selectedProfile]);

  const saveProfile = trpc.aiGovernance.saveProfile.useMutation({
    onSuccess: () => { toast.success("교사별 AI 보조 봇 프로필을 저장했습니다. 교사 승인 전에는 학생에게 자동 발송되지 않습니다."); utils.aiGovernance.overview.invalidate(); },
    onError: (err) => toast.error(err.message || "프로필 저장에 실패했습니다."),
  });
  const updateExample = trpc.aiGovernance.updateStyleExampleStatus.useMutation({
    onSuccess: () => { toast.success("승인 사례 상태를 변경했습니다."); utils.aiGovernance.overview.invalidate(); },
    onError: (err) => toast.error(err.message || "상태 변경에 실패했습니다."),
  });

  if (isLoading) return <div className="mx-auto max-w-6xl p-8 text-center text-slate-500">AI 보조 봇 운영 정보를 불러오는 중입니다…</div>;
  if (error) return <div className="mx-auto max-w-6xl p-8 text-center text-rose-600">관리자 권한이 필요하거나 정보를 불러오지 못했습니다.</div>;

  return <div className="mx-auto max-w-6xl space-y-6 px-4 py-6">
    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
      <div>
        <Link href="/admin"><Button variant="ghost" size="sm" className="-ml-2 gap-1 text-slate-600"><ChevronLeft className="h-4 w-4" />관리자 대시보드</Button></Link>
        <h1 className="mt-2 text-2xl font-bold text-slate-900">교사별 AI 보조 봇 운영 설계</h1>
        <p className="mt-1 max-w-3xl text-sm leading-relaxed text-slate-600">교사가 승인한 스타일 지침과 가명 처리된 사례만 AI 초안에 반영합니다. 모든 AI 초안은 교사 검토·수정·승인 후에만 학생에게 전달되어야 합니다.</p>
      </div>
      <Link href="/admin/terms"><Button variant="outline" className="gap-2"><ShieldCheck className="h-4 w-4" />동의·정책 문안 관리</Button></Link>
    </div>

    <div className="grid gap-4 sm:grid-cols-3">
      <Card><CardContent className="flex items-center gap-3 p-4"><div className="rounded-xl bg-indigo-50 p-2.5"><Bot className="h-5 w-5 text-indigo-600" /></div><div><p className="text-xs text-slate-500">활성 AI 보조 봇</p><p className="text-xl font-bold">{data?.profiles.filter((profile) => profile.isEnabled === 1).length ?? 0}</p></div></CardContent></Card>
      <Card><CardContent className="flex items-center gap-3 p-4"><div className="rounded-xl bg-emerald-50 p-2.5"><Users className="h-5 w-5 text-emerald-600" /></div><div><p className="text-xs text-slate-500">승인된 첨삭교사</p><p className="text-xl font-bold">{data?.teachers.length ?? 0}</p></div></CardContent></Card>
      <Card><CardContent className="flex items-center gap-3 p-4"><div className="rounded-xl bg-amber-50 p-2.5"><FileCheck2 className="h-5 w-5 text-amber-600" /></div><div><p className="text-xs text-slate-500">승인 대기 사례</p><p className="text-xl font-bold">{data?.styleExamples.filter((item) => item.approvalStatus === "draft" || item.approvalStatus === "teacher_approved").length ?? 0}</p></div></CardContent></Card>
    </div>

    <Tabs defaultValue="profiles" className="space-y-4">
      <TabsList className="grid w-full grid-cols-4 sm:max-w-2xl"><TabsTrigger value="profiles">교사 프로필</TabsTrigger><TabsTrigger value="examples">승인 사례</TabsTrigger><TabsTrigger value="policy">동의 정책</TabsTrigger><TabsTrigger value="audit">감사 이력</TabsTrigger></TabsList>
      <TabsContent value="profiles">
        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2"><Sparkles className="h-5 w-5 text-indigo-600" />교사별 첨삭 스타일 프로필</CardTitle><CardDescription>스타일은 AI 초안의 어조와 평가 순서를 조정할 뿐, 검증되지 않은 사실·점수·개인정보를 생성해서는 안 됩니다.</CardDescription></CardHeader>
          <CardContent className="space-y-5">
            {data?.teachers.length ? <>
              <div className="grid gap-4 md:grid-cols-2"><div className="space-y-2"><Label>첨삭교사</Label><Select value={teacherId} onValueChange={setTeacherId}><SelectTrigger><SelectValue placeholder="교사를 선택하세요" /></SelectTrigger><SelectContent>{data.teachers.map((teacher) => <SelectItem key={teacher.id} value={String(teacher.id)}>{teacher.name || teacher.email || `교사 #${teacher.id}`} · Level {teacher.teacherLevel}</SelectItem>)}</SelectContent></Select></div><div className="space-y-2"><Label>보조 봇 이름</Label><Input value={form.displayName} onChange={(event) => setForm({ ...form, displayName: event.target.value })} /></div></div>
              <div className="grid gap-4 md:grid-cols-2"><div className="space-y-2"><Label>피드백 어조</Label><Select value={form.tone} onValueChange={(tone) => setForm({ ...form, tone: tone as keyof typeof toneLabels })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{Object.entries(toneLabels).map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}</SelectContent></Select></div><div className="space-y-2"><Label>우선 평가 영역</Label><Input value={form.feedbackFocus} onChange={(event) => setForm({ ...form, feedbackFocus: event.target.value })} /></div></div>
              <div className="space-y-2"><Label>교사 스타일 지침</Label><Textarea rows={5} value={form.styleInstruction} onChange={(event) => setForm({ ...form, styleInstruction: event.target.value })} placeholder="예: 주장과 근거의 연결을 먼저 확인하고, 따뜻하지만 구체적인 개선 문장으로 제안합니다." /></div>
              <div className="space-y-2"><Label>사용 금지 표현 <span className="font-normal text-slate-400">쉼표로 구분</span></Label><Input value={form.forbiddenPhrases} onChange={(event) => setForm({ ...form, forbiddenPhrases: event.target.value })} placeholder="무조건, 완벽함, 합격 보장" /></div>
              <div className="flex flex-col gap-3 rounded-xl border border-indigo-100 bg-indigo-50/60 p-4 sm:flex-row sm:items-center sm:justify-between"><div><p className="font-semibold text-indigo-950">AI 초안 생성 활성화</p><p className="mt-1 text-xs leading-relaxed text-indigo-800">켜더라도 AI는 교사 검토 전 학생에게 직접 발송되지 않습니다. 프로필 버전 {selectedProfile?.currentVersion ?? 0}</p></div><Switch checked={form.isEnabled} onCheckedChange={(isEnabled) => setForm({ ...form, isEnabled })} /></div>
              <div className="flex justify-end"><Button className="gap-2 bg-indigo-600 hover:bg-indigo-700" disabled={saveProfile.isPending || !selectedTeacher} onClick={() => selectedTeacher && saveProfile.mutate({ teacherId: selectedTeacher.id, displayName: form.displayName, tone: form.tone, feedbackFocus: form.feedbackFocus, styleInstruction: form.styleInstruction, forbiddenPhrases: form.forbiddenPhrases.split(",").map((item) => item.trim()).filter(Boolean), isEnabled: form.isEnabled })}><Save className="h-4 w-4" />{saveProfile.isPending ? "저장 중…" : "프로필 버전 저장"}</Button></div>
            </> : <p className="rounded-xl bg-slate-50 p-8 text-center text-sm text-slate-500">승인된 첨삭교사가 등록되면 교사별 AI 보조 봇 프로필을 만들 수 있습니다.</p>}
          </CardContent>
        </Card>
      </TabsContent>
      <TabsContent value="examples"><Card><CardHeader><CardTitle>가명 처리된 승인 사례</CardTitle><CardDescription>원본 학생 식별자는 표시하지 않습니다. 교사 승인 후 관리자 검수를 거쳐서만 AI 스타일 참조 또는 품질 평가 후보로 사용합니다.</CardDescription></CardHeader><CardContent className="space-y-3">{data?.styleExamples.length ? data.styleExamples.map((example) => <div key={example.id} className="rounded-xl border border-slate-200 p-4"><div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between"><div><p className="text-sm font-semibold text-slate-800">교사 #{example.teacherId} · {example.purpose}</p><p className="mt-2 line-clamp-2 text-xs leading-relaxed text-slate-600">{example.pseudonymizedPrompt}</p></div><Select value={example.approvalStatus} onValueChange={(status) => updateExample.mutate({ exampleId: example.id, status: status as "draft" | "teacher_approved" | "admin_approved" | "rejected" | "withdrawn" })}><SelectTrigger className="w-40"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="draft">초안</SelectItem><SelectItem value="teacher_approved">교사 승인</SelectItem><SelectItem value="admin_approved">관리자 승인</SelectItem><SelectItem value="rejected">반려</SelectItem><SelectItem value="withdrawn">철회</SelectItem></SelectContent></Select></div></div>) : <p className="rounded-xl bg-slate-50 p-8 text-center text-sm text-slate-500">아직 등록된 가명 처리 사례가 없습니다. 교사가 자신의 첨삭 사례를 등록하고 승인할 수 있도록 교사 포털을 연동합니다.</p>}</CardContent></Card></TabsContent>
      <TabsContent value="policy"><Card><CardHeader><CardTitle>가입 동의 및 데이터 처리 정책</CardTitle><CardDescription>필수 문서는 가입 전에 전문 확인 후 동의하도록 설계되어 있습니다. AI 품질 개선 데이터 활용은 선택 동의이며, 원본 답안은 자동 학습 데이터가 아닙니다.</CardDescription></CardHeader><CardContent className="space-y-3">{data?.policies.map((policy) => <div key={policy.id} className="flex items-center justify-between rounded-xl border border-slate-200 p-4"><div><p className="font-semibold text-slate-800">{policy.title} <span className="text-xs font-normal text-slate-400">v{policy.version}</span></p><p className="mt-1 text-xs text-slate-500">대상: {policy.requiredForRoles} · {policy.isRequired ? "필수 동의" : "선택 동의"}</p></div>{policy.isRequired ? <CheckCircle2 className="h-5 w-5 text-emerald-600" /> : <span className="rounded-full bg-slate-100 px-2 py-1 text-xs text-slate-600">선택</span>}</div>)}</CardContent></Card></TabsContent>
      <TabsContent value="audit"><Card><CardHeader><CardTitle>동의·권리 행사 감사 이력</CardTitle><CardDescription>정책 버전별 동의 상태와 열람·정정·AI 개선 철회·삭제 요청을 관리자 권한으로 조회합니다. 요청 처리 기능은 담당자 검토 후 별도 이력으로 완료해야 합니다.</CardDescription></CardHeader><CardContent className="space-y-6"><div><p className="mb-2 text-sm font-semibold text-slate-800">최근 동의 이력</p>{data?.consentAudit.length ? <div className="overflow-x-auto rounded-xl border border-slate-200"><table className="w-full min-w-[600px] text-left text-xs"><thead className="bg-slate-50 text-slate-500"><tr><th className="p-3">사용자</th><th className="p-3">문서·버전</th><th className="p-3">상태</th><th className="p-3">확인 시각</th></tr></thead><tbody>{data.consentAudit.slice(0, 20).map((consent) => <tr key={consent.id} className="border-t border-slate-100"><td className="p-3">#{consent.userId}</td><td className="p-3">{consent.policyKey}<br /><span className="text-slate-400">v{consent.policyVersion}</span></td><td className="p-3"><span className={consent.status === "accepted" ? "text-emerald-700" : "text-amber-700"}>{consent.status === "accepted" ? "동의" : "철회"}</span></td><td className="p-3">{new Date(consent.updatedAt).toLocaleString("ko-KR")}</td></tr>)}</tbody></table></div> : <p className="rounded-xl bg-slate-50 p-4 text-sm text-slate-500">가입 동의 이력이 아직 없습니다.</p>}</div><div><p className="mb-2 text-sm font-semibold text-slate-800">최근 정보주체 요청</p>{data?.dataRequests.length ? <div className="space-y-2">{data.dataRequests.slice(0, 10).map((request) => <div key={request.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-200 p-3 text-xs"><span>사용자 #{request.userId} · {request.requestType}</span><span className="rounded-full bg-slate-100 px-2 py-1 text-slate-700">{request.status}</span></div>)}</div> : <p className="rounded-xl bg-slate-50 p-4 text-sm text-slate-500">접수된 권리 행사 요청이 없습니다.</p>}</div></CardContent></Card></TabsContent>
    </Tabs>
  </div>;
}
