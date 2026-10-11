import React, { useState } from "react";
import { ArrowRight, FileText, MessageSquareText, PenLine, RotateCcw, Sparkles, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Link } from "wouter";
import { useAuth } from "@/_core/hooks/useAuth";
import LoginRequired from "@/components/LoginRequired";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { trpc } from "@/lib/trpc";
import { COURSE_OPTIONS } from "@shared/course";

type Tab = "essays" | "ai" | "trash";

const ESSAY_STATUS: Record<string, { label: string; className: string }> = {
  draft: { label: "작성 중", className: "bg-slate-100 text-slate-700 hover:bg-slate-100" },
  submitted: { label: "교사 첨삭 대기", className: "bg-amber-100 text-amber-800 hover:bg-amber-100" },
  reviewed: { label: "첨삭 완료", className: "bg-emerald-100 text-emerald-800 hover:bg-emerald-100" },
};

function formatDate(value: string | Date | null | undefined) {
  if (!value) return "";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "" : date.toLocaleDateString("ko-KR", { year: "numeric", month: "long", day: "numeric" });
}

function snippet(text: string | null | undefined, length = 110) {
  const compact = (text ?? "").replace(/\s+/g, " ").trim();
  return compact.length > length ? `${compact.slice(0, length)}…` : compact;
}

const courseLabel = (value: string) => COURSE_OPTIONS.find((course) => course.value === value)?.label ?? value;

// 내가 쓴 글과 AI 첨삭 받은 내용을 다시 찾아보는 화면. 마이페이지·프로필 메뉴·AI 첨삭 화면에서 들어온다.
export default function MyWritings() {
  const { isAuthenticated } = useAuth();
  // 글쓰기 화면의 '휴지통' 버튼은 /my-writings?tab=trash 로 들어온다.
  const [tab, setTab] = useState<Tab>(() => (typeof window !== "undefined" && new URLSearchParams(window.location.search).get("tab") === "trash" ? "trash" : "essays"));
  const utils = trpc.useUtils();
  const essays = trpc.essaySubmission.getByUser.useQuery(undefined, { enabled: isAuthenticated });
  const aiFeedbacks = trpc.aiAutoFeedback.getByUser.useQuery(undefined, { enabled: isAuthenticated });
  const trashed = trpc.essaySubmission.trashList.useQuery(undefined, { enabled: isAuthenticated });
  const refreshAll = () => {
    void utils.essaySubmission.getByUser.invalidate();
    void utils.essaySubmission.trashList.invalidate();
    void utils.essaySubmission.workspace.invalidate();
  };
  const onError = (error: { message: string }) => toast.error(error.message || "처리하지 못했습니다.");
  const trashMutation = trpc.essaySubmission.trash.useMutation({ onSuccess: () => { toast.success("휴지통으로 옮겼습니다."); refreshAll(); }, onError });
  const restoreMutation = trpc.essaySubmission.restore.useMutation({ onSuccess: () => { toast.success("글을 복원했습니다."); refreshAll(); }, onError });
  const purgeMutation = trpc.essaySubmission.purge.useMutation({ onSuccess: () => { toast.success("영구 삭제했습니다."); refreshAll(); }, onError });
  const emptyMutation = trpc.essaySubmission.emptyTrash.useMutation({ onSuccess: (result) => { toast.success(`휴지통을 비웠습니다(${result.count}편).`); refreshAll(); }, onError });
  const busy = trashMutation.isPending || restoreMutation.isPending || purgeMutation.isPending || emptyMutation.isPending;

  if (!isAuthenticated) return <LoginRequired />;

  const essayRows = [...(essays.data ?? [])].sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
  const trashRows = trashed.data ?? [];
  const aiRows = [...(aiFeedbacks.data ?? [])].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  return (
    <div className="bg-slate-50 px-4 py-8 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <header>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">내 글·첨삭 기록</h1>
          <p className="mt-2 text-base leading-7 text-slate-600">내가 쓴 글과 AI·교사 첨삭 결과를 다시 확인하고, 이어서 고쳐 쓸 수 있습니다.</p>
        </header>

        <div role="tablist" aria-label="기록 종류" className="inline-flex rounded-xl border border-slate-200 bg-white p-1 shadow-sm">
          {([
            ["essays", `내가 쓴 글 (${essayRows.length})`],
            ["ai", `AI 첨삭 내역 (${aiRows.length})`],
            ["trash", `휴지통 (${trashRows.length})`],
          ] as const).map(([key, label]) => (
            <button
              key={key}
              type="button"
              role="tab"
              aria-selected={tab === key}
              onClick={() => setTab(key)}
              className={`rounded-lg px-4 py-2 text-sm font-bold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 ${tab === key ? "bg-indigo-700 text-white" : "text-slate-600 hover:bg-slate-50"}`}
            >
              {label}
            </button>
          ))}
        </div>

        {tab === "essays" && (
          <section aria-label="내가 쓴 글" className="space-y-3">
            {essays.isLoading && <p className="py-10 text-center text-sm text-slate-500">불러오는 중입니다...</p>}
            {!essays.isLoading && essayRows.length === 0 && (
              <Card className="p-8 text-center text-sm text-slate-600">
                아직 저장된 글이 없습니다.
                <div className="mt-4"><Link href="/essay-submission"><Button className="bg-indigo-700 text-white hover:bg-indigo-800"><PenLine className="mr-1.5 h-4 w-4" /> 글쓰기 시작</Button></Link></div>
              </Card>
            )}
            {essayRows.map((essay) => {
              const status = ESSAY_STATUS[essay.status] ?? ESSAY_STATUS.draft;
              return (
                <Card key={essay.id} className="flex flex-col gap-3 border-slate-200 bg-white p-4 shadow-sm sm:flex-row sm:items-start sm:justify-between sm:p-5">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <FileText className="h-4 w-4 text-indigo-600" aria-hidden="true" />
                      <h2 className="truncate text-base font-extrabold text-slate-900">{essay.title}</h2>
                      <Badge className={status.className}>{status.label}</Badge>
                    </div>
                    <p className="mt-1 text-xs text-slate-500">마지막 수정 {formatDate(essay.updatedAt)}</p>
                    <p className="mt-2 line-clamp-2 text-sm leading-6 text-slate-600">{snippet(essay.content)}</p>
                  </div>
                  <div className="flex shrink-0 flex-wrap gap-2">
                    <Link href={`/essay-submission?essay=${essay.id}`}><Button size="sm" variant="outline"><PenLine className="mr-1.5 h-3.5 w-3.5" /> {essay.status === "draft" ? "이어서 쓰기" : "글 보기·수정"}</Button></Link>
                    {essay.aiFeedbackId ? <Link href={`/ai-feedback-compare/${essay.aiFeedbackId}`}><Button size="sm" variant="outline"><Sparkles className="mr-1.5 h-3.5 w-3.5" /> AI 첨삭 보기</Button></Link> : null}
                    <Button size="sm" variant="outline" disabled={busy} className="border-rose-200 text-rose-700 hover:bg-rose-50" onClick={() => { if (window.confirm("이 글을 휴지통으로 옮길까요? 휴지통에서 복원할 수 있습니다.")) trashMutation.mutate({ essayId: essay.id }); }}><Trash2 className="mr-1.5 h-3.5 w-3.5" /> 삭제</Button>
                    {essay.status !== "draft" && <Link href={`/teacher-feedback/${essay.id}`}><Button size="sm" className="bg-indigo-700 text-white hover:bg-indigo-800"><MessageSquareText className="mr-1.5 h-3.5 w-3.5" /> 교사 첨삭 보기</Button></Link>}
                  </div>
                </Card>
              );
            })}
            <p className="pt-1 text-xs text-slate-500">기기에만 임시 저장된 글은 <Link href="/offline-essays" className="font-bold text-indigo-700 underline">오프라인 보관함</Link>에서 볼 수 있습니다.</p>
          </section>
        )}

        {tab === "trash" && (
          <section aria-label="휴지통" data-testid="essay-trash" className="space-y-3">
            <div className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-4 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm leading-6 text-slate-600">삭제한 글은 여기에 보관되며 복원할 수 있습니다. 영구 삭제하면 되돌릴 수 없고, 교사 첨삭 기록이 있는 글은 정산·기록 보존을 위해 제목과 본문만 지워집니다.</p>
              <Button size="sm" variant="outline" disabled={busy || trashRows.length === 0} className="shrink-0 border-rose-200 text-rose-700 hover:bg-rose-50" onClick={() => { if (window.confirm(`휴지통의 글 ${trashRows.length}편을 모두 영구 삭제할까요? 되돌릴 수 없습니다.`)) emptyMutation.mutate(); }}><Trash2 className="mr-1.5 h-3.5 w-3.5" /> 휴지통 비우기</Button>
            </div>
            {trashed.isLoading && <p className="py-10 text-center text-sm text-slate-500">불러오는 중입니다...</p>}
            {!trashed.isLoading && trashRows.length === 0 && <Card className="p-8 text-center text-sm text-slate-600">휴지통이 비어 있습니다.</Card>}
            {trashRows.map((essay) => (
              <Card key={essay.id} className="flex flex-col gap-3 border-slate-200 bg-white p-4 shadow-sm sm:flex-row sm:items-start sm:justify-between sm:p-5">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <Trash2 className="h-4 w-4 text-slate-400" aria-hidden="true" />
                    <h2 className="truncate text-base font-extrabold text-slate-700">{essay.title}</h2>
                    <Badge className={(ESSAY_STATUS[essay.status] ?? ESSAY_STATUS.draft).className}>{(ESSAY_STATUS[essay.status] ?? ESSAY_STATUS.draft).label}</Badge>
                  </div>
                  <p className="mt-1 text-xs text-slate-500">삭제한 날 {formatDate(essay.deletedAt)}</p>
                  <p className="mt-2 line-clamp-2 text-sm leading-6 text-slate-500">{essay.preview}</p>
                </div>
                <div className="flex shrink-0 flex-wrap gap-2">
                  <Button size="sm" variant="outline" disabled={busy} onClick={() => restoreMutation.mutate({ essayId: essay.id })}><RotateCcw className="mr-1.5 h-3.5 w-3.5" /> 복원</Button>
                  <Button size="sm" variant="outline" disabled={busy} className="border-rose-200 text-rose-700 hover:bg-rose-50" onClick={() => { if (window.confirm("이 글을 영구 삭제할까요? 되돌릴 수 없습니다.")) purgeMutation.mutate({ essayId: essay.id }); }}>영구 삭제</Button>
                </div>
              </Card>
            ))}
          </section>
        )}

        {tab === "ai" && (
          <section aria-label="AI 첨삭 내역" className="space-y-3">
            {aiFeedbacks.isLoading && <p className="py-10 text-center text-sm text-slate-500">불러오는 중입니다...</p>}
            {!aiFeedbacks.isLoading && aiRows.length === 0 && (
              <Card className="p-8 text-center text-sm text-slate-600">
                아직 받은 AI 첨삭이 없습니다.
                <div className="mt-4"><Link href="/ai-auto-feedback"><Button className="bg-indigo-700 text-white hover:bg-indigo-800"><Sparkles className="mr-1.5 h-4 w-4" /> AI 첨삭 받으러 가기</Button></Link></div>
              </Card>
            )}
            {aiRows.map((feedback) => (
              <Card key={feedback.id} className="flex flex-col gap-3 border-slate-200 bg-white p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between sm:p-5">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <Sparkles className="h-4 w-4 text-indigo-600" aria-hidden="true" />
                    <h2 className="truncate text-base font-extrabold text-slate-900">{feedback.essayTitle}</h2>
                    <Badge variant="outline">{courseLabel(feedback.courseType)} 과정</Badge>
                    {typeof feedback.overallScore === "number" && <Badge className="bg-indigo-100 text-indigo-800 hover:bg-indigo-100">종합 {feedback.overallScore}점</Badge>}
                  </div>
                  <p className="mt-1 text-xs text-slate-500">첨삭 받은 날 {formatDate(feedback.createdAt)}</p>
                  {feedback.overallComment && <p className="mt-2 line-clamp-2 text-sm leading-6 text-slate-600">{snippet(feedback.overallComment)}</p>}
                </div>
                <Link href={`/ai-feedback-compare/${feedback.id}`} className="shrink-0"><Button size="sm" className="bg-indigo-700 text-white hover:bg-indigo-800">원문과 비교해 보기 <ArrowRight className="ml-1.5 h-3.5 w-3.5" /></Button></Link>
              </Card>
            ))}
          </section>
        )}
      </div>
    </div>
  );
}
