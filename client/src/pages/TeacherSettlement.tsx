import React, { useState } from "react";
import { Link } from "wouter";
import { ChevronLeft, ChevronRight, Wallet } from "lucide-react";
import { useAuth } from "@/_core/hooks/useAuth";
import LoginRequired from "@/components/LoginRequired";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { trpc } from "@/lib/trpc";
import { formatKrw } from "@shared/plans";
import { currentMonthKst } from "@shared/settlement";

const STATUS_LABELS = { confirmed: "확정", paid: "지급 완료" } as const;
const STATUS_STYLES = { confirmed: "bg-indigo-100 text-indigo-900", paid: "bg-emerald-100 text-emerald-900" } as const;

function shiftMonth(month: string, delta: number) {
  const [year, monthNumber] = month.split("-").map(Number);
  const date = new Date(Date.UTC(year, monthNumber - 1 + delta, 1));
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}

function formatDate(value: Date | string | null | undefined) {
  return value ? new Date(value).toLocaleDateString("ko-KR", { timeZone: "Asia/Seoul" }) : "-";
}

// 교사포털의 정산 화면. 교사가 등록·승인한 첨삭 활동 건수와 단가로 월별 정산 금액을 보여준다.
export default function TeacherSettlement() {
  const { user, isAuthenticated } = useAuth();
  const [month, setMonth] = useState(currentMonthKst());
  const approvedTeacher = isAuthenticated && user?.role === "teacher" && (user as { teacherStatus?: string }).teacherStatus === "approved";
  const overviewQuery = trpc.settlement.myOverview.useQuery({ month }, { enabled: approvedTeacher });
  const statementsQuery = trpc.settlement.myStatements.useQuery(undefined, { enabled: approvedTeacher });

  if (!isAuthenticated) return <LoginRequired />;
  if (!approvedTeacher) {
    return (
      <div className="mx-auto max-w-xl px-4 py-16 text-center">
        <Wallet className="mx-auto h-14 w-14 text-slate-300" aria-hidden="true" />
        <h1 className="mt-4 text-2xl font-bold text-slate-900">승인된 교사만 볼 수 있습니다</h1>
        <p className="mt-2 text-sm text-slate-600">교사 계정이 승인되면 첨삭 활동에 따른 정산 내역을 확인할 수 있습니다.</p>
        <Link href="/"><Button variant="outline" className="mt-6">홈으로 돌아가기</Button></Link>
      </div>
    );
  }

  const overview = overviewQuery.data;
  const statement = overview?.statement ?? null;
  // 확정·지급된 정산서가 있으면 그 시점의 금액이 기준이고, 없으면 현재 활동 기준 예상액이다.
  const items = statement ? statement.items : overview?.estimate.items ?? [];
  const gross = statement ? statement.grossKrw : overview?.estimate.grossKrw ?? 0;
  const withholding = statement ? statement.withholdingKrw : overview?.estimate.withholdingKrw ?? 0;
  const withholdingPct = statement ? statement.withholdingPct : overview?.estimate.withholdingPct ?? 0;
  const net = statement ? statement.netKrw : overview?.estimate.netKrw ?? 0;
  const statements = statementsQuery.data ?? [];
  const activityDescriptions = new Map<string, string>((overview?.activities ?? []).map((activity) => [activity.type, activity.description]));

  return (
    <div className="mx-auto max-w-5xl space-y-6 px-4 py-8 sm:px-6">
      <div>
        <Link href="/teacher-mypage"><Button variant="ghost" size="sm" className="-ml-2 gap-1 text-slate-600"><ChevronLeft className="h-4 w-4" />교사 마이페이지</Button></Link>
        <h1 className="mt-2 text-3xl font-bold text-slate-900">첨삭 정산</h1>
        <p className="mt-2 text-sm leading-6 text-slate-600">교사가 등록·승인한 첨삭 활동 건수에 활동별 단가를 곱해 월 단위로 정산합니다. 정산이 확정되기 전의 금액은 예상액이며, 확정된 뒤에는 단가가 바뀌어도 금액이 변하지 않습니다.</p>
      </div>

      <div className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white p-3">
        <Button variant="outline" size="sm" onClick={() => setMonth(shiftMonth(month, -1))} aria-label="이전 달"><ChevronLeft className="h-4 w-4" /></Button>
        <div className="text-center">
          <p className="text-lg font-bold text-slate-900">{month.replace("-", "년 ")}월</p>
          <p className="text-xs text-slate-500">
            {statement ? <span className={`rounded-full px-2 py-0.5 font-semibold ${STATUS_STYLES[statement.status as keyof typeof STATUS_STYLES]}`}>{STATUS_LABELS[statement.status as keyof typeof STATUS_LABELS]}</span> : overview?.isCurrentMonth ? "진행 중인 달 · 예상액" : "확정 전 · 예상액"}
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => setMonth(shiftMonth(month, 1))} disabled={month >= currentMonthKst()} aria-label="다음 달"><ChevronRight className="h-4 w-4" /></Button>
      </div>

      {overviewQuery.error ? (
        <Card className="p-6 text-sm text-rose-700">{overviewQuery.error.message || "정산 정보를 불러오지 못했습니다."}</Card>
      ) : (
        <>
          <Card className="overflow-x-auto p-0">
            <table className="w-full min-w-[560px] text-left text-sm">
              <thead className="bg-slate-50 text-xs text-slate-600">
                <tr><th className="p-3">활동</th><th className="p-3 text-right">건수</th><th className="p-3 text-right">건당 단가</th><th className="p-3 text-right">금액</th></tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <tr key={item.type} className="border-t border-slate-100">
                    <td className="p-3"><p className="font-semibold text-slate-900">{item.label}</p><p className="text-xs text-slate-500">{activityDescriptions.get(item.type) ?? ""}</p></td>
                    <td className="p-3 text-right text-slate-800">{item.count}건</td>
                    <td className="p-3 text-right text-slate-600">{formatKrw(item.unitAmountKrw)}</td>
                    <td className="p-3 text-right font-semibold text-slate-900">{formatKrw(item.amountKrw)}</td>
                  </tr>
                ))}
                {overviewQuery.isLoading && <tr><td colSpan={4} className="p-6 text-center text-slate-500">불러오는 중입니다...</td></tr>}
              </tbody>
            </table>
          </Card>

          <div className="grid gap-4 sm:grid-cols-3">
            <Card className="p-5"><p className="text-xs font-semibold text-slate-500">{statement ? "정산 총액" : "예상 총액"}</p><p className="mt-1 text-2xl font-bold text-slate-900">{formatKrw(gross)}</p></Card>
            <Card className="p-5"><p className="text-xs font-semibold text-slate-500">원천징수({withholdingPct}%)</p><p className="mt-1 text-2xl font-bold text-slate-700">-{formatKrw(withholding)}</p></Card>
            <Card className="border-indigo-200 bg-indigo-50/60 p-5"><p className="text-xs font-semibold text-indigo-800">{statement?.status === "paid" ? "지급 금액" : "지급 예정 금액"}</p><p className="mt-1 text-2xl font-bold text-indigo-900">{formatKrw(net)}</p></Card>
          </div>
          {statement && <p className="text-xs text-slate-500">확정일 {formatDate(statement.confirmedAt)}{statement.paidAt ? ` · 지급일 ${formatDate(statement.paidAt)}` : ""}{statement.note ? ` · 메모: ${statement.note}` : ""}</p>}
          <p className="text-xs leading-5 text-slate-500">원천징수는 간이 계산입니다. 실제 지급액과 증빙은 운영팀이 확정한 정산서를 기준으로 합니다.</p>
        </>
      )}

      <section aria-labelledby="statement-history">
        <h2 id="statement-history" className="text-lg font-bold text-slate-900">확정된 정산 내역</h2>
        <Card className="mt-3 overflow-x-auto p-0">
          <table className="w-full min-w-[560px] text-left text-sm">
            <thead className="bg-slate-50 text-xs text-slate-600">
              <tr><th className="p-3">정산 월</th><th className="p-3">상태</th><th className="p-3 text-right">총액</th><th className="p-3 text-right">원천징수</th><th className="p-3 text-right">지급 금액</th><th className="p-3">지급일</th></tr>
            </thead>
            <tbody>
              {statements.map((row) => (
                <tr key={row.id} className="border-t border-slate-100">
                  <td className="p-3"><button type="button" onClick={() => setMonth(row.periodMonth)} className="font-semibold text-indigo-700 hover:underline">{row.periodMonth}</button></td>
                  <td className="p-3"><span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${STATUS_STYLES[row.status as keyof typeof STATUS_STYLES]}`}>{STATUS_LABELS[row.status as keyof typeof STATUS_LABELS]}</span></td>
                  <td className="p-3 text-right">{formatKrw(row.grossKrw)}</td>
                  <td className="p-3 text-right text-slate-600">-{formatKrw(row.withholdingKrw)}</td>
                  <td className="p-3 text-right font-semibold">{formatKrw(row.netKrw)}</td>
                  <td className="p-3 text-slate-600">{formatDate(row.paidAt)}</td>
                </tr>
              ))}
              {!statementsQuery.isLoading && statements.length === 0 && <tr><td colSpan={6} className="p-6 text-center text-slate-500">아직 확정된 정산 내역이 없습니다. 월이 끝나면 운영팀이 정산을 확정합니다.</td></tr>}
            </tbody>
          </table>
        </Card>
      </section>
    </div>
  );
}
