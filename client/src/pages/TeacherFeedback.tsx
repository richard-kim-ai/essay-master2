import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { trpc } from "@/lib/trpc";
import { Link, useRoute } from "wouter";
import { Bot, CheckCircle2, Loader2, MessageSquare, Send, Sparkles } from "lucide-react";
import { useState, useEffect } from "react";
import { toast } from "sonner";

export default function TeacherFeedback() {
  const { user, isAuthenticated } = useAuth();
  const [match, params] = useRoute("/teacher-feedback/:essayId");
  const essayId = params?.essayId ? parseInt(params.essayId) : null;

  const [feedback, setFeedback] = useState<any>(null);
  const [essay, setEssay] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [overallComment, setOverallComment] = useState("");
  const [overallScore, setOverallScore] = useState(75);
  const [structureScore, setStructureScore] = useState(75);
  const [logicScore, setLogicScore] = useState(75);
  const [expressionScore, setExpressionScore] = useState(75);
  const [comments, setComments] = useState<any[]>([]);
  const [newComment, setNewComment] = useState("");
  const [selectedText, setSelectedText] = useState("");
  const [selectedDraft, setSelectedDraft] = useState<any>(null);
  const [draftChangeSummary, setDraftChangeSummary] = useState("");
  const [templateTitle, setTemplateTitle] = useState("");
  const [selectedTemplateId, setSelectedTemplateId] = useState("");
  const isTeacherReviewer = user?.role === "teacher" || user?.role === "admin";
  const isApprovedTeacher = user?.role === "teacher" && user?.teacherStatus === "approved";
  const utils = trpc.useUtils();

  const getEssayQuery = trpc.essaySubmission.getById.useQuery(essayId || 0, {
    enabled: !!essayId,
  });
  const getFeedbackQuery = trpc.teacherFeedback.getByEssay.useQuery(essayId || 0, {
    enabled: !!essayId,
  });
  const getCommentsQuery = trpc.teacherFeedback.getComments.useQuery(feedback?.id || 0, {
    enabled: !!feedback?.id,
  });
  const createFeedbackMutation = trpc.teacherFeedback.create.useMutation();
  const updateFeedbackMutation = trpc.teacherFeedback.update.useMutation();
  const addCommentMutation = trpc.teacherFeedback.addComment.useMutation();
  const templatesQuery = trpc.teacherOperations.feedbackTemplates.useQuery(undefined, { enabled: isApprovedTeacher });
  const saveTemplateMutation = trpc.teacherOperations.saveFeedbackTemplate.useMutation({ onSuccess: () => { utils.teacherOperations.feedbackTemplates.invalidate(); setTemplateTitle(""); toast.success("피드백 상용구를 저장했습니다."); }, onError: (error) => toast.error(error.message) });
  const deleteTemplateMutation = trpc.teacherOperations.deleteFeedbackTemplate.useMutation({ onSuccess: () => { utils.teacherOperations.feedbackTemplates.invalidate(); setSelectedTemplateId(""); toast.success("피드백 상용구를 삭제했습니다."); }, onError: (error) => toast.error(error.message) });
  const aiDraftsQuery = trpc.teacherAi.draftsForEssay.useQuery({ essayId: essayId || 0 }, { enabled: Boolean(essayId && isTeacherReviewer) });
  const draftRevisionsQuery = trpc.teacherAi.revisionsForDraft.useQuery({ draftId: selectedDraft?.id || 0 }, { enabled: Boolean(selectedDraft?.id && isTeacherReviewer) });
  const generateDraftMutation = trpc.teacherAi.generateDraft.useMutation();
  const saveDraftRevisionMutation = trpc.teacherAi.saveDraftRevision.useMutation();
  const approveDraftMutation = trpc.teacherAi.approveDraft.useMutation();

  useEffect(() => {
    if (getEssayQuery.data) {
      setEssay(getEssayQuery.data);
    }
  }, [getEssayQuery.data]);

  useEffect(() => {
    if (getFeedbackQuery.data && Array.isArray(getFeedbackQuery.data) && getFeedbackQuery.data.length > 0) {
      const fb = getFeedbackQuery.data[0];
      setFeedback(fb);
      setOverallComment(fb.overallComment || "");
      setOverallScore(fb.overallScore || 75);
      setStructureScore(fb.structureScore || 75);
      setLogicScore(fb.logicScore || 75);
      setExpressionScore(fb.expressionScore || 75);
    }
  }, [getFeedbackQuery.data]);

  useEffect(() => {
    if (getCommentsQuery.data) {
      setComments(getCommentsQuery.data);
    }
  }, [getCommentsQuery.data]);

  useEffect(() => {
    if (aiDraftsQuery.data?.length) {
      setSelectedDraft((current: any) => current ?? aiDraftsQuery.data[0]);
    }
  }, [aiDraftsQuery.data]);

  if (!isAuthenticated) {
    return <div className="text-center py-12">로그인이 필요합니다.</div>;
  }

  if (!essayId || !essay) {
    return (
      <div className="min-h-screen bg-gray-50 py-12 text-center">
        <p className="text-gray-600">논술을 선택해주세요.</p>
      </div>
    );
  }

  const handleSaveFeedback = async () => {
    setLoading(true);
    try {
      if (feedback?.id) {
        await updateFeedbackMutation.mutateAsync({
          id: feedback.id,
          overallComment,
          overallScore,
          structureScore,
          logicScore,
          expressionScore,
        });
        toast.success("선생님 첨삭이 완료되었습니다! 학생에게 알림과 토스트 메시지가 전송되었습니다.");
      } else {
        const result = await createFeedbackMutation.mutateAsync({
          essayId: essayId || 0,
          overallComment,
          overallScore,
          structureScore,
          logicScore,
          expressionScore,
        });
        setFeedback(result);
        toast.success("선생님 첨삭이 저장되었습니다! 학생에게 실시간 첨삭 완료 알림이 전달되었습니다.");
      }
      getFeedbackQuery.refetch();
    } catch (error) {
      console.error("Error saving feedback:", error);
      toast.error("저장 중 오류가 발생했습니다.");
    } finally {
      setLoading(false);
    }
  };

  const handleAddComment = async () => {
    if (!newComment.trim() || !feedback?.id) {
      toast.error("코멘트를 입력해주세요.");
      return;
    }

    setLoading(true);
    try {
      await addCommentMutation.mutateAsync({
        feedbackId: feedback.id,
        lineNumber: 0,
        startIndex: 0,
        endIndex: 0,
        comment: newComment,
        commentType: "other",
      });
      toast.success("코멘트가 추가되었습니다.");
      setNewComment("");
      getCommentsQuery.refetch();
    } catch (error) {
      console.error("Error adding comment:", error);
      toast.error("코멘트 추가 중 오류가 발생했습니다.");
    } finally {
      setLoading(false);
    }
  };

  const applyDraftToForm = (draft: any) => {
    setSelectedDraft(draft);
    try {
      const evaluation = draft.evaluationJson ? JSON.parse(draft.evaluationJson) : null;
      if (evaluation) {
        setOverallScore(evaluation.overallScore ?? overallScore);
        setLogicScore(evaluation.logicScore ?? logicScore);
        setStructureScore(evaluation.structureScore ?? structureScore);
        setExpressionScore(evaluation.expressionScore ?? expressionScore);
      }
    } catch { /* 구조화 점수 없이 초안 본문만 활용 */ }
    setOverallComment(draft.draftComment || "");
  };

  const handleGenerateAiDraft = async () => {
    if (!essayId) return;
    try {
      const draft = await generateDraftMutation.mutateAsync({ essayId });
      applyDraftToForm(draft);
      aiDraftsQuery.refetch();
      toast.success("AI 초안을 만들었습니다. 교사가 검토·수정하기 전에는 학생에게 공개되지 않습니다.");
    } catch (error: any) {
      toast.error(error?.message || "AI 초안 생성에 실패했습니다. 관리자에서 교사 AI 보조 봇 프로필을 먼저 활성화해주세요.");
    }
  };

  const handleSaveDraftRevision = async () => {
    if (!selectedDraft) return toast.error("수정할 AI 초안을 먼저 선택해주세요.");
    try {
      await saveDraftRevisionMutation.mutateAsync({ draftId: selectedDraft.id, revisedComment: overallComment, changeSummary: draftChangeSummary || "교사 검토 및 수정" });
      aiDraftsQuery.refetch();
      draftRevisionsQuery.refetch();
      toast.success("교사 수정 이력을 저장했습니다. 아직 학생에게 발송되지 않았습니다.");
    } catch (error: any) { toast.error(error?.message || "수정 이력 저장에 실패했습니다."); }
  };

  const handleApproveAndSend = async () => {
    if (!selectedDraft) return toast.error("최종 발송할 AI 초안을 먼저 선택해주세요.");
    try {
      await approveDraftMutation.mutateAsync({ draftId: selectedDraft.id, finalComment: overallComment });
      await getFeedbackQuery.refetch();
      await aiDraftsQuery.refetch();
      toast.success("교사가 승인한 최종 첨삭을 학생에게 발송했습니다.");
    } catch (error: any) { toast.error(error?.message || "최종 발송에 실패했습니다."); }
  };

  const renderSentenceDiff = (draftText: string, finalText: string) => finalText.split(/(?<=[.!?。])\s+|\n+/).filter(Boolean).map((sentence, index) => (
    <span key={`${sentence}-${index}`} className={draftText.includes(sentence) ? "" : "rounded bg-amber-100 px-1 text-amber-950"}>{sentence}{" "}</span>
  ));

  return (
    <div className="min-h-screen bg-gray-50 py-12">
      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <h1 className="text-4xl font-bold text-gray-900 mb-8">선생님 첨삭</h1>

        <div className="grid lg:grid-cols-3 gap-8">
          {/* Essay Content */}
          <div className="lg:col-span-2 space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>{essay.title}</CardTitle>
                <CardDescription>
                  작성자: {essay.userId} | 상태: {essay.status}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="bg-gray-50 p-6 rounded-lg whitespace-pre-wrap text-sm text-gray-700 leading-relaxed max-h-96 overflow-y-auto">
                  {essay.content}
                </div>
              </CardContent>
            </Card>

            {isTeacherReviewer && <Card className="border-indigo-100 shadow-sm">
              <CardHeader>
                <CardTitle className="flex items-center gap-2"><Bot className="h-5 w-5 text-indigo-600" />교사 승인형 AI 첨삭 초안</CardTitle>
                <CardDescription>교사 프로필과 관리자 승인 사례를 참고한 보조 초안입니다. AI가 학생에게 직접 발송하지 않으며, 교사 수정·승인 후에만 공개됩니다.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex flex-col gap-2 sm:flex-row">
                  <Button type="button" onClick={handleGenerateAiDraft} disabled={generateDraftMutation.isPending} className="gap-2 bg-indigo-600 hover:bg-indigo-700"><Sparkles className="h-4 w-4" />{generateDraftMutation.isPending ? "AI 초안 생성 중…" : "AI 첨삭 초안 생성"}</Button>
                  {aiDraftsQuery.data?.length ? <select className="h-10 rounded-md border border-slate-200 bg-white px-3 text-sm" value={selectedDraft?.id ?? ""} onChange={(event) => { const draft = aiDraftsQuery.data?.find((item) => String(item.id) === event.target.value); if (draft) applyDraftToForm(draft); }}>{aiDraftsQuery.data.map((draft) => <option key={draft.id} value={draft.id}>초안 #{draft.id} · {draft.status} · {new Date(draft.createdAt).toLocaleString("ko-KR")}</option>)}</select> : null}
                </div>
                {selectedDraft ? <>
                  <div className="grid gap-4 lg:grid-cols-2">
                    <div className="rounded-xl border border-indigo-100 bg-indigo-50/50 p-4"><p className="mb-2 text-sm font-bold text-indigo-950">AI 초안 · 학생에게 미공개</p><p className="whitespace-pre-wrap text-sm leading-7 text-slate-700">{selectedDraft.draftComment}</p></div>
                    <div className="rounded-xl border border-emerald-100 bg-emerald-50/50 p-4"><p className="mb-2 text-sm font-bold text-emerald-950">교사 최종본 · 수정 비교</p><p className="whitespace-pre-wrap text-sm leading-7 text-slate-700">{overallComment ? renderSentenceDiff(selectedDraft.draftComment, overallComment) : "오른쪽 평가란에서 교사 최종 첨삭을 작성하세요."}</p><p className="mt-3 border-t border-emerald-100 pt-3 text-xs text-emerald-800">노란색 강조: AI 초안에서 교사가 새로 쓰거나 바꾼 문장 · 변경 상태: {overallComment === selectedDraft.draftComment ? "AI 초안과 동일" : "교사 수정됨"}</p></div>
                  </div>
                  <div className="rounded-xl border border-slate-200 p-3"><label className="text-xs font-semibold text-slate-700">수정 요약 <span className="font-normal text-slate-400">학습 후보 검토에만 사용</span></label><Input value={draftChangeSummary} onChange={(event) => setDraftChangeSummary(event.target.value)} placeholder="예: 근거 인용을 보강하고 표현을 완화함" className="mt-2" /><div className="mt-3 flex flex-col gap-2 sm:flex-row"><Button type="button" variant="outline" onClick={handleSaveDraftRevision} disabled={saveDraftRevisionMutation.isPending}>수정 이력 저장</Button><Button type="button" className="gap-2 bg-emerald-600 hover:bg-emerald-700" onClick={handleApproveAndSend} disabled={approveDraftMutation.isPending}><CheckCircle2 className="h-4 w-4" />{approveDraftMutation.isPending ? "최종 발송 중…" : "교사 승인 후 학생에게 발송"}</Button></div></div>
                  {draftRevisionsQuery.data?.length ? <div className="rounded-xl bg-slate-50 p-3"><p className="text-xs font-bold text-slate-700">저장된 교사 수정 이력</p><div className="mt-2 space-y-2">{draftRevisionsQuery.data.slice(0, 3).map((revision) => <div key={revision.id} className="rounded-lg border border-slate-200 bg-white p-2 text-xs text-slate-600"><p>{revision.changeSummary || "수정 요약 없음"}</p><p className="mt-1 text-slate-400">v{revision.revisionNumber} · {new Date(revision.createdAt).toLocaleString("ko-KR")} · 학습 후보 {revision.learningApproval}</p></div>)}</div></div> : null}
                </> : <div className="rounded-xl bg-slate-50 p-4 text-sm text-slate-500">교사별 AI 보조 봇을 활성화한 뒤 초안을 생성하면, 이곳에서 AI 초안과 교사 최종본을 비교할 수 있습니다.</div>}
              </CardContent>
            </Card>}

            {/* Comments */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <MessageSquare className="w-5 h-5" />
                  코멘트
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {comments.length > 0 ? (
                  <div className="space-y-3">
                    {comments.map((comment) => (
                      <div key={comment.id} className="p-3 bg-blue-50 rounded-lg border border-blue-200">
                        <p className="text-sm text-gray-700">{comment.comment}</p>
                        <p className="text-xs text-gray-500 mt-2">
                          {comment.commentType}
                        </p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-gray-500">아직 코멘트가 없습니다.</p>
                )}

                {/* Add Comment */}
                <div className="space-y-2 pt-4 border-t">
                  <Textarea
                    placeholder="새 코멘트를 입력하세요..."
                    value={newComment}
                    onChange={(e) => setNewComment(e.target.value)}
                    rows={3}
                    className="resize-none"
                  />
                  <Button
                    onClick={handleAddComment}
                    disabled={loading || !newComment.trim()}
                    className="w-full bg-indigo-600 hover:bg-indigo-700"
                  >
                    {loading ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        추가 중...
                      </>
                    ) : (
                      <>
                        <Send className="w-4 h-4 mr-2" />
                        코멘트 추가
                      </>
                    )}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Feedback Form */}
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>첨삭 평가</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Overall Score */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    종합 점수: {overallScore}점
                  </label>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={overallScore}
                    onChange={(e) => setOverallScore(parseInt(e.target.value))}
                    className="w-full"
                  />
                </div>

                {/* Structure Score */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    구조: {structureScore}점
                  </label>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={structureScore}
                    onChange={(e) => setStructureScore(parseInt(e.target.value))}
                    className="w-full"
                  />
                </div>

                {/* Logic Score */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    논리: {logicScore}점
                  </label>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={logicScore}
                    onChange={(e) => setLogicScore(parseInt(e.target.value))}
                    className="w-full"
                  />
                </div>

                {/* Expression Score */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    표현: {expressionScore}점
                  </label>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={expressionScore}
                    onChange={(e) => setExpressionScore(parseInt(e.target.value))}
                    className="w-full"
                  />
                </div>

                {/* Overall Comment */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    종합 평가
                  </label>
                  {isApprovedTeacher && <div className="mb-2 grid gap-2 rounded-lg border border-indigo-100 bg-indigo-50/50 p-2 sm:grid-cols-[1fr_auto_auto]"><select aria-label="저장된 피드백 상용구" value={selectedTemplateId} onChange={(event) => { const id = event.target.value; setSelectedTemplateId(id); const template = templatesQuery.data?.find((item) => item.id === Number(id)); if (template) setOverallComment(template.content); }} className="h-9 rounded-md border border-indigo-200 bg-white px-2 text-xs"><option value="">저장된 상용구 불러오기</option>{templatesQuery.data?.map((template) => <option key={template.id} value={template.id}>{template.title}</option>)}</select><Button type="button" variant="outline" size="sm" disabled={!selectedTemplateId || deleteTemplateMutation.isPending} onClick={() => deleteTemplateMutation.mutate({ templateId: Number(selectedTemplateId) })}>삭제</Button><div className="flex gap-1"><Input aria-label="새 상용구 제목" value={templateTitle} onChange={(event) => setTemplateTitle(event.target.value)} placeholder="상용구 제목" className="h-9 text-xs" /><Button type="button" size="sm" variant="outline" disabled={!templateTitle.trim() || !overallComment.trim() || saveTemplateMutation.isPending} onClick={() => saveTemplateMutation.mutate({ title: templateTitle.trim(), content: overallComment.trim() })}>저장</Button></div></div>}
                  <Textarea
                    placeholder="종합 평가를 입력하세요..."
                    value={overallComment}
                    onChange={(e) => setOverallComment(e.target.value)}
                    rows={4}
                    className="resize-none"
                  />
                </div>

                {/* Save Button */}
                <Button
                  onClick={handleSaveFeedback}
                  disabled={loading}
                  className="w-full bg-indigo-600 hover:bg-indigo-700"
                >
                  {loading ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      저장 중...
                    </>
                  ) : (
                    "첨삭 저장"
                  )}
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
