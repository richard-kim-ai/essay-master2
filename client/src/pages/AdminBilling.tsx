import React, { useState } from "react";
import { Link } from "wouter";
import { toast } from "sonner";
import { ChevronLeft, ChevronRight, FlaskConical } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import AdminInstitutionTab from "@/components/AdminInstitutionTab";
import { trpc } from "@/lib/trpc";
import { formatKrw, getPlanName } from "@shared/plans";
import { currentMonthKst, type ActivityType } from "@shared/settlement";

const ORDER_STATUS = {
  pending: { label: "결제 대기", style: "bg-amber-100 text-amber-900" },
  paid: { label: "결제 완료", style: "bg-emerald-100 text-emerald-900" },
  failed: { label: "결제 실패", style: "bg-rose-100 text-rose-900" },
  cancelled: { label: "취소", style: "bg-slate-200 text-slate-700" },
  refunded: { label: "환불", style: "bg-slate-200 text-slate-700" },
} as const;

const SUBSCRIPTION_STATUS = {
  active: { label: "이용 중", style: "bg-emerald-100 text-emerald-900" },
  cancelled: { label: "해지(기간 종료까지 이용)", style: "bg-amber-100 text-amber-900" },
  expired: { label: "종료", style: "bg-slate-200 text-slate-700" },
} as const;

const SETTLEMENT_STATUS = {
  draft: { label: "산출 중", style: "bg-amber-100 text-amber-900" },
  confirmed: { label: "확정", style: "bg-indigo-100 text-indigo-900" },
  paid: { label: "지급 완료", style: "bg-emerald-100 text-emerald-900" },
} as const;

const planName = (key: string) => getPlanName(key);

function formatDateTime(value: Date | string | null | undefined) {
  return value ? new Date(value).toLocaleString("ko-KR", { timeZone: "Asia/Seoul" }) : "-";
}

function shiftMonth(month: string, delta: number) {
  const [year, monthNumber] = month.split("-").map(Number);
  const date = new Date(Date.UTC(year, monthNumber - 1 + delta, 1));
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}

function LoadError({ message }: { message?: string }) {
  return <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm leading-6 text-rose-900" role="alert">정보를 불러오지 못했습니다{message ? `: ${message}` : ""}. 새 기능의 DB 반영(마이그레이션 0049·0050) 여부를 확인하고 다시 시도해 주세요. 불러오지 못한 값은 0원·0건이 아니라 알 수 없는 상태입니다.</div>;
}

function Pill({ label, style }: { label: string; style: string }) {
  return <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-semibold ${style}`}>{label}</span>;
}

// 관리자: 회원 결제·이용권과 교사 정산을 한 곳에서 관리한다.
export default function AdminBilling() {
  const summaryQuery = trpc.billing.adminSummary.useQuery();

  if (summaryQuery.error) {
    return <div className="mx-auto max-w-5xl p-6 text-sm text-rose-700">{summaryQuery.error.message || "관리자만 볼 수 있는 화면입니다."}</div>;
  }
  const summary = summaryQuery.data;

  return (
    <div className="mx-auto max-w-6xl space-y-4 p-4 sm:p-6">
      <div>
        <Link href="/admin"><Button variant="ghost" size="sm" className="-ml-2 gap-1 text-slate-600"><ChevronLeft className="h-4 w-4" />관리자 대시보드</Button></Link>
        <h1 className="mt-2 text-2xl font-bold text-slate-900">결제·정산 관리</h1>
        <p className="mt-1 text-sm text-slate-600">회원의 이용권 결제 내역과 교사 첨삭 정산을 관리합니다.</p>
      </div>

      {summary?.isTest && (
        <div className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-950" role="status">
          <FlaskConical className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          <p><strong>임시(테스트) 결제 모드입니다.</strong> 결제 연동이 확정되기 전이라 실제 결제 없이 결제가 완료된 것으로 처리되며, 모든 주문은 테스트로 기록됩니다. 아래 결제 금액은 실제 매출이 아닙니다. 실제 결제 연동 방법은 <code>docs/payment-integration.md</code>를 참고하세요.</p>
        </div>
      )}

      <Tabs defaultValue="orders" className="space-y-4">
        <TabsList className="flex h-auto flex-wrap justify-start gap-1">
          <TabsTrigger value="orders">결제 내역</TabsTrigger>
          <TabsTrigger value="subscriptions">이용권</TabsTrigger>
          <TabsTrigger value="settlements">교사 정산</TabsTrigger>
          <TabsTrigger value="institutions">기관 계약</TabsTrigger>
          <TabsTrigger value="settings">정산 설정</TabsTrigger>
        </TabsList>
        <TabsContent value="orders"><OrdersTab summary={summary} /></TabsContent>
        <TabsContent value="subscriptions"><SubscriptionsTab /></TabsContent>
        <TabsContent value="settlements"><SettlementsTab /></TabsContent>
        <TabsContent value="institutions"><AdminInstitutionTab /></TabsContent>
        <TabsContent value="settings"><SettlementSettingsTab /></TabsContent>
      </Tabs>
    </div>
  );
}

function OrdersTab({ summary }: { summary: { paidCount: number; paidTotalKrw: number; refundedCount: number; refundedTotalKrw: number; activeSubscriptions: number; testOrderCount: number } | undefined }) {
  const utils = trpc.useUtils();
  const [status, setStatus] = useState<keyof typeof ORDER_STATUS | "">("");
  const [search, setSearch] = useState("");
  const [refundTarget, setRefundTarget] = useState<{ id: number; label: string } | null>(null);
  const [reason, setReason] = useState("");
  const ordersQuery = trpc.billing.adminOrders.useQuery({ status: status || undefined, search: search.trim() || undefined, limit: 100 });
  const refund = trpc.billing.adminRefund.useMutation({
    onSuccess: () => {
      toast.success("환불 처리했습니다. 해당 이용권은 종료됩니다.");
      setRefundTarget(null);
      setReason("");
      utils.billing.adminOrders.invalidate();
      utils.billing.adminSummary.invalidate();
      utils.billing.adminSubscriptions.invalidate();
    },
    onError: (error) => toast.error(error.message || "환불 처리에 실패했습니다."),
  });
  const orders = ordersQuery.data ?? [];
  if (ordersQuery.error) return <LoadError message={ordersQuery.error.message} />;

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="p-4"><p className="text-xs font-semibold text-slate-500">결제 완료</p><p className="mt-1 text-xl font-bold text-slate-900">{summary?.paidCount ?? 0}건 · {formatKrw(summary?.paidTotalKrw ?? 0)}</p></Card>
        <Card className="p-4"><p className="text-xs font-semibold text-slate-500">환불</p><p className="mt-1 text-xl font-bold text-slate-900">{summary?.refundedCount ?? 0}건 · {formatKrw(summary?.refundedTotalKrw ?? 0)}</p></Card>
        <Card className="p-4"><p className="text-xs font-semibold text-slate-500">이용 중인 이용권</p><p className="mt-1 text-xl font-bold text-slate-900">{summary?.activeSubscriptions ?? 0}개</p></Card>
        <Card className="p-4"><p className="text-xs font-semibold text-slate-500">테스트 결제 주문</p><p className="mt-1 text-xl font-bold text-slate-900">{summary?.testOrderCount ?? 0}건</p></Card>
      </div>

      <div className="flex flex-col gap-2 sm:flex-row">
        <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="이름·이메일·주문번호 검색" className="sm:max-w-xs" aria-label="결제 내역 검색" />
        <select value={status} onChange={(event) => setStatus(event.target.value as keyof typeof ORDER_STATUS | "")} className="h-10 rounded-md border border-slate-200 bg-white px-3 text-sm" aria-label="결제 상태">
          <option value="">전체 상태</option>
          {Object.entries(ORDER_STATUS).map(([value, item]) => <option key={value} value={value}>{item.label}</option>)}
        </select>
      </div>

      <Card className="overflow-x-auto p-0">
        <table className="w-full min-w-[900px] text-left text-sm">
          <thead className="bg-slate-50 text-xs text-slate-600">
            <tr><th className="p-3">주문번호</th><th className="p-3">회원</th><th className="p-3">이용권</th><th className="p-3 text-right">금액</th><th className="p-3">상태</th><th className="p-3">결제 방식</th><th className="p-3">결제일</th><th className="p-3">작업</th></tr>
          </thead>
          <tbody>
            {orders.map((order) => (
              <tr key={order.id} className="border-t border-slate-100">
                <td className="p-3 font-mono text-xs text-slate-700">{order.providerOrderId}</td>
                <td className="p-3"><p className="font-semibold text-slate-900">{order.userName || "-"}</p><p className="text-xs text-slate-500">{order.userEmail || "-"}</p></td>
                <td className="p-3">{planName(order.planKey)}</td>
                <td className="p-3 text-right">{formatKrw(order.amountKrw)}</td>
                <td className="p-3"><Pill {...ORDER_STATUS[order.status]} />{order.failureReason && <p className="mt-1 text-xs text-rose-700">{order.failureReason}</p>}</td>
                <td className="p-3 text-xs text-slate-600">{order.provider}{order.isTest === 1 && <span className="ml-1 rounded bg-amber-100 px-1.5 py-0.5 font-semibold text-amber-900">테스트</span>}</td>
                <td className="p-3 text-xs text-slate-600">{formatDateTime(order.paidAt ?? order.createdAt)}</td>
                <td className="p-3">{order.status === "paid" && <Button size="sm" variant="outline" onClick={() => setRefundTarget({ id: order.id, label: `${order.userName || order.userEmail || "회원"} · ${planName(order.planKey)} · ${formatKrw(order.amountKrw)}` })}>환불</Button>}</td>
              </tr>
            ))}
            {!ordersQuery.isLoading && orders.length === 0 && <tr><td colSpan={8} className="p-8 text-center text-slate-500">결제 내역이 없습니다.</td></tr>}
          </tbody>
        </table>
      </Card>

      <Dialog open={Boolean(refundTarget)} onOpenChange={(open) => { if (!open) setRefundTarget(null); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>결제 환불</DialogTitle>
            <DialogDescription>{refundTarget?.label}. 환불하면 이 결제로 시작한 이용권이 바로 종료됩니다.</DialogDescription>
          </DialogHeader>
          <Input value={reason} onChange={(event) => setReason(event.target.value)} placeholder="환불 사유(필수)" aria-label="환불 사유" />
          <DialogFooter>
            <Button variant="outline" onClick={() => setRefundTarget(null)}>취소</Button>
            <Button disabled={reason.trim().length < 2 || refund.isPending} onClick={() => refundTarget && refund.mutate({ orderId: refundTarget.id, reason: reason.trim() })}>{refund.isPending ? "처리 중..." : "환불 처리"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function SubscriptionsTab() {
  const subscriptionsQuery = trpc.billing.adminSubscriptions.useQuery();
  const rows = subscriptionsQuery.data ?? [];
  if (subscriptionsQuery.error) return <LoadError message={subscriptionsQuery.error.message} />;
  return (
    <Card className="overflow-x-auto p-0">
      <table className="w-full min-w-[800px] text-left text-sm">
        <thead className="bg-slate-50 text-xs text-slate-600">
          <tr><th className="p-3">회원</th><th className="p-3">이용권</th><th className="p-3">상태</th><th className="p-3">이용 기간</th><th className="p-3 text-right">AI 평가 한도</th><th className="p-3">해지일</th></tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id} className="border-t border-slate-100">
              <td className="p-3"><p className="font-semibold text-slate-900">{row.userName || "-"}</p><p className="text-xs text-slate-500">{row.userEmail || "-"}</p></td>
              <td className="p-3">{planName(row.planKey)}</td>
              <td className="p-3">{row.awaitingStart === 1 ? <Pill label="결제 완료 · 시작 대기" style="bg-sky-100 text-sky-900" /> : <Pill {...SUBSCRIPTION_STATUS[row.status]} />}</td>
              <td className="p-3 text-xs text-slate-600">{formatDateTime(row.currentPeriodStart)} ~ {formatDateTime(row.currentPeriodEnd)}</td>
              <td className="p-3 text-right">{row.aiEvaluationsLimit}회</td>
              <td className="p-3 text-xs text-slate-600">{formatDateTime(row.cancelledAt)}</td>
            </tr>
          ))}
          {!subscriptionsQuery.isLoading && rows.length === 0 && <tr><td colSpan={6} className="p-8 text-center text-slate-500">이용권이 없습니다.</td></tr>}
        </tbody>
      </table>
    </Card>
  );
}

function SettlementsTab() {
  const utils = trpc.useUtils();
  const [month, setMonth] = useState(shiftMonth(currentMonthKst(), -1));
  const [paidTarget, setPaidTarget] = useState<{ id: number; label: string } | null>(null);
  const [note, setNote] = useState("");
  const overviewQuery = trpc.settlement.adminOverview.useQuery({ month });
  const refresh = () => utils.settlement.adminOverview.invalidate();
  const generate = trpc.settlement.adminGenerate.useMutation({
    onSuccess: (result) => { toast.success(`정산서를 산출했습니다. (갱신 ${result.generated}건${result.skipped ? `, 확정·지급 완료로 건너뜀 ${result.skipped}건` : ""})`); refresh(); },
    onError: (error) => toast.error(error.message || "정산 산출에 실패했습니다."),
  });
  const confirm = trpc.settlement.adminConfirm.useMutation({
    onSuccess: () => { toast.success("정산을 확정했습니다. 확정된 금액은 이후 단가가 바뀌어도 변하지 않습니다."); refresh(); },
    onError: (error) => toast.error(error.message || "정산 확정에 실패했습니다."),
  });
  const markPaid = trpc.settlement.adminMarkPaid.useMutation({
    onSuccess: () => { toast.success("지급 완료로 처리했습니다."); setPaidTarget(null); setNote(""); refresh(); },
    onError: (error) => toast.error(error.message || "지급 처리에 실패했습니다."),
  });
  const overview = overviewQuery.data;
  const rows = overview?.rows ?? [];
  const reconcile = trpc.settlement.adminReconcile.useMutation({
    onSuccess: (result) => { toast.success(`장부에 기록되지 않았던 활동 ${result.reconciled}건을 정리했습니다. 정산서를 다시 산출해 주세요.`); refresh(); },
    onError: (error) => toast.error(error.message || "장부 정리에 실패했습니다."),
  });
  const totalNet = rows.reduce((sum, row) => sum + (row.statement && row.statement.status !== "draft" ? row.statement.netKrw : row.estimate.netKrw), 0);

  if (overviewQuery.error) return <LoadError message={overviewQuery.error.message} />;
  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setMonth(shiftMonth(month, -1))} aria-label="이전 달"><ChevronLeft className="h-4 w-4" /></Button>
          <p className="min-w-28 text-center text-lg font-bold text-slate-900">{month.replace("-", "년 ")}월</p>
          <Button variant="outline" size="sm" onClick={() => setMonth(shiftMonth(month, 1))} disabled={month >= currentMonthKst()} aria-label="다음 달"><ChevronRight className="h-4 w-4" /></Button>
        </div>
        <div className="flex items-center gap-3">
          <p className="text-sm text-slate-600">지급 예정 합계 <strong className="text-slate-900">{formatKrw(totalNet)}</strong></p>
          <Button size="sm" onClick={() => generate.mutate({ month })} disabled={generate.isPending}>{generate.isPending ? "산출 중..." : "정산서 산출·갱신"}</Button>
        </div>
      </div>
      {overview && !overview.isClosed && <p className="text-xs text-amber-800">진행 중인 달입니다. 월이 끝나기 전에는 정산서를 확정할 수 없습니다(건수가 계속 늘어납니다).</p>}

      <Card className="overflow-x-auto p-0">
        <table className="w-full min-w-[900px] text-left text-sm">
          <thead className="bg-slate-50 text-xs text-slate-600">
            <tr>
              <th className="p-3">교사</th>
              {(overview?.activities ?? []).map((activity) => <th key={activity.type} className="p-3 text-right">{activity.label}</th>)}
              <th className="p-3 text-right">제외(기관·직접)</th><th className="p-3 text-right">총액</th><th className="p-3 text-right">지급 금액</th><th className="p-3">상태</th><th className="p-3">작업</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const statement = row.statement;
              const fixed = statement && statement.status !== "draft";
              const gross = fixed ? statement.grossKrw : row.estimate.grossKrw;
              const net = fixed ? statement.netKrw : row.estimate.netKrw;
              return (
                <tr key={row.teacherId} className="border-t border-slate-100">
                  <td className="p-3"><p className="font-semibold text-slate-900">{row.name || "-"}</p><p className="text-xs text-slate-500">{row.email || "-"}</p></td>
                  {(overview?.activities ?? []).map((activity) => <td key={activity.type} className="p-3 text-right">{row.counts[activity.type as ActivityType]}건</td>)}
                  <td className="p-3 text-right text-slate-500">{row.excludedAuto}·{row.excludedManual}건</td>
                  <td className="p-3 text-right">{formatKrw(gross)}</td>
                  <td className="p-3 text-right font-semibold">{formatKrw(net)}</td>
                  <td className="p-3">{statement ? <Pill {...SETTLEMENT_STATUS[statement.status]} /> : <span className="text-xs text-slate-500">미산출</span>}</td>
                  <td className="p-3">
                    {row.unreconciled > 0 && <Button size="sm" variant="outline" className="mr-1.5 border-amber-300 text-amber-900" disabled={reconcile.isPending} onClick={() => reconcile.mutate({ month, teacherId: row.teacherId })}>장부 정리 ({row.unreconciled}건)</Button>}
                    {statement?.status === "draft" && <Button size="sm" variant="outline" disabled={!overview?.isClosed || confirm.isPending || row.unreconciled > 0} onClick={() => confirm.mutate({ id: statement.id })}>확정</Button>}
                    {statement?.status === "confirmed" && <Button size="sm" onClick={() => setPaidTarget({ id: statement.id, label: `${row.name || row.email || "교사"} · ${month} · ${formatKrw(statement.netKrw)}` })}>지급 완료</Button>}
                  </td>
                </tr>
              );
            })}
            {!overviewQuery.isLoading && rows.length === 0 && <tr><td colSpan={8} className="p-8 text-center text-slate-500">승인된 교사가 없습니다.</td></tr>}
          </tbody>
        </table>
      </Card>
      <p className="text-xs leading-5 text-slate-500">산출 중(초안)인 정산서는 단가·건수가 바뀌면 다시 산출할 수 있고, 확정하면 그 시점의 단가·건수·원천징수율로 고정됩니다. 지급 완료는 실제 이체를 마친 뒤에 처리하세요.</p>

      <Dialog open={Boolean(paidTarget)} onOpenChange={(open) => { if (!open) setPaidTarget(null); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>지급 완료 처리</DialogTitle>
            <DialogDescription>{paidTarget?.label}. 실제 이체를 마친 뒤에 처리하세요.</DialogDescription>
          </DialogHeader>
          <Input value={note} onChange={(event) => setNote(event.target.value)} placeholder="메모(선택, 예: 10월 말 계좌 이체)" aria-label="지급 메모" />
          <DialogFooter>
            <Button variant="outline" onClick={() => setPaidTarget(null)}>취소</Button>
            <Button disabled={markPaid.isPending} onClick={() => paidTarget && markPaid.mutate({ id: paidTarget.id, note: note.trim() || undefined })}>{markPaid.isPending ? "처리 중..." : "지급 완료"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function SettlementSettingsTab() {
  const utils = trpc.useUtils();
  const overviewQuery = trpc.settlement.adminOverview.useQuery({ month: currentMonthKst() });
  const overview = overviewQuery.data;
  const settingsError = overviewQuery.error;
  const [rateDrafts, setRateDrafts] = useState<Record<string, string>>({});
  const [withholdingDraft, setWithholdingDraft] = useState<string | null>(null);
  const saveRate = trpc.settlement.adminSaveRate.useMutation({
    onSuccess: () => { toast.success("단가를 저장했습니다. 이후 산출하는 정산서부터 적용됩니다."); utils.settlement.adminOverview.invalidate(); },
    onError: (error) => toast.error(error.message || "단가를 저장하지 못했습니다."),
  });
  const saveWithholding = trpc.settlement.adminSaveWithholding.useMutation({
    onSuccess: () => { toast.success("원천징수율을 저장했습니다."); utils.settlement.adminOverview.invalidate(); },
    onError: (error) => toast.error(error.message || "원천징수율을 저장하지 못했습니다."),
  });

  if (settingsError) return <LoadError message={settingsError.message} />;
  return (
    <div className="space-y-4">
      <Card className="space-y-4 p-5">
        <div>
          <h2 className="text-lg font-bold text-slate-900">활동별 건당 단가</h2>
          <p className="mt-1 text-sm text-slate-600">정산서를 산출할 때 활동 건수에 곱하는 단가입니다. 이미 확정된 정산서는 바뀌지 않습니다.</p>
        </div>
        <div className="space-y-3">
          {(overview?.activities ?? []).map((activity) => {
            const current = overview?.rates[activity.type as ActivityType] ?? activity.defaultUnitKrw;
            const draft = rateDrafts[activity.type] ?? String(current);
            return (
              <div key={activity.type} className="flex flex-col gap-2 rounded-xl border border-slate-200 p-3 sm:flex-row sm:items-center sm:justify-between">
                <div><p className="font-semibold text-slate-900">{activity.label}</p><p className="text-xs text-slate-500">{activity.description}</p></div>
                <div className="flex items-center gap-2">
                  <Input type="number" min={0} max={1000000} step={100} value={draft} onChange={(event) => setRateDrafts((drafts) => ({ ...drafts, [activity.type]: event.target.value }))} className="w-32 text-right" aria-label={`${activity.label} 단가`} />
                  <span className="text-sm text-slate-600">원</span>
                  <Button size="sm" disabled={saveRate.isPending || draft === "" || Number(draft) === current} onClick={() => saveRate.mutate({ activityType: activity.type as ActivityType, unitAmountKrw: Math.round(Number(draft)) })}>저장</Button>
                </div>
              </div>
            );
          })}
        </div>
        <p className="text-xs text-amber-800">처음 설정된 단가는 임시 기본값입니다. 교사 계약 조건에 맞게 확인해 주세요.</p>
      </Card>

      <Card className="space-y-3 p-5">
        <div>
          <h2 className="text-lg font-bold text-slate-900">원천징수율</h2>
          <p className="mt-1 text-sm text-slate-600">사업소득으로 지급하는 경우의 원천징수율(소득세 3% + 지방소득세 0.3% = 3.3%)입니다. 간이 계산이며 실제 신고는 세무 기준에 따릅니다.</p>
        </div>
        <div className="flex items-center gap-2">
          <Input type="number" min={0} max={100} step={0.1} value={withholdingDraft ?? String(overview?.withholdingPct ?? 3.3)} onChange={(event) => setWithholdingDraft(event.target.value)} className="w-28 text-right" aria-label="원천징수율" />
          <span className="text-sm text-slate-600">%</span>
          <Button size="sm" disabled={saveWithholding.isPending || withholdingDraft === null || withholdingDraft === ""} onClick={() => saveWithholding.mutate({ pct: Number(withholdingDraft) })}>저장</Button>
        </div>
      </Card>
    </div>
  );
}
