import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Sparkles, X, ArrowRight, UserPlus } from "lucide-react";
import { Link } from "wouter";

import { useAuth } from "@/_core/hooks/useAuth";

export function SampleModeBanner() {
  const [dismissed, setDismissed] = useState(false);
  const { isAuthenticated } = useAuth();

  if (dismissed || isAuthenticated) return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 bg-gradient-to-r from-indigo-900 via-blue-900 to-slate-900 text-white shadow-2xl border-t border-indigo-700/50 py-3 px-4 sm:px-8">
      <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-indigo-500/30 text-indigo-300 border border-indigo-400/30">
            <Sparkles className="h-5 w-5" />
          </div>
          <div>
            <p className="text-sm font-bold flex items-center gap-2">
              <span>✨ 현재 샘플 체험 모드로 탐색 중입니다</span>
              <span className="hidden sm:inline-block bg-emerald-500/20 text-emerald-300 text-[10px] font-semibold px-2 py-0.5 rounded-full">안전한 미리보기</span>
            </p>
            <p className="text-xs text-slate-300">지금 회원가입하고 나만의 맞춤 학습 기록, AI 첨삭 보관함, 수료증을 영구 저장하세요!</p>
          </div>
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
          <Link href="/signup">
            <Button size="sm" className="bg-emerald-500 hover:bg-emerald-600 text-white font-bold text-xs gap-1 shadow">
              <UserPlus className="h-3.5 w-3.5" /> 지금 가입하고 내 데이터 저장하기
            </Button>
          </Link>
          <Button
            size="icon"
            variant="ghost"
            onClick={() => setDismissed(true)}
            className="text-slate-400 hover:text-white h-8 w-8"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
