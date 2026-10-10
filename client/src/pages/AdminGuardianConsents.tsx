import React from "react";
import { Link } from "wouter";
import { toast } from "sonner";
import { ChevronLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { trpc } from "@/lib/trpc";

const STATUS_LABELS = { pending: "동의 대기", approved: "동의 완료", withdrawn: "철회" } as const;
const STATUS_STYLES = {
  pending: "bg-amber-100 text-amber-900",
  approved: "bg-emerald-100 text-emerald-900",
  withdrawn: "bg-slate-200 text-slate-700",
} as const;

function formatDate(value: Date | string | null | undefined) {
  return value ? new Date(value).toLocaleString("ko-KR", { timeZone: "Asia/Seoul" }) : "-";
}

// 만 14세 미만 법정대리인 동의 관리대장. 동의 일시·확인 수단·문구 버전을 확인하고, 재발송·철회를 처리한다.
export default function AdminGuardianConsents() {
  const utils = trpc.useUtils();
  const listQuery = trpc.guardian.adminList.useQuery();
  const refresh = () => utils.guardian.adminList.invalidate();
  const resend = trpc.guardian.adminResend.useMutation({
    onSuccess: () => {
      toast.success("보호자에게 동의 요청 메일을 다시 보냈습니다.");
      refresh();
    },
    onError: (error) => toast.error(error.message || "재발송에 실패했습니다."),
  });
  const withdraw = trpc.guardian.adminWithdraw.useMutation({
    onSuccess: () => {
      toast.success("동의를 철회 처리했습니다. 해당 아동 계정은 로그인할 수 없습니다.");
      refresh();
    },
    onError: (error) => toast.error(error.message || "철회 처리에 실패했습니다."),
  });

  if (listQuery.error) {
    return <div className="mx-auto max-w-5xl p-6 text-sm text-rose-700">{listQuery.error.message || "관리자만 볼 수 있는 화면입니다."}</div>;
  }

  const rows = listQuery.data ?? [];

  return (
    <div className="mx-auto max-w-6xl space-y-4 p-4 sm:p-6">
      <div>
        <Link href="/admin"><Button variant="ghost" size="sm" className="-ml-2 gap-1 text-slate-600"><ChevronLeft className="h-4 w-4" />관리자 대시보드</Button></Link>
        <h1 className="mt-2 text-2xl font-bold text-slate-900">법정대리인 동의 관리대장</h1>
        <p className="mt-1 text-sm text-slate-600">만 14세 미만 아동 가입에 대한 법정대리인 동의 기록입니다. 철회를 처리하면 해당 아동 계정은 다시 로그인할 수 없습니다.</p>
      </div>

      <Card className="overflow-x-auto p-0">
        <table className="w-full min-w-[960px] text-left text-sm">
          <thead className="bg-slate-50 text-xs text-slate-600">
            <tr>
              <th className="p-3">아동</th>
              <th className="p-3">생년월일</th>
              <th className="p-3">법정대리인</th>
              <th className="p-3">상태</th>
              <th className="p-3">동의 일시(KST)</th>
              <th className="p-3">확인 수단 / 문구 버전</th>
              <th className="p-3">처리</th>
            </tr>
          </thead>
          <tbody>
            {listQuery.isLoading && <tr><td colSpan={7} className="p-6 text-center text-slate-500">불러오는 중...</td></tr>}
            {!listQuery.isLoading && rows.length === 0 && <tr><td colSpan={7} className="p-6 text-center text-slate-500">아직 동의 기록이 없습니다.</td></tr>}
            {rows.map((row) => (
              <tr key={row.id} className="border-t border-slate-100 align-top">
                <td className="p-3"><p className="font-semibold text-slate-900">{row.childName || "-"}</p><p className="text-xs text-slate-500">{row.childEmail}</p></td>
                <td className="p-3 text-slate-700">{row.childBirthDate}</td>
                <td className="p-3"><p className="font-semibold text-slate-900">{row.guardianName} ({row.guardianRelation})</p><p className="text-xs text-slate-500">{row.guardianEmail}</p></td>
                <td className="p-3"><span className={`rounded-full px-2.5 py-1 text-xs font-bold ${STATUS_STYLES[row.status]}`}>{STATUS_LABELS[row.status]}</span></td>
                <td className="p-3 text-slate-700">{row.status === "withdrawn" ? `철회 ${formatDate(row.updatedAt)}` : formatDate(row.approvedAt)}</td>
                <td className="p-3 text-xs text-slate-600">{row.consentMethod}<br />{row.consentVersion}</td>
                <td className="p-3">
                  <div className="flex flex-wrap gap-2">
                    {row.status === "pending" && (
                      <Button size="sm" variant="outline" disabled={resend.isPending} onClick={() => resend.mutate({ id: row.id })}>메일 재발송</Button>
                    )}
                    {row.status !== "withdrawn" && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="text-rose-700"
                        disabled={withdraw.isPending}
                        onClick={() => {
                          if (window.confirm(`${row.childName || "해당 아동"}의 법정대리인 동의를 철회 처리할까요? 아동 계정은 로그인할 수 없게 됩니다.`)) {
                            withdraw.mutate({ id: row.id });
                          }
                        }}
                      >
                        동의 철회
                      </Button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
