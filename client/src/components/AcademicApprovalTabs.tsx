import React, { type ReactNode } from "react";
import { Award, SlidersHorizontal, UsersRound } from "lucide-react";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

type AcademicApprovalTabsProps = {
  children: ReactNode;
};

export function AcademicApprovalTabs({ children }: AcademicApprovalTabsProps) {
  return (
    <Tabs defaultValue="permissions" className="space-y-5">
      <TabsList aria-label="학습 권한 및 수료 승인 관리" className="!flex h-auto w-full gap-1 overflow-x-auto rounded-2xl border border-slate-200 bg-white p-1.5 shadow-sm [scrollbar-width:none]">
        <TabsTrigger value="permissions" className="h-11 min-w-40 shrink-0 rounded-xl border-0 px-4 text-slate-600 hover:bg-blue-50 hover:text-blue-800 focus-visible:ring-blue-500 data-[state=active]:bg-blue-700 data-[state=active]:text-white data-[state=active]:shadow-md sm:min-w-0 sm:flex-1"><UsersRound className="h-4 w-4" />교사 권한 부여</TabsTrigger>
        <TabsTrigger value="policies" className="h-11 min-w-40 shrink-0 rounded-xl border-0 px-4 text-slate-600 hover:bg-violet-50 hover:text-violet-800 focus-visible:ring-violet-500 data-[state=active]:bg-violet-700 data-[state=active]:text-white data-[state=active]:shadow-md sm:min-w-0 sm:flex-1"><SlidersHorizontal className="h-4 w-4" />발급 조건 설정</TabsTrigger>
        <TabsTrigger value="approvals" className="h-11 min-w-40 shrink-0 rounded-xl border-0 px-4 text-slate-600 hover:bg-emerald-50 hover:text-emerald-800 focus-visible:ring-emerald-500 data-[state=active]:bg-emerald-700 data-[state=active]:text-white data-[state=active]:shadow-md sm:min-w-0 sm:flex-1"><Award className="h-4 w-4" />공동 승인 대기</TabsTrigger>
      </TabsList>
      {children}
    </Tabs>
  );
}
