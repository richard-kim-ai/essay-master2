import React, { useEffect, useState } from "react";
import { Link } from "wouter";
import { toast } from "sonner";
import { CalendarClock, CheckCircle2, FlaskConical } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { trpc } from "@/lib/trpc";
import { TEACHER_FEEDBACK_PRODUCTS, formatKrw, type TeacherFeedbackKey } from "@shared/plans";
import { CORE_ITEM_MAX, FEEDBACK_DUE_BUSINESS_DAYS, FEEDBACK_ITEMS } from "@shared/teacherFeedbackRequest";

export function formatDueDate(value: Date | string) {
  return new Date(value).toLocaleDateString("ko-KR", { timeZone: "Asia/Seoul", year: "numeric", month: "long", day: "numeric", weekday: "short" });
}

/**
 * 교사 첨삭 신청: 상품 선택 → 안내(가격·완료 예정일·담당 교사·환불 기준) → 앱 안 결제.
 * 이용권 결제자만 신청할 수 있고, 결제하면 글이 담당 교사에게 제출된다.
 */
export default function TeacherFeedbackRequestDialog({
  essayId,
  open,
  onOpenChange,
  onRequested,
}: {
  essayId: number | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** 신청(또는 기관 계약 요청)이 끝나 글이 제출된 뒤 호출된다. */
  onRequested: (status: string) => void | Promise<void>;
}) {
  const utils = trpc.useUtils();
  const [productKey, setProductKey] = useState<TeacherFeedbackKey>("tf_standard");
  const [items, setItems] = useState<string[]>([]);
  useEffect(() => {
    if (open) setItems([]);
  }, [open, productKey]);

  const plans = trpc.billing.plans.useQuery(undefined, { enabled: open });
  const quote = trpc.teacherFeedbackRequest.quote.useQuery(
    { essayId: essayId ?? 0, productKey, items: productKey === "tf_core" ? items : undefined },
    { enabled: open && essayId !== null },
  );
  const create = trpc.teacherFeedbackRequest.create.useMutation({
    onSuccess: async (result) => {
      if (result.status === "redirect" && result.redirectUrl) {
        window.location.assign(result.redirectUrl);
        return;
      }
      toast.success("교사 첨삭을 신청했습니다. 담당 교사가 완료 예정일까지 첨삭해 드립니다.");
      await Promise.all([utils.teacherFeedbackRequest.mine.invalidate(), utils.billing.myOrders.invalidate()]);
      onOpenChange(false);
      await onRequested("submitted");
    },
    onError: (error) => toast.error(error.message || "교사 첨삭을 신청하지 못했습니다."),
  });
  // 기관 계약이 비용을 부담하는 학생을 위한 기존 무료 요청 경로(개인 결제와 별개).
  const contractRequest = trpc.essaySubmission.requestTeacher.useMutation({
    onSuccess: async (result) => {
      toast.success("기관 계약으로 교사 첨삭을 요청했습니다.");
      onOpenChange(false);
      await onRequested(result.status);
    },
    onError: (error) => toast.error(error.message || "교사 첨삭을 요청하지 못했습니다."),
  });

  const data = quote.data;
  const product = TEACHER_FEEDBACK_PRODUCTS.find((item) => item.key === productKey);
  const needsPass = Boolean(data?.reasons.some((reason) => reason.includes("이용권")));
  const needsTeacher = Boolean(data?.reasons.some((reason) => reason.includes("담당 교사")));
  const busy = create.isPending || contractRequest.isPending;

  const toggleItem = (key: string) =>
    setItems((current) => (current.includes(key) ? current.filter((item) => item !== key) : current.length >= CORE_ITEM_MAX ? current : [...current, key]));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>교사 첨삭 신청</DialogTitle>
          <DialogDescription>이용권 결제자가 건별로 추가 결제해 신청합니다. 결과를 받기 전에는 언제든 전액 환불로 취소할 수 있어요.</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid gap-2 sm:grid-cols-3" role="radiogroup" aria-label="교사 첨삭 상품">
            {TEACHER_FEEDBACK_PRODUCTS.map((item) => {
              const active = item.key === productKey;
              return (
                <button
                  key={item.key}
                  type="button"
                  role="radio"
                  aria-checked={active}
                  onClick={() => setProductKey(item.key)}
                  className={`rounded-xl border p-3 text-left text-sm transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 ${active ? "border-indigo-500 bg-indigo-50 ring-1 ring-indigo-500" : "border-slate-200 bg-white hover:border-indigo-200"}`}
                >
                  <p className="font-bold text-slate-900">{item.name.replace("교사 ", "").replace(" 첨삭지도", "")}</p>
                  <p className="mt-1 text-base font-black text-slate-900">{formatKrw(item.priceKrw)}</p>
                  <p className="mt-1 text-xs leading-5 text-slate-600">{item.description}</p>
                </button>
              );
            })}
          </div>

          {productKey === "tf_core" && (
            <fieldset className="rounded-xl border border-slate-200 p-3">
              <legend className="px-1 text-xs font-semibold text-slate-700">첨삭받을 평가항목 선택 (최대 {CORE_ITEM_MAX}개)</legend>
              <div className="flex flex-wrap gap-2">
                {FEEDBACK_ITEMS.map((item) => {
                  const checked = items.includes(item.key);
                  return (
                    <label key={item.key} className={`flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-1.5 text-sm ${checked ? "border-indigo-500 bg-indigo-50 text-indigo-900" : "border-slate-200 text-slate-700"}`}>
                      <input type="checkbox" checked={checked} onChange={() => toggleItem(item.key)} disabled={!checked && items.length >= CORE_ITEM_MAX} />
                      {item.label}
                    </label>
                  );
                })}
              </div>
            </fieldset>
          )}

          {quote.isLoading && <p className="text-sm text-slate-500">신청 가능 여부를 확인하는 중입니다...</p>}

          {data && !data.eligible && (
            <div className="space-y-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-950" role="status">
              <ul className="list-disc space-y-1 pl-5">{data.reasons.map((reason) => <li key={reason}>{reason}</li>)}</ul>
              <div className="flex flex-wrap gap-2 pt-1">
                {needsPass && <Link href="/checkout"><Button size="sm" className="bg-indigo-600 text-white hover:bg-indigo-700">이용권 결제하러 가기</Button></Link>}
                {needsTeacher && <Link href="/mypage"><Button size="sm" variant="outline">담당 교사 선택하기</Button></Link>}
              </div>
            </div>
          )}

          {data?.eligible && (
            <div className="space-y-3 rounded-xl border border-indigo-100 bg-indigo-50/50 p-4 text-sm">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="font-bold text-slate-900">{data.productName} · {formatKrw(data.priceKrw)}</span>
                <span className="text-slate-600">담당 교사 {data.teacherName ?? "-"}</span>
              </div>
              <div className="flex items-start gap-2 text-slate-800">
                <CalendarClock className="mt-0.5 h-4 w-4 shrink-0 text-indigo-700" aria-hidden="true" />
                <div>
                  <p><strong>완료 예정일 {formatDueDate(data.dueAt)}</strong>까지</p>
                  <p className="mt-0.5 text-xs leading-5 text-slate-600">
                    신청(결제)한 날부터 주말을 뺀 {FEEDBACK_DUE_BUSINESS_DAYS}영업일 안에 담당 교사가 결과를 전달하기로 한 날짜입니다. 이 날짜가 지나도 전달되지 않으면 전액 환불하거나 계속 기다릴 수 있습니다.
                  </p>
                </div>
              </div>
              <p className="flex items-start gap-2 text-xs leading-5 text-slate-600"><CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" aria-hidden="true" />{data.refundNotice}</p>
              {plans.data?.isTest && (
                <p className="flex items-start gap-2 rounded-lg bg-amber-50 p-2 text-xs leading-5 text-amber-950"><FlaskConical className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />임시(테스트) 결제입니다. 실제 요금은 청구되지 않습니다.</p>
              )}
            </div>
          )}

          {data?.contractFunded && essayId !== null && (
            <div className="rounded-xl border border-slate-200 p-3 text-sm text-slate-700">
              <p>기관 계약이 비용을 부담하는 학생은 결제 없이 <strong>기관 계약으로 요청</strong>할 수도 있습니다(개인 결제와 별개).</p>
              <Button size="sm" variant="outline" className="mt-2" disabled={busy} onClick={() => contractRequest.mutate({ essayId })}>
                {contractRequest.isPending ? "요청 중..." : "기관 계약으로 요청"}
              </Button>
            </div>
          )}
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>닫기</Button>
          <Button
            className="bg-indigo-600 text-white hover:bg-indigo-700"
            disabled={busy || !data?.eligible || essayId === null}
            onClick={() => essayId !== null && create.mutate({ essayId, productKey, items: productKey === "tf_core" ? items : undefined })}
          >
            {create.isPending ? "결제 중..." : `결제하고 신청하기${product ? ` (${formatKrw(product.priceKrw)})` : ""}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
