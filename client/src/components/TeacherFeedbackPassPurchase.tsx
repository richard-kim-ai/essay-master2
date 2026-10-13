import React, { useState } from "react";
import { Link } from "wouter";
import { toast } from "sonner";
import { CheckCircle2, FlaskConical } from "lucide-react";
import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";
import { TEACHER_FEEDBACK_ELIGIBILITY_NOTICE, TEACHER_FEEDBACK_PASSES, formatKrw, type TeacherFeedbackPassKey } from "@shared/plans";

function formatDate(value: Date | string) {
  return new Date(value).toLocaleDateString("ko-KR", { timeZone: "Asia/Seoul" });
}

/**
 * 교사 첨삭지도권 구매·보유 현황. 일반 첨삭 1종을 1·3·5회분으로 판매하고, 신청할 때마다 1회씩 차감한다.
 * 이용권(학습형·AI 기본형·AI 집중형·AI 추가권)을 이용 중인 학습자만 구매할 수 있다.
 */
export default function TeacherFeedbackPassPurchase({ compact = false, studentId }: { compact?: boolean; /** 학부모가 연결된 자녀에게 구매해 줄 때 자녀의 계정 id */ studentId?: number }) {
  const utils = trpc.useUtils();
  const query = trpc.teacherFeedbackRequest.passes.useQuery(studentId ? { studentId } : undefined);
  const plans = trpc.billing.plans.useQuery();
  const [selected, setSelected] = useState<TeacherFeedbackPassKey>("tf_pass_3");
  const purchase = trpc.teacherFeedbackRequest.purchasePass.useMutation({
    onSuccess: async (result) => {
      if (result.status === "redirect" && result.redirectUrl) {
        window.location.assign(result.redirectUrl);
        return;
      }
      toast.success(studentId ? `${result.giftedTo || "자녀"} 학생에게 교사 첨삭지도권을 구매했습니다. 자녀가 글쓰기 화면에서 교사 첨삭을 신청할 수 있어요.` : "교사 첨삭지도권을 구매했습니다. 글쓰기 화면에서 교사 첨삭을 신청할 수 있어요.");
      await Promise.all([utils.teacherFeedbackRequest.passes.invalidate(), utils.teacherFeedbackRequest.quote.invalidate(), utils.billing.myOrders.invalidate()]);
    },
    onError: (error) => toast.error(error.message || "교사 첨삭지도권을 구매하지 못했습니다."),
  });

  const data = query.data;
  const usablePasses = (data?.passes ?? []).filter((pass) => pass.usable);
  const earliestExpiry = usablePasses.length > 0 ? usablePasses.map((pass) => new Date(pass.expiresAt).getTime()).sort((a, b) => a - b)[0] : null;
  const product = TEACHER_FEEDBACK_PASSES.find((item) => item.key === selected);

  return (
    <section aria-labelledby="tf-pass-title" className="space-y-3" data-testid="teacher-feedback-pass-purchase">
      <div className="flex flex-wrap items-center gap-2">
        <h2 id="tf-pass-title" className="text-lg font-bold text-slate-900">교사 첨삭지도권</h2>
        <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-bold text-amber-900">{TEACHER_FEEDBACK_ELIGIBILITY_NOTICE}</span>
      </div>
      {!compact && <p className="text-sm leading-6 text-slate-600">담당 교사가 논리·구성·근거에 대해 첨삭해 드립니다. 신청할 때마다 1회씩 차감되고, 결과를 받기 전에 취소하면 1회가 돌아옵니다.</p>}

      {data && (
        <p className="text-sm text-slate-700" data-testid="tf-pass-remaining">
          남은 첨삭 횟수 <strong>{data.totalRemaining}회</strong>
          {earliestExpiry !== null && <span className="text-slate-500"> · 가장 먼저 만료되는 권 {formatDate(new Date(earliestExpiry))}까지</span>}
        </p>
      )}

      <div className="grid gap-2 sm:grid-cols-3" role="radiogroup" aria-label="교사 첨삭지도권">
        {TEACHER_FEEDBACK_PASSES.map((item) => {
          const active = item.key === selected;
          const perSession = Math.round(item.priceKrw / item.sessions);
          return (
            <button
              key={item.key}
              type="button"
              role="radio"
              aria-checked={active}
              onClick={() => setSelected(item.key)}
              className={`rounded-xl border p-3 text-left text-sm transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 ${active ? "border-indigo-500 bg-indigo-50 ring-1 ring-indigo-500" : "border-slate-200 bg-white hover:border-indigo-200"}`}
            >
              <div className="flex items-center justify-between"><p className="font-bold text-slate-900">{item.sessions}회분</p>{item.featured && <span className="rounded-full bg-indigo-700 px-2 py-0.5 text-[11px] font-bold text-white">추천</span>}</div>
              <p className="mt-1 text-base font-black text-slate-900">{formatKrw(item.priceKrw)}</p>
              <p className="mt-1 text-xs text-slate-600">1회 약 {formatKrw(perSession)} · 구매일부터 {item.periodDays}일</p>
            </button>
          );
        })}
      </div>

      {data && !data.canBuy && (
        <div className="space-y-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-950" role="status">
          <ul className="list-disc space-y-1 pl-5">{data.buyReasons.map((reason) => <li key={reason}>{reason}</li>)}</ul>
          <Link href="/checkout"><Button size="sm" className="bg-indigo-600 text-white hover:bg-indigo-700">{studentId ? "자녀에게 이용권 구매하기" : "이용권 결제하러 가기"}</Button></Link>
        </div>
      )}

      {plans.data?.isTest && (
        <p className="flex items-start gap-2 rounded-lg bg-amber-50 p-2 text-xs leading-5 text-amber-950"><FlaskConical className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />임시(테스트) 결제입니다. 실제 요금은 청구되지 않습니다.</p>
      )}

      <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-200 p-3">
        <p className="flex items-center gap-2 text-sm text-slate-700"><CheckCircle2 className="h-4 w-4 text-emerald-600" aria-hidden="true" />{product ? `${product.name} · ${formatKrw(product.priceKrw)}` : ""}</p>
        <Button className="bg-indigo-600 text-white hover:bg-indigo-700" disabled={purchase.isPending || !data?.canBuy} onClick={() => purchase.mutate({ productKey: selected, ...(studentId ? { studentId } : {}) })}>
          {purchase.isPending ? "결제 중..." : "첨삭지도권 구매"}
        </Button>
      </div>
    </section>
  );
}
