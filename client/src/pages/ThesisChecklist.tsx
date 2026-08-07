import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import {
  CheckCircle2,
  AlertCircle,
  Lightbulb,
  RefreshCw,
  Download,
} from "lucide-react";

interface CheckItem {
  id: string;
  label: string;
  description: string;
  checked: boolean;
}

const CHECKLIST_ITEMS: CheckItem[] = [
  {
    id: "clear",
    label: "명확성",
    description: "주제문이 명확하고 이해하기 쉬운가?",
    checked: false,
  },
  {
    id: "arguable",
    label: "논쟁성",
    description: "주제문이 논쟁의 여지가 있는가? (사실이 아닌 의견인가?)",
    checked: false,
  },
  {
    id: "specific",
    label: "구체성",
    description: "주제문이 너무 광범위하지 않고 구체적인가?",
    checked: false,
  },
  {
    id: "supportable",
    label: "뒷받침 가능성",
    description: "주제문을 뒷받침할 증거나 논거를 제시할 수 있는가?",
    checked: false,
  },
  {
    id: "relevant",
    label: "관련성",
    description: "주제문이 과제나 주제와 관련이 있는가?",
    checked: false,
  },
  {
    id: "original",
    label: "독창성",
    description: "주제문이 독창적이고 개인의 의견을 담고 있는가?",
    checked: false,
  },
  {
    id: "balanced",
    label: "균형성",
    description: "주제문이 한쪽으로 치우치지 않고 균형잡혀 있는가?",
    checked: false,
  },
  {
    id: "grammatical",
    label: "문법성",
    description: "주제문의 문법이 올바른가?",
    checked: false,
  },
];

export default function ThesisChecklist() {
  const [thesis, setThesis] = useState("");
  const [items, setItems] = useState<CheckItem[]>(CHECKLIST_ITEMS);
  const [analyzed, setAnalyzed] = useState(false);

  const handleCheck = (id: string) => {
    setItems(
      items.map((item) =>
        item.id === id ? { ...item, checked: !item.checked } : item
      )
    );
  };

  const handleAnalyze = () => {
    if (!thesis.trim()) {
      toast.error("주제문을 입력해주세요.");
      return;
    }
    if (thesis.length < 10) {
      toast.error("더 자세한 주제문을 입력해주세요.");
      return;
    }
    setAnalyzed(true);
    toast.success("주제문 분석이 완료되었습니다!");
  };

  const handleReset = () => {
    setThesis("");
    setItems(CHECKLIST_ITEMS);
    setAnalyzed(false);
  };

  const checkedCount = items.filter((item) => item.checked).length;
  const totalCount = items.length;
  const completionRate = Math.round((checkedCount / totalCount) * 100);

  const getScoreColor = (rate: number) => {
    if (rate === 100) return "text-green-600";
    if (rate >= 75) return "text-blue-600";
    if (rate >= 50) return "text-yellow-600";
    return "text-red-600";
  };

  const getScoreBgColor = (rate: number) => {
    if (rate === 100) return "bg-green-50 border-green-200";
    if (rate >= 75) return "bg-blue-50 border-blue-200";
    if (rate >= 50) return "bg-yellow-50 border-yellow-200";
    return "bg-red-50 border-red-200";
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 to-pink-100 p-6">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">
            ✅ 주제문 체크리스트
          </h1>
          <p className="text-lg text-gray-600">
            작성한 주제문이 좋은 주제문인지 체계적으로 검토해보세요.
          </p>
        </div>

        <div className="grid lg:grid-cols-3 gap-6">
          {/* Left: Thesis Input */}
          <div className="lg:col-span-1">
            <Card className="p-6 bg-white sticky top-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">
                주제문 입력
              </h3>
              <Textarea
                placeholder="검토할 주제문을 입력하세요..."
                value={thesis}
                onChange={(e) => setThesis(e.target.value)}
                className="min-h-[150px] mb-4 p-3"
              />

              <div className="space-y-2">
                <Button
                  onClick={handleAnalyze}
                  className="w-full bg-purple-600 hover:bg-purple-700 text-white"
                >
                  분석 시작
                </Button>
                <Button
                  onClick={handleReset}
                  variant="outline"
                  className="w-full"
                >
                  <RefreshCw className="w-4 h-4 mr-2" />
                  초기화
                </Button>
              </div>

              {analyzed && (
                <div className={`mt-4 p-4 rounded-lg border ${getScoreBgColor(completionRate)}`}>
                  <p className={`text-sm font-semibold ${getScoreColor(completionRate)}`}>
                    완성도: {completionRate}%
                  </p>
                  <div className="w-full bg-gray-200 rounded-full h-2 mt-2">
                    <div
                      className={`h-2 rounded-full transition-all ${
                        completionRate === 100
                          ? "bg-green-500"
                          : completionRate >= 75
                          ? "bg-blue-500"
                          : completionRate >= 50
                          ? "bg-yellow-500"
                          : "bg-red-500"
                      }`}
                      style={{ width: `${completionRate}%` }}
                    ></div>
                  </div>
                </div>
              )}
            </Card>
          </div>

          {/* Right: Checklist */}
          <div className="lg:col-span-2">
            {analyzed ? (
              <div className="space-y-4">
                {/* Score Card */}
                <Card className={`p-6 border-2 ${getScoreBgColor(completionRate)}`}>
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-xl font-bold text-gray-900">
                      주제문 평가
                    </h3>
                    <div className={`text-4xl font-bold ${getScoreColor(completionRate)}`}>
                      {completionRate}%
                    </div>
                  </div>
                  <p className="text-sm text-gray-600">
                    {completionRate === 100
                      ? "완벽한 주제문입니다! 이 주제문으로 논술을 시작해도 좋습니다."
                      : completionRate >= 75
                      ? "좋은 주제문입니다. 몇 가지 개선 사항을 확인해보세요."
                      : completionRate >= 50
                      ? "개선이 필요한 부분들이 있습니다. 아래 항목들을 확인하세요."
                      : "주제문을 다시 작성하는 것을 권장합니다."}
                  </p>
                </Card>

                {/* Checklist Items */}
                <div className="space-y-3">
                  {items.map((item) => (
                    <Card
                      key={item.id}
                      className={`p-4 cursor-pointer transition-all ${
                        item.checked
                          ? "bg-green-50 border-green-200"
                          : "bg-white hover:bg-gray-50"
                      }`}
                      onClick={() => handleCheck(item.id)}
                    >
                      <div className="flex items-start gap-3">
                        <Checkbox
                          checked={item.checked}
                          onChange={() => handleCheck(item.id)}
                          className="mt-1"
                        />
                        <div className="flex-1">
                          <h4 className="font-semibold text-gray-900">
                            {item.label}
                          </h4>
                          <p className="text-sm text-gray-600 mt-1">
                            {item.description}
                          </p>
                        </div>
                        {item.checked && (
                          <CheckCircle2 className="w-5 h-5 text-green-600 flex-shrink-0 mt-1" />
                        )}
                      </div>
                    </Card>
                  ))}
                </div>

                {/* Summary */}
                <Card className="p-6 bg-blue-50 border-blue-200">
                  <h4 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
                    <Lightbulb className="w-5 h-5 text-blue-600" />
                    개선 제안
                  </h4>
                  <ul className="space-y-2 text-sm text-gray-700">
                    {items
                      .filter((item) => !item.checked)
                      .map((item) => (
                        <li key={item.id} className="flex gap-2">
                          <span className="text-blue-600 font-semibold">•</span>
                          <span>
                            <strong>{item.label}:</strong> {item.description}
                          </span>
                        </li>
                      ))}
                  </ul>
                  {items.every((item) => item.checked) && (
                    <p className="text-green-700 font-semibold mt-4">
                      ✓ 모든 항목을 확인했습니다! 이 주제문으로 논술을 시작하세요.
                    </p>
                  )}
                </Card>
              </div>
            ) : (
              <Card className="p-12 text-center bg-white">
                <AlertCircle className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                <p className="text-gray-500 text-lg">
                  주제문을 입력하고 "분석 시작" 버튼을 클릭하세요.
                </p>
              </Card>
            )}
          </div>
        </div>

        {/* Tips */}
        <Card className="mt-6 p-6 bg-gradient-to-r from-purple-50 to-pink-50 border-purple-200">
          <h4 className="font-semibold text-gray-900 mb-3">
            💡 좋은 주제문의 특징
          </h4>
          <div className="grid md:grid-cols-2 gap-4 text-sm text-gray-700">
            <div>
              <p className="font-semibold text-gray-900 mb-2">✓ 해야 할 것</p>
              <ul className="space-y-1">
                <li>• 명확하고 구체적인 주장을 담기</li>
                <li>• 논쟁의 여지가 있는 의견 제시</li>
                <li>• 증거로 뒷받침할 수 있는 내용</li>
              </ul>
            </div>
            <div>
              <p className="font-semibold text-gray-900 mb-2">✗ 하지 말아야 할 것</p>
              <ul className="space-y-1">
                <li>• 너무 광범위한 주제</li>
                <li>• 명백한 사실만 담기</li>
                <li>• 모호하고 불명확한 표현</li>
              </ul>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
