import { useEffect } from "react";
import { ArrowLeft, ChevronRight, Home } from "lucide-react";
import { Link, useLocation } from "wouter";
import { useAuth } from "@/_core/hooks/useAuth";
import { getPageTrail } from "@/lib/pageTrail";

// 이 탭에서 앱 안 화면을 몇 번 열었는지. 1이면 이전 화면이 앱 밖(또는 없음)이라 history.back() 대신 상위 화면으로 보낸다.
let inAppPageViews = 0;

// 메뉴 바로 아래에 붙는 페이지 이동 바: 이전 화면으로 돌아가기 + 홈부터 현재 화면까지의 경로.
export default function PageNavigator() {
  const [path, setLocation] = useLocation();
  const { user } = useAuth();
  const trail = getPageTrail(path, user?.role);

  useEffect(() => {
    inAppPageViews += 1;
  }, [path]);

  if (!trail) return null;

  const goBack = () => {
    if (inAppPageViews > 1 && typeof window !== "undefined") window.history.back();
    else setLocation(trail.fallbackHref);
  };

  return (
    <div className="border-b border-slate-200 bg-white" data-testid="page-navigator">
      <div className="mx-auto flex max-w-7xl items-center gap-3 px-4 py-2 sm:px-6 lg:px-8">
        <button
          type="button"
          onClick={goBack}
          className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 text-xs font-bold text-slate-700 transition hover:border-indigo-200 hover:bg-indigo-50 hover:text-indigo-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-1"
          aria-label={`이전 화면으로 돌아가기 (이전 기록이 없으면 ${trail.fallbackLabel})`}
        >
          <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" /> 이전
        </button>
        <nav aria-label="현재 위치" className="min-w-0">
          <ol className="flex min-w-0 flex-wrap items-center gap-x-1 gap-y-0.5 text-xs font-semibold text-slate-500 sm:text-sm">
            <li className="flex items-center">
              <Link href="/" className="inline-flex items-center gap-1 rounded transition hover:text-indigo-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500">
                <Home className="h-3.5 w-3.5" aria-hidden="true" /> 홈
              </Link>
            </li>
            {trail.items.map((item, index) => {
              const isCurrent = index === trail.items.length - 1;
              return (
                <li key={`${item.label}-${index}`} className="flex min-w-0 items-center gap-1">
                  <ChevronRight className="h-3.5 w-3.5 shrink-0 text-slate-300" aria-hidden="true" />
                  {item.href && !isCurrent ? (
                    <Link href={item.href} className="truncate rounded transition hover:text-indigo-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500">{item.label}</Link>
                  ) : (
                    <span className={`truncate ${isCurrent ? "font-extrabold text-slate-900" : ""}`} aria-current={isCurrent ? "page" : undefined}>{item.label}</span>
                  )}
                </li>
              );
            })}
          </ol>
        </nav>
      </div>
    </div>
  );
}
