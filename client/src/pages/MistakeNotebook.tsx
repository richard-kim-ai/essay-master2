import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";
import DashboardLayout from "@/components/DashboardLayout";
import { BookOpen, AlertCircle, CheckCircle2, Sparkles, Trash2, ArrowRight } from "lucide-react";
import { useLocation } from "wouter";
import { toast } from "sonner";

export default function MistakeNotebook() {
  const [, setLocation] = useLocation();
  const utils = trpc.useUtils();

  const { data: mistakes = [], isLoading: mistakesLoading } = trpc.curriculum.getMistakes.useQuery();
  const { data: recommended = [], isLoading: recLoading } = trpc.curriculum.getRecommendedQuestions.useQuery();

  const removeMutation = trpc.curriculum.removeMistake.useMutation({
    onSuccess: () => {
      toast.success("오답 노트에서 항목이 삭제되었습니다.");
      utils.curriculum.getMistakes.invalidate();
    },
  });

  return (
    <DashboardLayout>
      <div className="p-6 md:p-10 space-y-8 max-w-7xl mx-auto">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 bg-gradient-to-r from-amber-600 to-rose-700 text-white p-8 rounded-3xl shadow-xl">
          <div>
            <span className="px-3 py-1 bg-white/25 rounded-full text-xs font-bold text-white tracking-wide">
              오답 복습 및 맞춤 추천
            </span>
            <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight mt-2">
              나만의 오답 노트 & 취약점 클리닉
            </h1>
            <p className="text-xs md:text-sm text-amber-100 mt-1">
              워크북 기출문제 풀이 중 틀린 문항들을 모아 복습하고, AI가 분석한 취약 영역 맞춤 문제를 바로 풀어보세요.
            </p>
          </div>
          <Button
            onClick={() => setLocation("/mypage")}
            className="bg-white text-amber-900 hover:bg-amber-50 font-bold self-start md:self-auto"
          >
            마이페이지 허브로 이동
          </Button>
        </div>

        {/* 오답 노트 리스트 */}
        <div className="space-y-4">
          <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <AlertCircle className="w-5 h-5 text-rose-600" /> 축적된 오답 문항 ({mistakes.length}개)
          </h2>

          {mistakesLoading ? (
            <div className="py-12 text-center text-slate-500">오답 노트를 불러오는 중입니다...</div>
          ) : mistakes.length === 0 ? (
            <Card className="border-slate-200 bg-white shadow-sm p-12 text-center">
              <CheckCircle2 className="w-12 h-12 text-emerald-500 mx-auto mb-3" />
              <h3 className="text-lg font-bold text-slate-800">축적된 오답이 없습니다!</h3>
              <p className="text-sm text-slate-600 mt-1">커리큘럼 워크북 문제를 풀고 학습 능력을 높여보세요.</p>
            </Card>
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              {mistakes.map((m: any) => (
                <Card key={m.id} className="border-rose-100 bg-rose-50/30 shadow-sm flex flex-col justify-between">
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold px-2.5 py-1 bg-rose-100 text-rose-800 rounded-md">
                        오답 기록 #{m.id}
                      </span>
                      <span className="text-xs text-slate-500">
                        {new Date(m.createdAt).toLocaleDateString()}
                      </span>
                    </div>
                    <CardTitle className="text-base font-bold text-slate-900 mt-2">
                      제출 답안: {m.userAnswer}
                    </CardTitle>
                    <CardDescription className="text-slate-700 text-sm mt-1">
                      {m.aiFeedback}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="pt-0 flex items-center justify-end gap-2 border-t border-rose-100/50 pt-3">
                    <Button
                      size="sm"
                      variant="outline"
                      className="text-rose-700 border-rose-200 hover:bg-rose-100 gap-1"
                      onClick={() => removeMutation.mutate({ mistakeId: m.id })}
                    >
                      <Trash2 className="w-4 h-4" /> 복습 완료 (삭제)
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>

        {/* AI 취약 영역 맞춤 문제 추천 */}
        <div className="space-y-4 pt-6 border-t border-slate-200">
          <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-indigo-600" /> 취약 영역 맞춤 추천 기출문제
          </h2>

          {recLoading ? (
            <div className="py-8 text-center text-slate-500">추천 문제를 분석 중입니다...</div>
          ) : recommended.length === 0 ? (
            <p className="text-sm text-slate-500">추천할 문제가 없습니다.</p>
          ) : (
            <div className="grid gap-4 md:grid-cols-3">
              {recommended.map((q: any) => (
                <Card key={q.id} className="border-indigo-100 bg-white shadow-sm flex flex-col justify-between">
                  <CardHeader className="pb-3">
                    <span className="text-xs font-semibold px-2.5 py-1 bg-indigo-50 text-indigo-700 rounded-md w-fit">
                      {q.courseType} · Level {q.level}
                    </span>
                    <CardTitle className="text-base font-bold text-slate-900 mt-2 line-clamp-1">
                      {q.title}
                    </CardTitle>
                    <CardDescription className="text-slate-600 text-xs line-clamp-2 mt-1">
                      {q.prompt}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="pt-0 border-t border-slate-100 pt-3">
                    <Button
                      size="sm"
                      className="w-full bg-indigo-600 hover:bg-indigo-700 text-white gap-1"
                      onClick={() => setLocation(`/workbook/${q.courseType}/${q.level}`)}
                    >
                      지금 풀러 가기 <ArrowRight className="w-4 h-4" />
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}
