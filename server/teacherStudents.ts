// 교사 마이페이지의 '지도 학생' 선별 규칙.
// 예전에는 관리자가 준 진도·수료증 권한(조직·학생 단위)이 있어야만 학생으로 셌다. 그래서 학생의 담당 교사로
// 연결(users.teacherId)만 되어 있고 권한은 없는 학생이 0명으로 표시되고, 글 제출 목록(담당 교사 기준)과 어긋났다.
// 이제 담당 교사로 연결된 학생은 항상 지도 학생이고, 권한은 진도·수료증 관리 버튼에만 적용한다.

export interface StudentCandidate {
  id: number;
  role: string;
  tag?: string | null;
  teacherId?: number | null;
}

export interface StudentGrant {
  scopeType: string;
  studentId?: number | null;
  canManageProgress?: number | null;
  canRequestCertificate?: number | null;
}

export type StudentRelation = "assigned" | "granted" | "both";

/** 담당 교사로 연결됐거나(assigned) 학생 단위 권한을 받은(granted) 학습자 id와 그 관계를 돌려준다. */
export function selectManagedStudentIds(users: StudentCandidate[], grants: StudentGrant[], teacherId: number): Map<number, StudentRelation> {
  const grantedIds = new Set(
    grants
      .filter((grant) => grant.scopeType === "student")
      .map((grant) => grant.studentId)
      .filter((id): id is number => typeof id === "number")
  );
  const result = new Map<number, StudentRelation>();
  for (const user of users) {
    // 학부모 계정은 학생으로 세지 않는다.
    if (user.role !== "user" || user.tag === "학부모") continue;
    const assigned = user.teacherId === teacherId;
    const granted = grantedIds.has(user.id);
    if (assigned && granted) result.set(user.id, "both");
    else if (assigned) result.set(user.id, "assigned");
    else if (granted) result.set(user.id, "granted");
  }
  return result;
}
