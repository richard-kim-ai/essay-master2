import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";
import DashboardLayout from "@/components/DashboardLayout";
import { Bell, CheckCircle2, MessageSquare, Filter, ShieldCheck } from "lucide-react";
import { useLocation } from "wouter";
import React, { useState, useEffect } from "react";
import { toast } from "sonner";

export default function Notifications() {
  const [, setLocation] = useLocation();
  const utils = trpc.useUtils();

  const [filterType, setFilterType] = useState<string>("all"); // 'all', 'unread', 'teacher_feedback', 'assignment', 'evaluation_review', 'system'

  const { data: notifications = [], isLoading } = trpc.curriculum.getNotifications.useQuery();
  const markReadMutation = trpc.curriculum.markNotificationRead.useMutation({
    onSuccess: () => {
      utils.curriculum.getNotifications.invalidate();
      toast.success("알림이 읽음 처리되었습니다.");
    },
  });

  const markAllReadMutation = trpc.curriculum.markAllNotificationsRead.useMutation({
    onSuccess: () => {
      utils.curriculum.getNotifications.invalidate();
      toast.success("모든 알림이 읽음 처리되었습니다.");
    },
  });

  const [isPrefsOpen, setIsPrefsOpen] = useState(false);
  const { data: pushPrefs, refetch: refetchPrefs } = trpc.curriculum.getPushPrefs.useQuery();
  const updatePrefsMutation = trpc.curriculum.updatePushPrefs.useMutation({
    onSuccess: () => {
      toast.success("알림 수신 설정이 저장되었습니다.");
      setIsPrefsOpen(false);
      refetchPrefs();
    },
  });

  const [prefsForm, setPrefsForm] = useState({
    teacherFeedback: true,
    assignmentDeadline: true,
    notice: true,
  });

  // sync when pushPrefs loads
  React.useEffect(() => {
    if (pushPrefs) {
      setPrefsForm(pushPrefs);
    }
  }, [pushPrefs]);

  const filteredNotifications = notifications.filter((n: any) => {
    if (filterType === "unread") return n.isRead === 0;
    if (filterType !== "all") return n.category === filterType;
    return true;
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
              교사 첨삭, AI 첨삭 검수·이의제기 결과, 과제 마감과 공지사항을 필터링하여 모아보세요.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Button
              onClick={() => setIsPrefsOpen(true)}
              className="bg-white/20 hover:bg-white/30 text-white font-bold border border-white/30 gap-2"
            >
              🔔 푸시 알림 설정
            </Button>
            <Button
              onClick={() => setLocation("/mypage")}
              className="bg-white text-indigo-900 hover:bg-indigo-50 font-bold"
            >
              마이페이지 허브
            </Button>
          </div>
        </div>

        {/* Filter Buttons & Mark All Read */}
        <div className="flex flex-wrap gap-2 items-center justify-between bg-white p-4 rounded-2xl shadow-sm border border-slate-200">
          <div className="flex flex-wrap gap-2 items-center">
            <Filter className="w-4 h-4 text-slate-500 mr-1" />
            <span className="text-xs font-semibold text-slate-700 mr-2">필터:</span>
            <Button
              size="sm"
              variant={filterType === "all" ? "default" : "outline"}
              onClick={() => setFilterType("all")}
              className={filterType === "all" ? "bg-indigo-600 text-white" : "border-slate-200 text-slate-700"}
            >
              전체 ({notifications.length})
            </Button>
            <Button
              size="sm"
              variant={filterType === "unread" ? "default" : "outline"}
              onClick={() => setFilterType("unread")}
              className={filterType === "unread" ? "bg-indigo-600 text-white" : "border-slate-200 text-slate-700"}
            >
              읽지 않음 ({notifications.filter((n: any) => n.isRead === 0).length})
            </Button>
            <Button
              size="sm"
              variant={filterType === "teacher_feedback" ? "default" : "outline"}
              onClick={() => setFilterType("teacher_feedback")}
              className={filterType === "teacher_feedback" ? "bg-indigo-600 text-white" : "border-slate-200 text-slate-700"}
            >
              교사 첨삭
            </Button>
            <Button
              size="sm"
              variant={filterType === "assignment" ? "default" : "outline"}
              onClick={() => setFilterType("assignment")}
              className={filterType === "assignment" ? "bg-indigo-600 text-white" : "border-slate-200 text-slate-700"}
            >
              과제 마감
            </Button>
            <Button
              size="sm"
              variant={filterType === "evaluation_review" ? "default" : "outline"}
              onClick={() => setFilterType("evaluation_review")}
              className={filterType === "evaluation_review" ? "bg-indigo-600 text-white" : "border-slate-200 text-slate-700"}
            >
              첨삭 검수
            </Button>
          </div>
          <Button
            size="sm"
            variant="outline"
            onClick={() => markAllReadMutation.mutate()}
            className="border-indigo-200 text-indigo-700 hover:bg-indigo-50 font-semibold"
          >
            모두 읽음으로 표시
          </Button>
        </div>

        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
              <Bell className="w-5 h-5 text-indigo-600" /> 목록 ({filteredNotifications.length}개)
            </h2>
          </div>

          {isLoading ? (
            <div className="py-12 text-center text-slate-500">알림을 불러오는 중입니다...</div>
          ) : filteredNotifications.length === 0 ? (
            <Card className="border-slate-200 bg-white shadow-sm p-12 text-center">
              <CheckCircle2 className="w-12 h-12 text-emerald-500 mx-auto mb-3" />
              <h3 className="text-lg font-bold text-slate-800">조건에 맞는 알림이 없습니다.</h3>
              <p className="text-sm text-slate-600 mt-1">다른 필터를 선택하거나 새로운 소식을 기다려주세요.</p>
            </Card>
          ) : (
            <div className="space-y-3">
              {filteredNotifications.map((n: any) => (
                <Card
                  key={n.id}
                  className={`border shadow-sm transition-all ${
                    n.isRead ? "bg-white border-slate-200" : "bg-indigo-50/50 border-indigo-200 font-medium"
                  }`}
                >
                  <CardHeader className="py-4 flex flex-row items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${n.category === "evaluation_review" ? "bg-amber-100" : "bg-indigo-100"}`}>
                        {n.category === "evaluation_review" ? <ShieldCheck className="w-5 h-5 text-amber-700" /> : <MessageSquare className="w-5 h-5 text-indigo-600" />}
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

      {/* Push Notification Preferences Modal */}
      {isPrefsOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-6">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-extrabold text-slate-900 flex items-center gap-2">
                🔔 알림 유형별 푸시 설정
              </h3>
              <Button size="sm" variant="ghost" onClick={() => setIsPrefsOpen(false)}>✕</Button>
            </div>
            <p className="text-xs text-slate-500">
              수신하고 싶은 알림 유형을 선택하세요. 브라우저 푸시 권한이 허용된 경우 실시간으로 알림이 전송됩니다.
            </p>
            <div className="space-y-4">
              <div className="flex items-center justify-between p-3 rounded-2xl bg-slate-50 border border-slate-100">
                <div>
                  <p className="text-sm font-bold text-slate-800">교사 서술형 첨삭 완료</p>
                  <p className="text-xs text-slate-500">선생님이 답안 첨삭 및 피드백을 등록했을 때</p>
                </div>
                <input
                  type="checkbox"
                  checked={prefsForm.teacherFeedback}
                  onChange={(e) => setPrefsForm({ ...prefsForm, teacherFeedback: e.target.checked })}
                  className="w-5 h-5 accent-indigo-600 rounded cursor-pointer"
                />
              </div>
              <div className="flex items-center justify-between p-3 rounded-2xl bg-slate-50 border border-slate-100">
                <div>
                  <p className="text-sm font-bold text-slate-800">과제 마감 임박 알림</p>
                  <p className="text-xs text-slate-500">제출 기한이 다가오는 논술 과제가 있을 때</p>
                </div>
                <input
                  type="checkbox"
                  checked={prefsForm.assignmentDeadline}
                  onChange={(e) => setPrefsForm({ ...prefsForm, assignmentDeadline: e.target.checked })}
                  className="w-5 h-5 accent-indigo-600 rounded cursor-pointer"
                />
              </div>
              <div className="flex items-center justify-between p-3 rounded-2xl bg-slate-50 border border-slate-100">
                <div>
                  <p className="text-sm font-bold text-slate-800">학습 공지 및 시스템 소식</p>
                  <p className="text-xs text-slate-500">새로운 커리큘럼이나 플랫폼 공지사항</p>
                </div>
                <input
                  type="checkbox"
                  checked={prefsForm.notice}
                  onChange={(e) => setPrefsForm({ ...prefsForm, notice: e.target.checked })}
                  className="w-5 h-5 accent-indigo-600 rounded cursor-pointer"
                />
              </div>
            </div>
            <div className="flex justify-end gap-3 pt-2">
              <Button size="sm" variant="outline" onClick={() => setIsPrefsOpen(false)}>취소</Button>
              <Button
                size="sm"
                onClick={() => updatePrefsMutation.mutate(prefsForm)}
                className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold px-5"
              >
                저장하기
              </Button>
            </div>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}
