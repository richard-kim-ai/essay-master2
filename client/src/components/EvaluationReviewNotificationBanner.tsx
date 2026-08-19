import { ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";

export function EvaluationReviewNotificationBanner({ count, onView }: { count: number; onView: () => void }) {
  return (
    <section className="flex flex-col gap-3 rounded-2xl border border-amber-200 bg-amber-50/70 p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between" aria-label="첨삭 검수 결과 알림">
      <div className="flex items-start gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-100 text-amber-700"><ShieldCheck className="h-5 w-5" /></span>
        <div>
          <p className="font-bold text-slate-900">첨삭 검수 결과가 도착했습니다</p>
          <p className="mt-1 text-sm leading-6 text-slate-700">인간 검수 또는 이의제기 처리 결과 <strong>{count}건</strong>을 확인해 보세요.</p>
        </div>
      </div>
      <Button size="sm" onClick={onView} className="bg-amber-600 text-white hover:bg-amber-700">결과 확인</Button>
    </section>
  );
}
