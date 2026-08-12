import { useEffect, useState } from "react";
import { Bell, BellRing, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";

function decodeKey(value: string) {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const padding = "=".repeat((4 - (normalized.length % 4)) % 4);
  const raw = atob(normalized + padding);
  return Uint8Array.from(raw, (char) => char.charCodeAt(0));
}

export default function PushPermissionPrompt() {
  const { isAuthenticated } = useAuth();
  const config = trpc.push.config.useQuery(undefined, { enabled: isAuthenticated });
  const subscribeMutation = trpc.notifications.subscribe.useMutation();
  const [visible, setVisible] = useState(false);
  const [subscribed, setSubscribed] = useState(false);

  useEffect(() => {
    if (!isAuthenticated || !config.data?.enabled || !("serviceWorker" in navigator) || !("PushManager" in window) || Notification.permission === "denied") return;
    navigator.serviceWorker.ready.then((registration) => registration.pushManager.getSubscription()).then((subscription) => {
      setSubscribed(Boolean(subscription));
      setVisible(!subscription && Notification.permission !== "granted");
    }).catch(() => undefined);
  }, [config.data?.enabled, isAuthenticated]);

  if (!visible || subscribed || !config.data?.publicKey) return null;

  const subscribe = async () => {
    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") return;
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: decodeKey(config.data.publicKey) });
      await subscribeMutation.mutateAsync({ endpoint: subscription.endpoint, keys: { p256dh: subscription.toJSON().keys?.p256dh || "", auth: subscription.toJSON().keys?.auth || "" } });
      setSubscribed(true);
      setVisible(false);
      toast.success("학습 및 첨삭 알림을 켰습니다.");
    } catch {
      toast.error("알림 권한을 설정하지 못했습니다. 브라우저 설정을 확인해주세요.");
    }
  };

  return <div className="fixed inset-x-4 bottom-4 z-40 mx-auto flex max-w-xl items-center gap-3 rounded-2xl border border-blue-200 bg-white p-4 shadow-2xl"><div className="rounded-xl bg-blue-100 p-2 text-blue-700"><BellRing className="h-5 w-5" /></div><div className="min-w-0 flex-1"><p className="font-semibold text-slate-900">학습 알림을 받아보세요</p><p className="mt-1 text-xs leading-5 text-slate-600">학습 마감과 새로운 선생님 첨삭이 등록되면 알려드립니다.</p></div><Button size="sm" onClick={subscribe} disabled={subscribeMutation.isPending} className="gap-1 bg-blue-600 hover:bg-blue-700"><Bell className="h-4 w-4" />{subscribeMutation.isPending ? "설정 중" : "켜기"}</Button><Button variant="ghost" size="icon" onClick={() => setVisible(false)} aria-label="알림 안내 닫기"><X className="h-4 w-4" /></Button></div>;
}
