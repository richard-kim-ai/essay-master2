import React, { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { trpc } from "@/lib/trpc";
import { BUDGET_TYPES, budgetRemaining, type BudgetType } from "@shared/institution";

const STATUS = {
  draft: { label: "준비 중", style: "bg-slate-200 text-slate-700" },
  active: { label: "이용 중", style: "bg-emerald-100 text-emerald-900" },
  suspended: { label: "일시 중지", style: "bg-amber-100 text-amber-900" },
  closed: { label: "종료", style: "bg-slate-200 text-slate-700" },
} as const;

const dateLabel = (value: Date | string) => new Date(value).toLocaleDateString("ko-KR", { timeZone: "Asia/Seoul" });
// 날짜 입력(YYYY-MM-DD)은 한국 시간 0시로 본다. 종료일은 그 0시 직전까지(끝 시각은 포함하지 않음)다.
const kstStart = (value: string) => new Date(`${value}T00:00:00+09:00`);

function Pill({ label, style }: { label: string; style: string }) {
  return <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-semibold ${style}`}>{label}</span>;
}

function BudgetCell({ limit, used }: { limit: number; used: number }) {
  const percent = limit > 0 ? Math.min(100, Math.round((used / limit) * 100)) : 0;
  const remaining = budgetRemaining(limit, used);
  return (
    <div className="min-w-24">
      <p className="text-sm font-semibold text-slate-900">{used} / {limit}</p>
      <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-slate-100" aria-hidden="true"><div className={`h-full rounded-full ${percent >= 90 ? "bg-rose-500" : "bg-indigo-500"}`} style={{ width: `${percent}%` }} /></div>
      <p className="mt-0.5 text-[11px] text-slate-500">남음 {remaining}</p>
    </div>
  );
}

// 관리자: 학교·기관 계약(예산), 반 연결, 기관 소속 회원(회원 단위 정산 제외)을 관리한다.
export default function AdminInstitutionTab() {
  const utils = trpc.useUtils();
  const contractsQuery = trpc.institution.adminList.useQuery();
  const groupsQuery = trpc.institution.adminGroups.useQuery();
  const membersQuery = trpc.institution.adminMembers.useQuery();
  const contracts = contractsQuery.data ?? [];
  const groups = groupsQuery.data ?? [];
  const members = membersQuery.data ?? [];
  const refresh = () => { utils.institution.adminList.invalidate(); utils.institution.adminGroups.invalidate(); utils.institution.adminMembers.invalidate(); };
  const fail = (fallback: string) => (error: { message?: string }) => toast.error(error.message || fallback);

  // ----- 계약 만들기 -----
  const [createOpen, setCreateOpen] = useState(false);
  const [form, setForm] = useState({ name: "", contractCode: "", periodStart: "", periodEnd: "", humanLimit: "0", aiLimit: "0", managementLimit: "0", memo: "" });
  const createContract = trpc.institution.adminCreateContract.useMutation({
    onSuccess: () => { toast.success("계약을 등록했습니다. 활성화하면 이용할 수 있습니다."); setCreateOpen(false); refresh(); },
    onError: fail("계약을 등록하지 못했습니다."),
  });
  const canCreate = form.name.trim().length >= 2 && form.contractCode.trim().length >= 2 && form.periodStart !== "" && form.periodEnd !== "";

  // ----- 예산·상태 변경(사유 필수) -----
  const [budgetTarget, setBudgetTarget] = useState<{ id: number; name: string; human: string; ai: string; management: string } | null>(null);
  const [statusTarget, setStatusTarget] = useState<{ id: number; name: string; status: "active" | "suspended" | "closed" } | null>(null);
  const [reason, setReason] = useState("");
  const updateBudgets = trpc.institution.adminUpdateBudgets.useMutation({
    onSuccess: () => { toast.success("예산을 변경했습니다."); setBudgetTarget(null); setReason(""); refresh(); },
    onError: fail("예산을 변경하지 못했습니다."),
  });
  const setStatus = trpc.institution.adminSetStatus.useMutation({
    onSuccess: () => { toast.success("계약 상태를 변경했습니다."); setStatusTarget(null); setReason(""); refresh(); },
    onError: fail("상태를 변경하지 못했습니다."),
  });

  // ----- 반 연결 -----
  const [bindTarget, setBindTarget] = useState<{ groupId: number; groupName: string; contractId: number | null } | null>(null);
  const bindGroup = trpc.institution.adminBindGroup.useMutation({
    onSuccess: () => { toast.success("반 연결을 변경했습니다. 변경 이후의 활동부터 적용됩니다."); setBindTarget(null); setReason(""); refresh(); },
    onError: fail("반 연결을 변경하지 못했습니다."),
  });

  // ----- 기관 소속 회원 -----
  const [memberForm, setMemberForm] = useState({ email: "", contractId: "", exclude: true, reason: "" });
  const addMember = trpc.institution.adminAddMember.useMutation({
    onSuccess: (result) => { toast.success(`${result.name || result.email || "회원"}을(를) 기관 소속으로 지정했습니다.`); setMemberForm({ email: "", contractId: "", exclude: true, reason: "" }); refresh(); },
    onError: fail("기관 소속으로 지정하지 못했습니다."),
  });
  const [endTarget, setEndTarget] = useState<{ id: number; label: string } | null>(null);
  const endMember = trpc.institution.adminEndMember.useMutation({
    onSuccess: () => { toast.success("기관 소속을 해제했습니다. 해제 이후의 활동부터 개별 정산 대상이 됩니다."); setEndTarget(null); setReason(""); refresh(); },
    onError: fail("해제하지 못했습니다."),
  });

  const activeContracts = contracts.filter((contract) => contract.status !== "closed");

  return (
    <div className="space-y-5">
      <div className="rounded-xl border border-indigo-100 bg-indigo-50/60 p-4 text-sm leading-6 text-slate-700">
        <p><strong>기관 계약</strong>은 학교·기관이 사용 횟수(토큰)를 계약으로 정해 두는 방식입니다. 계약에 연결된 반과 기관 소속 회원의 첨삭은 <strong>교사 개별 정산에서 자동 제외</strong>되고, 계약의 예산에서 차감됩니다.</p>
        <ul className="mt-2 list-disc space-y-0.5 pl-5 text-xs text-slate-600">
          {BUDGET_TYPES.map((budget) => <li key={budget.type}><strong>{budget.label}</strong>: {budget.description}</li>)}
        </ul>
      </div>

      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold text-slate-900">계약</h2>
        <Button size="sm" onClick={() => setCreateOpen(true)}>계약 등록</Button>
      </div>
      <Card className="overflow-x-auto p-0">
        <table className="w-full min-w-[1000px] text-left text-sm">
          <thead className="bg-slate-50 text-xs text-slate-600">
            <tr><th className="p-3">계약</th><th className="p-3">기간</th><th className="p-3">상태</th>{BUDGET_TYPES.map((budget) => <th key={budget.type} className="p-3">{budget.label}({budget.unit})</th>)}<th className="p-3">연결</th><th className="p-3">작업</th></tr>
          </thead>
          <tbody>
            {contracts.map((contract) => (
              <tr key={contract.id} className="border-t border-slate-100 align-top">
                <td className="p-3"><p className="font-semibold text-slate-900">{contract.name}</p><p className="font-mono text-xs text-slate-500">{contract.contractCode}</p></td>
                <td className="p-3 text-xs text-slate-600">{dateLabel(contract.periodStart)} ~ {dateLabel(contract.periodEnd)}<br />(종료일 0시 전까지)</td>
                <td className="p-3"><Pill {...STATUS[contract.status]} /></td>
                <td className="p-3"><BudgetCell limit={contract.humanLimit} used={contract.humanUsed} /></td>
                <td className="p-3"><BudgetCell limit={contract.aiLimit} used={contract.aiUsed} /></td>
                <td className="p-3"><BudgetCell limit={contract.managementLimit} used={contract.managementUsed} /></td>
                <td className="p-3 text-xs text-slate-600">반 {contract.groupCount}개<br />회원 {contract.memberCount}명</td>
                <td className="p-3">
                  <div className="flex flex-wrap gap-1.5">
                    {contract.status !== "closed" && <Button size="sm" variant="outline" onClick={() => { setReason(""); setBudgetTarget({ id: contract.id, name: contract.name, human: String(contract.humanLimit), ai: String(contract.aiLimit), management: String(contract.managementLimit) }); }}>예산</Button>}
                    {(contract.status === "draft" || contract.status === "suspended") && <Button size="sm" onClick={() => { setReason(""); setStatusTarget({ id: contract.id, name: contract.name, status: "active" }); }}>활성화</Button>}
                    {contract.status === "active" && <Button size="sm" variant="outline" onClick={() => { setReason(""); setStatusTarget({ id: contract.id, name: contract.name, status: "suspended" }); }}>중지</Button>}
                    {contract.status !== "closed" && <Button size="sm" variant="outline" onClick={() => { setReason(""); setStatusTarget({ id: contract.id, name: contract.name, status: "closed" }); }}>종료</Button>}
                  </div>
                </td>
              </tr>
            ))}
            {!contractsQuery.isLoading && contracts.length === 0 && <tr><td colSpan={8} className="p-8 text-center text-slate-500">등록된 기관 계약이 없습니다.</td></tr>}
          </tbody>
        </table>
      </Card>

      <section className="space-y-2" aria-labelledby="institution-groups">
        <h2 id="institution-groups" className="text-lg font-bold text-slate-900">반 연결</h2>
        <p className="text-sm text-slate-600">계약에 연결한 반에서 교사가 한 첨삭·채점·관리는 개별 정산에서 제외되고 계약 예산을 씁니다. 연결을 바꾸면 그 이후의 활동부터 적용되며, 이미 기록된 활동은 그대로입니다.</p>
        <Card className="overflow-x-auto p-0">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead className="bg-slate-50 text-xs text-slate-600"><tr><th className="p-3">반</th><th className="p-3">담당 교사</th><th className="p-3 text-right">학생</th><th className="p-3">연결된 계약</th></tr></thead>
            <tbody>
              {groups.map((group) => (
                <tr key={group.id} className="border-t border-slate-100">
                  <td className="p-3 font-semibold text-slate-900">{group.name}{group.isActive === 0 && <span className="ml-2 text-xs font-normal text-slate-500">(비활성)</span>}</td>
                  <td className="p-3 text-slate-600">{group.teacherName || "미지정"}</td>
                  <td className="p-3 text-right">{group.memberCount}명</td>
                  <td className="p-3">
                    <select value={group.contractId ?? ""} onChange={(event) => { setReason(""); setBindTarget({ groupId: group.id, groupName: group.name, contractId: event.target.value ? Number(event.target.value) : null }); }} className="h-9 rounded-md border border-slate-200 bg-white px-2 text-sm" aria-label={`${group.name} 연결 계약`}>
                      <option value="">연결 없음(개별 학습자 반)</option>
                      {contracts.filter((contract) => contract.status !== "closed" || contract.id === group.contractId).map((contract) => <option key={contract.id} value={contract.id}>{contract.name} ({contract.contractCode})</option>)}
                    </select>
                  </td>
                </tr>
              ))}
              {!groupsQuery.isLoading && groups.length === 0 && <tr><td colSpan={4} className="p-8 text-center text-slate-500">만든 반이 없습니다.</td></tr>}
            </tbody>
          </table>
        </Card>
      </section>

      <section className="space-y-2" aria-labelledby="institution-members">
        <h2 id="institution-members" className="text-lg font-bold text-slate-900">기관 소속 회원</h2>
        <p className="text-sm text-slate-600">회원 단위로 개별 정산을 제외합니다. 학생을 지정하면 그 학생에 대한 교사의 모든 첨삭이, 교사를 지정하면 그 교사의 모든 활동이 개별 정산에서 빠집니다. 학생에게 계약을 연결하면 그 계약이 학생의 AI 평가 비용을 부담합니다(계약이 없으면 정산 제외만 적용).</p>
        <Card className="space-y-3 p-4">
          <div className="grid gap-2 sm:grid-cols-[1.4fr_1.2fr_2fr_auto]">
            <Input value={memberForm.email} onChange={(event) => setMemberForm({ ...memberForm, email: event.target.value })} placeholder="회원 이메일" aria-label="회원 이메일" />
            <select value={memberForm.contractId} onChange={(event) => setMemberForm({ ...memberForm, contractId: event.target.value })} className="h-10 rounded-md border border-slate-200 bg-white px-2 text-sm" aria-label="연결할 계약(학생)">
              <option value="">계약 연결 없음(정산 제외만)</option>
              {activeContracts.map((contract) => <option key={contract.id} value={contract.id}>{contract.name}</option>)}
            </select>
            <Input value={memberForm.reason} onChange={(event) => setMemberForm({ ...memberForm, reason: event.target.value })} placeholder="사유(예: 한빛중학교 소속 학생)" aria-label="지정 사유" />
            <Button disabled={addMember.isPending || !memberForm.email.trim() || memberForm.reason.trim().length < 2} onClick={() => addMember.mutate({ email: memberForm.email.trim(), contractId: memberForm.contractId ? Number(memberForm.contractId) : null, excludeIndividualSettlement: memberForm.exclude, reason: memberForm.reason.trim() })}>지정</Button>
          </div>
          <label className="flex items-center gap-2 text-sm text-slate-700"><input type="checkbox" checked={memberForm.exclude} onChange={(event) => setMemberForm({ ...memberForm, exclude: event.target.checked })} />개별 정산에서 제외</label>
        </Card>
        <Card className="overflow-x-auto p-0">
          <table className="w-full min-w-[760px] text-left text-sm">
            <thead className="bg-slate-50 text-xs text-slate-600"><tr><th className="p-3">회원</th><th className="p-3">구분</th><th className="p-3">계약</th><th className="p-3">정산</th><th className="p-3">사유</th><th className="p-3">상태</th><th className="p-3">작업</th></tr></thead>
            <tbody>
              {members.map((member) => (
                <tr key={member.id} className="border-t border-slate-100">
                  <td className="p-3"><p className="font-semibold text-slate-900">{member.userName || "-"}</p><p className="text-xs text-slate-500">{member.userEmail || "-"}</p></td>
                  <td className="p-3 text-slate-600">{member.userRole === "teacher" ? "교사" : "학생"}</td>
                  <td className="p-3 text-slate-600">{contracts.find((contract) => contract.id === member.contractId)?.name ?? "-"}</td>
                  <td className="p-3 text-slate-600">{member.excludeIndividualSettlement ? "개별 정산 제외" : "-"}</td>
                  <td className="p-3 text-xs text-slate-600">{member.reason}</td>
                  <td className="p-3">{member.endedAt ? <Pill label={`해제 ${dateLabel(member.endedAt)}`} style="bg-slate-200 text-slate-700" /> : <Pill label="소속 중" style="bg-emerald-100 text-emerald-900" />}</td>
                  <td className="p-3">{!member.endedAt && <Button size="sm" variant="outline" onClick={() => { setReason(""); setEndTarget({ id: member.id, label: `${member.userName || member.userEmail || "회원"}` }); }}>해제</Button>}</td>
                </tr>
              ))}
              {!membersQuery.isLoading && members.length === 0 && <tr><td colSpan={7} className="p-8 text-center text-slate-500">기관 소속으로 지정한 회원이 없습니다.</td></tr>}
            </tbody>
          </table>
        </Card>
      </section>

      {/* 계약 등록 */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>기관 계약 등록</DialogTitle><DialogDescription>계약 조건에 따라 기간과 예산(토큰 = 서비스 이용 횟수)을 정합니다. 등록 후 활성화해야 이용할 수 있습니다.</DialogDescription></DialogHeader>
          <div className="space-y-3">
            <Input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} placeholder="학교·기관 이름" aria-label="학교·기관 이름" />
            <Input value={form.contractCode} onChange={(event) => setForm({ ...form, contractCode: event.target.value })} placeholder="계약 번호(영문·숫자, 예: HB-2026-01)" aria-label="계약 번호" />
            <div className="grid grid-cols-2 gap-2">
              <label className="text-xs text-slate-600">시작일<Input type="date" value={form.periodStart} onChange={(event) => setForm({ ...form, periodStart: event.target.value })} className="mt-1" /></label>
              <label className="text-xs text-slate-600">종료일(이 날 0시까지)<Input type="date" value={form.periodEnd} onChange={(event) => setForm({ ...form, periodEnd: event.target.value })} className="mt-1" /></label>
            </div>
            <div className="grid grid-cols-3 gap-2">
              {BUDGET_TYPES.map((budget) => {
                const key = `${budget.type}Limit` as "humanLimit" | "aiLimit" | "managementLimit";
                return <label key={budget.type} className="text-xs text-slate-600">{budget.label} 예산({budget.unit})<Input type="number" min={0} value={form[key]} onChange={(event) => setForm({ ...form, [key]: event.target.value })} className="mt-1 text-right" /></label>;
              })}
            </div>
            <Input value={form.memo} onChange={(event) => setForm({ ...form, memo: event.target.value })} placeholder="메모(선택)" aria-label="메모" />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>취소</Button>
            <Button disabled={!canCreate || createContract.isPending} onClick={() => createContract.mutate({ name: form.name.trim(), contractCode: form.contractCode.trim(), periodStart: kstStart(form.periodStart), periodEnd: kstStart(form.periodEnd), humanLimit: Math.round(Number(form.humanLimit) || 0), aiLimit: Math.round(Number(form.aiLimit) || 0), managementLimit: Math.round(Number(form.managementLimit) || 0), memo: form.memo.trim() || undefined })}>{createContract.isPending ? "등록 중..." : "등록"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 예산 변경 */}
      <Dialog open={Boolean(budgetTarget)} onOpenChange={(open) => { if (!open) setBudgetTarget(null); }}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>예산 변경</DialogTitle><DialogDescription>{budgetTarget?.name}. 이미 사용한 횟수보다 작게 줄일 수 없습니다. 변경 사유는 기록됩니다.</DialogDescription></DialogHeader>
          {budgetTarget && (
            <div className="grid grid-cols-3 gap-2">
              {BUDGET_TYPES.map((budget) => <label key={budget.type} className="text-xs text-slate-600">{budget.label}({budget.unit})<Input type="number" min={0} value={budgetTarget[budget.type as BudgetType]} onChange={(event) => setBudgetTarget({ ...budgetTarget, [budget.type]: event.target.value })} className="mt-1 text-right" /></label>)}
            </div>
          )}
          <Input value={reason} onChange={(event) => setReason(event.target.value)} placeholder="변경 사유(필수)" aria-label="변경 사유" />
          <DialogFooter>
            <Button variant="outline" onClick={() => setBudgetTarget(null)}>취소</Button>
            <Button disabled={reason.trim().length < 2 || updateBudgets.isPending} onClick={() => budgetTarget && updateBudgets.mutate({ contractId: budgetTarget.id, human: Math.round(Number(budgetTarget.human) || 0), ai: Math.round(Number(budgetTarget.ai) || 0), management: Math.round(Number(budgetTarget.management) || 0), reason: reason.trim() })}>{updateBudgets.isPending ? "저장 중..." : "저장"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 계약 상태 변경 */}
      <Dialog open={Boolean(statusTarget)} onOpenChange={(open) => { if (!open) setStatusTarget(null); }}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>{statusTarget?.status === "active" ? "계약 활성화" : statusTarget?.status === "suspended" ? "계약 일시 중지" : "계약 종료"}</DialogTitle><DialogDescription>{statusTarget?.name}. {statusTarget?.status === "closed" ? "종료한 계약은 다시 열 수 없습니다. " : ""}중지·종료된 계약은 새 첨삭·AI·관리 이용이 막히고, 연결된 반의 활동은 계속 개별 정산에서 제외됩니다.</DialogDescription></DialogHeader>
          <Input value={reason} onChange={(event) => setReason(event.target.value)} placeholder="사유(필수)" aria-label="상태 변경 사유" />
          <DialogFooter>
            <Button variant="outline" onClick={() => setStatusTarget(null)}>취소</Button>
            <Button disabled={reason.trim().length < 2 || setStatus.isPending} onClick={() => statusTarget && setStatus.mutate({ contractId: statusTarget.id, status: statusTarget.status, reason: reason.trim() })}>{setStatus.isPending ? "처리 중..." : "확인"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 반 연결 변경 */}
      <Dialog open={Boolean(bindTarget)} onOpenChange={(open) => { if (!open) setBindTarget(null); }}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>반 연결 변경</DialogTitle><DialogDescription>{bindTarget?.groupName} 반을 {bindTarget?.contractId ? `"${contracts.find((contract) => contract.id === bindTarget.contractId)?.name ?? "계약"}" 계약에 연결` : "계약에서 해제"}합니다. 변경 이후의 활동부터 적용됩니다.</DialogDescription></DialogHeader>
          <Input value={reason} onChange={(event) => setReason(event.target.value)} placeholder="사유(필수)" aria-label="연결 변경 사유" />
          <DialogFooter>
            <Button variant="outline" onClick={() => setBindTarget(null)}>취소</Button>
            <Button disabled={reason.trim().length < 2 || bindGroup.isPending} onClick={() => bindTarget && bindGroup.mutate({ groupId: bindTarget.groupId, contractId: bindTarget.contractId, reason: reason.trim() })}>{bindGroup.isPending ? "처리 중..." : "변경"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 기관 소속 해제 */}
      <Dialog open={Boolean(endTarget)} onOpenChange={(open) => { if (!open) setEndTarget(null); }}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>기관 소속 해제</DialogTitle><DialogDescription>{endTarget?.label}. 해제 이후의 활동부터 개별 정산 대상이 됩니다(이미 기록된 활동은 그대로).</DialogDescription></DialogHeader>
          <Input value={reason} onChange={(event) => setReason(event.target.value)} placeholder="사유(필수)" aria-label="해제 사유" />
          <DialogFooter>
            <Button variant="outline" onClick={() => setEndTarget(null)}>취소</Button>
            <Button disabled={reason.trim().length < 2 || endMember.isPending} onClick={() => endTarget && endMember.mutate({ id: endTarget.id, reason: reason.trim() })}>{endMember.isPending ? "처리 중..." : "해제"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
