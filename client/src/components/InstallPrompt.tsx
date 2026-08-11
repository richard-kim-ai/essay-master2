import { useEffect, useState } from "react";
import { Download, X } from "lucide-react";
import { Button } from "@/components/ui/button";

type InstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

export default function InstallPrompt() {
  const [installEvent, setInstallEvent] = useState<InstallPromptEvent | null>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    const handleBeforeInstallPrompt = (event: Event) => {
      event.preventDefault();
      setInstallEvent(event as InstallPromptEvent);
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    return () => window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
  }, []);

  if (!installEvent || dismissed) return null;

  const install = async () => {
    await installEvent.prompt();
    await installEvent.userChoice;
    setInstallEvent(null);
  };

  return (
    <div className="fixed inset-x-3 bottom-4 z-50 rounded-2xl border border-blue-100 bg-white p-4 shadow-xl sm:inset-x-auto sm:right-5 sm:w-96">
      <button
        type="button"
        aria-label="설치 안내 닫기"
        onClick={() => setDismissed(true)}
        className="absolute right-3 top-3 rounded-full p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
      >
        <X className="h-4 w-4" />
      </button>
      <div className="pr-6">
        <p className="font-semibold text-slate-900">논술 마스터를 앱처럼 사용해 보세요</p>
        <p className="mt-1 text-sm text-slate-600">홈 화면에 설치하면 모바일에서도 빠르게 학습을 이어갈 수 있습니다.</p>
      </div>
      <Button onClick={install} className="mt-3 w-full gap-2 bg-blue-600 hover:bg-blue-700">
        <Download className="h-4 w-4" />
        홈 화면에 설치
      </Button>
    </div>
  );
}
