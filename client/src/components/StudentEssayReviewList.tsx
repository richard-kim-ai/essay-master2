import React, { useState } from "react";
import { FileText, MessageSquareText, Search } from "lucide-react";
import { Link } from "wouter";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { trpc } from "@/lib/trpc";

type StatusFilter = "submitted" | "reviewed" | "all";

const FILTERS: Array<{ key: StatusFilter; label: string }> = [
  { key: "submitted", label: "첨삭 대기" },
  { key: "reviewed", label: "첨삭 완료" },
  { key: "all", label: "전체" },
];

const REQUEST_LABEL: Record<string, string> = {
  paid: "신청 완료 · 교사 대기",
  in_progress: "작업 중",
  delivered: "전달 완료",
  cancelled: "신청 취소",
  refunded: "환불됨",
};

function formatDate(value: string | Date | null | undefined) {
  if (!value) return "";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "" : date.toLocaleDateString("ko-KR", { year: "numeric", month: "long", day: "numeric" });
}

// 교사(담당 학생)·관리자(전체 학생)가 학생이 제출한 글을 목록으로 보고, 글을 골라 첨삭 화면으로 들어가는 목록.
export default function StudentEssayReviewList({ scope }: { scope: "teacher" | "admin" }) {
  const [status, setStatus] = useState<StatusFilter>("submitted");
  const [search, setSearch] = useState("");
  const list = trpc.essaySubmission.reviewList.useQuery({ status, search: search.trim() || undefined });
  const rows = list.data ?? [];
  const now = Date.now();

  return (
    <section aria-label="학생 제출 글" data-testid="student-essay-review-list" className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl font-bold text-slate-900">학생 제출 글 {list.data ? `(${rows.length}편)` : ""}</h2>
          <p className="mt-1 text-sm text-slate-600">
            {scope === "admin" ? "모든 학생이 제출한 글입니다." : "내가 담당하는 학생이 제출한 글입니다."} 글을 골라 첨삭하거나 첨삭 결과를 확인하세요.
          </p>
        </div>
        <label className="relative block w-full sm:w-72">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden="true" />
          <input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="제목·학생 이름·이메일 검색"
            aria-label="학생 글 검색"
            className="h-10 w-full rounded-lg border border-slate-300 bg-white pl-9 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </label>
      </div>

      <div role="tablist" aria-label="첨삭 상태" className="inline-flex rounded-xl border border-slate-200 bg-white p-1 shadow-sm">
        {FILTERS.map((filter) => (
          <button
            key={filter.key}
            type="button"
            role="tab"
            aria-selected={status === filter.key}
            onClick={() => setStatus(filter.key)}
            className={`rounded-lg px-4 py-2 text-sm font-bold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 ${status === filter.key ? "bg-indigo-700 text-white" : "text-slate-600 hover:bg-slate-50"}`}
          >
            {filter.label}
          </button>
        ))}
      </div>

      {list.isLoading && <p className="py-10 text-center text-sm text-slate-500">불러오는 중입니다...</p>}
      {list.error && <p className="rounded-lg border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">{list.error.message}</p>}
      {!list.isLoading && !list.error && rows.length === 0 && (
        <Card className="p-8 text-center text-sm text-slate-600">
          {search.trim() ? "검색 결과가 없습니다." : status === "reviewed" ? "첨삭을 완료한 글이 없습니다." : "첨삭을 기다리는 글이 없습니다."}
        </Card>
      )}

      <ul className="space-y-3">
        {rows.map((row) => {
          const open = row.requestStatus === "paid" || row.requestStatus === "in_progress";
          const overdue = open && row.requestDueAt && new Date(row.requestDueAt).getTime() < now;
          return (
            <li key={row.essayId}>
              <Card className="flex flex-col gap-3 border-slate-200 bg-white p-4 shadow-sm sm:flex-row sm:items-start sm:justify-between sm:p-5">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <FileText className="h-4 w-4 text-indigo-600" aria-hidden="true" />
                    <h3 className="truncate text-base font-extrabold text-slate-900">{row.title}</h3>
                    {row.hasTeacherFeedback ? (
                      <Badge className="bg-emerald-100 text-emerald-800 hover:bg-emerald-100">첨삭 완료{typeof row.teacherFeedbackScore === "number" ? ` · ${row.teacherFeedbackScore}점` : ""}</Badge>
                    ) : (
                      <Badge className="bg-amber-100 text-amber-800 hover:bg-amber-100">첨삭 대기</Badge>
                    )}
                    {row.requestStatus && <Badge variant="outline">{REQUEST_LABEL[row.requestStatus] ?? row.requestStatus}</Badge>}
                    {overdue && <Badge className="bg-rose-100 text-rose-800 hover:bg-rose-100">기한 경과</Badge>}
                  </div>
                  <p className="mt-1 text-xs text-slate-500">
                    {row.studentName || "이름 없음"} · {row.studentEmail || "이메일 없음"} · 제출 {formatDate(row.submittedAt ?? row.updatedAt)}
                    {open && row.requestDueAt ? ` · 완료 예정 ${formatDate(row.requestDueAt)}` : ""}
                  </p>
                  <p className="mt-2 line-clamp-2 text-sm leading-6 text-slate-600">{row.preview}</p>
                </div>
                <div className="flex shrink-0 flex-wrap gap-2">
                  <Link href={`/teacher-feedback/${row.essayId}`}>
                    <Button size="sm" className="bg-indigo-700 text-white hover:bg-indigo-800">
                      <MessageSquareText className="mr-1.5 h-3.5 w-3.5" /> {row.hasTeacherFeedback ? "첨삭 보기·수정" : "첨삭하기"}
                    </Button>
                  </Link>
                </div>
              </Card>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
