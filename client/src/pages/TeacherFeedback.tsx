import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { trpc } from "@/lib/trpc";
import { Link, useRoute } from "wouter";
import { BookOpen, Loader2, MessageSquare, Send } from "lucide-react";
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
