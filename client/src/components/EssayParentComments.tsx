import React from "react";
import { Users } from "lucide-react";
import { trpc } from "@/lib/trpc";

const formatDate = (value: string | Date | null) =>
  value ? new Date(value).toLocaleDateString("ko-KR", { year: "numeric", month: "long", day: "numeric" }) : "";

// 한 편의 글에 연결된 학부모 코멘트. 첨삭 결과 화면과 글쓰기 화면에서 교사 코멘트·AI 첨삭과 함께 보여 준다.
// 코멘트가 없으면 아무것도 표시하지 않는다.
export default function EssayParentComments({ essayId }: { essayId: number | null | undefined }) {
  const { data } = trpc.parent.commentsForEssay.useQuery({ essayId: essayId ?? 0 }, { enabled: Boolean(essayId), retry: false });
  if (!essayId || !data || data.length === 0) return null;

  return (
    <section className="rounded-xl border border-sky-200 bg-sky-50/60 p-4" aria-label="학부모 코멘트" data-testid="essay-parent-comments">
      <h3 className="flex items-center gap-2 font-bold text-sky-950"><Users className="h-4 w-4" aria-hidden="true" />학부모 코멘트 <span className="text-xs font-normal text-slate-500">{data.length}건</span></h3>
      <ul className="mt-3 space-y-2">
        {data.map((item) => (
          <li key={item.id} className="rounded-lg bg-white p-3">
            <p className="whitespace-pre-wrap text-sm leading-6 text-slate-800">{item.comment}</p>
            <p className="mt-1 text-xs text-slate-500">{item.parentName}{item.createdAt ? ` · ${formatDate(item.createdAt)}` : ""}</p>
          </li>
        ))}
      </ul>
    </section>
  );
}
