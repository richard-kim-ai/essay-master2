import React, { useState } from "react";
import { Link } from "wouter";
import { ChevronLeft, ChevronRight, Wallet } from "lucide-react";
import { useAuth } from "@/_core/hooks/useAuth";
import LoginRequired from "@/components/LoginRequired";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { trpc } from "@/lib/trpc";
import { formatKrw } from "@shared/plans";
import { SETTLEMENT_ACTIVITIES, currentMonthKst } from "@shared/settlement";

const ACTIVITY_LABELS: Record<string, string> = Object.fromEntries(SETTLEMENT_ACTIVITIES.map((activity) => [activity.type, activity.label]));

const STATUS_LABELS = { confirmed: "확정", paid: "지급 완료" } as const;
const STATUS_STYLES = { confirmed: "bg-indigo-100 text-indigo-900", paid: "bg-emerald-100 text-emerald-900" } as const;

function shiftMonth(month: string, delta: number) {
  const [year, monthNumber] = month.split("-").map(Number);
  const date = new Date(Date.UTC(year, monthNumber - 1 + delta, 1));
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}

function formatDate(value: Date | string | null | undefined) {
  return value ? new Date(value).toLocaleDateString("ko-KR", { timeZone: "Asia/Seoul" }) : "-";
}

// 교사포털의 정산 화면. 교사가 등록·승인한 첨삭 활동 건수와 단가로 월별 정산 금액을 보여준다.
export default function TeacherSettlement() {
  const { user, isAuthenticated } = useAuth();
  const [month, setMonth] = useState(currentMonthKst());
  const approvedTeacher = isAuthenticated && user?.role === "teacher" && (user as { teacherStatus?: string }).teacherStatus === "approved";
  const overviewQuery = trpc.settlement.myOverview.useQuery({ month }, { enabled: approvedTeacher });
  const statementsQuery = trpc.settlement.myStatements.useQuery(undefined, { enabled: approvedTeacher });
  const activitiesQuery = trpc.settlement.myActivities.useQuery({ month }, { enabled: approvedTeacher });
  const utils = trpc.useUtils();
  const [exclusionTarget, setExclusionTarget] = useState<{ activityType: (typeof SETTLEMENT_ACTIVITIES)[number]["type"]; sourceId: number; excluded: boolean; label: string } | null>(null);
  const [reason, setReason] = useState("");
  const setExclusion = trpc.settlement.setActivityExclusion.useMutation({
    onSuccess: () => {
      toast.success(exclusionTarget?.excluded ? "이 활동을 정산에서 제외했습니다." : "정산 제외를 해제했습니다.");
      setExclusionTarget(null);
      setReason("");
      utils.settlement.myActivities.invalidate();
      utils.settlement.myOverview.invalidate();
    },
    onError: (error) => toast.error(error.message || "정산 제외를 바꾸지 못했습니다."),
  });

  if (!isAuthenticated) return <LoginRequired />;
  if (!approvedTeacher) {
    return (
      <div className="mx-auto max-w-xl px-4 py-16 text-center">
        <Wallet className="mx-auto h-14 w-14 text-slate-300" aria-hidden="true" />
        <h1 className="mt-4 text-2xl font-bold text-slate-900">승인된 교사만 볼 수 있습니다</h1>
        <p className="mt-2 text-sm text-slate-600">교사 계정이 승인되면 첨삭 활동에 따른 정산 내역을 확인할 수 있습니다.</p>
        <Link href="/"><Button variant="outline" className="mt-6">홈으로 돌아가기</Button></Link>
      </div>
    );
  }

  const overview = overviewQuery.data;
  const statement = overview?.statement ?? null;
  // 확정·지급된 정산서가 있으면 그 시점의 금액이 기준이고, 없으면 현재 활동 기준 예상액이다.
  const items = statement ? statement.items : overview?.estimate.items ?? [];
  const gross = statement ? statement.grossKrw : overview?.estimate.grossKrw ?? 0;
  const withholding = statement ? statement.withholdingKrw : overview?.estimate.withholdingKrw ?? 0;
  const withholdingPct = statement ? statement.withholdingPct : overview?.estimate.withholdingPct ?? 0;
  const net = statement ? statement.netKrw : overview?.estimate.netKrw ?? 0;
  const statements = statementsQuery.data ?? [];
  const activityDescriptions = new Map<string, string>((overview?.activities ?? []).map((activity) => [activity.type, activity.description]));

  return (
    <div className="mx-auto max-w-5xl space-y-6 px-4 py-8 sm:px-6">
      <div>
        <Link href="/teacher-mypage"><Button variant="ghost" size="sm" className="-ml-2 gap-1 text-slate-600"><ChevronLeft className="h-4 w-4" />교사 마이페이지</Button></Link>
        <h1 className="mt-2 text-3xl font-bold text-slate-900">첨삭 정산</h1>
        <p className="mt-2 text-sm leading-6 text-slate-600">교사가 등록·승인한 첨삭 활동 건수에 활동별 단가를 곱해 월 단위로 정산합니다. 정산이 확정되기 전의 금액은 예상액이며, 확정된 뒤에는 단가가 바뀌어도 금액이 변하지 않습니다.</p>
      </div>

      <div className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white p-3">
        <Button variant="outline" size="sm" onClick={() => setMonth(shiftMonth(month, -1))} aria-label="이전 달"><ChevronLeft className="h-4 w-4" /></Button>
        <div className="text-center">
          <p className="text-lg font-bold text-slate-900">{month.replace("-", "년 ")}월</p>
          <p className="text-xs text-slate-500">
            {statement ? <span className={`rounded-full px-2 py-0.5 font-semibold ${STATUS_STYLES[statement.status as keyof typeof STATUS_STYLES]}`}>{STATUS_LABELS[statement.status as keyof typeof STATUS_LABELS]}</span> : overview?.isCurrentMonth ? "진행 중인 달 · 예상액" : "확정 전 · 예상액"}
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => setMonth(shiftMonth(month, 1))} disabled={month >= currentMonthKst()} aria-label="다음 달"><ChevronRight className="h-4 w-4" /></Button>
      </div>

      {overview?.workload && (
        <section aria-labelledby="workload-title" className="space-y-2">
          <h2 id="workload-title" className="text-lg font-bold text-slate-900">이번 달 활동</h2>
          <div className="grid gap-3 sm:grid-cols-4">
            <Card className="p-4"><p className="text-xs font-semibold text-slate-500">전체 활동</p><p className="mt-1 text-2xl font-bold text-slate-900">{overview.workload.total}건</p></Card>
            <Card className="border-indigo-200 bg-indigo-50/60 p-4"><p className="text-xs font-semibold text-indigo-800">개별 정산 대상</p><p className="mt-1 text-2xl font-bold text-indigo-900">{overview.workload.included}건</p></Card>
            <Card className="p-4"><p className="text-xs font-semibold text-slate-500">기관 계약·소속(자동 제외)</p><p className="mt-1 text-2xl font-bold text-slate-700">{overview.workload.excludedAuto}건</p></Card>
            <Card className="p-4"><p className="text-xs font-semibold text-slate-500">직접 제외</p><p className="mt-1 text-2xl font-bold text-slate-700">{overview.workload.excludedManual}건</p></Card>
          </div>
          <p className="text-xs leading-5 text-slate-500">학교·기관과 계약한 반(또는 기관 소속 학생)의 활동은 계약으로 별도 처리되어 개별 정산에서 자동으로 제외됩니다. 제외된 활동도 업무량에는 그대로 표시됩니다.</p>
        </section>
      )}

      {overviewQuery.error ? (
        <Card className="p-6 text-sm text-rose-700">{overviewQuery.error.message || "정산 정보를 불러오지 못했습니다."}</Card>
      ) : (
        <>
          <Card className="overflow-x-auto p-0">
            <table className="w-full min-w-[560px] text-left text-sm">
              <thead className="bg-slate-50 text-xs text-slate-600">
                <tr><th className="p-3">활동</th><th className="p-3 text-right">건수</th><th className="p-3 text-right">건당 단가</th><th className="p-3 text-right">금액</th></tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <tr key={item.type} className="border-t border-slate-100">
                    <td className="p-3"><p className="font-semibold text-slate-900">{item.label}</p><p className="text-xs text-slate-500">{activityDescriptions.get(item.type) ?? ""}</p></td>
                    <td className="p-3 text-right text-slate-800">{item.count}건</td>
                    <td className="p-3 text-right text-slate-600">{formatKrw(item.unitAmountKrw)}</td>
                    <td className="p-3 text-right font-semibold text-slate-900">{formatKrw(item.amountKrw)}</td>
                  </tr>
                ))}
                {overviewQuery.isLoading && <tr><td colSpan={4} className="p-6 text-center text-slate-500">불러오는 중입니다...</td></tr>}
              </tbody>
            </table>
          </Card>

          <div className="grid gap-4 sm:grid-cols-3">
            <Card className="p-5"><p className="text-xs font-semibold text-slate-500">{statement ? "정산 총액" : "예상 총액"}</p><p className="mt-1 text-2xl font-bold text-slate-900">{formatKrw(gross)}</p></Card>
            <Card className="p-5"><p className="text-xs font-semibold text-slate-500">원천징수({withholdingPct}%)</p><p className="mt-1 text-2xl font-bold text-slate-700">-{formatKrw(withholding)}</p></Card>
            <Card className="border-indigo-200 bg-indigo-50/60 p-5"><p className="text-xs font-semibold text-indigo-800">{statement?.status === "paid" ? "지급 금액" : "지급 예정 금액"}</p><p className="mt-1 text-2xl font-bold text-indigo-900">{formatKrw(net)}</p></Card>
          </div>
          {statement && <p className="text-xs text-slate-500">확정일 {formatDate(statement.confirmedAt)}{statement.paidAt ? ` · 지급일 ${formatDate(statement.paidAt)}` : ""}{statement.note ? ` · 메모: ${statement.note}` : ""}</p>}
          <p className="text-xs leading-5 text-slate-500">원천징수는 간이 계산입니다. 실제 지급액과 증빙은 운영팀이 확정한 정산서를 기준으로 합니다.</p>
        </>
      )}

      <section aria-labelledby="activity-list" className="space-y-2">
        <h2 id="activity-list" className="text-lg font-bold text-slate-900">활동 내역과 정산 제외</h2>
        <p className="text-sm leading-6 text-slate-600">내가 지도하는 반의 활동 중 개별 정산에서 빼야 하는 것(예: 교내 지원 업무)은 사유와 함께 제외할 수 있습니다. 기관 계약·소속으로 자동 제외된 활동은 바꿀 수 없고, 정산이 확정된 달은 변경할 수 없습니다.{activitiesQuery.data?.frozen ? " 이 달은 이미 확정되어 변경할 수 없습니다." : ""}</p>
        <Card className="overflow-x-auto p-0">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead className="bg-slate-50 text-xs text-slate-600"><tr><th className="p-3">일시</th><th className="p-3">활동</th><th className="p-3">학생</th><th className="p-3">정산</th><th className="p-3">작업</th></tr></thead>
            <tbody>
              {(activitiesQuery.data?.activities ?? []).map((activity) => (
                <tr key={`${activity.activityType}-${activity.sourceId}`} className="border-t border-slate-100">
                  <td className="p-3 text-xs text-slate-600">{new Date(activity.occurredAt).toLocaleString("ko-KR", { timeZone: "Asia/Seoul" })}</td>
                  <td className="p-3">{ACTIVITY_LABELS[activity.activityType] ?? activity.activityType}</td>
                  <td className="p-3 text-slate-700">{activity.studentName || "-"}</td>
                  <td className="p-3">
                    <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${activity.excluded ? "bg-slate-200 text-slate-700" : "bg-emerald-100 text-emerald-900"}`}>{activity.label}</span>
                    {activity.manualReason && <p className="mt-1 text-xs text-slate-500">사유: {activity.manualReason}</p>}
                  </td>
                  <td className="p-3">
                    {activity.canToggle
                      ? <Button size="sm" variant="outline" onClick={() => { setReason(""); setExclusionTarget({ activityType: activity.activityType as (typeof SETTLEMENT_ACTIVITIES)[number]["type"], sourceId: activity.sourceId, excluded: !activity.excluded, label: `${ACTIVITY_LABELS[activity.activityType] ?? activity.activityType} · ${activity.studentName || "학생"}` }); }}>{activity.excluded ? "제외 해제" : "정산 제외"}</Button>
                      : <span className="text-xs text-slate-400">{activity.automatic ? "자동(변경 불가)" : "-"}</span>}
                  </td>
                </tr>
              ))}
              {!activitiesQuery.isLoading && (activitiesQuery.data?.activities ?? []).length === 0 && <tr><td colSpan={5} className="p-6 text-center text-slate-500">이 달의 활동이 없습니다.</td></tr>}
            </tbody>
          </table>
        </Card>
      </section>

      <Dialog open={Boolean(exclusionTarget)} onOpenChange={(open) => { if (!open) setExclusionTarget(null); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{exclusionTarget?.excluded ? "정산에서 제외" : "정산 제외 해제"}</DialogTitle>
            <DialogDescription>{exclusionTarget?.label}. {exclusionTarget?.excluded ? "이 활동은 개별 정산 금액에서 빠지고, 업무량에는 그대로 남습니다." : "이 활동이 다시 개별 정산 금액에 포함됩니다."} 사유는 기록됩니다.</DialogDescription>
          </DialogHeader>
          <Input value={reason} onChange={(event) => setReason(event.target.value)} placeholder="사유(필수, 예: 교내 연수 지원 업무)" aria-label="정산 제외 사유" />
          <DialogFooter>
            <Button variant="outline" onClick={() => setExclusionTarget(null)}>취소</Button>
            <Button disabled={reason.trim().length < 2 || setExclusion.isPending} onClick={() => exclusionTarget && setExclusion.mutate({ activityType: exclusionTarget.activityType, sourceId: exclusionTarget.sourceId, excluded: exclusionTarget.excluded, reason: reason.trim() })}>{setExclusion.isPending ? "처리 중..." : "확인"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <section aria-labelledby="statement-history">
        <h2 id="statement-history" className="text-lg font-bold text-slate-900">확정된 정산 내역</h2>
        <Card className="mt-3 overflow-x-auto p-0">
          <table className="w-full min-w-[560px] text-left text-sm">
            <thead className="bg-slate-50 text-xs text-slate-600">
              <tr><th className="p-3">정산 월</th><th className="p-3">상태</th><th className="p-3 text-right">총액</th><th className="p-3 text-right">원천징수</th><th className="p-3 text-right">지급 금액</th><th className="p-3">지급일</th></tr>
            </thead>
            <tbody>
              {statements.map((row) => (
                <tr key={row.id} className="border-t border-slate-100">
                  <td className="p-3"><button type="button" onClick={() => setMonth(row.periodMonth)} className="font-semibold text-indigo-700 hover:underline">{row.periodMonth}</button></td>
                  <td className="p-3"><span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${STATUS_STYLES[row.status as keyof typeof STATUS_STYLES]}`}>{STATUS_LABELS[row.status as keyof typeof STATUS_LABELS]}</span></td>
                  <td className="p-3 text-right">{formatKrw(row.grossKrw)}</td>
                  <td className="p-3 text-right text-slate-600">-{formatKrw(row.withholdingKrw)}</td>
                  <td className="p-3 text-right font-semibold">{formatKrw(row.netKrw)}</td>
                  <td className="p-3 text-slate-600">{formatDate(row.paidAt)}</td>
                </tr>
              ))}
              {!statementsQuery.isLoading && statements.length === 0 && <tr><td colSpan={6} className="p-6 text-center text-slate-500">아직 확정된 정산 내역이 없습니다. 월이 끝나면 운영팀이 정산을 확정합니다.</td></tr>}
            </tbody>
          </table>
        </Card>
      </section>
    </div>
  );
}
