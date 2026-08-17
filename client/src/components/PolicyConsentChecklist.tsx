import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { FileCheck2, ShieldCheck } from "lucide-react";
import { trpc } from "@/lib/trpc";

export type PolicyConsentValue = {
  policyKey: string;
  policyVersion: string;
  accepted: boolean;
};

type Props = {
  accountType: "student" | "parent" | "teacher";
  value: PolicyConsentValue[];
  onChange: (value: PolicyConsentValue[]) => void;
  disabled?: boolean;
};

const accountLabel = { student: "학생", parent: "학부모", teacher: "첨삭교사" } as const;

export function PolicyConsentChecklist({ accountType, value, onChange, disabled }: Props) {
  const { data: policies, isLoading } = trpc.policy.forSignup.useQuery({ accountType });
  const [reviewedKeys, setReviewedKeys] = useState<string[]>([]);
  const [activePolicyKey, setActivePolicyKey] = useState<string | null>(null);

  useEffect(() => {
    if (!policies) return;
    onChange(policies.map((policy) => ({
      policyKey: policy.policyKey,
      policyVersion: policy.version,
      accepted: value.find((item) => item.policyKey === policy.policyKey)?.accepted ?? false,
    })));
    // 정책 버전이 변경될 때에만 동의 값을 정규화한다.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [policies, accountType]);

  const activePolicy = policies?.find((policy) => policy.policyKey === activePolicyKey);
  const setAccepted = (policyKey: string, accepted: boolean) => onChange(value.map((item) => item.policyKey === policyKey ? { ...item, accepted } : item));

  if (isLoading || !policies) {
    return <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-xs text-slate-500">동의 문서를 불러오는 중입니다…</div>;
  }

  return (
    <section className="space-y-2 rounded-xl border border-slate-200 bg-slate-50/70 p-3.5" aria-label={`${accountLabel[accountType]} 회원가입 동의`}> 
      <div className="flex items-center gap-2 text-sm font-bold text-slate-800"><ShieldCheck className="h-4 w-4 text-emerald-600" />가입 전 필수 확인 및 동의</div>
      <p className="text-xs leading-relaxed text-slate-600">문서 전문을 열어 확인한 뒤에만 동의할 수 있습니다. AI 품질 개선 동의는 선택 사항이며 서비스 이용에 영향을 주지 않습니다.</p>
      {policies.map((policy) => {
        const consent = value.find((item) => item.policyKey === policy.policyKey);
        const reviewed = reviewedKeys.includes(policy.policyKey);
        return (
          <div key={policy.id} className="rounded-lg border border-slate-200 bg-white p-3">
            <div className="flex items-start gap-2">
              <Checkbox
                id={`consent-${policy.policyKey}`}
                checked={Boolean(consent?.accepted)}
                disabled={disabled || !reviewed}
                onCheckedChange={(checked) => setAccepted(policy.policyKey, checked === true)}
                className="mt-0.5"
              />
              <label htmlFor={`consent-${policy.policyKey}`} className="min-w-0 flex-1 cursor-pointer text-xs leading-relaxed text-slate-700">
                <span className="font-semibold text-slate-900">{policy.title}</span>
                <span className={policy.isRequired ? "ml-1 text-rose-600" : "ml-1 text-emerald-700"}>{policy.isRequired ? "(필수)" : "(선택)"}</span>
                <span className="ml-1 text-slate-400">v{policy.version}</span>
              </label>
              <Button type="button" variant="ghost" size="sm" className="h-7 shrink-0 px-2 text-xs text-blue-700" onClick={() => setActivePolicyKey(policy.policyKey)} disabled={disabled}>
                내용 확인
              </Button>
            </div>
            {!reviewed && <p className="ml-6 mt-1 text-[11px] text-amber-700">내용 확인 후 동의 항목이 활성화됩니다.</p>}
          </div>
        );
      })}

      <Dialog open={Boolean(activePolicy)} onOpenChange={(open) => !open && setActivePolicyKey(null)}>
        <DialogContent className="max-h-[82vh] max-w-2xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><FileCheck2 className="h-5 w-5 text-blue-600" />{activePolicy?.title}</DialogTitle>
            <DialogDescription>버전 {activePolicy?.version} · 가입 전 확인 문서</DialogDescription>
          </DialogHeader>
          <article className="whitespace-pre-wrap rounded-lg bg-slate-50 p-4 text-sm leading-7 text-slate-700">{activePolicy?.content}</article>
          <DialogFooter>
            <Button type="button" onClick={() => {
              if (activePolicy) setReviewedKeys((keys) => Array.from(new Set([...keys, activePolicy.policyKey])));
              setActivePolicyKey(null);
            }}>내용을 확인했습니다</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}
