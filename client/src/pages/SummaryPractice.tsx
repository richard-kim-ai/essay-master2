import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Lightbulb, Send, RotateCcw, CheckCircle2 } from "lucide-react";

interface SummaryFeedback {
  keywords: string[];
  logicFlow: string;
  suggestions: string[];
  score: number;
}

const SAMPLE_ARTICLE = `
인공지능(AI)은 현대 사회의 모든 분야에서 빠르게 확산되고 있습니다. 의료, 교육, 제조업 등 다양한 산업에서 AI 기술이 활용되면서 업무 효율성이 크게 향상되고 있습니다. 

그러나 AI의 발전에 따라 일자리 감소, 개인정보 침해, 윤리적 문제 등 새로운 사회 문제들이 대두되고 있습니다. 특히 AI 알고리즘의 편향성 문제는 차별과 불공정을 초래할 수 있어 심각한 우려의 대상이 되고 있습니다.

따라서 AI의 긍정적 발전을 도모하면서도 이러한 부작용을 최소화하기 위해서는 정부의 규제, 기업의 윤리 의식, 그리고 시민의 참여가 함께 이루어져야 합니다.
`;

export default function SummaryPractice() {
  const [summary, setSummary] = useState("");
  const [feedback, setFeedback] = useState<SummaryFeedback | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  const analyzeSummary = async () => {
    if (!summary.trim()) {
      toast.error("요약을 입력해주세요.");
      return;
    }

    if (summary.length < 20) {
      toast.error("더 자세한 요약을 작성해주세요.");
      return;
    }

    setIsAnalyzing(true);

    // 시뮬레이션된 분석 (실제로는 LLM 호출)
    setTimeout(() => {
      const mockFeedback: SummaryFeedback = {
        keywords: ["인공지능", "사회 문제", "규제", "윤리"],
        logicFlow:
          "주제 제시 → 문제점 지적 → 해결방안 제시의 논리적 흐름이 명확합니다.",
        suggestions: [
          "구체적인 사례를 추가하면 더 설득력 있을 것 같습니다.",
          "AI의 긍정적 영향도 함께 언급하면 균형잡힌 요약이 될 것입니다.",
        ],
        score: 82,
      };

      setFeedback(mockFeedback);
      setIsAnalyzing(false);
      toast.success("분석이 완료되었습니다!");
    }, 1500);
  };

  const resetForm = () => {
    setSummary("");
    setFeedback(null);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 to-pink-100 p-6">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">
            실시간 요약 연습장
          </h1>
          <p className="text-lg text-gray-600">
            주어진 글을 읽고 핵심 내용을 요약해보세요. AI가 실시간으로 피드백을
            제공합니다.
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-6">
          {/* Original Article */}
          <div>
            <Card className="p-6 h-full bg-white">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">
                📖 원문
              </h3>
              <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
                <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">
                  {SAMPLE_ARTICLE}
                </p>
              </div>
              <div className="mt-4 p-3 bg-blue-50 rounded-lg border border-blue-200">
                <p className="text-xs text-blue-700">
                  💡 팁: 원문의 주요 주제, 핵심 논점, 결론을 파악하고 요약하세요.
                </p>
              </div>
            </Card>
          </div>

          {/* Summary Input & Feedback */}
          <div className="space-y-4">
            {/* Input */}
            <Card className="p-6 bg-white">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">
                ✍️ 요약 작성
              </h3>
              <Textarea
                placeholder="원문의 핵심 내용을 요약해주세요..."
                value={summary}
                onChange={(e) => setSummary(e.target.value)}
                className="min-h-[200px] resize-none"
              />
              <div className="mt-3 text-xs text-gray-500">
                {summary.length} / 500 자
              </div>
            </Card>

            {/* Buttons */}
            <div className="flex gap-2">
              <Button
                onClick={analyzeSummary}
                disabled={isAnalyzing}
                className="flex-1 bg-purple-600 hover:bg-purple-700 text-white"
              >
                <Send className="w-4 h-4 mr-2" />
                {isAnalyzing ? "분석 중..." : "분석 요청"}
              </Button>
              <Button onClick={resetForm} variant="outline" className="flex-1">
                <RotateCcw className="w-4 h-4 mr-2" />
                초기화
              </Button>
            </div>
          </div>
        </div>

        {/* Feedback */}
        {feedback && (
          <div className="mt-6 space-y-4">
            {/* Score */}
            <Card className="p-6 bg-gradient-to-r from-purple-50 to-pink-50 border-purple-200">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600 mb-1">요약 점수</p>
                  <p className="text-4xl font-bold text-purple-600">
                    {feedback.score}점
                  </p>
                </div>
                <CheckCircle2 className="w-16 h-16 text-purple-400" />
              </div>
            </Card>

            {/* Keywords */}
            <Card className="p-6 bg-white">
              <h4 className="font-semibold text-gray-900 mb-3">🎯 핵심 키워드</h4>
              <div className="flex flex-wrap gap-2">
                {feedback.keywords.map((keyword, idx) => (
                  <Badge key={idx} className="bg-purple-100 text-purple-700">
                    {keyword}
                  </Badge>
                ))}
              </div>
            </Card>

            {/* Logic Flow */}
            <Card className="p-6 bg-white">
              <h4 className="font-semibold text-gray-900 mb-3">
                📊 논리 흐름 분석
              </h4>
              <p className="text-gray-700 leading-relaxed">
                {feedback.logicFlow}
              </p>
            </Card>

            {/* Suggestions */}
            <Card className="p-6 bg-blue-50 border-blue-200">
              <h4 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
                <Lightbulb className="w-5 h-5 text-blue-600" />
                개선 제안
              </h4>
              <ul className="space-y-2">
                {feedback.suggestions.map((suggestion, idx) => (
                  <li key={idx} className="flex gap-2 text-gray-700">
                    <span className="text-blue-600 font-semibold">•</span>
                    <span>{suggestion}</span>
                  </li>
                ))}
              </ul>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}
