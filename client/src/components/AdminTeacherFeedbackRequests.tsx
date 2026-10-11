import React, { useState } from "react";
import { Card } from "@/components/ui/card";
import { trpc } from "@/lib/trpc";
import { formatKrw, getPlanName } from "@shared/plans";
import { REQUEST_STATUS_LABELS } from "@/components/MyTeacherFeedbackRequests";

const FILTERS = [
  { value: "", label: "전체" },
  { value: "paid", label: "신청 완료 · 교사 대기" },
  { value: "in_progress", label: "교사 작업 중" },
  { value: "delivered", label: "전달 완료" },
  { value: "refunded", label: "환불 처리" },
  { value: "cancelled", label: "취소" },
] as const;

function formatDateTime(value: Date | string | null | undefined) {
  return value ? new Date(value).toLocaleString("ko-KR", { timeZone: "Asia/Seoul" }) : "-";
}

function formatDate(value: Date | string | null | undefined) {
  return value ? new Date(value).toLocaleDateString("ko-KR", { timeZone: "Asia/Seoul" }) : "-";
}

/**
 * 관리자용 교사 첨삭 신청·첨삭지도권 목록: 신청 상태와 완료 예정일 경과(지연) 건, 판매된 권의 잔여 횟수를 확인한다.
 * 권의 환불은 '결제 내역' 탭에서 주문을 환불하면 권과 진행 중인 신청이 함께 환불 처리된다.
 */
export default function AdminTeacherFeedbackRequests() {
  const [status, setStatus] = useState<(typeof FILTERS)[number]["value"]>("");
  const query = trpc.teacherFeedbackRequest.adminList.useQuery({ status: status || undefined, limit: 200 });
  const rows = query.data ?? [];
  const overdueCount = rows.filter((row) => row.overdue).length;
  const passesQuery = trpc.teacherFeedbackRequest.adminPasses.useQuery({ limit: 200 });
  const passes = passesQuery.data ?? [];

  return (
    <div className="space-y-3" data-testid="admin-teacher-feedback-requests">
      <div className="flex flex-wrap items-center gap-3">
        <select value={status} onChange={(event) => setStatus(event.target.value as typeof status)} className="h-10 rounded-md border border-slate-200 bg-white px-3 text-sm" aria-label="신청 상태 필터">
          {FILTERS.map((filter) => <option key={filter.value} value={filter.value}>{filter.label}</option>)}
        </select>
        <p className="text-sm text-slate-600">{rows.length}건{overdueCount > 0 ? ` · 완료 예정일 경과 ${overdueCount}건` : ""}</p>
      </div>
      <Card className="overflow-x-auto p-0">
        <table className="w-full min-w-[820px] text-left text-sm">
          <thead className="bg-slate-50 text-xs text-slate-600">
            <tr><th className="p-3">신청일</th><th className="p-3">학생</th><th className="p-3">글</th><th className="p-3">상태</th><th className="p-3">완료 예정일</th><th className="p-3">사용한 권</th></tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const label = REQUEST_STATUS_LABELS[row.status] ?? { label: row.status, style: "bg-slate-100 text-slate-700" };
              return (
                <tr key={row.id} className="border-t border-slate-100">
                  <td className="p-3 text-xs text-slate-600">{formatDateTime(row.createdAt)}</td>
                  <td className="p-3"><p className="font-semibold text-slate-900">{row.studentName || "-"}</p><p className="text-xs text-slate-500">{row.studentEmail || "-"}</p></td>
                  <td className="p-3">{row.essayTitle ?? `글 #${row.essayId}`}</td>
                  <td className="p-3"><span className={`inline-block rounded-full px-2 py-0.5 text-xs font-semibold ${label.style}`}>{label.label}</span>{row.overdue && <span className="ml-1 rounded-full bg-rose-100 px-2 py-0.5 text-xs font-semibold text-rose-800">기한 경과</span>}</td>
                  <td className="p-3 text-xs text-slate-600">{formatDateTime(row.dueAt)}</td>
                  <td className="p-3 text-xs text-slate-500">권 #{row.passId}</td>
                </tr>
              );
            })}
            {!query.isLoading && rows.length === 0 && <tr><td colSpan={6} className="p-8 text-center text-slate-500">교사 첨삭 신청이 없습니다.</td></tr>}
          </tbody>
        </table>
      </Card>

      <h3 className="pt-2 text-base font-bold text-slate-900">판매된 교사 첨삭지도권</h3>
      <Card className="overflow-x-auto p-0" data-testid="admin-teacher-feedback-passes">
        <table className="w-full min-w-[760px] text-left text-sm">
          <thead className="bg-slate-50 text-xs text-slate-600">
            <tr><th className="p-3">구매일</th><th className="p-3">회원</th><th className="p-3">상품</th><th className="p-3 text-right">금액</th><th className="p-3 text-right">사용 / 총</th><th className="p-3">유효기간</th><th className="p-3 text-right">미사용 환불 예상</th><th className="p-3">주문</th></tr>
          </thead>
          <tbody>
            {passes.map((pass) => (
              <tr key={pass.id} className="border-t border-slate-100">
                <td className="p-3 text-xs text-slate-600">{formatDate(pass.createdAt)}</td>
                <td className="p-3"><p className="font-semibold text-slate-900">{pass.userName || "-"}</p><p className="text-xs text-slate-500">{pass.userEmail || "-"}</p></td>
                <td className="p-3">{getPlanName(pass.productKey)}{pass.status === "refunded" && <span className="ml-1 rounded-full bg-slate-200 px-2 py-0.5 text-xs font-semibold text-slate-700">환불</span>}</td>
                <td className="p-3 text-right">{formatKrw(pass.priceKrw)}</td>
                <td className="p-3 text-right">{pass.sessionsUsed} / {pass.sessions}회</td>
                <td className="p-3 text-xs text-slate-600">{formatDate(pass.expiresAt)}{pass.expired && <span className="ml-1 text-rose-700">만료</span>}</td>
                <td className="p-3 text-right text-xs text-slate-600">{pass.unusedRefundKrw > 0 ? formatKrw(pass.unusedRefundKrw) : "-"}</td>
                <td className="p-3 text-xs text-slate-500">#{pass.orderId}</td>
              </tr>
            ))}
            {!passesQuery.isLoading && passes.length === 0 && <tr><td colSpan={8} className="p-8 text-center text-slate-500">판매된 교사 첨삭지도권이 없습니다.</td></tr>}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
