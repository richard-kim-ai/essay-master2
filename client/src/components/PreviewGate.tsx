import React, { useState } from "react";
import { Link, useLocation, useSearch } from "wouter";
import { Eye, LogIn } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { buildLoginHref } from "@/lib/loginRedirect";

// 로그인하지 않은 방문자에게 학습 화면을 "미리보기"로만 보여주는 래퍼.
// - 화면은 그대로 보이지만 inert로 클릭·입력·포커스를 막는다(실제 학습·서버 요청 없음).
// - 화면 어디를 눌러도 로그인 안내가 뜬다. 상단 안내줄에는 로그인·회원가입 버튼이 있다.
// active가 false(로그인한 상태)면 아무것도 바꾸지 않고 자식을 그대로 보여준다.
export default function PreviewGate({
  active,
  title,
  children,
}: {
  active: boolean;
  title: string;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [location] = useLocation();
  const search = useSearch();

  if (!active) return <>{children}</>;

  const loginHref = buildLoginHref(`${location}${search ? `?${search}` : ""}`);

  return (
    <div className="flex flex-col">
      <div role="region" aria-label="미리보기 안내" className="sticky top-16 z-30 border-b border-indigo-200 bg-indigo-50 px-4 py-3">
        <div className="mx-auto flex max-w-6xl flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <p className="flex items-center gap-2 text-sm text-indigo-950">
            <Eye className="h-4 w-4 shrink-0 text-indigo-600" aria-hidden="true" />
            <span><strong>{title} 미리보기</strong> · 화면 구성만 둘러볼 수 있습니다. 로그인하면 실제로 학습할 수 있어요.</span>
          </p>
          <div className="flex gap-2">
            <Link href={loginHref}><Button size="sm">로그인</Button></Link>
            <Link href="/signup?trial=1"><Button size="sm" variant="outline">회원가입</Button></Link>
          </div>
        </div>
      </div>

      {/* 클릭이 inert 내용을 통과해 이 요소에 닿으면 로그인 안내를 연다. */}
      <div className="relative flex-1 cursor-pointer" onClick={() => setOpen(true)} data-preview-surface="true">
        <div inert className="pointer-events-none select-none">{children}</div>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><LogIn className="h-5 w-5 text-indigo-600" aria-hidden="true" />로그인이 필요합니다</DialogTitle>
            <DialogDescription>{title}은(는) 로그인한 뒤 이용할 수 있습니다. 지금은 화면만 미리 볼 수 있어요.</DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
            <Link href={loginHref}><Button className="w-full sm:w-auto">로그인</Button></Link>
            <Link href="/signup?trial=1"><Button variant="outline" className="w-full sm:w-auto">회원가입</Button></Link>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
