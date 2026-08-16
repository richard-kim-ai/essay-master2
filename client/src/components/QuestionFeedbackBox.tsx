import { useState } from "react";
import { Button } from "@/components/ui/button";
import { ThumbsUp, ThumbsDown, AlertTriangle, Send } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";

interface Props {
  questionId: number;
}

export default function QuestionFeedbackBox({ questionId }: Props) {
  const [voted, setVoted] = useState<boolean>(false);
  const [isReportOpen, setIsReportOpen] = useState(false);
  const [reportType, setReportType] = useState("typo");
  const [comment, setComment] = useState("");

  const submitFeedbackMutation = trpc.questionBank.submitFeedback.useMutation();

  const handleVote = async (isHelpful: number) => {
    try {
      await submitFeedbackMutation.mutateAsync({
        questionId,
        isHelpful,
        reportType: "none",
      });
      setVoted(true);
      toast.success(isHelpful === 1 ? "소중한 피드백 감사합니다! (도움됨)" : "피드백이 반영되었습니다. 더 나은 문항으로 개선하겠습니다.");
    } catch (e) {
      toast.error("피드백 전송 중 오류가 발생했습니다.");
    }
  };

  const handleReportSubmit = async () => {
    try {
      await submitFeedbackMutation.mutateAsync({
        questionId,
        isHelpful: 0,
        reportType,
        comment,
      });
      setIsReportOpen(false);
      setComment("");
      toast.success("오류 신고가 접수되었습니다. 관리자 검토 후 즉시 수정됩니다.");
    } catch (e) {
      toast.error("오류 신고 전송 중 오류가 발생했습니다.");
    }
  };

  return (
    <div className="mt-6 pt-4 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-500">
      <div className="flex items-center gap-3">
        <span className="font-semibold text-slate-700">이 문제가 도움이 되었나요?</span>
        {!voted ? (
          <div className="flex items-center gap-1.5">
            <Button size="sm" variant="outline" onClick={() => handleVote(1)} className="h-7 px-2.5 text-xs gap-1 text-emerald-700 border-emerald-200 hover:bg-emerald-50">
              <ThumbsUp className="w-3.5 h-3.5" /> 도움됨
            </Button>
            <Button size="sm" variant="outline" onClick={() => handleVote(0)} className="h-7 px-2.5 text-xs gap-1 text-rose-700 border-rose-200 hover:bg-rose-50">
              <ThumbsDown className="w-3.5 h-3.5" /> 아쉬움
            </Button>
          </div>
        ) : (
          <span className="text-indigo-600 font-semibold">피드백이 반영되었습니다. 감사합니다!</span>
        )}
      </div>

      <div>
        <Button size="sm" variant="ghost" onClick={() => setIsReportOpen(true)} className="h-7 text-xs text-slate-500 hover:text-rose-600 gap-1">
          <AlertTriangle className="w-3.5 h-3.5" /> 문제 오류 신고
        </Button>
      </div>

      <Dialog open={isReportOpen} onOpenChange={setIsReportOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-rose-600 text-base">
              <AlertTriangle className="w-5 h-5" /> 문제 오류 신고
            </DialogTitle>
            <DialogDescription>
              본 문항의 오탈자, 정답 오류, 혹은 불명확한 내용을 신고해 주시면 검토 후 개선됩니다.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div>
              <label className="text-xs font-bold text-slate-700 mb-1 block">신고 유형</label>
              <select
                value={reportType}
                onChange={e => setReportType(e.target.value)}
                className="w-full px-3 py-2 border rounded-md text-sm"
              >
                <option value="typo">오탈자 및 문맥 어색함</option>
                <option value="wrong_answer">정답 또는 해설 오류</option>
                <option value="unclear">문제 설명이 모호함</option>
                <option value="other">기타 건의사항</option>
              </select>
            </div>

            <div>
              <label className="text-xs font-bold text-slate-700 mb-1 block">상세 내용 (선택)</label>
              <Textarea
                rows={4}
                placeholder="구체적인 수정 요청 사항을 입력해주세요..."
                value={comment}
                onChange={e => setComment(e.target.value)}
                className="text-xs"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsReportOpen(false)}>취소</Button>
            <Button onClick={handleReportSubmit} className="bg-rose-600 hover:bg-rose-700 text-white gap-1.5">
              <Send className="w-3.5 h-3.5" /> 신고 접수하기
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
