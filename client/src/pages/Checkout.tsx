import React, { useState } from "react";
import { Link, useSearch } from "wouter";
import { toast } from "sonner";
import { CheckCircle2, FlaskConical } from "lucide-react";
import { useAuth } from "@/_core/hooks/useAuth";
import LoginRequired from "@/components/LoginRequired";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { trpc } from "@/lib/trpc";
import { PLANS, formatKrw, getPlan, type PlanKey } from "@shared/plans";

const ORDER_STATUS_LABELS: Record<string, string> = { pending: "결제 대기", paid: "결제 완료", failed: "결제 실패", cancelled: "취소", refunded: "환불" };

function formatDate(value: Date | string | null | undefined) {
  return value ? new Date(value).toLocaleDateString("ko-KR", { timeZone: "Asia/Seoul" }) : "-";
}

// 이용권 선택·결제·내 이용권 관리. 결제 제공자가 정해지기 전에는 임시(테스트) 결제로 곧바로 완료된다.
export default function Checkout() {
  const { user, isAuthenticated } = useAuth();
  const search = useSearch();
  const requested = new URLSearchParams(search).get("plan") ?? "";
  const [selected, setSelected] = useState<PlanKey>(getPlan(requested)?.key ?? "starter");
  const utils = trpc.useUtils();
  const learner = isAuthenticated && user?.role === "user" && user?.tag !== "학부모";
  const plansQuery = trpc.billing.plans.useQuery();
  const subscriptionQuery = trpc.billing.mySubscription.useQuery(undefined, { enabled: isAuthenticated });
  const ordersQuery = trpc.billing.myOrders.useQuery(undefined, { enabled: learner });
  const refresh = () => {
    utils.billing.mySubscription.invalidate();
    utils.billing.myOrders.invalidate();
    utils.aiAutoFeedback.getTodayQuota.invalidate();
  };
  const checkout = trpc.billing.startCheckout.useMutation({
    onSuccess: (result) => {
      if (result.status === "redirect" && result.redirectUrl) {
        window.location.assign(result.redirectUrl);
        return;
      }
      toast.success("이용권이 시작되었습니다.");
      refresh();
    },
    onError: (error) => toast.error(error.message || "결제를 완료하지 못했습니다."),
  });
  const cancel = trpc.billing.cancelSubscription.useMutation({
    onSuccess: (result) => {
      toast.success(`이용권을 해지했습니다. ${formatDate(result.periodEnd)}까지는 계속 이용할 수 있어요.`);
      refresh();
    },
    onError: (error) => toast.error(error.message || "해지하지 못했습니다."),
  });

  if (!isAuthenticated) return <LoginRequired />;
  if (!learner) {
    return (
      <div className="mx-auto max-w-xl px-4 py-16 text-center">
        <h1 className="text-2xl font-bold text-slate-900">학습자 계정에서 결제할 수 있습니다</h1>
        <p className="mt-2 text-sm text-slate-600">이용권은 학습자 계정에서 결제합니다. 학부모·교사·관리자 계정은 결제 대상이 아닙니다.</p>
        <Link href="/pricing"><Button variant="outline" className="mt-6">요금정책 보기</Button></Link>
      </div>
    );
  }

  const isTest = plansQuery.data?.isTest ?? true;
  const plan = getPlan(selected) ?? PLANS[0];
  const subscription = subscriptionQuery.data?.subscription ?? null;
  const entitlement = subscriptionQuery.data?.entitlement;
  const subscribedPlan = subscription ? getPlan(subscription.planKey) : undefined;
  const orders = ordersQuery.data ?? [];

  return (
    <div className="mx-auto max-w-4xl space-y-6 px-4 py-8 sm:px-6">
      <div>
        <h1 className="text-3xl font-bold text-slate-900">이용권 결제</h1>
        <p className="mt-2 text-sm leading-6 text-slate-600">학습량에 맞는 이용권을 선택하세요. 이용권은 결제일부터 {plan.periodDays}일 동안 유효하며, AI 논술 평가 횟수는 이용 기간 안에서 사용할 수 있습니다.</p>
      </div>

      {isTest && (
        <div className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-950" role="status">
          <FlaskConical className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          <p><strong>임시(테스트) 결제입니다.</strong> 결제 기능을 준비하는 중이라 실제 요금이 청구되지 않고, 결제하기를 누르면 바로 결제가 완료된 것으로 처리됩니다.</p>
        </div>
      )}

      {subscription && entitlement?.mode === "plan" && (
        <Card className="space-y-3 border-indigo-200 bg-indigo-50/50 p-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-lg font-bold text-indigo-900">{subscribedPlan?.name ?? subscription.planKey} 이용 중</p>
            <span className="rounded-full bg-white px-2.5 py-0.5 text-xs font-semibold text-indigo-800">{subscription.status === "cancelled" ? "해지됨 · 기간 종료까지 이용" : "이용 중"}</span>
          </div>
          <p className="text-sm text-slate-700">이용 기간 {formatDate(subscription.currentPeriodStart)} ~ {formatDate(subscription.currentPeriodEnd)}</p>
          <p className="text-sm text-slate-700">AI 논술 평가 <strong>{entitlement.used}</strong> / {entitlement.limit}회 사용 (남은 횟수 {entitlement.remaining}회)</p>
          <div className="flex flex-wrap gap-2">
            <Link href="/ai-auto-feedback"><Button size="sm" className="bg-indigo-600 hover:bg-indigo-700">AI 첨삭 받으러 가기</Button></Link>
            {subscription.status === "active" && <Button size="sm" variant="outline" disabled={cancel.isPending} onClick={() => cancel.mutate()}>{cancel.isPending ? "처리 중..." : "이용권 해지"}</Button>}
          </div>
        </Card>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        {PLANS.map((item) => {
          const active = item.key === selected;
          return (
            <button key={item.key} type="button" onClick={() => setSelected(item.key)} aria-pressed={active} className={`rounded-2xl border p-5 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 ${active ? "border-indigo-500 bg-indigo-50/60 shadow-sm" : "border-slate-200 bg-white hover:border-indigo-300"}`}>
              <div className="flex items-center justify-between"><p className="text-lg font-bold text-slate-900">{item.name}</p>{"featured" in item && item.featured && <span className="rounded-full bg-indigo-700 px-2 py-0.5 text-[11px] font-bold text-white">추천</span>}</div>
              <p className="mt-1 text-sm text-slate-600">{item.description}</p>
              <p className="mt-3 text-2xl font-black text-slate-900">{formatKrw(item.priceKrw)}<span className="ml-1 text-xs font-semibold text-slate-500">/ {item.periodDays}일</span></p>
              <ul className="mt-3 space-y-1.5">{item.features.map((feature) => <li key={feature} className="flex items-start gap-2 text-sm text-slate-700"><CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" aria-hidden="true" />{feature}</li>)}</ul>
            </button>
          );
        })}
      </div>

      <Card className="flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm text-slate-600">선택한 이용권</p>
          <p className="text-lg font-bold text-slate-900">{plan.name} · {formatKrw(plan.priceKrw)}</p>
          {subscription && <p className="text-xs text-slate-500">새로 결제하면 현재 이용권은 종료되고 새 이용권이 지금부터 시작됩니다.</p>}
        </div>
        <Button className="bg-indigo-600 hover:bg-indigo-700" disabled={checkout.isPending} onClick={() => checkout.mutate({ planKey: plan.key })}>{checkout.isPending ? "결제 중..." : isTest ? "임시 결제하기" : "결제하기"}</Button>
      </Card>

      <section aria-labelledby="order-history">
        <h2 id="order-history" className="text-lg font-bold text-slate-900">결제 내역</h2>
        <Card className="mt-3 overflow-x-auto p-0">
          <table className="w-full min-w-[520px] text-left text-sm">
            <thead className="bg-slate-50 text-xs text-slate-600"><tr><th className="p-3">결제일</th><th className="p-3">이용권</th><th className="p-3 text-right">금액</th><th className="p-3">상태</th></tr></thead>
            <tbody>
              {orders.map((order) => (
                <tr key={order.id} className="border-t border-slate-100">
                  <td className="p-3 text-slate-600">{formatDate(order.paidAt ?? order.createdAt)}</td>
                  <td className="p-3">{getPlan(order.planKey)?.name ?? order.planKey}{order.isTest === 1 && <span className="ml-2 rounded bg-amber-100 px-1.5 py-0.5 text-xs font-semibold text-amber-900">테스트</span>}</td>
                  <td className="p-3 text-right">{formatKrw(order.amountKrw)}</td>
                  <td className="p-3">{ORDER_STATUS_LABELS[order.status] ?? order.status}</td>
                </tr>
              ))}
              {!ordersQuery.isLoading && orders.length === 0 && <tr><td colSpan={4} className="p-6 text-center text-slate-500">아직 결제 내역이 없습니다.</td></tr>}
            </tbody>
          </table>
        </Card>
      </section>
    </div>
  );
}
