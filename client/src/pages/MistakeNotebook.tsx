import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { Trash2, BookOpen, TrendingUp, Filter } from "lucide-react";

interface MistakeNote {
  id: string;
  question: string;
  userAnswer: string;
  correctAnswer: string;
  category: "grammar" | "logic" | "expression" | "structure";
  date: string;
  reviewCount: number;
  importance: "high" | "medium" | "low";
}

const SAMPLE_MISTAKES: MistakeNote[] = [
  {
    id: "1",
    question: "다음 문장을 더 명확하게 표현하시오: '학생들이 공부를 잘하기 위해서는 노력이 필요하다.'",
    userAnswer: "학생들이 공부를 잘하려면 열심히 해야 한다.",
    correctAnswer:
      "학생들의 학업 성취를 위해서는 체계적인 학습 전략과 지속적인 노력이 필수적이다.",
    category: "expression",
    date: "2024-08-01",
    reviewCount: 2,
    importance: "high",
  },
  {
    id: "2",
    question: "다음 단락의 논리적 흐름을 평가하시오.",
    userAnswer: "첫 번째 문장이 결론이고, 그 다음 근거가 나온다.",
    correctAnswer: "먼저 주제를 제시한 후, 구체적인 근거를 제시하고, 마지막에 결론을 내려야 한다.",
    category: "logic",
    date: "2024-07-28",
    reviewCount: 1,
    importance: "high",
  },
  {
    id: "3",
    question: "다음 문장의 문법 오류를 찾으시오: '그는 책을 읽으며 공부하고 있는 중이다.'",
    userAnswer: "오류가 없다.",
    correctAnswer: "'읽으며'와 '있는 중이다'는 중복된 표현이다. '책을 읽고 있다' 또는 '책을 읽으며 공부한다'가 올바르다.",
    category: "grammar",
    date: "2024-07-25",
    reviewCount: 3,
    importance: "medium",
  },
];

const CATEGORY_LABELS = {
  grammar: "문법",
  logic: "논리",
  expression: "표현",
  structure: "구조",
};

const IMPORTANCE_COLORS = {
  high: "bg-red-100 text-red-700",
  medium: "bg-yellow-100 text-yellow-700",
  low: "bg-green-100 text-green-700",
};

export default function MistakeNotebook() {
  const [mistakes, setMistakes] = useState<MistakeNote[]>(SAMPLE_MISTAKES);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

  const filteredMistakes = mistakes.filter((mistake) => {
    const matchesSearch =
      mistake.question.includes(searchTerm) ||
      mistake.userAnswer.includes(searchTerm);
    const matchesCategory = !selectedCategory || mistake.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  const deleteMistake = (id: string) => {
    setMistakes(mistakes.filter((m) => m.id !== id));
    toast.success("오답 노트가 삭제되었습니다.");
  };

  const getCategoryStats = () => {
    const stats: Record<string, number> = {};
    mistakes.forEach((mistake) => {
      stats[mistake.category] = (stats[mistake.category] || 0) + 1;
    });
    return stats;
  };

  const stats = getCategoryStats();

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 to-red-100 p-6">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">📚 오답 노트</h1>
          <p className="text-lg text-gray-600">
            틀린 문제들을 자동으로 분류하여 관리하고, 반복 학습으로 실력을 향상시키세요.
          </p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
          <Card className="p-4 bg-white">
            <p className="text-sm text-gray-600">전체 오답</p>
            <p className="text-3xl font-bold text-orange-600">{mistakes.length}</p>
          </Card>
          {Object.entries(stats).map(([category, count]) => (
            <Card key={category} className="p-4 bg-white">
              <p className="text-sm text-gray-600">
                {CATEGORY_LABELS[category as keyof typeof CATEGORY_LABELS]}
              </p>
              <p className="text-3xl font-bold text-blue-600">{count}</p>
            </Card>
          ))}
        </div>

        {/* Search & Filter */}
        <Card className="p-4 mb-6 bg-white">
          <div className="space-y-4">
            <Input
              placeholder="오답 검색..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full"
            />
            <div className="flex gap-2 flex-wrap">
              <Button
                variant={selectedCategory === null ? "default" : "outline"}
                onClick={() => setSelectedCategory(null)}
                size="sm"
              >
                전체
              </Button>
              {Object.entries(CATEGORY_LABELS).map(([key, label]) => (
                <Button
                  key={key}
                  variant={selectedCategory === key ? "default" : "outline"}
                  onClick={() => setSelectedCategory(key)}
                  size="sm"
                >
                  {label}
                </Button>
              ))}
            </div>
          </div>
        </Card>

        {/* Mistakes List */}
        <div className="space-y-4">
          {filteredMistakes.length === 0 ? (
            <Card className="p-12 text-center bg-white">
              <BookOpen className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-500 text-lg">오답 노트가 없습니다.</p>
            </Card>
          ) : (
            filteredMistakes.map((mistake) => (
              <Card
                key={mistake.id}
                className="p-6 bg-white hover:shadow-lg transition-shadow"
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <Badge className="bg-orange-100 text-orange-700">
                        {CATEGORY_LABELS[mistake.category as keyof typeof CATEGORY_LABELS]}
                      </Badge>
                      <Badge className={IMPORTANCE_COLORS[mistake.importance]}>
                        {mistake.importance === "high"
                          ? "중요"
                          : mistake.importance === "medium"
                          ? "보통"
                          : "낮음"}
                      </Badge>
                      <span className="text-xs text-gray-500">{mistake.date}</span>
                    </div>
                    <h3 className="font-semibold text-gray-900 mb-3">
                      {mistake.question}
                    </h3>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => deleteMistake(mistake.id)}
                    className="text-red-600 hover:bg-red-50"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>

                {/* Comparison */}
                <div className="grid md:grid-cols-2 gap-4 mb-4">
                  <div className="bg-red-50 p-4 rounded-lg border border-red-200">
                    <p className="text-xs text-red-700 font-semibold mb-2">❌ 내 답변</p>
                    <p className="text-sm text-gray-700">{mistake.userAnswer}</p>
                  </div>
                  <div className="bg-green-50 p-4 rounded-lg border border-green-200">
                    <p className="text-xs text-green-700 font-semibold mb-2">✅ 정답</p>
                    <p className="text-sm text-gray-700">{mistake.correctAnswer}</p>
                  </div>
                </div>

                {/* Review Stats */}
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  <TrendingUp className="w-4 h-4" />
                  <span>복습 횟수: {mistake.reviewCount}회</span>
                </div>
              </Card>
            ))
          )}
        </div>

        {/* Tips */}
        <Card className="mt-8 p-6 bg-blue-50 border-blue-200">
          <h4 className="font-semibold text-gray-900 mb-3">💡 오답 노트 활용 팁</h4>
          <ul className="space-y-2 text-sm text-gray-700">
            <li>• 같은 유형의 오답이 반복되면 해당 분야를 집중 학습하세요</li>
            <li>• 중요도 높은 오답부터 우선적으로 복습하세요</li>
            <li>• 정답과 내 답변을 비교하며 차이점을 분석하세요</li>
            <li>• 주기적으로 복습하여 같은 실수를 반복하지 않도록 하세요</li>
          </ul>
        </Card>
      </div>
    </div>
  );
}
