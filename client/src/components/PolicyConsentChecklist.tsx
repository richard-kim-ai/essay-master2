import React, { useEffect, useState } from "react";
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

  // 팝업에서 내용을 확인하면 '확인함'으로 기록한다. 필수 문서는 확인 버튼을 누르면 동의가 자동으로 체크되고,
  // 선택 문서는 팝업의 '동의합니다'를 눌렀을 때만 체크된다(선택 동의를 자동으로 받지 않는다).
  const confirmPolicy = (policyKey: string, accept: boolean) => {
    setReviewedKeys((keys) => Array.from(new Set([...keys, policyKey])));
    if (accept) setAccepted(policyKey, true);
    setActivePolicyKey(null);
  };

  if (isLoading || !policies) {
    return <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-xs text-slate-500">동의 문서를 불러오는 중입니다…</div>;
  }

  return (
    <section className="space-y-2 rounded-xl border border-slate-200 bg-slate-50/70 p-3.5" aria-label={`${accountLabel[accountType]} 회원가입 동의`}>
      <div className="flex items-center gap-2 text-sm font-bold text-slate-800"><ShieldCheck className="h-4 w-4 text-emerald-600" />가입 전 필수 확인 및 동의</div>
      <p className="text-xs leading-relaxed text-slate-600">각 항목의 '내용 보기'를 눌러 팝업에서 확인하면 필수 항목은 동의가 자동으로 체크됩니다. 선택 항목은 팝업에서 직접 동의하며, 선택하지 않아도 서비스 이용에는 영향이 없습니다.</p>
      {policies.map((policy) => {
        const consent = value.find((item) => item.policyKey === policy.policyKey);
        const reviewed = reviewedKeys.includes(policy.policyKey);
        return (
          <div key={policy.id} className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white p-3">
            <Checkbox
              id={`consent-${policy.policyKey}`}
              checked={Boolean(consent?.accepted)}
              disabled={disabled || !reviewed}
              onCheckedChange={(checked) => setAccepted(policy.policyKey, checked === true)}
            />
            <label htmlFor={`consent-${policy.policyKey}`} className="min-w-0 flex-1 text-xs leading-relaxed text-slate-700">
              <span className="font-semibold text-slate-900">{policy.title}</span>
              <span className={policy.isRequired ? "ml-1 text-rose-600" : "ml-1 text-emerald-700"}>{policy.isRequired ? "(필수)" : "(선택)"}</span>
              {!reviewed && <span className="ml-1 text-[11px] text-amber-700">내용 확인 필요</span>}
            </label>
            <Button type="button" variant="ghost" size="sm" className="h-7 shrink-0 px-2 text-xs text-indigo-700" onClick={() => setActivePolicyKey(policy.policyKey)} disabled={disabled}>
              내용 보기
            </Button>
          </div>
        );
      })}

      <Dialog open={Boolean(activePolicy)} onOpenChange={(open) => !open && setActivePolicyKey(null)}>
        <DialogContent className="max-h-[85vh] max-w-2xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><FileCheck2 className="h-5 w-5 text-indigo-600" />{activePolicy?.title}</DialogTitle>
            <DialogDescription>{activePolicy?.isRequired ? "필수 동의 문서 · 확인하면 동의가 체크됩니다" : "선택 동의 문서 · 동의하지 않아도 서비스 이용에는 영향이 없습니다"}</DialogDescription>
          </DialogHeader>
          <article className="whitespace-pre-wrap rounded-lg bg-slate-50 p-4 text-sm leading-7 text-slate-700">{activePolicy?.content}</article>
          <DialogFooter>
            {activePolicy?.isRequired ? (
              <Button type="button" onClick={() => confirmPolicy(activePolicy.policyKey, true)}>내용을 확인했습니다 (동의)</Button>
            ) : (
              <>
                <Button type="button" variant="outline" onClick={() => activePolicy && confirmPolicy(activePolicy.policyKey, false)}>동의하지 않음</Button>
                <Button type="button" onClick={() => activePolicy && confirmPolicy(activePolicy.policyKey, true)}>동의합니다</Button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}
