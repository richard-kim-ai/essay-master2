import React from "react";
import { Link, useLocation, useSearch } from "wouter";
import { LogIn } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { buildLoginHref } from "@/lib/loginRedirect";

// 로그인이 필요한 화면에서 비로그인 방문자에게 보여주는 공통 안내.
// 로그인 뒤 지금 보던 화면으로 돌아오도록 현재 경로를 함께 넘긴다.
export default function LoginRequired({ message }: { message?: string }) {
  const [location] = useLocation();
  const search = useSearch();
  const current = `${location}${search ? `?${search}` : ""}`;

  return (
    <div className="mx-auto flex max-w-md justify-center px-4 py-16">
      <Card className="w-full space-y-4 p-8 text-center" role="alert">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-indigo-50 text-indigo-600">
          <LogIn className="h-6 w-6" aria-hidden="true" />
        </div>
        <h2 className="text-xl font-bold text-slate-900">로그인이 필요합니다</h2>
        <p className="text-sm leading-6 text-slate-600">{message ?? "이 화면은 로그인한 뒤 이용할 수 있습니다. 로그인하면 지금 보던 화면으로 돌아옵니다."}</p>
        <div className="flex flex-col gap-2 sm:flex-row sm:justify-center">
          <Link href={buildLoginHref(current)}><Button className="w-full sm:w-auto">로그인</Button></Link>
          <Link href="/signup?trial=1"><Button variant="outline" className="w-full sm:w-auto">회원가입</Button></Link>
        </div>
        <p className="text-xs text-slate-500">처음이라면 <Link href="/sample" className="font-semibold text-indigo-700 underline underline-offset-2">샘플 체험</Link>으로 먼저 둘러보세요.</p>
      </Card>
    </div>
  );
}
