import React from "react";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";

// 학생이 학부모의 학습 정보 열람 요청을 승인·거절하고, 이미 연결된 학부모를 해제하는 영역.
// 요청도 연결도 없으면 아무것도 표시하지 않는다.
export default function ParentLinkRequests() {
  const utils = trpc.useUtils();
  const { data } = trpc.parent.myParentLinks.useQuery();
  const respond = trpc.parent.respondToRequest.useMutation({
    onSuccess: (result) => {
      toast.success(result.status === "approved" ? "학부모의 학습 정보 열람을 승인했습니다." : "학부모 연결을 해제했습니다.");
      utils.parent.myParentLinks.invalidate();
    },
    onError: (error) => toast.error(error.message || "처리 중 오류가 발생했습니다."),
  });

  if (!data || (data.pending.length === 0 && data.approved.length === 0)) return null;

  return (
    <Card className="space-y-4 border-indigo-200 bg-white p-4 sm:p-5" aria-label="학부모 연결 관리">
      {data.pending.length > 0 && (
        <div>
          <h2 className="text-base font-extrabold text-slate-900">학부모 연결 요청</h2>
          <p className="mt-1 text-sm text-slate-600">승인하면 해당 학부모가 내 학습 진도와 제출한 답안, AI 첨삭 결과를 볼 수 있습니다. 모르는 사람이면 거절하세요.</p>
          <ul className="mt-3 space-y-2">
            {data.pending.map((request) => (
              <li key={request.linkId} className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-slate-50 p-3">
                <span className="text-sm font-semibold text-slate-800">{request.parentName || "이름 없음"} <span className="font-normal text-slate-500">({request.parentEmail})</span></span>
                <span className="flex gap-2">
                  <Button size="sm" disabled={respond.isPending} onClick={() => respond.mutate({ linkId: request.linkId, accept: true })}>승인</Button>
                  <Button size="sm" variant="outline" disabled={respond.isPending} onClick={() => respond.mutate({ linkId: request.linkId, accept: false })}>거절</Button>
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
      {data.approved.length > 0 && (
        <div>
          <h2 className="text-base font-extrabold text-slate-900">연결된 학부모</h2>
          <ul className="mt-3 space-y-2">
            {data.approved.map((parent) => (
              <li key={parent.linkId} className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-slate-50 p-3">
                <span className="text-sm font-semibold text-slate-800">{parent.parentName || "이름 없음"} <span className="font-normal text-slate-500">({parent.parentEmail})</span></span>
                <Button size="sm" variant="outline" disabled={respond.isPending} onClick={() => respond.mutate({ linkId: parent.linkId, accept: false })}>연결 해제</Button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </Card>
  );
}
