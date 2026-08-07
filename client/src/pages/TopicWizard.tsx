import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  ChevronRight,
  ChevronLeft,
  CheckCircle2,
  Lightbulb,
  BookOpen,
} from "lucide-react";

type Step = 1 | 2 | 3 | 4;

interface TopicData {
  category: string;
  topic: string;
  mainIdea: string;
  outline: string;
}

const CATEGORIES = [
  "사회 현상",
  "환경 문제",
  "기술 발전",
  "교육",
  "문화",
  "경제",
  "정치",
  "과학",
];

export default function TopicWizard() {
  const [step, setStep] = useState<Step>(1);
  const [data, setData] = useState<TopicData>({
    category: "",
    topic: "",
    mainIdea: "",
    outline: "",
  });

  const handleNext = () => {
    if (step === 1 && !data.category) {
      toast.error("카테고리를 선택해주세요.");
      return;
    }
    if (step === 2 && !data.topic) {
      toast.error("주제를 입력해주세요.");
      return;
    }
    if (step === 3 && !data.mainIdea) {
      toast.error("주제문을 입력해주세요.");
      return;
    }

    if (step < 4) {
      setStep((step + 1) as Step);
    }
  };

  const handlePrev = () => {
    if (step > 1) {
      setStep((step - 1) as Step);
    }
  };

  const handleComplete = () => {
    if (!data.outline) {
      toast.error("개요를 입력해주세요.");
      return;
    }
    toast.success("주제 설정이 완료되었습니다!");
  };

  const progress = (step / 4) * 100;

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 to-emerald-100 p-6">
      <div className="max-w-2xl mx-auto">
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">
            📝 주제 설정 위저드
          </h1>
          <p className="text-lg text-gray-600">
            단계별 안내를 통해 논술 주제를 체계적으로 설정해보세요.
          </p>
        </div>

        <div className="mb-8">
          <div className="flex justify-between mb-2">
            <span className="text-sm font-semibold text-gray-700">
              Step {step} of 4
            </span>
            <span className="text-sm font-semibold text-gray-700">
              {progress.toFixed(0)}%
            </span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-3">
            <div
              className="bg-gradient-to-r from-green-500 to-emerald-500 h-3 rounded-full transition-all duration-300"
              style={{ width: `${progress}%` }}
            ></div>
          </div>
        </div>

        {step === 1 && (
          <Card className="p-8 bg-white">
            <div className="mb-6">
              <h2 className="text-2xl font-bold text-gray-900 mb-2">
                Step 1: 카테고리 선택
              </h2>
              <p className="text-gray-600">
                논술할 주제의 카테고리를 선택해주세요.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3 mb-8">
              {CATEGORIES.map((category) => (
                <Button
                  key={category}
                  onClick={() => setData({ ...data, category })}
                  variant={data.category === category ? "default" : "outline"}
                  className={`h-auto py-4 ${
                    data.category === category
                      ? "bg-green-600 text-white"
                      : "text-gray-700"
                  }`}
                >
                  {category}
                </Button>
              ))}
            </div>

            {data.category && (
              <div className="p-4 bg-green-50 rounded-lg border border-green-200 mb-6">
                <p className="text-sm text-green-700">
                  ✓ 선택된 카테고리: <span className="font-semibold">{data.category}</span>
                </p>
              </div>
            )}
          </Card>
        )}

        {step === 2 && (
          <Card className="p-8 bg-white">
            <div className="mb-6">
              <h2 className="text-2xl font-bold text-gray-900 mb-2">
                Step 2: 주제 입력
              </h2>
              <p className="text-gray-600">
                {data.category} 카테고리에서 구체적인 주제를 입력해주세요.
              </p>
            </div>

            <div className="mb-8">
              <label className="block text-sm font-semibold text-gray-700 mb-3">
                주제
              </label>
              <Input
                placeholder="예: 인공지능이 일자리에 미치는 영향"
                value={data.topic}
                onChange={(e) => setData({ ...data, topic: e.target.value })}
                className="text-lg p-4"
              />
              <p className="text-xs text-gray-500 mt-2">
                구체적이고 명확한 주제를 입력하면 더 좋은 피드백을 받을 수 있습니다.
              </p>
            </div>

            {data.topic && (
              <div className="p-4 bg-green-50 rounded-lg border border-green-200">
                <p className="text-sm text-green-700">
                  ✓ 입력된 주제: <span className="font-semibold">{data.topic}</span>
                </p>
              </div>
            )}
          </Card>
        )}

        {step === 3 && (
          <Card className="p-8 bg-white">
            <div className="mb-6">
              <h2 className="text-2xl font-bold text-gray-900 mb-2">
                Step 3: 주제문 작성
              </h2>
              <p className="text-gray-600">
                주제에 대한 자신의 의견을 주제문으로 표현해주세요.
              </p>
            </div>

            <div className="mb-8">
              <label className="block text-sm font-semibold text-gray-700 mb-3">
                주제문 (한 문장으로 표현)
              </label>
              <Textarea
                placeholder="예: 인공지능의 발전은 일자리 감소를 초래하지만, 새로운 기회 창출을 통해 사회 발전을 이룰 수 있다."
                value={data.mainIdea}
                onChange={(e) =>
                  setData({ ...data, mainIdea: e.target.value })
                }
                className="min-h-[120px] p-4 text-base"
              />
              <p className="text-xs text-gray-500 mt-2">
                명확하고 논쟁의 여지가 있는 주제문을 작성하세요.
              </p>
            </div>

            {data.mainIdea && (
              <div className="p-4 bg-green-50 rounded-lg border border-green-200">
                <p className="text-sm text-green-700 font-semibold mb-2">
                  ✓ 작성된 주제문:
                </p>
                <p className="text-sm text-gray-700">{data.mainIdea}</p>
              </div>
            )}
          </Card>
        )}

        {step === 4 && (
          <Card className="p-8 bg-white">
            <div className="mb-6">
              <h2 className="text-2xl font-bold text-gray-900 mb-2">
                Step 4: 글의 개요 작성
              </h2>
              <p className="text-gray-600">
                주제문을 뒷받침할 개요를 작성해주세요.
              </p>
            </div>

            <div className="mb-8">
              <label className="block text-sm font-semibold text-gray-700 mb-3">
                개요 (서론, 본론, 결론)
              </label>
              <Textarea
                placeholder="서론: 인공지능의 정의와 현황&#10;본론 1: 일자리 감소의 우려&#10;본론 2: 새로운 기회 창출&#10;결론: 올바른 정책과 교육의 필요성"
                value={data.outline}
                onChange={(e) => setData({ ...data, outline: e.target.value })}
                className="min-h-[180px] p-4 text-base"
              />
              <p className="text-xs text-gray-500 mt-2">
                각 단락의 핵심 내용을 간단히 정리하세요.
              </p>
            </div>

            {data.outline && (
              <div className="p-4 bg-green-50 rounded-lg border border-green-200">
                <p className="text-sm text-green-700 font-semibold mb-2">
                  ✓ 작성된 개요:
                </p>
                <p className="text-sm text-gray-700 whitespace-pre-wrap">
                  {data.outline}
                </p>
              </div>
            )}
          </Card>
        )}

        <div className="flex gap-3 mt-8">
          <Button
            onClick={handlePrev}
            disabled={step === 1}
            variant="outline"
            className="flex-1"
          >
            <ChevronLeft className="w-4 h-4 mr-2" />
            이전
          </Button>

          {step < 4 ? (
            <Button
              onClick={handleNext}
              className="flex-1 bg-green-600 hover:bg-green-700 text-white"
            >
              다음
              <ChevronRight className="w-4 h-4 ml-2" />
            </Button>
          ) : (
            <Button
              onClick={handleComplete}
              className="flex-1 bg-green-600 hover:bg-green-700 text-white"
            >
              <CheckCircle2 className="w-4 h-4 mr-2" />
              완료
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
