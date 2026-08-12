import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { ShieldCheck, Save, KeyRound } from "lucide-react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";

const PROVIDERS = [
  { id: "google" as const, name: "Google", description: "Google 계정으로 간편하게 로그인합니다." },
  { id: "kakao" as const, name: "카카오", description: "카카오 계정과 연결해 로그인합니다." },
  { id: "naver" as const, name: "네이버", description: "네이버 계정과 연결해 로그인합니다." },
];

type Draft = { clientId: string; clientSecret: string; enabled: boolean; hasSecret: boolean; clearSecret: boolean };

export default function SocialProviderSettings() {
  const { user, loading } = useAuth();
  const isAdmin = user?.role === "admin";
  const settingsQuery = trpc.social.settings.useQuery(undefined, { enabled: isAdmin });
  const pushSettingsQuery = trpc.push.settings.useQuery(undefined, { enabled: isAdmin });
  const updateMutation = trpc.social.updateSettings.useMutation({
    onSuccess: () => {
      toast.success("소셜 로그인 설정을 저장했습니다.");
      settingsQuery.refetch();
    },
    onError: (error) => toast.error(error.message || "설정을 저장하지 못했습니다."),
  });
  const [drafts, setDrafts] = useState<Record<string, Draft>>({});
  const [pushDraft, setPushDraft] = useState({ publicKey: "", privateKey: "", subject: "", hasPrivateKey: false, hasSubject: false, clearPrivateKey: false, clearSubject: false });
  const pushMutation = trpc.push.updateSettings.useMutation({ onSuccess: () => { toast.success("PWA 푸시 설정을 저장했습니다."); pushSettingsQuery.refetch(); }, onError: (error) => toast.error(error.message || "푸시 설정을 저장하지 못했습니다.") });

  useEffect(() => {
    if (!settingsQuery.data) return;
    setDrafts(Object.fromEntries(settingsQuery.data.map((item) => [item.provider, { clientId: item.clientId, clientSecret: "", enabled: item.enabled, hasSecret: item.hasSecret, clearSecret: false }])));
  }, [settingsQuery.data]);

  useEffect(() => {
    if (!pushSettingsQuery.data) return;
    setPushDraft((current) => ({ ...current, publicKey: pushSettingsQuery.data.publicKey, hasPrivateKey: pushSettingsQuery.data.hasPrivateKey, hasSubject: pushSettingsQuery.data.hasSubject }));
  }, [pushSettingsQuery.data]);

  const updateDraft = (provider: string, patch: Partial<Draft>) => setDrafts((current) => ({ ...current, [provider]: { ...current[provider], ...patch } }));

  if (loading) return <div className="min-h-screen bg-slate-50 p-8 text-center text-slate-600">권한을 확인하는 중...</div>;
  if (!isAdmin) return <div className="min-h-screen bg-slate-50 px-4 py-16"><Card className="mx-auto max-w-md p-8 text-center"><ShieldCheck className="mx-auto h-12 w-12 text-slate-400" /><h1 className="mt-4 text-xl font-bold text-slate-900">관리자 전용 설정</h1><p className="mt-2 text-sm leading-6 text-slate-600">Google·카카오·네이버와 PWA 푸시 키는 관리자만 설정할 수 있습니다.</p><Button className="mt-6" onClick={() => { window.location.href = "/login"; }}>로그인 화면으로 이동</Button></Card></div>;

  return (
    <div className="min-h-screen bg-slate-50 px-4 py-8 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-5xl">
        <div className="mb-8 flex items-start gap-4"><div className="rounded-2xl bg-blue-100 p-3 text-blue-700"><ShieldCheck className="h-7 w-7" /></div><div><h1 className="text-3xl font-bold text-slate-900">소셜 로그인 설정</h1><p className="mt-2 text-slate-600">관리자만 클라이언트 정보와 활성화 상태를 관리할 수 있습니다.</p></div></div>
        <Card className="mb-6 border-amber-200 bg-amber-50 p-5 text-sm leading-6 text-amber-900"><strong>보안 안내</strong><br />Client Secret은 서버에서 암호화해 저장하며 화면에는 다시 표시하지 않습니다. 새 값을 입력하지 않고 저장하면 기존 Secret이 유지됩니다. 설정값은 초기 상태에서 비어 있고 모든 제공자는 비활성화되어 있습니다.</Card>
        <div className="space-y-5">
          <Card className="border-violet-200 bg-violet-50/60 p-5 sm:p-6"><div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between"><div><h2 className="text-xl font-bold text-slate-900">PWA Web Push</h2><p className="mt-2 text-sm leading-6 text-slate-600">VAPID 공개키·비공개키·Subject를 이곳에서 한 번에 입력합니다. 세 값이 모두 저장되면 학습 마감과 첨삭 알림을 활성화할 수 있습니다.</p></div><Badge variant={pushDraft.publicKey && pushDraft.hasPrivateKey && pushDraft.hasSubject ? "default" : "outline"}>{pushDraft.publicKey && pushDraft.hasPrivateKey && pushDraft.hasSubject ? "설정 완료" : "설정 필요"}</Badge></div><div className="mt-6 grid gap-4 md:grid-cols-2"><label className="text-sm font-medium text-slate-700 md:col-span-2">VAPID 공개키<Input value={pushDraft.publicKey} onChange={(event) => setPushDraft((current) => ({ ...current, publicKey: event.target.value }))} className="mt-2" placeholder="현재 비어 있음" /></label><label className="text-sm font-medium text-slate-700">VAPID 비공개키<Input type="password" value={pushDraft.privateKey} onChange={(event) => setPushDraft((current) => ({ ...current, privateKey: event.target.value, clearPrivateKey: false }))} className="mt-2" placeholder={pushDraft.hasPrivateKey ? "기존 값 유지 중 — 변경 시 입력" : "현재 비어 있음"} /></label><label className="text-sm font-medium text-slate-700">VAPID Subject<Input value={pushDraft.subject} onChange={(event) => setPushDraft((current) => ({ ...current, subject: event.target.value, clearSubject: false }))} className="mt-2" placeholder={pushDraft.hasSubject ? "기존 값 유지 중 — 변경 시 입력" : "mailto:admin@example.com"} /></label></div><div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-violet-100 pt-4"><div className="text-sm text-slate-500">비공개키와 Subject는 화면에 다시 표시하지 않습니다.</div><div className="flex gap-2"><Button variant="outline" disabled={!pushDraft.hasPrivateKey && !pushDraft.hasSubject} onClick={() => setPushDraft((current) => ({ ...current, privateKey: "", subject: "", clearPrivateKey: current.hasPrivateKey, clearSubject: current.hasSubject, hasPrivateKey: false, hasSubject: false }))}>비공개 설정 삭제</Button><Button disabled={pushMutation.isPending} onClick={() => pushMutation.mutate({ publicKey: pushDraft.publicKey, privateKey: pushDraft.privateKey || undefined, subject: pushDraft.subject || undefined, clearPrivateKey: pushDraft.clearPrivateKey, clearSubject: pushDraft.clearSubject })} className="bg-violet-600 hover:bg-violet-700">{pushMutation.isPending ? "저장 중..." : "푸시 설정 저장"}</Button></div></div></Card>
          {PROVIDERS.map((provider) => {
            const draft = drafts[provider.id] ?? { clientId: "", clientSecret: "", enabled: false, hasSecret: false, clearSecret: false };
            return <Card key={provider.id} className="p-5 sm:p-6"><div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between"><div className="min-w-0"><div className="flex items-center gap-3"><h2 className="text-xl font-bold text-slate-900">{provider.name}</h2><Badge variant={draft.enabled && draft.hasSecret && draft.clientId ? "default" : "outline"}>{draft.enabled && draft.hasSecret && draft.clientId ? "활성" : "설정 필요"}</Badge></div><p className="mt-2 text-sm text-slate-600">{provider.description}</p></div><div className="flex items-center gap-3"><Label htmlFor={`${provider.id}-enabled`}>사용</Label><Switch id={`${provider.id}-enabled`} checked={draft.enabled} onCheckedChange={(enabled) => updateDraft(provider.id, { enabled })} /></div></div><div className="mt-6 grid gap-4 md:grid-cols-2"><label className="text-sm font-medium text-slate-700">Client ID / REST API 키<Input value={draft.clientId} onChange={(event) => updateDraft(provider.id, { clientId: event.target.value })} className="mt-2" placeholder="현재 비어 있음" /></label><label className="text-sm font-medium text-slate-700">Client Secret<Input type="password" value={draft.clientSecret} onChange={(event) => updateDraft(provider.id, { clientSecret: event.target.value, clearSecret: false })} className="mt-2" placeholder={draft.hasSecret ? "기존 값 유지 중 — 변경 시 입력" : "현재 비어 있음"} /></label></div><div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-4"><div className="flex items-center gap-2 text-sm text-slate-500"><KeyRound className="h-4 w-4" />{draft.hasSecret ? "서버에 암호화된 Secret 저장됨" : "저장된 Secret 없음"}</div><div className="flex gap-2"><Button variant="outline" disabled={!draft.hasSecret} onClick={() => updateDraft(provider.id, { clearSecret: true, clientSecret: "", hasSecret: false })}>Secret 삭제</Button><Button disabled={updateMutation.isPending} onClick={() => updateMutation.mutate({ provider: provider.id, clientId: draft.clientId, clientSecret: draft.clientSecret || undefined, clearSecret: draft.clearSecret, enabled: draft.enabled })} className="gap-2 bg-blue-600 hover:bg-blue-700"><Save className="h-4 w-4" />저장</Button></div></div></Card>;
          })}
        </div>
      </div>
    </div>
  );
}
