import React, { useState } from "react";
import { Link } from "wouter";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { trpc } from "@/lib/trpc";
import { formatKrw, getPlanName } from "@shared/plans";
import { formatDueDate } from "@/components/TeacherFeedbackRequestDialog";

export const REQUEST_STATUS_LABELS: Record<string, { label: string; style: string }> = {
  paid: { label: "결제 완료 · 교사 대기", style: "bg-sky-100 text-sky-900" },
  in_progress: { label: "교사 작업 중", style: "bg-indigo-100 text-indigo-900" },
  delivered: { label: "전달 완료", style: "bg-emerald-100 text-emerald-900" },
  cancelled: { label: "취소", style: "bg-slate-200 text-slate-700" },
  refunded: { label: "환불 완료", style: "bg-slate-200 text-slate-700" },
};

/** 내 교사 첨삭 신청: 진행 상태·완료 예정일, 전달 전 취소(전액 환불), 지연 시 선택, 전달 후 보완 요청. */
export default function MyTeacherFeedbackRequests() {
  const utils = trpc.useUtils();
  const query = trpc.teacherFeedbackRequest.mine.useQuery();
  const [reworkTarget, setReworkTarget] = useState<number | null>(null);
  const [reworkNote, setReworkNote] = useState("");
  // 환불은 되돌릴 수 없으므로 한 번 눌러 확인 문구를 보여 주고, 다시 눌러야 실행한다.
  const [confirmCancel, setConfirmCancel] = useState<number | null>(null);
  const refresh = () => Promise.all([utils.teacherFeedbackRequest.mine.invalidate(), utils.billing.myOrders.invalidate()]);

  const cancel = trpc.teacherFeedbackRequest.cancel.useMutation({
    onSuccess: async (result) => {
      toast.success(`신청을 취소하고 ${formatKrw(result.refundedKrw)}을 전액 환불했습니다.`);
      setConfirmCancel(null);
      await refresh();
    },
    onError: (error) => {
      toast.error(error.message || "취소하지 못했습니다.");
      setConfirmCancel(null);
    },
  });
  const rework = trpc.teacherFeedbackRequest.requestRework.useMutation({
    onSuccess: async (result) => {
      toast.success(`보완을 요청했습니다. 완료 예정일은 ${formatDueDate(result.dueAt)}입니다.`);
      setReworkTarget(null);
      setReworkNote("");
      await refresh();
    },
    onError: (error) => toast.error(error.message || "보완을 요청하지 못했습니다."),
  });

  const rows = query.data ?? [];
  if (query.isLoading || rows.length === 0) return null;

  return (
    <Card className="border-slate-200" data-testid="my-teacher-feedback-requests">
      <CardHeader>
        <CardTitle className="text-lg">내 교사 첨삭 신청</CardTitle>
        <CardDescription>결과가 전달되기 전에는 언제든 취소하고 전액 환불받을 수 있습니다.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {rows.map((row) => {
          const status = REQUEST_STATUS_LABELS[row.status] ?? { label: row.status, style: "bg-slate-100 text-slate-700" };
          const open = row.status === "paid" || row.status === "in_progress";
          return (
            <div key={row.id} className="space-y-2 rounded-xl border border-slate-200 p-4 text-sm">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="font-bold text-slate-900">{row.essayTitle ?? `글 #${row.essayId}`}</p>
                <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${status.style}`}>{status.label}</span>
              </div>
              <p className="text-slate-600">
                {getPlanName(row.productKey)} · {formatKrw(row.priceKrw)}
                {row.scopeLabel ? ` · ${row.scopeLabel}` : ""}
              </p>
              {open && (
                <p className="text-slate-700">
                  완료 예정일 <strong>{formatDueDate(row.dueAt)}</strong>까지
                  {row.reworkCount > 0 ? " (보완 진행 중)" : ""}
                </p>
              )}
              {row.overdue && (
                <p className="rounded-lg bg-amber-50 p-2 text-xs leading-5 text-amber-950" role="status">
                  완료 예정일이 지났습니다. 아래에서 <strong>전액 환불</strong>을 받거나 그대로 기다리실 수 있어요. 기다리시면 담당 교사가 곧 결과를 전달합니다.
                </p>
              )}
              <div className="flex flex-wrap items-center gap-2 pt-1">
                {open && confirmCancel !== row.id && (
                  <Button size="sm" variant="outline" onClick={() => setConfirmCancel(row.id)}>
                    {row.overdue ? "전액 환불받기" : "신청 취소(전액 환불)"}
                  </Button>
                )}
                {open && confirmCancel === row.id && (
                  <>
                    <span className="text-xs text-slate-700">신청을 취소하고 {formatKrw(row.priceKrw)}을 전액 환불받으시겠어요?</span>
                    <Button size="sm" className="bg-rose-600 text-white hover:bg-rose-700" disabled={cancel.isPending} onClick={() => cancel.mutate({ requestId: row.id })}>
                      {cancel.isPending ? "환불 중..." : "네, 취소하고 환불받기"}
                    </Button>
                    <Button size="sm" variant="ghost" disabled={cancel.isPending} onClick={() => setConfirmCancel(null)}>아니요</Button>
                  </>
                )}
                {row.status === "delivered" && (
                  <>
                    <Link href={`/teacher-feedback/${row.essayId}`}><Button size="sm" className="bg-indigo-600 text-white hover:bg-indigo-700">첨삭 결과 보기</Button></Link>
                    <Button size="sm" variant="outline" onClick={() => setReworkTarget(reworkTarget === row.id ? null : row.id)}>보완 요청</Button>
                  </>
                )}
              </div>
              {reworkTarget === row.id && (
                <div className="space-y-2 rounded-lg border border-slate-200 bg-slate-50 p-3">
                  <label className="block text-xs font-semibold text-slate-700" htmlFor={`rework-${row.id}`}>약속한 범위에 못 미친 부분을 알려 주세요 (무료로 보완해 드립니다)</label>
                  <textarea id={`rework-${row.id}`} value={reworkNote} onChange={(event) => setReworkNote(event.target.value)} rows={3} maxLength={2000} className="w-full rounded-md border border-slate-200 p-2 text-sm" placeholder="예) 근거에 대한 피드백이 빠져 있어요." />
                  <Button size="sm" className="bg-indigo-600 text-white hover:bg-indigo-700" disabled={rework.isPending || reworkNote.trim().length < 5} onClick={() => rework.mutate({ requestId: row.id, note: reworkNote })}>
                    {rework.isPending ? "요청 중..." : "보완 요청 보내기"}
                  </Button>
                </div>
              )}
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
