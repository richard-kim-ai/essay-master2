import React from "react";
import { Link } from "wouter";
import { MessageSquare } from "lucide-react";
import { Card } from "@/components/ui/card";
import { trpc } from "@/lib/trpc";

const formatDate = (value: string | Date | null) =>
  value ? new Date(value).toLocaleDateString("ko-KR", { year: "numeric", month: "long", day: "numeric" }) : "";

// 연결된 학부모가 남긴 응원·지도 코멘트를 학생이 읽는 영역. 코멘트가 없으면 아무것도 표시하지 않는다.
export default function ParentComments() {
  const { data } = trpc.parent.myComments.useQuery();
  if (!data || data.length === 0) return null;

  return (
    <Card className="space-y-3 border-indigo-200 bg-white p-4 sm:p-5" aria-label="학부모 코멘트" data-testid="parent-comments">
      <div className="flex items-center gap-2">
        <MessageSquare className="h-4 w-4 text-indigo-600" aria-hidden="true" />
        <h2 className="text-base font-extrabold text-slate-900">학부모 코멘트</h2>
        <span className="text-xs text-slate-500">총 {data.length}건</span>
      </div>
      <ul className="max-h-80 space-y-2 overflow-y-auto pr-1">
        {data.map((item) => (
          <li key={item.id} className="rounded-xl bg-indigo-50/50 p-3">
            {item.essayId && <Link href={`/teacher-feedback/${item.essayId}`} className="mb-1 block text-xs font-semibold text-indigo-700 underline underline-offset-2">「{item.essayTitle || "내 글"}」 첨삭 결과에서 보기</Link>}
            <p className="whitespace-pre-wrap text-sm leading-6 text-slate-800">{item.comment}</p>
            <p className="mt-1 text-xs text-slate-500">{item.parentName}{item.essayId ? "" : " · 글과 연결되지 않은 이전 코멘트"}{item.createdAt ? ` · ${formatDate(item.createdAt)}` : ""}</p>
          </li>
        ))}
      </ul>
    </Card>
  );
}
