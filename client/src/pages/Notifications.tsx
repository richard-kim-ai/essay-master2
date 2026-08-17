import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";
import DashboardLayout from "@/components/DashboardLayout";
import { Bell, CheckCircle2, MessageSquare, Calendar, ArrowRight } from "lucide-react";
import { useLocation } from "wouter";
import { toast } from "sonner";

export default function Notifications() {
  const [, setLocation] = useLocation();
  const utils = trpc.useUtils();

  const { data: notifications = [], isLoading } = trpc.curriculum.getNotifications.useQuery();
  const markReadMutation = trpc.curriculum.markNotificationRead.useMutation({
    onSuccess: () => {
      utils.curriculum.getNotifications.invalidate();
    },
  });

  return (
    <DashboardLayout>
      <div className="p-6 md:p-10 space-y-8 max-w-5xl mx-auto">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 bg-gradient-to-r from-indigo-700 to-blue-800 text-white p-8 rounded-3xl shadow-xl">
          <div>
            <span className="px-3 py-1 bg-white/20 rounded-full text-xs font-bold text-white tracking-wide">
              인앱 알림 센터
            </span>
            <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight mt-2">
              학습 알림 및 첨삭 소식함
            </h1>
            <p className="text-xs md:text-sm text-indigo-100 mt-1">
              선생님 서술형 첨삭 완료 내역과 과제 마감, 공지사항을 한곳에서 모아보고 관리하세요.
            </p>
          </div>
          <Button
            onClick={() => setLocation("/mypage")}
            className="bg-white text-indigo-900 hover:bg-indigo-50 font-bold"
          >
            마이페이지 허브
          </Button>
        </div>

        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
              <Bell className="w-5 h-5 text-indigo-600" /> 전체 알림 ({notifications.length}개)
            </h2>
          </div>

          {isLoading ? (
            <div className="py-12 text-center text-slate-500">알림을 불러오는 중입니다...</div>
          ) : notifications.length === 0 ? (
            <Card className="border-slate-200 bg-white shadow-sm p-12 text-center">
              <CheckCircle2 className="w-12 h-12 text-emerald-500 mx-auto mb-3" />
              <h3 className="text-lg font-bold text-slate-800">새로운 알림이 없습니다.</h3>
              <p className="text-sm text-slate-600 mt-1">교사 첨삭이 완료되면 이곳에 실시간 알림이 표시됩니다.</p>
            </Card>
          ) : (
            <div className="space-y-3">
              {notifications.map((n: any) => (
                <Card
                  key={n.id}
                  className={`border shadow-sm transition-all ${
                    n.isRead ? "bg-white border-slate-200" : "bg-indigo-50/50 border-indigo-200 font-medium"
                  }`}
                >
                  <CardHeader className="py-4 flex flex-row items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-indigo-100 flex items-center justify-center shrink-0">
                        <MessageSquare className="w-5 h-5 text-indigo-600" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <CardTitle className="text-base font-bold text-slate-900">{n.title}</CardTitle>
                          {!n.isRead && (
                            <span className="px-2 py-0.5 bg-rose-500 text-white text-[10px] font-bold rounded-full">
                              NEW
                            </span>
                          )}
                        </div>
                        <CardDescription className="text-slate-700 text-sm mt-0.5">
                          {n.message}
                        </CardDescription>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <span className="text-xs text-slate-400">
                        {new Date(n.createdAt).toLocaleString()}
                      </span>
                      {!n.isRead && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => markReadMutation.mutate({ notificationId: n.id })}
                          className="border-indigo-300 text-indigo-700 hover:bg-indigo-100"
                        >
                          읽음 처리
                        </Button>
                      )}
                    </div>
                  </CardHeader>
                </Card>
              ))}
            </div>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}
