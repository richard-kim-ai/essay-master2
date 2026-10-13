import React from "react";
import { GraduationCap } from "lucide-react";
import { useAuth } from "@/_core/hooks/useAuth";
import EssayWorkspace from "@/components/EssayWorkspace";
import StudentEssayReviewList from "@/components/StudentEssayReviewList";

// 교사·관리자가 열면 학생용 글쓰기 작업공간이 아니라 '첨삭 관리 센터'(학생 제출 글 목록)를 보여 준다.
// 학생·방문자는 기존 글쓰기·첨삭 요청 작업공간을 그대로 쓴다.
export default function EssaySubmission() {
  const { user } = useAuth();
  if (user && (user.role === "teacher" || user.role === "admin")) {
    return (
      <div className="bg-slate-50 px-4 py-8 sm:px-6 lg:px-8" data-testid="teacher-essay-center">
        <div className="mx-auto max-w-7xl space-y-6">
          <header>
            <p className="flex items-center gap-1.5 text-sm font-bold text-indigo-700"><GraduationCap className="h-4 w-4" aria-hidden="true" /> {user.role === "admin" ? "관리자" : "교사"}용 · 첨삭 지도</p>
            <h1 className="mt-1 text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">첨삭 관리 센터</h1>
            <p className="mt-2 text-base leading-7 text-slate-600">학생이 제출한 글을 불러와 확인하고, 글을 선택해 첨삭 지도를 진행합니다.</p>
          </header>
          <StudentEssayReviewList scope={user.role === "admin" ? "admin" : "teacher"} />
        </div>
      </div>
    );
  }
  return <EssayWorkspace />;
}
