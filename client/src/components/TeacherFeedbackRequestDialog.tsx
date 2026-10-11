import React from "react";
import { Link } from "wouter";
import { toast } from "sonner";
import { CalendarClock, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { trpc } from "@/lib/trpc";
import TeacherFeedbackPassPurchase from "@/components/TeacherFeedbackPassPurchase";
import { FEEDBACK_DUE_BUSINESS_DAYS } from "@shared/teacherFeedbackRequest";

export function formatDueDate(value: Date | string) {
  return new Date(value).toLocaleDateString("ko-KR", { timeZone: "Asia/Seoul", year: "numeric", month: "long", day: "numeric", weekday: "short" });
}

/**
 * 교사 첨삭 신청: 안내(남은 횟수·완료 예정일·담당 교사) → 교사 첨삭지도권 1회를 차감해 신청.
 * 권이 없으면 같은 화면에서 구매할 수 있다(이용권 결제자만). 결과를 받기 전에는 취소해 1회를 돌려받을 수 있다.
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
  const quote = trpc.teacherFeedbackRequest.quote.useQuery({ essayId: essayId ?? 0 }, { enabled: open && essayId !== null });
  const create = trpc.teacherFeedbackRequest.create.useMutation({
    onSuccess: async (result) => {
      toast.success(`교사 첨삭을 신청했습니다. 첨삭지도권 1회를 사용했고 ${result.remaining}회 남았어요.`);
      await Promise.all([utils.teacherFeedbackRequest.mine.invalidate(), utils.teacherFeedbackRequest.passes.invalidate()]);
      onOpenChange(false);
      await onRequested("submitted");
    },
    onError: (error) => toast.error(error.message || "교사 첨삭을 신청하지 못했습니다."),
  });
  // 기관 계약이 비용을 부담하는 학생을 위한 기존 무료 요청 경로(개인 첨삭지도권과 별개).
  const contractRequest = trpc.essaySubmission.requestTeacher.useMutation({
    onSuccess: async (result) => {
      toast.success("기관 계약으로 교사 첨삭을 요청했습니다.");
      onOpenChange(false);
      await onRequested(result.status);
    },
    onError: (error) => toast.error(error.message || "교사 첨삭을 요청하지 못했습니다."),
  });

  const data = quote.data;
  const needsTeacher = Boolean(data?.reasons.some((reason) => reason.includes("담당 교사")));
  const busy = create.isPending || contractRequest.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>교사 첨삭 신청</DialogTitle>
          <DialogDescription>교사 첨삭지도권 1회를 사용해 담당 교사에게 첨삭을 신청합니다. 결과를 받기 전에는 언제든 취소하고 1회를 돌려받을 수 있어요.</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {quote.isLoading && <p className="text-sm text-slate-500">신청 가능 여부를 확인하는 중입니다...</p>}

          {data && !data.eligible && (
            <div className="space-y-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-950" role="status">
              <ul className="list-disc space-y-1 pl-5">{data.reasons.map((reason) => <li key={reason}>{reason}</li>)}</ul>
              {needsTeacher && <Link href="/mypage"><Button size="sm" variant="outline">담당 교사 선택하기</Button></Link>}
            </div>
          )}

          {data?.eligible && (
            <div className="space-y-3 rounded-xl border border-indigo-100 bg-indigo-50/50 p-4 text-sm">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="font-bold text-slate-900">교사 첨삭지도권 {data.remaining}회 보유 → 신청하면 1회 사용</span>
                <span className="text-slate-600">담당 교사 {data.teacherName ?? "-"}</span>
              </div>
              <div className="flex items-start gap-2 text-slate-800">
                <CalendarClock className="mt-0.5 h-4 w-4 shrink-0 text-indigo-700" aria-hidden="true" />
                <div>
                  <p><strong>완료 예정일 {formatDueDate(data.dueAt)}</strong>까지</p>
                  <p className="mt-0.5 text-xs leading-5 text-slate-600">
                    신청한 날부터 주말을 뺀 {FEEDBACK_DUE_BUSINESS_DAYS}영업일 안에 담당 교사가 결과를 전달하기로 한 날짜입니다. 이 날짜가 지나도 전달되지 않으면 취소하고 1회를 돌려받거나 계속 기다릴 수 있습니다.
                  </p>
                </div>
              </div>
              <p className="flex items-start gap-2 text-xs leading-5 text-slate-600"><CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" aria-hidden="true" />{data.cancelNotice}</p>
            </div>
          )}

          {data && !data.eligible && data.canBuyPass && <TeacherFeedbackPassPurchase compact />}

          {data?.contractFunded && essayId !== null && (
            <div className="rounded-xl border border-slate-200 p-3 text-sm text-slate-700">
              <p>기관 계약이 비용을 부담하는 학생은 첨삭지도권 없이 <strong>기관 계약으로 요청</strong>할 수도 있습니다(개인 첨삭지도권과 별개).</p>
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
            onClick={() => essayId !== null && create.mutate({ essayId })}
          >
            {create.isPending ? "신청 중..." : "첨삭지도권 1회 사용해 신청"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
