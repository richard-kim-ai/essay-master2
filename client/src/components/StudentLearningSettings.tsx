import React, { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { ChevronDown, GraduationCap, Sparkles } from "lucide-react";

const AI_BOT_VALUE = "ai-bot";

/** 학생이 가입 후 직접 고르는 설정: 담당 교사, AI 개인 맞춤 첨삭(학습 데이터 활용 동의). */
export default function StudentLearningSettings() {
  const utils = trpc.useUtils();
  const teacherQuery = trpc.auth.myTeacher.useQuery();
  const [selectedTeacher, setSelectedTeacher] = useState(AI_BOT_VALUE);
  useEffect(() => {
    if (teacherQuery.data) setSelectedTeacher(teacherQuery.data.currentTeacherId ? String(teacherQuery.data.currentTeacherId) : AI_BOT_VALUE);
  }, [teacherQuery.data?.currentTeacherId]);
  const selectTeacher = trpc.auth.selectMyTeacher.useMutation({
    onSuccess: async () => {
      toast.success("담당 교사를 저장했습니다.");
      await Promise.all([utils.auth.myTeacher.invalidate(), utils.auth.me.invalidate()]);
    },
    onError: (error) => toast.error(error.message || "담당 교사를 저장하지 못했습니다."),
  });

  const personalization = trpc.policy.aiPersonalization.useQuery();
  const [showDocument, setShowDocument] = useState(false);
  const setPersonalization = trpc.policy.setAiPersonalization.useMutation({
    onSuccess: async (_result, variables) => {
      toast.success(variables.enabled ? "AI 개인 맞춤 첨삭을 켰습니다. 다음 첨삭부터 최근 학습 기록이 반영됩니다." : "동의를 철회했습니다. 이제 개인 맞춤 없이 일반 첨삭이 제공됩니다.");
      setShowDocument(false);
      await utils.policy.aiPersonalization.invalidate();
    },
    onError: (error) => toast.error(error.message || "설정을 저장하지 못했습니다."),
  });

  const teacherData = teacherQuery.data;
  const consent = personalization.data;
  const unchanged = teacherData ? selectedTeacher === (teacherData.currentTeacherId ? String(teacherData.currentTeacherId) : AI_BOT_VALUE) : true;

  return (
    <div className="grid gap-4 md:grid-cols-2" aria-label="학습 설정">
      <Card className="border-slate-200 bg-white shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base"><GraduationCap className="h-5 w-5 text-indigo-600" />담당 교사</CardTitle>
          <CardDescription>
            현재 담당: <strong className="text-slate-800">{teacherData?.currentTeacherName ?? "불러오는 중…"}</strong>. 선택하지 않으면 AI 첨삭 봇이 기본 담당입니다.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <label className="block text-sm font-medium text-slate-700">
            교사 선택
            <select
              value={selectedTeacher}
              onChange={(event) => setSelectedTeacher(event.target.value)}
              disabled={!teacherData || selectTeacher.isPending}
              className="mt-2 h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm outline-none ring-indigo-500 focus:ring-2"
            >
              <option value={AI_BOT_VALUE}>선택하지 않음 — AI 첨삭 전용 봇</option>
              {teacherData?.candidates.map((teacher) => (
                <option key={teacher.id} value={teacher.id}>{teacher.name} · Level {teacher.teacherLevel}{teacher.courseMatch ? " · 내 과정 추천" : ""}</option>
              ))}
            </select>
          </label>
          <Button
            type="button"
            className="bg-indigo-600 hover:bg-indigo-700"
            disabled={unchanged || selectTeacher.isPending}
            onClick={() => selectTeacher.mutate({ teacherId: selectedTeacher === AI_BOT_VALUE ? null : Number(selectedTeacher) })}
          >
            {selectTeacher.isPending ? "저장 중…" : "담당 교사 저장"}
          </Button>
        </CardContent>
      </Card>

      <Card className="border-slate-200 bg-white shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base"><Sparkles className="h-5 w-5 text-indigo-600" />AI 개인 맞춤 첨삭</CardTitle>
          <CardDescription>
            AI 품질 개선용 학습 데이터 활용에 동의하면, AI 첨삭이 내 최근 학습 기록(점수 경향·반복되는 보완점)을 참고해 맞춤으로 제공됩니다. 선택 사항이며 동의하지 않아도 일반 첨삭은 그대로 이용할 수 있습니다.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className={`text-sm font-semibold ${consent?.consented ? "text-emerald-700" : "text-slate-600"}`}>
            {consent ? (consent.consented ? "개인 맞춤 첨삭 사용 중" : "사용 안 함 (동의 필요)") : "불러오는 중…"}
          </p>
          {consent && !consent.consented && (
            <>
              <button type="button" className="flex w-full items-center justify-between rounded-lg border border-slate-200 px-3 py-2 text-left text-xs font-semibold text-slate-700" aria-expanded={showDocument} onClick={() => setShowDocument((open) => !open)}>
                {consent.document?.title ?? "동의 문서"} 읽어보기
                <ChevronDown className={`h-4 w-4 text-slate-400 transition-transform ${showDocument ? "rotate-180" : ""}`} aria-hidden="true" />
              </button>
              {showDocument && <article className="max-h-48 overflow-y-auto whitespace-pre-wrap rounded-lg bg-slate-50 p-3 text-xs leading-6 text-slate-700">{consent.document?.content}</article>}
              <Button type="button" className="bg-indigo-600 hover:bg-indigo-700" disabled={!showDocument || setPersonalization.isPending} onClick={() => setPersonalization.mutate({ enabled: true })}>
                {setPersonalization.isPending ? "저장 중…" : "내용을 확인했고 동의합니다"}
              </Button>
              {!showDocument && <p className="text-[11px] text-amber-700">문서를 펼쳐 확인하면 동의 버튼이 활성화됩니다.</p>}
            </>
          )}
          {consent?.consented && (
            <>
              <p className="text-xs leading-5 text-slate-600">동의는 언제든 철회할 수 있으며, 철회하면 바로 개인 맞춤이 꺼지고 신규 사례 수집이 중단됩니다.</p>
              <Button type="button" variant="outline" disabled={setPersonalization.isPending} onClick={() => setPersonalization.mutate({ enabled: false })}>
                {setPersonalization.isPending ? "저장 중…" : "동의 철회"}
              </Button>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
