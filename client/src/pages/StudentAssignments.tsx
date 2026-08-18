import { useMemo, useState } from "react";
import { useLocation } from "wouter";
import { toast } from "sonner";
import { BookOpenCheck, CalendarClock, CheckCircle2, ClipboardPenLine, FileEdit, Send, Sparkles } from "lucide-react";
import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";

type AssignmentFilter = "all" | "pending" | "submitted" | "reviewed";

function formatDueDate(value: Date | null) {
  return value ? new Date(value).toLocaleString("ko-KR", { month: "long", day: "numeric", hour: "2-digit", minute: "2-digit" }) : "마감일 없음";
}

export default function StudentAssignments() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const utils = trpc.useUtils();
  const [filter, setFilter] = useState<AssignmentFilter>("all");
  const [selectedAssignmentId, setSelectedAssignmentId] = useState<number | null>(null);
  const [content, setContent] = useState("");
  const { data: assignments = [], isLoading } = trpc.student.myAssignments.useQuery(undefined, { enabled: user?.role === "user" });

  const selectedAssignment = assignments.find((assignment: any) => assignment.id === selectedAssignmentId) as any | undefined;
  const submitMutation = trpc.student.submitAssignment.useMutation({
    onSuccess: () => {
      toast.success("과제가 제출되었습니다. 교사 채점이 완료되면 알림으로 안내합니다.");
      setSelectedAssignmentId(null);
      setContent("");
      utils.student.myAssignments.invalidate();
    },
    onError: (error) => toast.error(error.message || "과제를 제출하지 못했습니다."),
  });

  const counts = useMemo(() => ({
    all: assignments.length,
    pending: assignments.filter((assignment: any) => assignment.submissionStatus === "pending").length,
    submitted: assignments.filter((assignment: any) => assignment.submissionStatus === "submitted").length,
    reviewed: assignments.filter((assignment: any) => assignment.submissionStatus === "reviewed").length,
  }), [assignments]);
  const visibleAssignments = assignments.filter((assignment: any) => filter === "all" || assignment.submissionStatus === filter);

  const openSubmission = (assignment: any) => {
    setSelectedAssignmentId(assignment.id);
    setContent(assignment.submission?.content || "");
  };

  if (user && user.role !== "user") {
    return (
      <DashboardLayout>
        <div className="mx-auto max-w-3xl p-6 md:p-10">
          <Card className="border-amber-200 bg-amber-50 p-8 text-center">
            <ClipboardPenLine className="mx-auto mb-3 h-10 w-10 text-amber-600" />
            <CardTitle>학습자 전용 과제 공간입니다</CardTitle>
            <CardDescription className="mt-2">학생 계정으로 로그인하면 배정된 반 과제를 확인하고 제출할 수 있습니다.</CardDescription>
            <Button className="mt-5" onClick={() => setLocation("/mypage")}>마이페이지로 이동</Button>
          </Card>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="mx-auto max-w-6xl space-y-5 p-4 md:p-6 lg:p-8">
        <section className="rounded-2xl bg-indigo-900 p-5 text-white shadow-lg md:flex md:items-center md:justify-between md:p-6">
          <div>
            <div className="mb-2 inline-flex items-center gap-1.5 rounded-full bg-white/15 px-2.5 py-1 text-xs font-semibold text-indigo-100">
              <Sparkles className="h-3.5 w-3.5" /> 나의 반 과제
            </div>
            <h1 className="text-2xl font-extrabold tracking-tight">배정된 과제를 확인하고 제출하세요</h1>
            <p className="mt-1 text-sm text-indigo-100">제출 후 교사의 채점 및 첨삭 진행 상황도 이곳에서 확인할 수 있습니다.</p>
          </div>
          <div className="mt-4 flex items-center gap-2 text-sm md:mt-0">
            <span className="rounded-xl bg-white/10 px-3 py-2 font-semibold">미제출 {counts.pending}개</span>
            <Button variant="outline" className="border-white/35 bg-white text-indigo-900 hover:bg-indigo-50" onClick={() => setLocation("/mypage")}>마이페이지</Button>
          </div>
        </section>

        <div className="grid gap-3 sm:grid-cols-4">
          {([
            ["all", "전체"],
            ["pending", "제출 필요"],
            ["submitted", "채점 대기"],
            ["reviewed", "채점 완료"],
          ] as [AssignmentFilter, string][]).map(([key, label]) => (
            <button
              key={key}
              type="button"
              onClick={() => setFilter(key)}
              className={`rounded-xl border p-3 text-left transition ${filter === key ? "border-indigo-600 bg-indigo-50 ring-1 ring-indigo-200" : "border-slate-200 bg-white hover:border-indigo-200"}`}
            >
              <span className="text-xs font-medium text-slate-500">{label}</span>
              <span className="mt-1 block text-xl font-extrabold text-slate-900">{counts[key]}개</span>
            </button>
          ))}
        </div>

        {isLoading ? (
          <div className="py-20 text-center text-sm text-slate-500">배정된 과제를 불러오는 중입니다.</div>
        ) : visibleAssignments.length === 0 ? (
          <Card className="border-slate-200 bg-white py-16 text-center shadow-sm">
            <BookOpenCheck className="mx-auto mb-3 h-11 w-11 text-emerald-500" />
            <CardTitle className="text-lg">표시할 과제가 없습니다</CardTitle>
            <CardDescription className="mt-2">새로운 과제가 배정되면 헤더 알림과 이 화면에서 확인할 수 있습니다.</CardDescription>
          </Card>
        ) : (
          <div className="grid gap-4 lg:grid-cols-2">
            {visibleAssignments.map((assignment: any) => {
              const isReviewed = assignment.submissionStatus === "reviewed";
              const isSubmitted = assignment.submissionStatus === "submitted";
              return (
                <Card key={assignment.id} className={`border shadow-sm ${assignment.isOverdue ? "border-rose-200" : "border-slate-200"}`}>
                  <CardHeader className="space-y-3 pb-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-xs font-semibold text-indigo-600">{assignment.groupName}</p>
                        <CardTitle className="mt-1 line-clamp-2 text-lg text-slate-900">{assignment.title}</CardTitle>
                      </div>
                      <span className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-bold ${isReviewed ? "bg-emerald-100 text-emerald-700" : isSubmitted ? "bg-blue-100 text-blue-700" : assignment.isOverdue ? "bg-rose-100 text-rose-700" : "bg-amber-100 text-amber-700"}`}>
                        {isReviewed ? "채점 완료" : isSubmitted ? "채점 대기" : assignment.isOverdue ? "마감 경과" : "제출 필요"}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5 text-xs text-slate-500"><CalendarClock className="h-3.5 w-3.5" /> {formatDueDate(assignment.dueAt)}</div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <p className="line-clamp-3 text-sm leading-6 text-slate-600">{assignment.instructions}</p>
                    {isReviewed && assignment.submission?.teacherComment && (
                      <div className="rounded-xl bg-emerald-50 p-3 text-sm text-emerald-900"><strong>교사 코멘트</strong><p className="mt-1">{assignment.submission.teacherComment}</p></div>
                    )}
                    <Button
                      className="w-full bg-indigo-600 font-bold text-white hover:bg-indigo-700"
                      disabled={isReviewed}
                      onClick={() => openSubmission(assignment)}
                    >
                      {isReviewed ? <><CheckCircle2 className="mr-1.5 h-4 w-4" /> 채점 완료</> : isSubmitted ? <><FileEdit className="mr-1.5 h-4 w-4" /> 제출 답안 수정</> : <><ClipboardPenLine className="mr-1.5 h-4 w-4" /> 답안 작성·제출</>}
                    </Button>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}

        <Dialog open={selectedAssignmentId !== null} onOpenChange={(open) => !open && setSelectedAssignmentId(null)}>
          <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
            <DialogHeader>
              <DialogTitle className="pr-6 text-xl">{selectedAssignment?.title}</DialogTitle>
              <DialogDescription>{selectedAssignment?.groupName} · 마감 {selectedAssignment ? formatDueDate(selectedAssignment.dueAt) : ""}</DialogDescription>
            </DialogHeader>
            <div className="rounded-xl bg-slate-50 p-4 text-sm leading-6 text-slate-700"><strong className="block text-slate-900">과제 안내</strong><p className="mt-1 whitespace-pre-wrap">{selectedAssignment?.instructions}</p></div>
            <div className="space-y-2">
              <label className="text-sm font-bold text-slate-800" htmlFor="assignment-content">나의 답안</label>
              <Textarea id="assignment-content" value={content} onChange={(event) => setContent(event.target.value)} placeholder="주장과 근거가 드러나도록 답안을 작성해주세요." className="min-h-60 resize-y leading-7" />
              <p className="text-right text-xs text-slate-500">{content.trim().length.toLocaleString()} / 20,000자 · 최소 20자</p>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setSelectedAssignmentId(null)}>취소</Button>
              <Button className="bg-indigo-600 text-white hover:bg-indigo-700" disabled={content.trim().length < 20 || submitMutation.isPending} onClick={() => selectedAssignment && submitMutation.mutate({ assignmentId: selectedAssignment.id, content: content.trim() })}>
                <Send className="mr-1.5 h-4 w-4" /> {submitMutation.isPending ? "제출 중..." : "과제 제출"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}
