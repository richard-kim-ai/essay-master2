import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Award, Sparkles, Trophy, CheckCircle2 } from "lucide-react";
import { Link } from "wouter";

interface BadgeCelebrationModalProps {
  isOpen: boolean;
  onClose: () => void;
  badgeName: string;
  courseName: string;
}

export default function BadgeCelebrationModal({ isOpen, onClose, badgeName, courseName }: BadgeCelebrationModalProps) {
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md text-center p-8 bg-gradient-to-b from-indigo-50/90 via-white to-white border-indigo-100 shadow-2xl rounded-3xl">
        <DialogHeader className="sr-only">
          <DialogTitle>뱃지 획득 축하</DialogTitle>
        </DialogHeader>

        <div className="relative mx-auto mt-4 mb-6">
          {/* Glowing background ring */}
          <div className="absolute inset-0 bg-amber-400 rounded-full blur-xl opacity-30 animate-pulse"></div>
          
          <div className="relative w-24 h-24 bg-gradient-to-br from-amber-400 to-orange-500 text-white rounded-3xl shadow-lg flex items-center justify-center mx-auto transform hover:scale-105 transition-transform">
            <Trophy className="h-12 w-12 text-white animate-bounce" />
          </div>
          <div className="absolute -top-2 -right-2 bg-indigo-600 text-white p-2 rounded-full shadow-md">
            <Sparkles className="h-5 w-5" />
          </div>
        </div>

        <div className="space-y-3">
          <span className="px-3 py-1 bg-indigo-100 text-indigo-800 text-xs font-bold rounded-full uppercase tracking-wider">
            {courseName} 과정 성취
          </span>
          <h2 className="text-2xl font-black text-slate-900 tracking-tight">
            축하합니다! 뱃지 획득
          </h2>
          <p className="text-indigo-600 font-bold text-lg">
            "{badgeName}"
          </p>
          <p className="text-slate-600 text-sm leading-relaxed max-w-xs mx-auto">
            꾸준한 학습과 도전을 통해 새로운 전문 뱃지를 마이페이지에 저장했습니다. 계속해서 다음 단계로 나아가세요!
          </p>
        </div>

        <div className="flex flex-col sm:flex-row gap-3 mt-8">
          <Link href="/dashboard" className="flex-1">
            <Button onClick={onClose} className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold h-11 rounded-xl shadow-md">
              대시보드에서 확인
            </Button>
          </Link>
          <Button onClick={onClose} variant="outline" className="flex-1 border-slate-200 text-slate-700 font-bold h-11 rounded-xl">
            계속 학습하기
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
