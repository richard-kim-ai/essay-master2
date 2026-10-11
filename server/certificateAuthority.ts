import { TRPCError } from "@trpc/server";
import * as db from "./db";

// 수료증 승인 권한 관리(관리자 화면의 회원 및 권한 통합 관리).
// - 첨삭교사: '수료증 검토·요청 권한' = 담당 학생 전체에 대한 조직 범위 권한(teacher_permission_grants.canRequestCertificate)
// - 관리자: '수료증 최종 승인 권한' = users.certificateApprovalRevoked가 0이면 승인 가능(기본값이라 기존 관리자는 모두 가능, 회수한 관리자만 제한)

export interface CertificateAuthorityRow {
  userId: number;
  role: "teacher" | "admin";
  granted: boolean;
}

/** 이 이름으로 만든 '전체 담당 학생' 범위 권한을 수료증 권한 부여의 대상으로 쓴다. */
export const CERTIFICATE_GRANT_ORGANIZATION = "전체 담당 학생";

const isCertificateGrant = (grant: { scopeType: string; canRequestCertificate: number }) => grant.scopeType === "organization" && grant.canRequestCertificate === 1;

/** 모든 관리자·교사 계정의 수료증 승인 권한 현황. */
export async function listCertificateAuthorities(): Promise<CertificateAuthorityRow[]> {
  const [stats, grants] = await Promise.all([db.getAllUsersStats(), db.getTeacherPermissionGrants()]);
  const users = (stats?.users ?? []) as Array<{ id: number; role: string; certificateApprovalRevoked?: number | null }>;
  const grantedTeachers = new Set(grants.filter((grant) => grant.isActive === 1 && isCertificateGrant(grant)).map((grant) => grant.teacherId));
  const rows: CertificateAuthorityRow[] = [];
  for (const user of users) {
    if (user.role === "teacher") rows.push({ userId: user.id, role: "teacher", granted: grantedTeachers.has(user.id) });
    else if (user.role === "admin") rows.push({ userId: user.id, role: "admin", granted: !user.certificateApprovalRevoked });
  }
  return rows;
}

/** 수료증 권한을 부여(enabled=true)하거나 회수한다. 관리자만 호출할 수 있다. */
export async function setCertificateAuthority(actor: { id: number; role: string }, input: { userId: number; enabled: boolean }) {
  if (actor.role !== "admin") throw new TRPCError({ code: "FORBIDDEN", message: "관리자 권한이 필요합니다." });
  const target = await db.getUserById(input.userId);
  if (!target) throw new TRPCError({ code: "NOT_FOUND", message: "계정을 찾을 수 없습니다." });

  if (target.role === "teacher") {
    if (target.teacherStatus !== "approved") throw new TRPCError({ code: "BAD_REQUEST", message: "승인된 첨삭교사에게만 수료증 권한을 부여할 수 있습니다." });
    const grants = (await db.getTeacherPermissionGrants()).filter((grant) => grant.teacherId === target.id && isCertificateGrant(grant));
    if (input.enabled) {
      if (grants.some((grant) => grant.isActive === 1)) return { userId: target.id, role: "teacher" as const, granted: true };
      const reusable = grants[0];
      await db.saveTeacherPermissionGrant({
        grantId: reusable?.id,
        teacherId: target.id,
        scopeType: "organization",
        organizationName: reusable?.organizationName ?? CERTIFICATE_GRANT_ORGANIZATION,
        studentId: null,
        canManageProgress: reusable?.canManageProgress ?? 0,
        canRequestCertificate: 1,
        isActive: 1,
        grantedBy: actor.id,
      });
    } else {
      for (const grant of grants.filter((item) => item.isActive === 1)) await db.setTeacherPermissionGrantActive(grant.id, 0);
    }
  } else if (target.role === "admin") {
    if (!input.enabled) {
      if (target.id === actor.id) throw new TRPCError({ code: "BAD_REQUEST", message: "본인의 수료증 승인 권한은 회수할 수 없습니다." });
      // 승인할 수 있는 관리자가 한 명도 남지 않으면 수료증을 발급할 수 없으므로 막는다.
      const remaining = (await listCertificateAuthorities()).filter((row) => row.role === "admin" && row.granted && row.userId !== target.id);
      if (remaining.length === 0) throw new TRPCError({ code: "BAD_REQUEST", message: "수료증을 승인할 수 있는 관리자가 한 명 이상 남아 있어야 합니다." });
    }
    await db.setCertificateApprovalRevoked(target.id, !input.enabled);
  } else {
    throw new TRPCError({ code: "BAD_REQUEST", message: "관리자와 첨삭교사에게만 수료증 승인 권한을 부여할 수 있습니다." });
  }

  await db.createAdminAuditLog({
    actorId: actor.id,
    targetUserId: target.id,
    action: "role_changed",
    summary: `${target.role === "admin" ? "관리자" : "첨삭교사"} 수료증 ${target.role === "admin" ? "최종 승인" : "검토·요청"} 권한 ${input.enabled ? "부여" : "회수"}`,
    metadata: { type: "certificate_authority", enabled: input.enabled, role: target.role },
  });
  return { userId: target.id, role: target.role as "teacher" | "admin", granted: input.enabled };
}
