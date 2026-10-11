import React from "react";
import { Star } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { trpc } from "@/lib/trpc";

export function Stars({ value, size = "h-4 w-4" }: { value: number | null; size?: string }) {
  const rounded = value === null ? 0 : Math.round(value);
  return (
    <span className="inline-flex" aria-label={value === null ? "평가 없음" : `별점 ${value}점`}>
      {[1, 2, 3, 4, 5].map((index) => (
        <Star key={index} className={`${size} ${index <= rounded ? "fill-amber-400 text-amber-400" : "text-slate-300"}`} aria-hidden="true" />
      ))}
    </span>
  );
}

const formatDate = (value: string | Date) => new Date(value).toLocaleDateString("ko-KR", { year: "numeric", month: "long", day: "numeric" });

// 관리자가 교사 한 명의 평점·후기와 활동(담당 학생·첨삭 수)을 보고 평가·관리하는 패널(회원 상세의 교사 화면).
export default function TeacherRatingPanel({ teacherId }: { teacherId: number }) {
  const detail = trpc.teacherRating.detail.useQuery({ teacherId });
  const profile = trpc.teacherRating.profile.useQuery({ teacherId });
  const summary = detail.data;
  const total = summary?.count ?? 0;

  return (
    <div className="space-y-6" data-testid="teacher-rating-panel">
      <div className="grid gap-4 sm:grid-cols-4">
        <Card><CardContent className="p-4"><p className="text-xs font-medium text-slate-500">평균 별점</p><p className="mt-1 flex items-center gap-2 text-2xl font-extrabold text-slate-900" data-testid="rating-average">{summary?.average ?? "–"}<Stars value={summary?.average ?? null} /></p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-xs font-medium text-slate-500">받은 평가</p><p className="mt-1 text-2xl font-extrabold text-slate-900">{total}건</p><p className="text-[11px] text-slate-400">낮은 평가(2점 이하) {summary?.lowCount ?? 0}건</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-xs font-medium text-slate-500">등록한 첨삭</p><p className="mt-1 text-2xl font-extrabold text-slate-900">{profile.data?.feedbackCount ?? 0}건</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-xs font-medium text-slate-500">담당 학생</p><p className="mt-1 text-2xl font-extrabold text-slate-900">{profile.data?.assignedStudents ?? 0}명</p></CardContent></Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">별점 분포</CardTitle>
          <CardDescription>학생이 첨삭을 받은 뒤 남긴 별점입니다.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {([5, 4, 3, 2, 1] as const).map((star) => {
            const n = summary?.distribution?.[star] ?? 0;
            return (
              <div key={star} className="flex items-center gap-3 text-sm">
                <span className="w-8 shrink-0 text-slate-600">{star}점</span>
                <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-amber-400" style={{ width: total ? `${(n / total) * 100}%` : "0%" }} /></div>
                <span className="w-10 shrink-0 text-right text-slate-500">{n}건</span>
              </div>
            );
          })}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">학생 후기 ({summary?.reviews?.filter((item) => item.review).length ?? 0}건)</CardTitle>
          <CardDescription>최근 후기부터 보여 줍니다. 후기가 없는 평가는 별점만 집계됩니다.</CardDescription>
        </CardHeader>
        <CardContent>
          {detail.isLoading ? (
            <p className="py-6 text-center text-sm text-slate-500">불러오는 중입니다...</p>
          ) : !summary || summary.reviews.length === 0 ? (
            <p className="py-6 text-center text-sm text-slate-500" data-testid="no-reviews">아직 받은 평가가 없습니다.</p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {summary.reviews.map((item) => (
                <li key={item.id} className="py-3">
                  <div className="flex flex-wrap items-center gap-2"><Stars value={item.rating} /><span className="text-sm font-bold text-slate-900">{item.rating}점</span><span className="text-xs text-slate-500">{item.studentName || "이름 없음"} · {formatDate(item.createdAt)}{item.essayTitle ? ` · ${item.essayTitle}` : ""}</span></div>
                  {item.review ? <p className="mt-1 whitespace-pre-wrap text-sm leading-6 text-slate-700">{item.review}</p> : <p className="mt-1 text-xs text-slate-400">후기 없음</p>}
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
