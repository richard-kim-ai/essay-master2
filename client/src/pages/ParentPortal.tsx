import React, { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { BookOpen, Award, Bot, ClipboardList, Gift, Send, UserCheck, TrendingUp, ArrowLeft, Link as LinkIcon, UserPlus } from "lucide-react";
import { Link } from "wouter";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ChildBillingSummary } from "@/components/ParentPurchase";

const formatDate = (value: string | Date | null | undefined) => (value ? new Date(value).toLocaleDateString("ko-KR", { year: "numeric", month: "long", day: "numeric" }) : "–");

type EssayComment = { id: string; parentName: string; comment: string; createdAt: Date | string | null };

// 한 편의 글에 남긴 코멘트와 새 코멘트 입력. 글 없이는 코멘트를 보낼 수 없다(학생이 어떤 글에 대한 말인지 알 수 있도록).
function EssayCommentBox({ essayId, studentId, comments, addComment }: { essayId: number; studentId: number; comments: EssayComment[]; addComment: { mutate: (vars: { studentId: number; essayId: number; comment: string }, options?: { onSuccess?: () => void }) => void; isPending: boolean } }) {
  const [text, setText] = useState("");
  return (
    <div className="space-y-2 rounded-lg border border-slate-200 bg-slate-50 p-3" data-testid={`essay-comment-box-${essayId}`}>
      <p className="text-xs font-semibold text-slate-700">이 글에 남긴 코멘트 ({comments.length})</p>
      {comments.map((item) => (
        <div key={item.id} className="rounded-md bg-white p-2 text-xs text-slate-700"><p className="whitespace-pre-wrap">{item.comment}</p><p className="mt-1 text-[11px] text-slate-400">{item.parentName} · {item.createdAt ? formatDate(item.createdAt) : "날짜 미상"}</p></div>
      ))}
      <form
        className="space-y-2"
        onSubmit={(event) => {
          event.preventDefault();
          if (!text.trim()) return;
          addComment.mutate({ studentId, essayId, comment: text.trim() }, { onSuccess: () => setText("") });
        }}
      >
        <textarea value={text} onChange={(event) => setText(event.target.value)} maxLength={1000} required placeholder="이 글에 대한 응원이나 지도 한마디를 남겨 보세요." className="min-h-[80px] w-full rounded-lg border border-slate-200 bg-white p-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
        <Button type="submit" size="sm" disabled={addComment.isPending} className="gap-1 bg-indigo-600 text-white hover:bg-indigo-700"><Send className="h-3.5 w-3.5" />{addComment.isPending ? "보내는 중..." : "이 글에 코멘트 보내기"}</Button>
      </form>
    </div>
  );
}

export default function ParentPortal() {
  const [studentEmailInput, setStudentEmailInput] = useState("");
  const [linkModalOpen, setLinkModalOpen] = useState(false);
  const [linkedStudentId, setLinkedStudentId] = useState<number | null>(null);
  const [tab, setTab] = useState("overview");

  const utils = trpc.useUtils();
  const { data: linkedStudents, isLoading: linkedLoading, refetch: refetchLinked } = trpc.parent.linkedStudents.useQuery();

  const { data: linkRequests = [], refetch: refetchRequests } = trpc.parent.linkRequests.useQuery();

  const linkMutation = trpc.parent.linkStudent.useMutation({
    onSuccess: (data) => {
      setStudentEmailInput("");
      setLinkModalOpen(false);
      if (data.status === "approved") {
        toast.success(`자녀 계정이 ${"courseLabel" in data && data.courseLabel ? data.courseLabel : "선택"} 과정으로 연동되었습니다.`);
        refetchLinked();
        if ("studentId" in data && data.studentId) setLinkedStudentId(data.studentId);
      } else if (data.status === "pending") {
        toast.success("연결 요청을 보냈습니다. 자녀가 승인하면 학습 현황을 볼 수 있습니다.");
        refetchRequests();
      } else {
        toast.error("자녀가 연결을 거절한 상태입니다. 자녀와 상의한 뒤 다시 요청해 주세요.");
        refetchRequests();
      }
    },
    onError: (err: any) => {
      toast.error(err.message || "자녀 연동 중 오류가 발생했습니다.");
    },
  });

  const { data: studentDetail, refetch: refetchDetail } = trpc.parent.studentDetail.useQuery(
    { studentId: linkedStudentId ?? 0 },
    { enabled: linkedStudentId !== null }
  );

  const addCommentMutation = trpc.parent.addComment.useMutation({
    onSuccess: () => {
      toast.success("코멘트를 보냈습니다. 자녀의 첨삭 결과 화면과 알림에서 볼 수 있습니다.");
      refetchDetail();
    },
    onError: (err: any) => {
      toast.error(err.message || "코멘트 등록 중 오류가 발생했습니다.");
    },
  });

  const handleLinkSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!studentEmailInput.trim()) return;
    linkMutation.mutate({ studentEmail: studentEmailInput.trim().toLowerCase() });
  };

  // 연동된 학생이 처음 로드될 때만 첫 번째 학생을 선택합니다.
  useEffect(() => {
    if (linkedStudents && linkedStudents.length > 0 && linkedStudentId === null) {
      setLinkedStudentId(linkedStudents[0].id);
    }
  }, [linkedStudents, linkedStudentId]);

  return (
    <div className="space-y-6 max-w-7xl mx-auto py-6 px-4">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <Link href="/">
              <Button variant="ghost" size="sm" className="gap-1 text-slate-600 pl-0">
                <ArrowLeft className="h-4 w-4" /> 홈으로
              </Button>
            </Link>
          </div>
          <h1 className="text-2xl font-bold text-slate-900">학부모 전용 학습 모니터링 콘솔</h1>
          <p className="text-sm text-slate-500">자녀의 이메일 계정을 연동하여 실시간 학습 진도율, 논술 첨삭 결과, 수료증 취득 현황을 모니터링합니다.</p>
        </div>

        <div className="flex items-center gap-3">
          {linkedStudents && linkedStudents.length > 0 && (
            <div className="flex items-center gap-2 bg-white p-2 rounded-xl border border-slate-200 shadow-sm">
              <span className="text-xs font-semibold text-slate-600 pl-2">연동된 자녀:</span>
              <select
                className="h-9 rounded-md border border-slate-200 bg-slate-50 px-3 text-xs font-medium text-slate-800"
                value={linkedStudentId ?? ""}
                onChange={(e) => setLinkedStudentId(Number(e.target.value))}
              >
                {linkedStudents.map((s: any) => (
                  <option key={s.id} value={s.id}>
                    {s.name || `학생 #${s.id}`} · {s.courseLabel || s.tag || "과정 미설정"} ({s.email})
                  </option>
                ))}
              </select>
            </div>
          )}
          <Button onClick={() => setLinkModalOpen(true)} className="gap-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs">
            <UserPlus className="h-4 w-4" /> 자녀 계정 연동하기
          </Button>
        </div>
      </div>

      {linkRequests.length > 0 && (
        <Card className="space-y-2 border-amber-200 bg-amber-50 p-4" aria-label="자녀 연결 요청 현황">
          <p className="text-sm font-bold text-amber-950">자녀 연결 요청 현황</p>
          <ul className="space-y-1 text-sm text-amber-900">
            {linkRequests.map((request) => (
              <li key={request.linkId}>
                {request.studentName || request.studentEmail || "자녀 계정"} · {request.status === "pending" ? "자녀의 승인을 기다리는 중입니다." : "자녀가 연결을 거절했습니다."}
              </li>
            ))}
          </ul>
        </Card>
      )}

      {linkedLoading ? (
        <Card className="p-12 text-center text-slate-500">연동된 자녀 정보를 불러오는 중...</Card>
      ) : !linkedStudents || linkedStudents.length === 0 ? (
        <Card className="p-12 text-center space-y-4 border-dashed border-2 border-slate-200 bg-white">
          <div className="mx-auto w-12 h-12 rounded-full bg-indigo-50 text-indigo-600 flex items-center justify-center">
            <LinkIcon className="h-6 w-6" />
          </div>
          <h3 className="text-lg font-bold text-slate-900">연동된 자녀 계정이 없습니다</h3>
          <p className="text-sm text-slate-500 max-w-md mx-auto">
            학습 중인 자녀의 이메일 계정을 연동하여 주간 AI 첨삭 리포트와 학습 진도 변화를 실시간으로 확인해 보세요.
          </p>
          <Button onClick={() => setLinkModalOpen(true)} className="bg-indigo-600 hover:bg-indigo-700 text-white">
            지금 자녀 계정 연동하기
          </Button>
        </Card>
      ) : studentDetail ? (
        <Tabs value={tab} onValueChange={setTab} className="space-y-6">
          <TabsList className="grid w-full grid-cols-2 sm:grid-cols-4 sm:max-w-3xl">
            <TabsTrigger value="overview">학습 현황</TabsTrigger>
            <TabsTrigger value="writing">글·첨삭</TabsTrigger>
            <TabsTrigger value="certificates">수료증</TabsTrigger>
            <TabsTrigger value="billing">이용권·구매</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-6">
            <Card className="border-slate-200 shadow-sm" data-testid="parent-overview">
              <CardHeader>
                <CardTitle className="text-lg font-bold flex items-center gap-2">
                  <UserCheck className="h-5 w-5 text-indigo-600" />
                  <span>{studentDetail.student.name || "자녀"} 학생 학습 현황</span>
                </CardTitle>
                <CardDescription>
                  학습 과정: <span className="font-semibold text-indigo-700" data-testid="child-course">{studentDetail.student.courseLabel || "아직 과정을 선택하지 않았습니다"}</span> · 가입일: {formatDate(studentDetail.student.createdAt)} · 최근 접속: {formatDate(studentDetail.student.lastSignedIn)}
                </CardDescription>
              </CardHeader>
              <CardContent className="grid gap-3 sm:grid-cols-5">
                <div className="p-4 bg-indigo-50/60 rounded-xl border border-indigo-100">
                  <p className="text-xs font-medium text-indigo-600">완료한 학습 단원</p>
                  <h3 className="text-2xl font-bold text-indigo-900 mt-1">{studentDetail.learning.completedCount}개</h3>
                  <p className="text-[11px] text-indigo-500">{studentDetail.learning.lastCompletedAt ? `마지막 ${formatDate(studentDetail.learning.lastCompletedAt)}` : "아직 완료한 단원 없음"}</p>
                </div>
                <div className="p-4 bg-emerald-50/50 rounded-xl border border-emerald-100">
                  <p className="text-xs font-medium text-emerald-600">제출한 글</p>
                  <h3 className="text-2xl font-bold text-emerald-900 mt-1">{studentDetail.essays.length}건</h3>
                </div>
                <div className="p-4 bg-sky-50/60 rounded-xl border border-sky-100">
                  <p className="text-xs font-medium text-sky-700">AI 첨삭</p>
                  <h3 className="text-2xl font-bold text-sky-900 mt-1">{studentDetail.aiFeedbacks.length}건</h3>
                </div>
                <div className="p-4 bg-indigo-50/50 rounded-xl border border-indigo-100">
                  <p className="text-xs font-medium text-indigo-600">취득한 수료증</p>
                  <h3 className="text-2xl font-bold text-indigo-900 mt-1">{studentDetail.certificates.length}장</h3>
                </div>
                <div className="p-4 bg-amber-50/50 rounded-xl border border-amber-100">
                  <p className="text-xs font-medium text-amber-700">반 과제</p>
                  <h3 className="mt-1 text-2xl font-bold text-amber-900">{studentDetail.classAssignments?.length ?? 0}건</h3>
                </div>
              </CardContent>
            </Card>

            <Card className="border-slate-200 shadow-sm" data-testid="parent-growth">
              <CardHeader>
                <CardTitle className="text-base font-bold flex items-center gap-2"><TrendingUp className="h-4 w-4 text-indigo-600" /> 학습 진도와 실력</CardTitle>
                <CardDescription>실제 학습·첨삭 기록에서 계산한 값입니다. 기록이 없는 영역은 "측정 전"으로 표시합니다.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-5">
                <div className="grid gap-3 sm:grid-cols-4 text-center">
                  <div className="rounded-lg bg-slate-50 p-3"><p className="text-[11px] text-slate-500">이번 주 푼 문항</p><p className="text-lg font-bold text-slate-900">{studentDetail.weekly.solvedThisWeek}개</p></div>
                  <div className="rounded-lg bg-slate-50 p-3"><p className="text-[11px] text-slate-500">이번 주 정답률</p><p className="text-lg font-bold text-slate-900">{studentDetail.weekly.accuracyRate === null ? "–" : `${studentDetail.weekly.accuracyRate}%`}</p></div>
                  <div className="rounded-lg bg-slate-50 p-3"><p className="text-[11px] text-slate-500">이번 주 완료 단원</p><p className="text-lg font-bold text-slate-900">{studentDetail.weekly.completedModules}개</p></div>
                  <div className="rounded-lg bg-slate-50 p-3"><p className="text-[11px] text-slate-500">학습한 날</p><p className="text-lg font-bold text-slate-900">{studentDetail.weekly.activeDays}일</p></div>
                </div>
                <div className="space-y-2">
                  {studentDetail.analytics.skills.map((skill) => (
                    <div key={skill.key} className="flex items-center gap-3 text-sm">
                      <span className="w-28 shrink-0 text-slate-700">{skill.label}</span>
                      <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-indigo-500" style={{ width: `${skill.value ?? 0}%` }} /></div>
                      <span className="w-20 shrink-0 text-right text-xs text-slate-500">{skill.value === null ? "측정 전" : `${skill.value}점`}</span>
                    </div>
                  ))}
                </div>
                {studentDetail.learning.recent.length > 0 && (
                  <div>
                    <p className="mb-2 text-xs font-semibold text-slate-600">최근 완료한 학습</p>
                    <ul className="divide-y divide-slate-100 text-sm">
                      {studentDetail.learning.recent.map((item, index) => (
                        <li key={index} className="flex items-center justify-between py-2"><span className="text-slate-800">{item.level ? `${item.level}단계 학습 완료` : "학습 완료"}</span><span className="text-xs text-slate-500">{item.score !== null ? `${item.score}점 · ` : ""}{formatDate(item.completedAt)}</span></li>
                      ))}
                    </ul>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card className="border-amber-100 shadow-sm">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base font-bold">
                  <ClipboardList className="h-4 w-4 text-amber-600" /> 반 과제 제출·채점 현황
                </CardTitle>
                <CardDescription>배정 과제, 자녀의 제출 답안, 교사 채점과 검토 완료된 AI 1차 첨삭을 확인합니다.</CardDescription>
              </CardHeader>
              <CardContent>
                {(studentDetail.classAssignments?.length ?? 0) === 0 ? (
                  <p className="py-8 text-center text-sm text-slate-500">현재 배정된 반 과제가 없습니다.</p>
                ) : (
                  <div className="space-y-3">
                    {studentDetail.classAssignments.slice(0, 6).map((assignment: any) => {
                      const evaluation = assignment.aiFeedback?.evaluationJson ? (() => { try { return JSON.parse(assignment.aiFeedback.evaluationJson); } catch { return null; } })() : null;
                      const statusLabel = assignment.submissionStatus === "reviewed" ? "교사 채점 완료" : assignment.submissionStatus === "submitted" ? "교사 검토 대기" : assignment.isOverdue ? "마감 경과·미제출" : "제출 전";
                      const statusClass = assignment.submissionStatus === "reviewed" ? "bg-emerald-100 text-emerald-700" : assignment.submissionStatus === "submitted" ? "bg-indigo-100 text-indigo-700" : assignment.isOverdue ? "bg-rose-100 text-rose-700" : "bg-amber-100 text-amber-700";
                      return <div key={assignment.id} className="rounded-xl border border-slate-100 bg-slate-50 p-4">
                        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                          <div><p className="font-semibold text-slate-900">{assignment.title}</p><p className="mt-1 text-xs text-slate-500">{assignment.groupName} · 마감 {assignment.dueAt ? new Date(assignment.dueAt).toLocaleString("ko-KR") : "미지정"}</p></div>
                          <Badge className={statusClass}>{statusLabel}</Badge>
                        </div>
                        {assignment.submission ? <details className="mt-3 rounded-lg border border-slate-200 bg-white"><summary className="cursor-pointer px-3 py-2 text-xs font-semibold text-slate-700">제출 답안·채점 결과 보기</summary><div className="space-y-3 border-t border-slate-100 p-3"><div><p className="text-xs font-bold text-slate-500">제출 답안</p><p className="mt-1 whitespace-pre-wrap text-sm leading-6 text-slate-700">{assignment.submission.content}</p></div>{assignment.submission.status === "reviewed" && <div className="rounded-lg bg-emerald-50 p-3"><p className="text-xs font-bold text-emerald-800">교사 최종 채점 · {assignment.submission.score ?? "-"}점</p><p className="mt-1 whitespace-pre-wrap text-sm leading-6 text-slate-700">{assignment.submission.teacherComment || "교사 피드백을 준비 중입니다."}</p></div>}{assignment.aiFeedback && <div className="rounded-lg bg-indigo-50 p-3"><p className="flex items-center gap-1.5 text-xs font-bold text-indigo-800"><Bot className="h-3.5 w-3.5" /> 검토 완료 AI 1차 첨삭 · {assignment.aiFeedback.overallScore}점</p><p className="mt-1 whitespace-pre-wrap text-sm leading-6 text-slate-700">{evaluation?.summary || assignment.aiFeedback.draftComment}</p>{evaluation?.priorityImprovements?.length > 0 && <ul className="mt-2 list-disc space-y-1 pl-4 text-xs text-slate-600">{evaluation.priorityImprovements.map((item: string, index: number) => <li key={`${item}-${index}`}>{item}</li>)}</ul>}</div>}</div></details> : <p className="mt-3 text-sm text-slate-500">아직 자녀가 답안을 제출하지 않았습니다.</p>}
                      </div>;
                    })}
                  </div>
                )}
              </CardContent>
            </Card>

          </TabsContent>

          <TabsContent value="writing" className="space-y-6">
            <Card className="border-slate-200 shadow-sm" data-testid="parent-essays">
              <CardHeader>
                <CardTitle className="text-base font-bold flex items-center gap-2"><BookOpen className="h-4 w-4 text-indigo-600" /> 제출한 글과 선생님 첨삭</CardTitle>
                <CardDescription>제출했거나 첨삭을 받은 글만 보입니다. 글을 열면 선생님 총평을 보고, 그 글에 코멘트를 남길 수 있습니다. 작성 중인 초안은 자녀만 볼 수 있습니다.</CardDescription>
              </CardHeader>
              <CardContent>
                {studentDetail.essays.length === 0 ? (
                  <p className="py-8 text-center text-sm text-slate-500" data-testid="no-essays">아직 제출한 글이 없습니다.</p>
                ) : (
                  <div className="space-y-3">
                    {studentDetail.essays.map((essay) => (
                      <details key={essay.id} className="rounded-xl border border-slate-100 bg-slate-50">
                        <summary className="flex cursor-pointer flex-wrap items-center justify-between gap-2 p-4">
                          <span>
                            <span className="font-semibold text-sm text-slate-900">{essay.title}</span>
                            <span className="ml-2 text-xs text-slate-500">{formatDate(essay.submittedAt ?? essay.updatedAt)}</span>
                          </span>
                          <span className="flex items-center gap-2">
                            {essay.teacherScore !== null && <span className="text-xs px-2 py-0.5 rounded bg-indigo-100 text-indigo-800 font-bold">선생님 점수 {essay.teacherScore}점</span>}
                            <span className={`text-xs font-semibold px-2.5 py-1 rounded-full border ${essay.status === "reviewed" ? "text-emerald-600 bg-emerald-50 border-emerald-200" : "text-slate-600 bg-white border-slate-200"}`}>{essay.status === "reviewed" ? "첨삭 완료" : "제출 완료"}</span>
                          </span>
                        </summary>
                        <div className="space-y-3 border-t border-slate-100 bg-white p-4 text-sm">
                          <p className="whitespace-pre-wrap leading-6 text-slate-700">{essay.content}</p>
                          {essay.teacherComment && <div className="rounded-lg border border-indigo-100 bg-indigo-50/50 p-3"><p className="mb-1 text-xs font-semibold text-indigo-700">선생님 총평</p><p className="whitespace-pre-wrap text-slate-700">{essay.teacherComment}</p></div>}
                          <EssayCommentBox essayId={essay.id} comments={studentDetail.comments.filter((item) => item.essayId === essay.id)} addComment={addCommentMutation} studentId={studentDetail.student.id} />
                        </div>
                      </details>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card className="border-slate-200 shadow-sm" data-testid="parent-ai-feedbacks">
              <CardHeader>
                <CardTitle className="text-base font-bold flex items-center gap-2"><Bot className="h-4 w-4 text-sky-600" /> AI 첨삭 내역</CardTitle>
              </CardHeader>
              <CardContent>
                {studentDetail.aiFeedbacks.length === 0 ? (
                  <p className="py-6 text-center text-sm text-slate-500">아직 AI 첨삭 기록이 없습니다.</p>
                ) : (
                  <ul className="divide-y divide-slate-100 text-sm">
                    {studentDetail.aiFeedbacks.map((row) => (
                      <li key={row.id} className="flex items-center justify-between gap-3 py-2"><span className="text-slate-800">{row.title}</span><span className="shrink-0 text-xs text-slate-500">{row.overallScore !== null ? `${row.overallScore}점` : "기본 점검"} · {formatDate(row.createdAt)}</span></li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>

            <Card className="border-slate-200 shadow-sm">
              <CardHeader>
                <CardTitle className="text-base font-bold">보낸 코멘트 ({studentDetail.comments.length})</CardTitle>
              </CardHeader>
              <CardContent>
                {studentDetail.comments.length === 0 ? (
                  <p className="py-6 text-center text-xs text-slate-400" data-testid="no-comments">보낸 코멘트가 없습니다.</p>
                ) : (
                  <div className="space-y-2 max-h-[320px] overflow-y-auto pr-1">
                    {studentDetail.comments.map((item) => (
                      <div key={item.id} className="p-3 rounded-lg bg-indigo-50/40 border border-indigo-100 text-xs text-slate-700 leading-relaxed">
                        <p className="whitespace-pre-wrap">{item.comment}</p>
                        <p className="mt-1 text-[11px] text-slate-400">{item.essayTitle ? `「${item.essayTitle}」 · ` : "글과 연결되지 않은 이전 코멘트 · "}{item.parentName} · {item.createdAt ? formatDate(item.createdAt) : "날짜 미상"}</p>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="certificates" className="space-y-6">
            <Card className="border-slate-200 shadow-sm" data-testid="parent-certificates">
              <CardHeader><CardTitle className="text-base font-bold flex items-center gap-2"><Award className="h-4 w-4 text-indigo-600" /> 취득한 수료증</CardTitle></CardHeader>
              <CardContent>
                {studentDetail.certificates.length === 0 ? (
                  <p className="py-8 text-center text-sm text-slate-500">아직 취득한 수료증이 없습니다.</p>
                ) : (
                  <ul className="divide-y divide-slate-100 text-sm">
                    {studentDetail.certificates.map((cert) => (
                      <li key={cert.id} className="flex items-center justify-between py-2"><span className="text-slate-800">{cert.title || (cert.certificateType === "graduation_certificate" ? "졸업 수료증" : `${cert.level ?? ""}단계 수료증`)}</span><span className="text-xs text-slate-500">{formatDate(cert.issuedAt)}</span></li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="billing" className="space-y-6">
            <Card className="space-y-4 border-slate-200 p-5 shadow-sm" data-testid="parent-billing-tab">
              <div>
                <h2 className="flex items-center gap-2 text-base font-bold text-slate-900"><Gift className="h-4 w-4 text-indigo-600" /> {studentDetail.student.name || "자녀"} 학생의 이용권</h2>
                <p className="mt-1 text-xs text-slate-500">이용권과 교사 첨삭지도권은 자녀 계정에 지급됩니다.</p>
              </div>
              <ChildBillingSummary studentId={studentDetail.student.id} />
              <Link href={`/checkout?student=${studentDetail.student.id}`}><Button className="bg-indigo-600 text-white hover:bg-indigo-700">이용권·첨삭지도권 구매해 주기</Button></Link>
            </Card>
          </TabsContent>
        </Tabs>
      ) : null}

      {/* Link Student Modal */}
      {linkModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <Card className="w-full max-w-md bg-white p-6 shadow-xl">
            <h3 className="text-lg font-bold text-slate-900 mb-2">자녀 계정 연동</h3>
            <p className="text-xs text-slate-500 mb-4">가입된 자녀 학생의 이메일 주소를 입력하여 계정을 연결하세요.</p>
            <form onSubmit={handleLinkSubmit} className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">학생 이메일 주소</label>
                <Input
                  type="email"
                  required
                  placeholder="student@example.com"
                  value={studentEmailInput}
                  onChange={(e) => setStudentEmailInput(e.target.value)}
                />
              </div>
              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => setLinkModalOpen(false)}>취소</Button>
                <Button type="submit" disabled={linkMutation.isPending} className="bg-indigo-600 hover:bg-indigo-700 text-white">
                  {linkMutation.isPending ? "연동 중..." : "연동 신청"}
                </Button>
              </div>
            </form>
          </Card>
        </div>
      )}
    </div>
  );
}
