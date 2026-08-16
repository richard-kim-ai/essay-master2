import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { BookOpen, BarChart3, Award, ArrowRight, Sparkles } from "lucide-react";

export function OnboardingModal() {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(1);

  useEffect(() => {
    const hasSeen = localStorage.getItem("essay-master-onseen");
    if (!hasSeen) {
      const timer = setTimeout(() => setOpen(true), 800);
      return () => clearTimeout(timer);
    }
  }, []);

  const handleClose = () => {
    localStorage.setItem("essay-master-onseen", "true");
    setOpen(false);
  };

  const steps = [
    {
      icon: BookOpen,
      color: "text-blue-600 bg-blue-50",
      title: "1단계: 단계별 커리큘럼 탐색",
      desc: "초등, 중고등, 고등/대입, 일반 과정까지 나에게 딱 맞는 맞춤형 커리큘럼을 선택하고 체계적인 논술 학습을 시작해보세요.",
    },
    {
      icon: BarChart3,
      color: "text-emerald-600 bg-emerald-50",
      title: "2단계: 대시보드 진도 및 AI 첨삭",
      desc: "실시간 AI 첨삭 엔진이 문장의 경제성, 명료성, 정확성을 분석해 점수와 피드백을 즉시 제공합니다.",
    },
    {
      icon: Award,
      color: "text-purple-600 bg-purple-50",
      title: "3단계: 성취 뱃지 및 수료증 발급",
      desc: "학습을 완료할 때마다 뱃지가 자동으로 수여되며, 고해상도 수료증과 소셜 미디어 공유 기능으로 성취감을 만끽하세요!",
    },
  ];

  const current = steps[step - 1];
  const Icon = current.icon;

  return (
    <Dialog open={open} onOpenChange={(val) => { if (!val) handleClose(); }}>
      <DialogContent className="sm:max-w-lg bg-white rounded-2xl p-6 shadow-2xl">
        <DialogHeader className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-indigo-50 text-indigo-700 text-xs font-bold">
              <Sparkles className="h-3.5 w-3.5" /> 논술 마스터 환영합니다!
            </span>
            <span className="text-xs font-bold text-slate-400">Step {step} / 3</span>
          </div>
          <DialogTitle className="text-xl font-bold text-slate-900 flex items-center gap-2 pt-2">
            <div className={`p-2.5 rounded-xl ${current.color}`}>
              <Icon className="h-6 w-6" />
            </div>
            {current.title}
          </DialogTitle>
          <DialogDescription className="text-sm text-slate-600 leading-relaxed pt-1">
            {current.desc}
          </DialogDescription>
        </DialogHeader>

        <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden my-6">
          <div className="bg-indigo-600 h-full transition-all duration-300" style={{ width: `${(step / 3) * 100}%` }} />
        </div>

        <DialogFooter className="flex items-center justify-between sm:justify-between">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleClose}
            className="text-slate-500 text-xs hover:text-slate-800"
          >
            다시 보지 않기
          </Button>
          <div className="flex items-center gap-2">
            {step > 1 && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setStep(step - 1)}
              >
                이전
              </Button>
            )}
            {step < 3 ? (
              <Button
                size="sm"
                className="bg-indigo-600 hover:bg-indigo-700 text-white gap-1"
                onClick={() => setStep(step + 1)}
              >
                다음 <ArrowRight className="h-3.5 w-3.5" />
              </Button>
            ) : (
              <Button
                size="sm"
                className="bg-emerald-600 hover:bg-emerald-700 text-white gap-1"
                onClick={handleClose}
              >
                학습 시작하기 <Sparkles className="h-3.5 w-3.5" />
              </Button>
            )}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
