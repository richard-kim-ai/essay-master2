import { Bell, CheckCheck, ChevronRight, ClipboardCheck, MessageSquare, Megaphone } from "lucide-react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

function notificationIcon(category: string) {
  if (category === "teacher_feedback") return <MessageSquare className="h-4 w-4 text-violet-600" />;
  if (category === "assignment_deadline" || category === "class_assignment") return <ClipboardCheck className="h-4 w-4 text-amber-600" />;
  return <Megaphone className="h-4 w-4 text-blue-600" />;
}

function getNotificationDestination(category: string) {
  if (category === "assignment_deadline" || category === "class_assignment") return "/my-assignments";
  return "/notifications";
}

export function NotificationPopover() {
  const [, setLocation] = useLocation();
  const utils = trpc.useUtils();
  const { data: notifications = [] } = trpc.curriculum.getNotifications.useQuery();
  const unreadCount = notifications.filter((notification: any) => notification.isRead === 0).length;
  const recentNotifications = notifications.slice(0, 4);

  const markReadMutation = trpc.curriculum.markNotificationRead.useMutation({
    onSuccess: () => utils.curriculum.getNotifications.invalidate(),
  });
  const markAllReadMutation = trpc.curriculum.markAllNotificationsRead.useMutation({
    onSuccess: () => utils.curriculum.getNotifications.invalidate(),
  });

  const openNotification = (notification: any) => {
    if (notification.isRead === 0) markReadMutation.mutate({ notificationId: notification.id });
    setLocation(getNotificationDestination(notification.category));
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="relative h-9 w-9 rounded-full text-slate-700 hover:bg-indigo-50 hover:text-indigo-700" aria-label="알림 열기">
          <Bell className="h-[18px] w-[18px]" />
          {unreadCount > 0 && (
            <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-rose-600 px-1 text-[9px] font-bold leading-none text-white ring-2 ring-white">
              {unreadCount > 9 ? "9+" : unreadCount}
            </span>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" sideOffset={10} className="w-[min(25rem,calc(100vw-1.5rem))] overflow-hidden rounded-2xl border-slate-200 bg-white p-0 shadow-xl">
        <div className="flex items-center justify-between gap-3 bg-indigo-950 px-4 py-3 text-white">
          <div>
            <DropdownMenuLabel className="p-0 text-sm font-bold text-white">알림</DropdownMenuLabel>
            <p className="mt-0.5 text-[11px] text-indigo-200">{unreadCount ? `읽지 않은 알림 ${unreadCount}개` : "모든 알림을 확인했습니다."}</p>
          </div>
          {unreadCount > 0 && (
            <Button
              size="sm"
              variant="ghost"
              className="h-7 px-2 text-[11px] font-semibold text-white hover:bg-white/15 hover:text-white"
              onClick={(event) => {
                event.preventDefault();
                markAllReadMutation.mutate();
              }}
              disabled={markAllReadMutation.isPending}
            >
              <CheckCheck className="mr-1 h-3.5 w-3.5" /> 모두 읽음
            </Button>
          )}
        </div>
        <div className="max-h-[22rem] overflow-y-auto p-1.5">
          {recentNotifications.length === 0 ? (
            <div className="px-4 py-10 text-center text-sm text-slate-500">새로운 알림이 없습니다.</div>
          ) : recentNotifications.map((notification: any) => (
            <DropdownMenuItem
              key={notification.id}
              className={`group flex cursor-pointer items-start gap-3 rounded-xl px-3 py-3 ${notification.isRead ? "" : "bg-indigo-50/80 focus:bg-indigo-50"}`}
              onSelect={() => openNotification(notification)}
            >
              <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white shadow-sm ring-1 ring-slate-100">
                {notificationIcon(notification.category)}
              </span>
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-1.5">
                  <span className="truncate text-xs font-bold text-slate-900">{notification.title}</span>
                  {notification.isRead === 0 && <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-rose-500" aria-label="읽지 않음" />}
                </span>
                <span className="mt-0.5 line-clamp-2 block text-[11px] leading-4 text-slate-600">{notification.message}</span>
                <span className="mt-1 block text-[10px] text-slate-400">{new Date(notification.createdAt).toLocaleString("ko-KR")}</span>
              </span>
            </DropdownMenuItem>
          ))}
        </div>
        <DropdownMenuSeparator className="m-0" />
        <DropdownMenuItem className="flex cursor-pointer items-center justify-between px-4 py-3 text-xs font-semibold text-indigo-700 focus:bg-indigo-50 focus:text-indigo-800" onSelect={() => setLocation("/notifications")}>
          알림 센터 전체 보기 <ChevronRight className="h-4 w-4" />
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
