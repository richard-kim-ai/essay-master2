import { useMemo, useState } from "react";
import { Link } from "wouter";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { CheckCircle2, EyeOff, LibraryBig, Loader2, ShieldCheck, ShieldAlert, Trash2 } from "lucide-react";

type CourseType = "elementary" | "middle_high" | "high_univ" | "general_adult";
const COURSE_LABEL: Record<CourseType, string> = { elementary: "초등", middle_high: "중고등", high_univ: "고등/대입", general_adult: "일반/직장인" };

export default function TeacherWritingExamples() {
  const { user, isAuthenticated } = useAuth();
  const enabled = isAuthenticated && user?.role === "teacher" && (user as any).teacherStatus === "approved";
  const utils = trpc.useUtils();
  const { data: submissions = [], isLoading: submissionsLoading } = trpc.teacherOperations.classAssignmentSubmissions.useQuery(undefined, { enabled });
  const { data: examples = [], isLoading: examplesLoading } = trpc.teacherOperations.approvedWritingExamples.useQuery(undefined, { enabled });
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [title, setTitle] = useState("");
  const [topic, setTopic] = useState("");
  const [skillTags, setSkillTags] = useState("");
  const [content, setContent] = useState("");
  const [teacherNote, setTeacherNote] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const candidates = useMemo(() => submissions.filter((submission: any) => submission.status === "reviewed"), [submissions]);
  const selected = candidates.find((candidate: any) => candidate.id === selectedId) as any;

  const publishMutation = trpc.teacherOperations.publishWritingExample.useMutation({
    onSuccess: () => { utils.teacherOperations.approvedWritingExamples.invalidate(); setSelectedId(null); setTitle(""); setTopic(""); setSkillTags(""); setContent(""); setTeacherNote(""); setConfirmed(false); toast.success("익명화된 우수 예시문을 학생 라이브러리에 게시했습니다."); },
    onError: (error) => toast.error(error.message || "예시문 게시에 실패했습니다."),
  });
  const withdrawMutation = trpc.teacherOperations.withdrawWritingExample.useMutation({
    onSuccess: () => { utils.teacherOperations.approvedWritingExamples.invalidate(); toast.success("예시문을 학생 라이브러리에서 철회했습니다."); },
    onError: (error) => toast.error(error.message || "예시문 철회에 실패했습니다."),
  });

  const chooseCandidate = (candidate: any) => {
    setSelectedId(candidate.id);
    setTitle(`${candidate.assignmentTitle} 우수 답안 예시`);
    setTopic(candidate.assignmentTitle);
    setSkillTags("주장, 근거, 구조");
    setContent(candidate.content);
    setTeacherNote(candidate.teacherComment || "이 예시문에서 주장과 근거의 연결 방식을 살펴보세요.");
    setConfirmed(false);
  };

  if (!isAuthenticated) return <div className="py-16 text-center text-slate-600">로그인 후 우수 예시문을 관리할 수 있습니다.</div>;
  if (user?.role !== "teacher" || (user as any).teacherStatus !== "approved") return <div className="py-16 text-center text-slate-600">승인된 첨삭교사 계정에서만 우수 예시문을 관리할 수 있습니다.</div>;

  return (
    <div className="min-h-screen bg-slate-50 px-4 py-8 sm:px-6 lg:px-8"><main className="mx-auto max-w-6xl space-y-6">
      <header className="rounded-2xl bg-gradient-to-r from-slate-900 to-indigo-900 p-6 text-white shadow-lg sm:p-8"><div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between"><div className="flex gap-3"><div className="rounded-xl bg-white/15 p-3"><LibraryBig className="h-7 w-7" /></div><div><p className="text-sm font-semibold text-indigo-200">교사 승인 학습 자료</p><h1 className="mt-1 text-3xl font-bold">우수 예시문 관리</h1><p className="mt-2 max-w-3xl text-sm leading-6 text-slate-200">채점 완료한 담당 반 학생의 답안을 익명화·편집하여, 같은 과정 학생이 참고할 수 있는 예시문으로 승인합니다.</p></div></div><Link href="/teacher-mypage"><Button variant="secondary">교사 포털로 돌아가기</Button></Link></div></header>
      <Card className="border-amber-200 bg-amber-50"><CardContent className="flex gap-3 p-4 text-sm leading-6 text-amber-950"><ShieldAlert className="mt-0.5 h-5 w-5 shrink-0 text-amber-700" /><p><strong>게시 전 필수 확인:</strong> 학생 이름, 이메일, 연락처, 소속 등 식별 정보와 개인적 경험을 특정할 수 있는 표현을 제거하세요. 게시되는 본문은 원본 답안과 분리되어 익명화된 텍스트만 저장됩니다.</p></CardContent></Card>
      <div className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr]"><Card className="border-slate-200 bg-white shadow-sm"><CardHeader><CardTitle>1. 채점 완료 답안 선택</CardTitle><CardDescription>본인이 담당하는 반에서 채점 완료한 제출물만 후보로 표시됩니다.</CardDescription></CardHeader><CardContent>{submissionsLoading ? <div className="py-8 text-center text-slate-500"><Loader2 className="mx-auto h-5 w-5 animate-spin" /></div> : candidates.length === 0 ? <div className="rounded-xl border border-dashed border-slate-300 p-8 text-center text-sm text-slate-500">현재 승인 가능한 채점 완료 답안이 없습니다.</div> : <div className="max-h-[540px] space-y-3 overflow-y-auto pr-1">{candidates.map((candidate: any) => <button key={candidate.id} type="button" onClick={() => chooseCandidate(candidate)} className={`w-full rounded-xl border p-4 text-left transition ${selectedId === candidate.id ? "border-indigo-500 bg-indigo-50" : "border-slate-200 hover:border-indigo-200 hover:bg-slate-50"}`}><div className="flex items-center justify-between gap-2"><p className="font-semibold text-slate-900">{candidate.assignmentTitle}</p><Badge className="bg-emerald-100 text-emerald-800 hover:bg-emerald-100">{candidate.score ?? 0}점</Badge></div><p className="mt-1 text-xs text-slate-600">{candidate.groupName} · {candidate.studentName} · {COURSE_LABEL[(candidate.courseType || "middle_high") as CourseType]}</p><p className="mt-2 line-clamp-2 text-sm leading-6 text-slate-700">{candidate.content}</p></button>)}</div>}</CardContent></Card>
        <Card className="border-indigo-100 bg-white shadow-sm"><CardHeader><CardTitle>2. 익명화·승인 후 게시</CardTitle><CardDescription>학생에게 공개할 제목·주제·본문·학습 포인트를 직접 검토하고 편집하세요.</CardDescription></CardHeader><CardContent className="space-y-4">{!selected ? <div className="rounded-xl border border-dashed border-slate-300 p-12 text-center text-sm text-slate-500"><ShieldCheck className="mx-auto h-10 w-10 text-slate-300" /><p className="mt-3">왼쪽에서 승인할 채점 완료 답안을 선택하세요.</p></div> : <><div className="grid gap-4 sm:grid-cols-2"><div className="space-y-2"><label className="text-sm font-semibold text-slate-800">게시 제목</label><Input value={title} onChange={(event) => setTitle(event.target.value)} /></div><div className="space-y-2"><label className="text-sm font-semibold text-slate-800">학습 주제</label><Input value={topic} onChange={(event) => setTopic(event.target.value)} /></div></div><div className="space-y-2"><label className="text-sm font-semibold text-slate-800">논술 역량 태그 <span className="font-normal text-slate-500">(쉼표로 구분)</span></label><Input value={skillTags} onChange={(event) => setSkillTags(event.target.value)} placeholder="예: 주장, 근거, 반론" /></div><div className="space-y-2"><label className="text-sm font-semibold text-slate-800">익명화된 예시문 본문</label><Textarea value={content} onChange={(event) => setContent(event.target.value)} className="min-h-64" /></div><div className="space-y-2"><label className="text-sm font-semibold text-slate-800">교사 참고 포인트 <span className="font-normal text-slate-500">(선택)</span></label><Textarea value={teacherNote} onChange={(event) => setTeacherNote(event.target.value)} className="min-h-24" /></div><label className="flex cursor-pointer gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950"><input type="checkbox" checked={confirmed} onChange={(event) => setConfirmed(event.target.checked)} className="mt-0.5 h-4 w-4 accent-amber-600" /><span>학생 이름·연락처·이메일·소속 등 개인 식별 정보를 제거했고, 학생 참고용으로 게시해도 되는 익명화 본문임을 확인했습니다.</span></label><Button disabled={!confirmed || publishMutation.isPending} onClick={() => publishMutation.mutate({ sourceSubmissionId: selected.id, courseType: (selected.courseType || "middle_high") as CourseType, title, topic, skillTags, anonymizedContent: content, teacherNote, confirmAnonymized: true })} className="w-full bg-indigo-700 text-white hover:bg-indigo-800">{publishMutation.isPending ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />게시 중</> : <><CheckCircle2 className="mr-2 h-4 w-4" />교사 승인 후 라이브러리에 게시</>}</Button></>}</CardContent></Card></div>
      <Card className="border-slate-200 bg-white shadow-sm"><CardHeader><CardTitle>내가 승인한 예시문</CardTitle><CardDescription>학생 라이브러리에 공개된 예시문을 즉시 철회할 수 있습니다.</CardDescription></CardHeader><CardContent>{examplesLoading ? <div className="py-8 text-center text-slate-500"><Loader2 className="mx-auto h-5 w-5 animate-spin" /></div> : examples.length === 0 ? <div className="rounded-xl border border-dashed border-slate-300 p-8 text-center text-sm text-slate-500">아직 승인한 예시문이 없습니다.</div> : <div className="space-y-3">{examples.map((example) => <div key={example.id} className="flex flex-col gap-3 rounded-xl border border-slate-200 p-4 sm:flex-row sm:items-center sm:justify-between"><div><div className="flex flex-wrap items-center gap-2"><p className="font-semibold text-slate-900">{example.title}</p><Badge className={example.status === "published" ? "bg-emerald-100 text-emerald-800 hover:bg-emerald-100" : "bg-slate-100 text-slate-700 hover:bg-slate-100"}>{example.status === "published" ? "공개 중" : "철회됨"}</Badge></div><p className="mt-1 text-sm text-slate-600">{example.topic} · {example.skillTags || "태그 없음"}</p></div>{example.status === "published" && <Button variant="outline" size="sm" disabled={withdrawMutation.isPending} onClick={() => withdrawMutation.mutate({ exampleId: example.id })} className="border-rose-200 text-rose-700 hover:bg-rose-50"><EyeOff className="mr-1.5 h-4 w-4" />공개 철회</Button>}</div>)}</div>}</CardContent></Card>
    </main></div>
  );
}
