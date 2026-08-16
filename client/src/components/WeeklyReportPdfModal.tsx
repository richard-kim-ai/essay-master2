import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Download, FileText, Printer, CheckCircle2, TrendingUp, Award, Users, ShieldAlert } from "lucide-react";
import { toast } from "sonner";

interface Props {
  open: boolean;
  onClose: () => void;
  analyticsData: any;
}

export function WeeklyReportPdfModal({ open, onClose, analyticsData }: Props) {
  const [isExporting, setIsExporting] = useState(false);

  const totalUsers = analyticsData?.users?.totalUsers || 0;
  const activeToday = analyticsData?.users?.activeToday || 0;
  const totalSubmissions = analyticsData?.progress?.totalSubmissions || 0;
  const avgScore = analyticsData?.progress?.avgScore || 0;
  const totalAiRequests = analyticsData?.ai?.totalRequests || 0;

  const handlePrintOrDownload = () => {
    setIsExporting(true);
    setTimeout(() => {
      window.print();
      setIsExporting(false);
      toast.success("주간 리포트 인쇄 및 PDF 내보내기 창이 호출되었습니다.");
    }, 600);
  };

  return (
    <Dialog open={open} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto bg-slate-100 p-6">
        <DialogHeader className="bg-white p-6 rounded-t-2xl border-b border-slate-200">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="rounded-xl bg-blue-600 p-2.5 text-white">
                <FileText className="h-6 w-6" />
              </div>
              <div>
                <DialogTitle className="text-xl font-bold text-slate-900">논술 마스터 주간 학습 분석 리포트</DialogTitle>
                <DialogDescription className="text-xs text-slate-500">발행일: {new Date().toLocaleDateString()} | 플랫폼 전반 학습 지표 및 AI 첨삭 요약</DialogDescription>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button size="sm" variant="outline" className="gap-1.5 text-xs bg-white" onClick={handlePrintOrDownload} disabled={isExporting}>
                <Printer className="h-3.5 w-3.5" /> 인쇄 / PDF 저장
              </Button>
            </div>
          </div>
        </DialogHeader>

        {/* Report Paper Content */}
        <div id="weekly-report-printable-area" className="bg-white p-8 rounded-b-2xl shadow-sm space-y-6 text-slate-800">
          {/* Executive Summary */}
          <div className="p-5 rounded-2xl bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-100 space-y-2">
            <h3 className="text-sm font-bold text-blue-900 flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-blue-600" /> 주간 운영 하이라이트
            </h3>
            <p className="text-xs leading-relaxed text-blue-800">
              이번 주 플랫폼 전체 학습자들의 논술 답안 제출 건수는 총 <strong className="text-blue-900">{totalSubmissions}건</strong>이며, 평균 첨삭 점수는 <strong className="text-blue-900">{avgScore}점</strong>을 기록하였습니다. AI 자동 첨삭 엔진과 교사 지도 시스템이 유기적으로 연동되어 학습 효율성이 안정적으로 유지되고 있습니다.
            </p>
          </div>

          {/* Key Metrics Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/50 text-center">
              <p className="text-xs font-medium text-slate-500">전체 가입 회원</p>
              <h4 className="text-xl font-extrabold text-slate-900 mt-1">{totalUsers}명</h4>
            </div>
            <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/50 text-center">
              <p className="text-xs font-medium text-slate-500">오늘 활성 학습자</p>
              <h4 className="text-xl font-extrabold text-emerald-600 mt-1">{activeToday}명</h4>
            </div>
            <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/50 text-center">
              <p className="text-xs font-medium text-slate-500">총 논술 제출</p>
              <h4 className="text-xl font-extrabold text-indigo-600 mt-1">{totalSubmissions}건</h4>
            </div>
            <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/50 text-center">
              <p className="text-xs font-medium text-slate-500">AI 첨삭 활용량</p>
              <h4 className="text-xl font-extrabold text-purple-600 mt-1">{totalAiRequests}회</h4>
            </div>
          </div>

          {/* Detailed Observations */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider">과정별 핵심 관찰 및 제언</h4>
            <div className="space-y-2">
              <div className="p-3.5 rounded-xl border border-slate-100 bg-slate-50 flex items-start gap-3">
                <CheckCircle2 className="h-4 w-4 text-emerald-600 mt-0.5 shrink-0" />
                <div className="text-xs leading-relaxed">
                  <strong className="text-slate-900 block mb-0.5">초등·중고등 논술 과정</strong>
                  단계별 워크북과 문장 교정 퀴즈 참여율이 높으며, 특히 어휘 정확성 부문에서 뚜렷한 향상세를 보이고 있습니다.
                </div>
              </div>
              <div className="p-3.5 rounded-xl border border-slate-100 bg-slate-50 flex items-start gap-3">
                <CheckCircle2 className="h-4 w-4 text-emerald-600 mt-0.5 shrink-0" />
                <div className="text-xs leading-relaxed">
                  <strong className="text-slate-900 block mb-0.5">고등/대입 및 일반/직장인 과정</strong>
                  신규 추가된 수리·과학 논증 및 실무 보고서 작성 모듈에서 좌우 분할 비교 뷰 활용 빈도가 높게 나타났습니다.
                </div>
              </div>
            </div>
          </div>

          {/* Footer Signature */}
          <div className="pt-4 border-t border-slate-100 flex items-center justify-between text-xs text-slate-400">
            <span>논술 마스터(Essay Master) 운영팀 발간</span>
            <span>Confidential & Official Document</span>
          </div>
        </div>

        <DialogFooter className="pt-4">
          <Button variant="outline" onClick={onClose}>닫기</Button>
          <Button onClick={handlePrintOrDownload} className="bg-blue-600 hover:bg-blue-700 text-white gap-2">
            <Download className="h-4 w-4" /> PDF로 저장하기
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
