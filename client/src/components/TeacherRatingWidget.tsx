import React, { useEffect, useState } from "react";
import { Star } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { trpc } from "@/lib/trpc";

const MAX_REVIEW = 1000;
const LABELS = ["", "아쉬워요", "별로예요", "보통이에요", "좋아요", "아주 좋아요"] as const;

// 학생이 받은 교사 첨삭에 별점(1~5)과 후기를 남기는 영역. 첨삭 1건당 1개이고 나중에 고칠 수 있다.
// 별점·후기는 관리자가 교사를 평가·관리하는 데 쓰이며 다른 학생에게는 공개되지 않는다.
export default function TeacherRatingWidget({ feedbackId }: { feedbackId: number }) {
  const utils = trpc.useUtils();
  const mine = trpc.teacherFeedback.myRating.useQuery(feedbackId);
  const rate = trpc.teacherFeedback.rate.useMutation({
    onSuccess: () => {
      toast.success("평가를 저장했습니다. 소중한 의견 감사합니다.");
      void utils.teacherFeedback.myRating.invalidate(feedbackId);
    },
    onError: (error) => toast.error(error.message || "평가를 저장하지 못했습니다."),
  });
  const [rating, setRating] = useState(0);
  const [hover, setHover] = useState(0);
  const [review, setReview] = useState("");

  useEffect(() => {
    if (mine.data) {
      setRating(mine.data.rating);
      setReview(mine.data.review ?? "");
    }
  }, [mine.data]);

  const shown = hover || rating;
  return (
    <Card className="border-amber-100" data-testid="teacher-rating-widget">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg"><Star className="h-5 w-5 text-amber-500" aria-hidden="true" /> 이 첨삭은 어땠나요?</CardTitle>
        <CardDescription>별점과 후기는 교사 평가에 반영되며 관리자만 확인합니다. 언제든 고칠 수 있어요.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex flex-wrap items-center gap-3">
          <div role="radiogroup" aria-label="별점" className="flex gap-1" onMouseLeave={() => setHover(0)}>
            {[1, 2, 3, 4, 5].map((value) => (
              <button
                key={value}
                type="button"
                role="radio"
                aria-checked={rating === value}
                aria-label={`${value}점`}
                onClick={() => setRating(value)}
                onMouseEnter={() => setHover(value)}
                className="rounded p-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500"
              >
                <Star className={`h-8 w-8 transition ${value <= shown ? "fill-amber-400 text-amber-400" : "text-slate-300"}`} aria-hidden="true" />
              </button>
            ))}
          </div>
          <span className="text-sm font-semibold text-slate-700" data-testid="rating-label">{shown ? `${shown}점 · ${LABELS[shown]}` : "별을 눌러 평가해 주세요"}</span>
        </div>
        <div>
          <Textarea
            aria-label="후기"
            placeholder="선생님의 첨삭에 대한 후기를 남겨 주세요 (선택)"
            value={review}
            onChange={(event) => setReview(event.target.value.slice(0, MAX_REVIEW))}
            rows={3}
            className="resize-none"
          />
          <p className="mt-1 text-right text-xs text-slate-500">{review.length} / {MAX_REVIEW}자</p>
        </div>
        <Button
          type="button"
          className="w-full bg-amber-500 text-white hover:bg-amber-600"
          disabled={rating === 0 || rate.isPending}
          onClick={() => rate.mutate({ feedbackId, rating, review: review.trim() || undefined })}
        >
          {rate.isPending ? "저장 중..." : mine.data ? "평가 수정하기" : "평가 남기기"}
        </Button>
      </CardContent>
    </Card>
  );
}
