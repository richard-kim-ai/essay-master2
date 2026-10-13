import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Sparkles, X, UserPlus } from "lucide-react";
import { Link } from "wouter";
import { useAuth } from "@/_core/hooks/useAuth";
import { BOTTOM_NOTICE_PRIORITY, useBottomNotice } from "@/lib/bottomNotice";

const DISMISS_KEY = "essay-master-signup-banner-dismissed";

function readDismissed() {
  try {
    return typeof window !== "undefined" && window.sessionStorage.getItem(DISMISS_KEY) === "1";
  } catch {
    return false;
  }
}

// 로그인하지 않은 방문자에게 회원가입을 안내하는 하단 배너. 닫으면 이번 방문 동안은 다시 보이지 않는다.
// (파일·컴포넌트 이름은 이전 '샘플 체험 모드 배너'에서 유지했지만, 샘플 모드를 사칭하지 않고 일반 가입 안내만 한다.)
export function SampleModeBanner() {
  const [dismissed, setDismissed] = useState(readDismissed);
  const { isAuthenticated } = useAuth();
  const active = useBottomNotice("signupBanner", BOTTOM_NOTICE_PRIORITY.signupBanner, !dismissed && !isAuthenticated);

  if (dismissed || isAuthenticated || !active) return null;

  const dismiss = () => {
    try {
      window.sessionStorage.setItem(DISMISS_KEY, "1");
    } catch {
      // 저장할 수 없는 환경에서는 이 화면에서만 닫는다.
    }
    setDismissed(true);
  };

  return (
    <div role="region" aria-label="회원가입 안내" className="fixed bottom-0 left-0 right-0 z-50 border-t border-indigo-700/50 bg-gradient-to-r from-indigo-900 to-slate-900 px-4 py-3 text-white shadow-2xl">
      <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-3 sm:flex-row">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl border border-indigo-400/30 bg-indigo-500/30 text-indigo-200">
            <Sparkles className="h-5 w-5" />
          </div>
          <div>
            <p className="text-sm font-bold">회원가입하고 학습 기록을 저장하세요</p>
            <p className="text-xs text-slate-300">맞춤 학습 기록, AI 첨삭 보관함, 수료증을 안전하게 저장할 수 있습니다.</p>
          </div>
        </div>

        <div className="flex w-full items-center justify-end gap-2 sm:w-auto">
          <Link href="/signup?trial=1">
            <Button size="sm" className="gap-1 bg-white text-xs font-bold text-indigo-900 shadow hover:bg-indigo-50">
              <UserPlus className="h-3.5 w-3.5" /> 회원가입하기
            </Button>
          </Link>
          <Button size="icon" variant="ghost" aria-label="회원가입 안내 닫기" onClick={dismiss} className="h-8 w-8 text-slate-300 hover:text-white">
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
