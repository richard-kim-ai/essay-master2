import React, { useState } from "react";
import { Link, useLocation, useSearch } from "wouter";
import { LogIn } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { buildLoginHref } from "@/lib/loginRedirect";

// 로그인하지 않은 방문자에게 학습 화면을 "미리보기"로만 보여주는 래퍼.
// - 화면은 그대로 보이지만 inert로 클릭·입력·포커스를 막는다(실제 학습·서버 요청 없음).
// - 화면 어디를 눌러도 로그인 안내 팝업이 뜬다(별도 안내 줄 없음: 헤더에 로그인·회원가입이 있다).
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
