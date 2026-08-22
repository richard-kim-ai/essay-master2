import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { Users, BookOpen, Award, Bot, ClipboardList, MessageSquare, Send, CheckCircle2, UserCheck, Shield, ArrowLeft, Link as LinkIcon, UserPlus } from "lucide-react";
import { Link } from "wouter";

export default function ParentPortal() {
  const [studentEmailInput, setStudentEmailInput] = useState("");
  const [linkModalOpen, setLinkModalOpen] = useState(false);
  const [linkedStudentId, setLinkedStudentId] = useState<number | null>(null);
  const [commentText, setCommentText] = useState("");

  const utils = trpc.useUtils();
  const { data: linkedStudents, isLoading: linkedLoading, refetch: refetchLinked } = trpc.parent.linkedStudents.useQuery();

  const linkMutation = trpc.parent.linkStudent.useMutation({
    onSuccess: (data) => {
      toast.success(`자녀 계정이 ${data.courseLabel || "선택"} 과정으로 성공적으로 연동되었습니다.`);
      setStudentEmailInput("");
      setLinkModalOpen(false);
      refetchLinked();
      if (data.studentId) setLinkedStudentId(data.studentId);
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
      toast.success("학부모 코멘트가 자녀의 학습 기록에 등록되었습니다.");
      setCommentText("");
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

  const handleAddComment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!commentText.trim() || !linkedStudentId) return;
    addCommentMutation.mutate({ studentId: linkedStudentId, comment: commentText.trim() });
  };

  // 연동된 학생이 처음 로드될 때만 첫 번째 학생을 선택합니다.
  useEffect(() => {
    if (linkedStudents && linkedStudents.length > 0 && linkedStudentId === null) {
      setLinkedStudentId(linkedStudents[0].id);
    }
  }, [linkedStudents, linkedStudentId]);

  return (
    <div className="space-y-6 max-w-6xl mx-auto py-6 px-4">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <Link href="/dashboard">
              <Button variant="ghost" size="sm" className="gap-1 text-slate-600 pl-0">
                <ArrowLeft className="h-4 w-4" /> 대시보드로 돌아가기
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
          <Button onClick={() => setLinkModalOpen(true)} className="gap-2 bg-blue-600 hover:bg-blue-700 text-white text-xs">
            <UserPlus className="h-4 w-4" /> 자녀 계정 연동하기
          </Button>
        </div>
      </div>

      {linkedLoading ? (
        <Card className="p-12 text-center text-slate-500">연동된 자녀 정보를 불러오는 중...</Card>
      ) : !linkedStudents || linkedStudents.length === 0 ? (
        <Card className="p-12 text-center space-y-4 border-dashed border-2 border-slate-200 bg-white">
          <div className="mx-auto w-12 h-12 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center">
            <LinkIcon className="h-6 w-6" />
          </div>
          <h3 className="text-lg font-bold text-slate-900">연동된 자녀 계정이 없습니다</h3>
          <p className="text-sm text-slate-500 max-w-md mx-auto">
            학습 중인 자녀의 이메일 계정을 연동하여 주간 AI 첨삭 리포트와 학습 진도 변화를 실시간으로 확인해 보세요.
          </p>
          <Button onClick={() => setLinkModalOpen(true)} className="bg-blue-600 hover:bg-blue-700 text-white">
            지금 자녀 계정 연동하기
          </Button>
        </Card>
      ) : studentDetail ? (
        <div className="grid gap-6 lg:grid-cols-3">
          {/* Left 2 Cols */}
          <div className="lg:col-span-2 space-y-6">
            <Card className="border-slate-200 shadow-sm">
              <CardHeader>
                <CardTitle className="text-lg font-bold flex items-center gap-2">
                  <UserCheck className="h-5 w-5 text-blue-600" />
                  <span>{studentDetail.user.name || "자녀"} 학생 학습 현황 개요</span>
                </CardTitle>
                <CardDescription>가입 과정: <span className="font-semibold text-blue-700">{studentDetail.user.courseLabel || studentDetail.user.tag || "과정 미설정"}</span> · 가입일: {new Date(studentDetail.user.createdAt).toLocaleDateString()} · 최근 접속: {new Date(studentDetail.user.lastSignedIn).toLocaleString()}</CardDescription>
              </CardHeader>
              <CardContent className="grid gap-3 sm:grid-cols-5">
                <div className="p-4 bg-indigo-50/60 rounded-xl border border-indigo-100">
                  <p className="text-xs font-medium text-indigo-600">선택 학습 과정</p>
                  <h3 className="mt-1 text-base font-bold text-indigo-900">{studentDetail.user.courseLabel || studentDetail.user.tag || "미설정"}</h3>
                </div>
                <div className="p-4 bg-blue-50/50 rounded-xl border border-blue-100">
                  <p className="text-xs font-medium text-blue-600">완료한 학습 모듈</p>
                  <h3 className="text-2xl font-bold text-blue-900 mt-1">{studentDetail.progress.length}개</h3>
                </div>
                <div className="p-4 bg-emerald-50/50 rounded-xl border border-emerald-100">
                  <p className="text-xs font-medium text-emerald-600">제출한 논술 답안</p>
                  <h3 className="text-2xl font-bold text-emerald-900 mt-1">{studentDetail.submissions.length}건</h3>
                </div>
                <div className="p-4 bg-purple-50/50 rounded-xl border border-purple-100">
                  <p className="text-xs font-medium text-purple-600">취득한 수료증</p>
                  <h3 className="text-2xl font-bold text-purple-900 mt-1">{studentDetail.certificates.length}장</h3>
                </div>
                <div className="p-4 bg-amber-50/50 rounded-xl border border-amber-100">
                  <p className="text-xs font-medium text-amber-700">반 과제</p>
                  <h3 className="mt-1 text-2xl font-bold text-amber-900">{studentDetail.classAssignments?.length ?? 0}건</h3>
                </div>
              </CardContent>
            </Card>

            <Card className="border-slate-200 shadow-sm">
              <CardHeader>
                <CardTitle className="text-base font-bold flex items-center gap-2">
                  <BookOpen className="h-4 w-4 text-indigo-600" /> 최근 논술 제출 및 AI 첨삭 결과
                </CardTitle>
              </CardHeader>
              <CardContent>
                {studentDetail.submissions.length === 0 ? (
                  <p className="py-8 text-center text-sm text-slate-500">아직 제출된 논술 답안이 없습니다.</p>
                ) : (
                  <div className="space-y-3">
                    {studentDetail.submissions.slice(0, 5).map((sub: any) => (
                      <div key={sub.id} className="p-4 rounded-xl border border-slate-100 bg-slate-50 flex items-center justify-between">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-sm text-slate-900">과정 ID #{sub.curriculumId} 논술 답안</span>
                            <span className="text-xs px-2 py-0.5 rounded bg-indigo-100 text-indigo-800 font-bold">점수: {sub.totalScore ?? 85}점</span>
                          </div>
                          <p className="text-xs text-slate-500 mt-1">{new Date(sub.createdAt).toLocaleString()}</p>
                        </div>
                        <span className="text-xs font-semibold text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200">첨삭 완료</span>
                      </div>
                    ))}
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
                      const statusClass = assignment.submissionStatus === "reviewed" ? "bg-emerald-100 text-emerald-700" : assignment.submissionStatus === "submitted" ? "bg-blue-100 text-blue-700" : assignment.isOverdue ? "bg-rose-100 text-rose-700" : "bg-amber-100 text-amber-700";
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
          </div>

          {/* Right Col */}
          <div className="space-y-6">
            <Card className="border-slate-200 shadow-sm">
              <CardHeader>
                <CardTitle className="text-base font-bold flex items-center gap-2">
                  <MessageSquare className="h-4 w-4 text-blue-600" /> 학부모 응원 및 지도 코멘트
                </CardTitle>
                <CardDescription>자녀에게 전달할 격려 메시지나 학습 메모를 남기세요.</CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleAddComment} className="space-y-3">
                  <textarea
                    placeholder="예: 오늘 논술 과제 수고했어! 논리 전개 방식을 조금 더 다듬어보자."
                    value={commentText}
                    onChange={(e) => setCommentText(e.target.value)}
                    className="w-full min-h-[120px] rounded-xl border border-slate-200 p-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    required
                  />
                  <Button type="submit" disabled={addCommentMutation.isPending} className="w-full gap-2 bg-blue-600 hover:bg-blue-700 text-white">
                    <Send className="h-4 w-4" /> {addCommentMutation.isPending ? "등록 중..." : "코멘트 전송 및 기록"}
                  </Button>
                </form>
              </CardContent>
            </Card>

            <Card className="border-slate-200 shadow-sm">
              <CardHeader>
                <CardTitle className="text-base font-bold">학부모 코멘트 히스토리</CardTitle>
              </CardHeader>
              <CardContent>
                {!studentDetail.user.adminNotes ? (
                  <p className="py-6 text-center text-xs text-slate-400">등록된 코멘트 기록이 없습니다.</p>
                ) : (
                  <div className="space-y-2 max-h-[280px] overflow-y-auto pr-1">
                    {studentDetail.user.adminNotes.split("\n").map((note: string, idx: number) => (
                      <div key={idx} className="p-3 rounded-lg bg-blue-50/40 border border-blue-100 text-xs text-slate-700 leading-relaxed">
                        {note}
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
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
                <Button type="submit" disabled={linkMutation.isPending} className="bg-blue-600 hover:bg-blue-700 text-white">
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
