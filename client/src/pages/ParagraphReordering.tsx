import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { toast } from "sonner";
import { GripVertical, Check, RotateCcw, Award, Link as LinkIcon } from "lucide-react";
import { Link } from "wouter";

export default function ParagraphReordering() {
  const { isAuthenticated } = useAuth();
  const [courseType, setCourseType] = useState<"elementary" | "middle_high" | "high_univ" | "general_adult">("middle_high");
  const { data: qList, isLoading } = trpc.questionBank.random.useQuery({ courseType, toolType: "reordering", limit: 1 });
  
  const [paragraphs, setParagraphs] = useState<{ id: string; content: string; correctOrder: number }[]>([]);
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [completed, setCompleted] = useState(false);
  const [score, setScore] = useState(0);

  const awardBadgeMutation = trpc.badges.award.useMutation();
  const utils = trpc.useUtils();

  useEffect(() => {
    if (qList && qList.length > 0) {
      try {
        const parsed = JSON.parse(qList[0].contentData);
        if (parsed.paragraphs) {
          setParagraphs([...parsed.paragraphs].sort(() => Math.random() - 0.5));
          setCompleted(false);
          setScore(0);
        }
      } catch {
        setParagraphs([
          { id: "1", content: "먼저 현대 사회의 주요 쟁점을 파악한다.", correctOrder: 1 },
          { id: "2", content: "그 다음 양측의 입장을 대조하여 분석한다.", correctOrder: 2 },
          { id: "3", content: "종합적으로 자신의 견해를 도출한다.", correctOrder: 3 },
        ].sort(() => Math.random() - 0.5));
      }
    }
  }, [qList]);

  if (!isAuthenticated) return <div className="text-center py-12 text-slate-600">로그인이 필요합니다.</div>;
  if (isLoading) return <div className="text-center py-12 text-slate-600">문제은행에서 단락 데이터를 불러오는 중...</div>;

  const handleDragStart = (id: string) => setDraggedId(id);
  const handleDragOver = (e: React.DragEvent) => e.preventDefault();
  const handleDrop = (targetId: string) => {
    if (!draggedId || draggedId === targetId) return;
    const items = [...paragraphs];
    const dragIdx = items.findIndex(i => i.id === draggedId);
    const targetIdx = items.findIndex(i => i.id === targetId);
    const [removed] = items.splice(dragIdx, 1);
    items.splice(targetIdx, 0, removed);
    setParagraphs(items);
    setDraggedId(null);
  };

  const handleCheckOrder = () => {
    let correctCount = 0;
    paragraphs.forEach((p, idx) => {
      if (p.correctOrder === idx + 1) correctCount++;
    });
    const finalScore = Math.round((correctCount / paragraphs.length) * 100);
    setScore(finalScore);
    setCompleted(true);

    if (finalScore >= 70) {
      awardBadgeMutation.mutate({
        courseType,
        badgeType: "reordering",
        badgeName: `${courseType === "elementary" ? "초등" : courseType === "middle_high" ? "중고등" : courseType === "high_univ" ? "고등/대입" : "일반"} 단락 재구성 마스터 뱃지`,
      }, {
        onSuccess: () => {
          utils.badges.getByUser.invalidate();
          toast.success("훌륭합니다! 단락 재구성 실습을 완료하고 뱃지를 획득했습니다.");
        }
      });
    } else {
      toast.info("순서가 일부 맞지 않습니다. 다시 시도해보세요.");
    }
  };

  const handleReset = () => {
    if (qList && qList.length > 0) {
      const parsed = JSON.parse(qList[0].contentData);
      if (parsed.paragraphs) {
        setParagraphs([...parsed.paragraphs].sort(() => Math.random() - 0.5));
      }
    }
    setCompleted(false);
    setScore(0);
  };

  return (
    <div className="min-h-screen bg-slate-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-3xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <Link href="/curriculum"><Button variant="ghost" className="text-slate-600 pl-0">← 커리큘럼으로 돌아가기</Button></Link>
          <div className="flex gap-2">
            {(["elementary", "middle_high", "high_univ", "general_adult"] as const).map(c => (
              <Button key={c} size="sm" variant={courseType === c ? "default" : "outline"} className={courseType === c ? "bg-indigo-600 text-white" : ""} onClick={() => setCourseType(c)}>
                {c === "elementary" ? "초등" : c === "middle_high" ? "중고등" : c === "high_univ" ? "고등/대입" : "일반"}
              </Button>
            ))}
          </div>
        </div>

        <Card className="border-indigo-100 shadow-sm">
          <CardHeader>
            <CardTitle className="text-2xl font-bold text-slate-900">단락 재구성 드래그 실습</CardTitle>
            <CardDescription>흩어진 단락 카드를 마우스로 드래그하여 논리적인 글의 흐름(서론-본론-결론)으로 배치하세요.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-3">
              {paragraphs.map((p, idx) => (
                <div
                  key={p.id}
                  draggable
                  onDragStart={() => handleDragStart(p.id)}
                  onDragOver={handleDragOver}
                  onDrop={() => handleDrop(p.id)}
                  className="p-4 bg-white border border-slate-200 rounded-xl shadow-sm flex items-center gap-3 cursor-grab active:cursor-grabbing hover:border-indigo-300 transition-all"
                >
                  <GripVertical className="h-5 w-5 text-slate-400 shrink-0" />
                  <span className="w-6 h-6 bg-indigo-100 text-indigo-700 font-bold rounded-full flex items-center justify-center text-xs shrink-0">{idx + 1}</span>
                  <p className="text-slate-800 text-sm leading-6 flex-1">{p.content}</p>
                </div>
              ))}
            </div>

            {completed && (
              <div className={`p-4 rounded-xl border ${score >= 70 ? "bg-emerald-50 border-emerald-200 text-emerald-900" : "bg-amber-50 border-amber-200 text-amber-900"}`}>
                <h4 className="font-bold flex items-center gap-2">
                  <Check className="h-5 w-5" /> 실습 결과: {score}점 ({score >= 70 ? "통과" : "재도전 필요"})
                </h4>
                <p className="text-xs mt-1">{score >= 70 ? "단락의 논리적 전개 구조를 정확히 이해하셨습니다!" : "일부 단락의 순서가 어긋났습니다. 다시 정렬해보세요."}</p>
              </div>
            )}

            <div className="flex justify-between pt-4">
              <Button variant="outline" onClick={handleReset} className="gap-2">
                <RotateCcw className="h-4 w-4" /> 초기화
              </Button>
              <Button onClick={handleCheckOrder} className="bg-indigo-600 hover:bg-indigo-700 text-white gap-2">
                <Check className="h-4 w-4" /> 정답 제출 및 검증
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
