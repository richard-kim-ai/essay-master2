import React, { useEffect, useState } from "react";
import { Link, useSearch } from "wouter";
import { toast } from "sonner";
import { CheckCircle2, FlaskConical, Gift } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import TeacherFeedbackPassPurchase from "@/components/TeacherFeedbackPassPurchase";
import { trpc } from "@/lib/trpc";
import { PLANS, formatKrw, getPlan, getPlanName, type PlanKey } from "@shared/plans";

const ORDER_STATUS_LABELS: Record<string, string> = { pending: "결제 대기", paid: "결제 완료", failed: "결제 실패", cancelled: "취소", refunded: "환불" };
const formatDate = (value: Date | string | null | undefined) => (value ? new Date(value).toLocaleDateString("ko-KR", { timeZone: "Asia/Seoul" }) : "-");

/** 연결된 자녀의 이용권·남은 횟수. 구매 전에 현재 상태를 확인하는 용도다. */
export function ChildBillingSummary({ studentId }: { studentId: number }) {
  const { data, isLoading } = trpc.billing.studentBilling.useQuery({ studentId });
  if (isLoading) return <p className="text-sm text-slate-500">자녀의 이용권을 불러오는 중입니다...</p>;
  if (!data) return null;
  const entitlement = data.entitlement;
  return (
    <div className="space-y-3 text-sm" data-testid="child-billing-summary">
      {data.subscriptions.length === 0 && data.awaitingStart.length === 0 && <p className="text-slate-600">이용 중인 유료 이용권이 없습니다.</p>}
      {data.subscriptions.map((item) => (
        <p key={item.id} className="rounded-lg bg-indigo-50/60 p-3 text-slate-800"><strong>{getPlanName(item.planKey)}</strong> · 이용 중 · {formatDate(item.currentPeriodStart)} ~ {formatDate(item.currentPeriodEnd)}</p>
      ))}
      {data.awaitingStart.map((item) => (
        <p key={item.id} className="rounded-lg bg-amber-50 p-3 text-amber-950"><strong>{getPlanName(item.planKey)}</strong> · 결제 완료, 자녀가 '유료 이용 시작'을 누르면 {item.periodDays}일 동안 이용할 수 있습니다.</p>
      ))}
      {(entitlement.mode === "plan" || entitlement.mode === "trial") && <p className="text-slate-700">AI 평가·첨삭 <strong>{entitlement.used}</strong> / {entitlement.limit}회 사용 (남은 {entitlement.remaining}회)</p>}
      <p className="text-slate-700">교사 첨삭지도권 남은 횟수 <strong data-testid="child-pass-remaining">{data.passRemaining}회</strong></p>
    </div>
  );
}

/** 학부모가 연결된 자녀에게 이용권·교사 첨삭지도권을 구매해 주는 화면. 구매한 이용권은 자녀 계정에 지급된다. */
export default function ParentPurchase() {
  const search = useSearch();
  const requestedStudent = Number(new URLSearchParams(search).get("student")) || null;
  const requestedPlan = new URLSearchParams(search).get("plan") ?? "";
  const utils = trpc.useUtils();
  const linked = trpc.parent.linkedStudents.useQuery();
  const plansQuery = trpc.billing.plans.useQuery();
  const ordersQuery = trpc.billing.myOrders.useQuery();
  const [studentId, setStudentId] = useState<number | null>(requestedStudent);
  const [selected, setSelected] = useState<PlanKey>(getPlan(requestedPlan)?.key ?? "ai_basic");

  const students = linked.data ?? [];
  useEffect(() => {
    if (students.length === 0) return;
    if (!studentId || !students.some((student) => student.id === studentId)) setStudentId(students[0].id);
  }, [students, studentId]);
  const child = students.find((student) => student.id === studentId) ?? null;
  const plan = getPlan(selected) ?? PLANS[0];
  const isTest = plansQuery.data?.isTest ?? true;

  const checkout = trpc.billing.startCheckout.useMutation({
    onSuccess: (result) => {
      if (result.status === "redirect" && result.redirectUrl) {
        window.location.assign(result.redirectUrl);
        return;
      }
      toast.success(`${result.giftedTo || "자녀"} 학생에게 ${plan.name}을(를) 구매했습니다. ${plan.kind === "package" ? "자녀가 이용권 화면에서 '유료 이용 시작'을 누르면 30일이 시작됩니다." : "구매일부터 90일 동안 사용할 수 있습니다."}`);
      void utils.billing.studentBilling.invalidate();
      void utils.billing.myOrders.invalidate();
      void utils.teacherFeedbackRequest.passes.invalidate();
    },
    onError: (error) => toast.error(error.message || "결제를 완료하지 못했습니다."),
  });

  if (linked.isLoading) return <div className="mx-auto max-w-3xl px-4 py-16 text-center text-sm text-slate-500">자녀 정보를 불러오는 중입니다...</div>;
  if (students.length === 0) {
    return (
      <div className="mx-auto max-w-xl px-4 py-16 text-center" data-testid="parent-purchase-no-child">
        <h1 className="text-2xl font-bold text-slate-900">연결된 자녀가 없습니다</h1>
        <p className="mt-2 text-sm leading-6 text-slate-600">이용권과 첨삭지도권은 연결을 승인한 자녀 계정에 지급됩니다. 학부모 포털에서 자녀 계정을 연결하고, 자녀가 승인하면 구매할 수 있습니다.</p>
        <Link href="/parent-portal"><Button className="mt-6 bg-indigo-600 hover:bg-indigo-700">학부모 포털로 이동</Button></Link>
      </div>
    );
  }

  const orders = ordersQuery.data ?? [];
  const nameOf = (id: number) => students.find((student) => student.id === id)?.name || `학생 #${id}`;

  return (
    <div className="mx-auto max-w-7xl space-y-6 px-4 py-8 sm:px-6" data-testid="parent-purchase">
      <div>
        <h1 className="flex items-center gap-2 text-3xl font-bold text-slate-900"><Gift className="h-7 w-7 text-indigo-600" aria-hidden="true" />자녀에게 이용권 구매</h1>
        <p className="mt-2 text-sm leading-6 text-slate-600">연결을 승인한 자녀에게 이용권과 교사 첨삭지도권을 구매해 줄 수 있습니다. 구매한 이용권은 <strong>자녀 계정</strong>에 지급되고 자녀의 학습에 사용됩니다. 학습형·AI 기본형·AI 집중형은 결제 후 자녀가 <strong>'유료 이용 시작'</strong>을 눌러야 30일이 시작됩니다.</p>
      </div>

      {isTest && (
        <div className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-950" role="status">
          <FlaskConical className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          <p><strong>임시(테스트) 결제입니다.</strong> 결제 기능을 준비하는 중이라 실제 요금이 청구되지 않고, 결제하기를 누르면 바로 결제가 완료된 것으로 처리됩니다.</p>
        </div>
      )}

      <Card className="space-y-3 p-5">
        <div className="flex flex-wrap items-center gap-3">
          <label htmlFor="gift-child" className="text-sm font-semibold text-slate-700">이용권을 받을 자녀</label>
          <select id="gift-child" className="h-9 rounded-md border border-slate-200 bg-slate-50 px-3 text-sm font-medium text-slate-800" value={studentId ?? ""} onChange={(event) => setStudentId(Number(event.target.value))}>
            {students.map((student) => <option key={student.id} value={student.id}>{student.name || `학생 #${student.id}`} · {student.courseLabel || student.tag || "과정 미설정"}</option>)}
          </select>
        </div>
        {studentId && <ChildBillingSummary studentId={studentId} />}
      </Card>

      <div className="grid gap-4 sm:grid-cols-2">
        {PLANS.map((item) => {
          const active = item.key === selected;
          return (
            <button key={item.key} type="button" onClick={() => setSelected(item.key)} aria-pressed={active} className={`rounded-2xl border p-5 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 ${active ? "border-indigo-500 bg-indigo-50 ring-1 ring-indigo-500" : "border-slate-200 bg-white hover:border-indigo-300"}`}>
              <p className="text-lg font-bold text-slate-900">{item.name}</p>
              <p className="mt-1 text-sm text-slate-600">{item.description}</p>
              <p className="mt-3 text-2xl font-black text-slate-900">{formatKrw(item.priceKrw)}<span className="ml-1 text-xs font-semibold text-slate-500">/ {item.periodDays}일</span></p>
              <ul className="mt-3 space-y-1.5">{item.features.map((feature) => <li key={feature} className="flex items-start gap-2 text-sm text-slate-700"><CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" aria-hidden="true" />{feature}</li>)}</ul>
            </button>
          );
        })}
      </div>

      <Card className="flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm text-slate-600">{child?.name || "자녀"} 학생에게 구매</p>
          <p className="text-lg font-bold text-slate-900">{plan.name} · {formatKrw(plan.priceKrw)}</p>
        </div>
        <Button className="bg-indigo-600 hover:bg-indigo-700" disabled={checkout.isPending || !studentId} onClick={() => studentId && checkout.mutate({ planKey: plan.key, studentId })}>
          {checkout.isPending ? "결제 중..." : isTest ? "테스트 결제로 구매해 주기" : "결제하고 구매해 주기"}
        </Button>
      </Card>

      <Card className="p-5">{studentId && <TeacherFeedbackPassPurchase studentId={studentId} />}</Card>

      <section aria-labelledby="gift-orders">
        <h2 id="gift-orders" className="text-lg font-bold text-slate-900">구매해 준 내역</h2>
        <Card className="mt-3 overflow-x-auto p-0">
          <table className="w-full min-w-[520px] text-left text-sm">
            <thead className="bg-slate-50 text-xs text-slate-600"><tr><th className="p-3">결제일</th><th className="p-3">받은 자녀</th><th className="p-3">상품</th><th className="p-3 text-right">금액</th><th className="p-3">상태</th></tr></thead>
            <tbody>
              {orders.map((order) => (
                <tr key={order.id} className="border-t border-slate-100">
                  <td className="p-3 text-slate-600">{formatDate(order.paidAt ?? order.createdAt)}</td>
                  <td className="p-3">{nameOf(order.userId)}</td>
                  <td className="p-3">{getPlanName(order.planKey)}{order.isTest === 1 && <span className="ml-2 rounded bg-amber-100 px-1.5 py-0.5 text-xs font-semibold text-amber-900">테스트</span>}</td>
                  <td className="p-3 text-right">{formatKrw(order.amountKrw)}</td>
                  <td className="p-3">{ORDER_STATUS_LABELS[order.status] ?? order.status}</td>
                </tr>
              ))}
              {!ordersQuery.isLoading && orders.length === 0 && <tr><td colSpan={5} className="p-6 text-center text-slate-500">아직 구매해 준 내역이 없습니다.</td></tr>}
            </tbody>
          </table>
        </Card>
      </section>
    </div>
  );
}
