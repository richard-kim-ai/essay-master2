import React from "react";
import { useLocation } from "wouter";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { trpc } from "@/lib/trpc";
import { formatDueDate } from "@/components/TeacherFeedbackRequestDialog";

/**
 * 교사용 '첨삭 신청 대기열': 학생이 첨삭지도권으로 신청한 첨삭 건을 완료 예정일이 가까운 순으로 보여 주고,
 * '첨삭하기'를 누르면 작업을 시작하고 첨삭 작성 화면으로 이동한다. 교사 지급은 계약급여로 따로 집행하므로 금액은 표시하지 않는다.
 */
export default function TeacherFeedbackQueue() {
  const [, setLocation] = useLocation();
  const utils = trpc.useUtils();
  const query = trpc.teacherFeedbackRequest.queue.useQuery();
  const start = trpc.teacherFeedbackRequest.start.useMutation({
    onSuccess: async (result) => {
      await utils.teacherFeedbackRequest.queue.invalidate();
      setLocation(`/teacher-feedback/${result.essayId}`);
    },
    onError: (error) => toast.error(error.message || "작업을 시작하지 못했습니다."),
  });

  const rows = query.data ?? [];

  return (
    <Card className="border-slate-200" data-testid="teacher-feedback-queue">
      <CardHeader>
        <CardTitle className="text-lg">첨삭 신청 대기열 ({rows.length}건)</CardTitle>
        <CardDescription>학생이 교사 첨삭지도권을 사용해 신청한 첨삭입니다. 논리·구성·근거를 중심으로 완료 예정일까지 결과를 전달해 주세요.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {query.isLoading && <p className="text-sm text-slate-500">불러오는 중입니다...</p>}
        {!query.isLoading && rows.length === 0 && <div className="rounded-xl border border-dashed border-slate-300 p-8 text-center text-sm text-slate-500">대기 중인 첨삭 신청이 없습니다.</div>}
        {rows.map((row) => (
          <div key={row.id} className="space-y-1.5 rounded-xl border border-slate-200 p-4 text-sm">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="font-bold text-slate-900">{row.essayTitle ?? `글 #${row.essayId}`} <span className="font-normal text-slate-500">· {row.studentName ?? "학생"}</span></p>
              <span className="flex items-center gap-1.5">
                {row.overdue && <span className="rounded-full bg-rose-100 px-2.5 py-0.5 text-xs font-semibold text-rose-800">기한 경과</span>}
                <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-semibold text-slate-700">{row.status === "in_progress" ? "작업 중" : "대기"}</span>
              </span>
            </div>
            <p className="text-slate-700">완료 예정일 <strong>{formatDueDate(row.dueAt)}</strong>까지</p>
            {row.reworkCount > 0 && <p className="rounded-lg bg-amber-50 p-2 text-xs leading-5 text-amber-950">학생이 보완을 요청했습니다{row.reworkNote ? `: ${row.reworkNote}` : "."}</p>}
            <div className="pt-1">
              <Button size="sm" className="bg-indigo-600 text-white hover:bg-indigo-700" disabled={start.isPending} onClick={() => start.mutate({ requestId: row.id })}>
                {row.status === "in_progress" ? "이어서 첨삭하기" : "첨삭하기"}
              </Button>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
