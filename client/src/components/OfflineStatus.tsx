import { useEffect, useState } from "react";
import { WifiOff, Wifi } from "lucide-react";

export default function OfflineStatus() {
  const [isOnline, setIsOnline] = useState(() =>
    typeof navigator === "undefined" ? true : navigator.onLine,
  );
  const [showBackOnline, setShowBackOnline] = useState(false);

  useEffect(() => {
    const handleOffline = () => {
      setIsOnline(false);
      setShowBackOnline(false);
    };
    const handleOnline = () => {
      setIsOnline(true);
      setShowBackOnline(true);
      window.setTimeout(() => setShowBackOnline(false), 2600);
    };

    window.addEventListener("offline", handleOffline);
    window.addEventListener("online", handleOnline);
    return () => {
      window.removeEventListener("offline", handleOffline);
      window.removeEventListener("online", handleOnline);
    };
  }, []);

  if (isOnline && !showBackOnline) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className={`sticky top-16 z-40 flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium shadow-sm ${
        isOnline ? "bg-emerald-600 text-white" : "bg-slate-900 text-white"
      }`}
    >
      {isOnline ? <Wifi className="h-4 w-4" /> : <WifiOff className="h-4 w-4" />}
      <span>
        {isOnline
          ? "인터넷 연결이 복구되었습니다."
          : "오프라인 상태입니다. 캐시된 학습 화면은 계속 사용할 수 있습니다."}
      </span>
    </div>
  );
}
