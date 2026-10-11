import React from "react";
import { useAuth } from "@/_core/hooks/useAuth";
import LoginRequired from "@/components/LoginRequired";
import StudentEssayReviewList from "@/components/StudentEssayReviewList";

// 관리자: 모든 학생이 제출한 글을 목록으로 보고 첨삭할 글을 고른다(서버가 관리자 권한을 다시 확인한다).
export default function AdminStudentEssays() {
  const { isAuthenticated } = useAuth();
  if (!isAuthenticated) return <LoginRequired />;
  return (
    <div className="bg-slate-50 px-4 py-8 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <StudentEssayReviewList scope="admin" />
      </div>
    </div>
  );
}
