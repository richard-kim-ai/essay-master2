import { useEffect, useState } from "react";
import { Link } from "wouter";
import { ArrowLeft, Save, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";

const providers = { rule: "규칙 기반", openai: "기본 LLM", openai_compatible: "OpenAI 호환", vllm: "vLLM", kobert: "KoBERT", lora: "LoRA", custom: "사용자 정의" } as const;
type Profile = Awaited<ReturnType<typeof trpc.admin.getEvaluationModels.useQuery>>["data"] extends (infer T)[] | undefined ? T : never;

export default function AdminEvaluationModels() {
  const { user, loading } = useAuth();
  const isAdmin = user?.role === "admin";
  const query = trpc.admin.getEvaluationModels.useQuery(undefined, { enabled: isAdmin });
  const update = trpc.admin.updateEvaluationModels.useMutation({ onSuccess: () => { toast.success("평가 모델 설정을 저장했습니다."); query.refetch(); }, onError: (error) => toast.error(error.message) });
  const [profiles, setProfiles] = useState<Profile[]>([]);
  useEffect(() => { if (query.data) setProfiles(query.data); }, [query.data]);
  const patch = (id: string, values: Partial<Profile>) => setProfiles((items) => items.map((item) => item.id === id ? { ...item, ...values } : item));

  if (loading || query.isLoading) return <div className="min-h-screen bg-slate-50 p-12 text-center text-slate-600">모델 설정을 불러오는 중입니다...</div>;
  if (!isAdmin) return <div className="min-h-screen bg-slate-50 p-12 text-center"><ShieldCheck className="mx-auto h-12 w-12 text-slate-400" /><h1 className="mt-4 text-xl font-bold">관리자 전용 설정</h1></div>;
  return <div className="min-h-screen bg-slate-50 px-4 py-8 sm:px-6 lg:px-8"><div className="mx-auto max-w-6xl">
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4"><div><Link href="/admin" className="mb-3 inline-flex items-center gap-2 text-sm text-slate-500 hover:text-slate-900"><ArrowLeft className="h-4 w-4" />관리자 대시보드</Link><h1 className="text-3xl font-bold text-slate-900">평가 모델 관리</h1><p className="mt-2 text-sm text-slate-600">활성화된 모델은 우선순위 순으로 선택됩니다. 서버가 준비되지 않은 모델은 비활성 상태로 두세요.</p></div><Button disabled={update.isPending} onClick={() => update.mutate({ profiles })} className="gap-2"><Save className="h-4 w-4" />전체 저장</Button></div>
    <div className="space-y-4">{profiles.map((profile) => <Card key={profile.id} className="p-5"><div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between"><div><div className="flex flex-wrap items-center gap-2"><h2 className="text-lg font-bold">{profile.name}</h2><Badge variant={profile.enabled ? "default" : "outline"}>{profile.enabled ? "활성" : "비활성"}</Badge><Badge variant="outline">{providers[profile.provider]}</Badge></div><p className="mt-1 text-xs text-slate-500">ID: {profile.id} · 용도: {profile.purpose}</p></div><div className="flex items-center gap-3 text-sm"><span>사용</span><Switch checked={profile.enabled} onCheckedChange={(enabled) => patch(profile.id, { enabled })} /></div></div><div className="mt-5 grid gap-4 md:grid-cols-3"><label className="text-sm font-medium">모델 식별자<Input value={profile.model} onChange={(e) => patch(profile.id, { model: e.target.value })} className="mt-2" placeholder="예: gpt-4.1-mini" /></label><label className="text-sm font-medium">Provider<Select value={profile.provider} onValueChange={(provider) => patch(profile.id, { provider: provider as Profile["provider"] })}><SelectTrigger className="mt-2"><SelectValue /></SelectTrigger><SelectContent>{Object.entries(providers).map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}</SelectContent></Select></label><label className="text-sm font-medium">우선순위<Input type="number" min={1} max={999} value={profile.priority} onChange={(e) => patch(profile.id, { priority: Number(e.target.value) || 1 })} className="mt-2" /></label></div><label className="mt-4 block text-sm font-medium">모델 서버 Endpoint<Input value={profile.endpoint} onChange={(e) => patch(profile.id, { endpoint: e.target.value })} className="mt-2" placeholder="https://... (선택)" /></label><label className="mt-4 block text-sm font-medium">관리 메모<Input value={profile.notes} onChange={(e) => patch(profile.id, { notes: e.target.value })} className="mt-2" /></label></Card>)}</div>
  </div></div>;
}
