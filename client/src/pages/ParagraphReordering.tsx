import { useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { toast } from "sonner";
import { GripVertical, Check, RotateCcw } from "lucide-react";

interface Paragraph {
  id: string;
  content: string;
  correctOrder: number;
}

const SAMPLE_PARAGRAPHS: Paragraph[] = [
  {
    id: "p1",
    content:
      "따라서 이러한 문제를 해결하기 위해서는 개인의 노력뿐만 아니라 사회 전체의 관심과 지원이 필요하다.",
    correctOrder: 3,
  },
  {
    id: "p2",
    content:
      "먼저 현재 사회에서 발생하고 있는 다양한 문제들을 살펴보면, 대부분 개인의 책임감 부족에서 비롯된다.",
    correctOrder: 1,
  },
  {
    id: "p3",
    content:
      "이를 위해 교육 제도의 개선, 법적 규제의 강화, 그리고 시민 의식의 고취가 중요하다.",
    correctOrder: 4,
  },
  {
    id: "p4",
    content:
      "구체적으로, 청소년 교육에서부터 책임감과 윤리의식을 강조하는 교육이 필요하며, 이는 장기적으로 사회 전체의 의식 수준을 높일 수 있다.",
    correctOrder: 2,
  },
];

export default function ParagraphReordering() {
  const { user } = useAuth();
  const [paragraphs, setParagraphs] = useState<Paragraph[]>(
    SAMPLE_PARAGRAPHS.sort(() => Math.random() - 0.5)
  );
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [completed, setCompleted] = useState(false);
  const [score, setScore] = useState(0);

  const handleDragStart = (id: string) => {
    setDraggedId(id);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = (targetId: string) => {
    if (!draggedId || draggedId === targetId) return;

    const draggedIndex = paragraphs.findIndex((p) => p.id === draggedId);
    const targetIndex = paragraphs.findIndex((p) => p.id === targetId);

    const newParagraphs = [...paragraphs];
    [newParagraphs[draggedIndex], newParagraphs[targetIndex]] = [
      newParagraphs[targetIndex],
      newParagraphs[draggedIndex],
    ];

    setParagraphs(newParagraphs);
    setDraggedId(null);
  };

  const checkOrder = () => {
    let correctCount = 0;
    paragraphs.forEach((p, index) => {
      if (p.correctOrder === index + 1) {
        correctCount++;
      }
    });

    const calculatedScore = Math.round((correctCount / paragraphs.length) * 100);
    setScore(calculatedScore);
    setCompleted(true);

    if (calculatedScore === 100) {
      toast.success("완벽합니다! 모든 단락이 올바른 순서입니다.");
    } else if (calculatedScore >= 75) {
      toast.success(`좋습니다! ${calculatedScore}% 정확합니다.`);
    } else {
      toast.info(`${calculatedScore}% 정확합니다. 다시 시도해보세요.`);
    }
  };

  const resetOrder = () => {
    setParagraphs(SAMPLE_PARAGRAPHS.sort(() => Math.random() - 0.5));
    setCompleted(false);
    setScore(0);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-6">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">
            단락 재구성 연습
          </h1>
          <p className="text-lg text-gray-600">
            아래 단락들을 올바른 순서로 정렬해보세요. 드래그앤드롭으로 이동할 수
            있습니다.
          </p>
        </div>

        {/* Instructions */}
        <Card className="mb-6 p-4 bg-white border-l-4 border-blue-500">
          <h3 className="font-semibold text-gray-900 mb-2">📌 지침</h3>
          <ul className="text-sm text-gray-700 space-y-1">
            <li>• 각 단락을 드래그하여 올바른 순서로 정렬하세요</li>
            <li>• 논리적 흐름을 고려하여 배열해야 합니다</li>
            <li>• 완료 후 "답안 확인" 버튼을 클릭하세요</li>
          </ul>
        </Card>

        {/* Paragraphs Container */}
        <div className="space-y-3 mb-6">
          {paragraphs.map((para, index) => (
            <div
              key={para.id}
              draggable
              onDragStart={() => handleDragStart(para.id)}
              onDragOver={handleDragOver}
              onDrop={() => handleDrop(para.id)}
              className={`
                p-4 bg-white rounded-lg border-2 cursor-move transition-all
                ${draggedId === para.id ? "opacity-50 border-blue-500" : "border-gray-200 hover:border-blue-300"}
                ${completed && para.correctOrder === index + 1 ? "border-green-500 bg-green-50" : ""}
                ${completed && para.correctOrder !== index + 1 ? "border-red-500 bg-red-50" : ""}
              `}
            >
              <div className="flex items-start gap-3">
                <GripVertical className="w-5 h-5 text-gray-400 mt-1 flex-shrink-0" />
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <Badge variant="outline" className="bg-blue-100 text-blue-700">
                      {index + 1}번
                    </Badge>
                    {completed && (
                      <>
                        {para.correctOrder === index + 1 ? (
                          <Check className="w-5 h-5 text-green-600" />
                        ) : (
                          <span className="text-red-600 font-semibold">
                            ✗ (정답: {para.correctOrder}번)
                          </span>
                        )}
                      </>
                    )}
                  </div>
                  <p className="text-gray-700 leading-relaxed">{para.content}</p>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Result */}
        {completed && (
          <Card className="mb-6 p-4 bg-blue-50 border-blue-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">정확도</p>
                <p className="text-3xl font-bold text-blue-600">{score}%</p>
              </div>
              <div className="text-right">
                {score === 100 ? (
                  <p className="text-green-600 font-semibold">완벽합니다! 🎉</p>
                ) : score >= 75 ? (
                  <p className="text-blue-600 font-semibold">좋은 시도입니다!</p>
                ) : (
                  <p className="text-orange-600 font-semibold">다시 시도해보세요</p>
                )}
              </div>
            </div>
          </Card>
        )}

        {/* Buttons */}
        <div className="flex gap-3">
          <Button
            onClick={checkOrder}
            disabled={completed}
            className="flex-1 bg-blue-600 hover:bg-blue-700 text-white"
          >
            답안 확인
          </Button>
          <Button
            onClick={resetOrder}
            variant="outline"
            className="flex-1"
          >
            <RotateCcw className="w-4 h-4 mr-2" />
            다시 시작
          </Button>
        </div>

        {/* Tips */}
        <Card className="mt-6 p-4 bg-yellow-50 border-yellow-200">
          <h4 className="font-semibold text-gray-900 mb-2">💡 팁</h4>
          <p className="text-sm text-gray-700">
            좋은 글쓰기는 명확한 시작, 중간, 끝을 가져야 합니다. 각 단락이 어떤
            역할을 하는지 생각해보세요.
          </p>
        </Card>
      </div>
    </div>
  );
}
