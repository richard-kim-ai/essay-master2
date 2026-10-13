import React from "react";
import { BadgeCheck } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";

export const AUTHORITY_LABEL = { teacher: "수료증 검토·요청", admin: "수료증 최종 승인" } as const;

// 관리자·첨삭교사의 수료증 승인 권한을 부여하거나 회수한다.
// - 첨삭교사: 담당 학생의 수료증 검토·요청 권한 / 관리자: 수료증 최종 승인 권한
export default function CertificateAuthorityControl({ userId, role, granted, compact = false }: { userId: number; role: "teacher" | "admin"; granted: boolean; compact?: boolean }) {
  const utils = trpc.useUtils();
  const mutation = trpc.admin.setCertificateAuthority.useMutation({
    onSuccess: (_result, variables) => {
      toast.success(variables.enabled ? `${AUTHORITY_LABEL[role]} 권한을 부여했습니다.` : `${AUTHORITY_LABEL[role]} 권한을 회수했습니다.`);
      void utils.admin.getCertificateAuthorities.invalidate();
      void utils.admin.getAuditLogs.invalidate();
    },
    onError: (error) => toast.error(error.message || "권한을 변경하지 못했습니다."),
  });

  const change = () => {
    const enabled = !granted;
    const message = enabled ? `${AUTHORITY_LABEL[role]} 권한을 부여할까요?` : `${AUTHORITY_LABEL[role]} 권한을 회수할까요? 회수하면 이 계정은 수료증을 ${role === "admin" ? "승인·반려" : "검토·요청"}할 수 없습니다.`;
    if (window.confirm(message)) mutation.mutate({ userId, enabled });
  };

  return (
    <div className="flex flex-wrap items-center gap-2" data-testid="certificate-authority">
      <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ${granted ? "bg-emerald-100 text-emerald-800" : "bg-slate-100 text-slate-500"}`}>
        <BadgeCheck className="h-3 w-3" aria-hidden="true" /> {AUTHORITY_LABEL[role]} {granted ? "가능" : "불가"}
      </span>
      <Button type="button" size="sm" variant="outline" className={compact ? "h-7 px-2 text-xs" : ""} disabled={mutation.isPending} onClick={change}>
        {granted ? "권한 회수" : "권한 부여"}
      </Button>
    </div>
  );
}
