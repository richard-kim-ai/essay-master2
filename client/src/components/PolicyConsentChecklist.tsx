import React, { useCallback, useEffect, useState } from "react";
import { Checkbox } from "@/components/ui/checkbox";
import { ChevronDown, ShieldCheck } from "lucide-react";
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

/** 문서 상자를 끝까지 읽었는지(스크롤이 맨 아래이거나, 스크롤 없이 전부 보이는지) 판단한다. */
export function hasReadToEnd(box: { scrollTop: number; clientHeight: number; scrollHeight: number }): boolean {
  return box.scrollTop + box.clientHeight >= box.scrollHeight - 8;
}

export function PolicyConsentChecklist({ accountType, value, onChange, disabled }: Props) {
  const { data: policies, isLoading } = trpc.policy.forSignup.useQuery({ accountType });
  const [reviewedKeys, setReviewedKeys] = useState<string[]>([]);
  const [openKey, setOpenKey] = useState<string | null>(null);

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

  const setAccepted = (policyKey: string, accepted: boolean) => onChange(value.map((item) => item.policyKey === policyKey ? { ...item, accepted } : item));

  // 문서를 끝까지 읽으면 '확인함'으로 기록한다. 필수 문서는 이때 동의가 자동으로 체크되고,
  // 선택 문서는 읽은 뒤 본인이 직접 선택해야 한다(선택 동의를 자동으로 받지 않는다).
  const markReviewed = useCallback((policyKey: string, isRequired: boolean) => {
    if (reviewedKeys.includes(policyKey)) return;
    setReviewedKeys((keys) => [...keys, policyKey]);
    if (isRequired) setAccepted(policyKey, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reviewedKeys, value]);

  if (isLoading || !policies) {
    return <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-xs text-slate-500">동의 문서를 불러오는 중입니다…</div>;
  }

  return (
    <section className="space-y-2 rounded-xl border border-slate-200 bg-slate-50/70 p-3.5" aria-label={`${accountLabel[accountType]} 회원가입 동의`}>
      <div className="flex items-center gap-2 text-sm font-bold text-slate-800"><ShieldCheck className="h-4 w-4 text-emerald-600" />가입 전 필수 확인 및 동의</div>
      <p className="text-xs leading-relaxed text-slate-600">항목을 펼쳐 내용을 끝까지 읽으면 필수 항목은 동의가 자동으로 체크됩니다. 선택 항목은 읽은 뒤 직접 선택하며, 선택하지 않아도 서비스 이용에는 영향이 없습니다.</p>
      {policies.map((policy) => {
        const consent = value.find((item) => item.policyKey === policy.policyKey);
        const reviewed = reviewedKeys.includes(policy.policyKey);
        const open = openKey === policy.policyKey;
        const isRequired = Boolean(policy.isRequired);
        return (
          <div key={policy.id} className="rounded-lg border border-slate-200 bg-white">
            <div className="flex items-center gap-2 p-3">
              <Checkbox
                id={`consent-${policy.policyKey}`}
                checked={Boolean(consent?.accepted)}
                disabled={disabled || !reviewed}
                onCheckedChange={(checked) => setAccepted(policy.policyKey, checked === true)}
              />
              <button
                type="button"
                className="flex min-w-0 flex-1 items-center justify-between gap-2 text-left text-xs leading-relaxed text-slate-700"
                aria-expanded={open}
                aria-controls={`policy-body-${policy.policyKey}`}
                onClick={() => setOpenKey(open ? null : policy.policyKey)}
                disabled={disabled}
              >
                <span className="min-w-0">
                  <span className="font-semibold text-slate-900">{policy.title}</span>
                  <span className={isRequired ? "ml-1 text-rose-600" : "ml-1 text-emerald-700"}>{isRequired ? "(필수)" : "(선택)"}</span>
                  {!reviewed && <span className="ml-1 text-[11px] text-amber-700">펼쳐서 확인</span>}
                </span>
                <ChevronDown className={`h-4 w-4 shrink-0 text-slate-400 transition-transform ${open ? "rotate-180" : ""}`} aria-hidden="true" />
              </button>
            </div>
            {open && (
              <div className="border-t border-slate-100 px-3 pb-3">
                <article
                  id={`policy-body-${policy.policyKey}`}
                  className="mt-2 max-h-48 overflow-y-auto whitespace-pre-wrap rounded-lg bg-slate-50 p-3 text-xs leading-6 text-slate-700"
                  ref={(box) => { if (box && !reviewed && hasReadToEnd(box)) markReviewed(policy.policyKey, isRequired); }}
                  onScroll={(event) => { if (hasReadToEnd(event.currentTarget)) markReviewed(policy.policyKey, isRequired); }}
                >
                  {policy.content}
                </article>
                <p className="mt-1.5 text-[11px] text-slate-500">
                  {reviewed ? (isRequired ? "내용을 확인해 동의가 체크되었습니다. 동의하지 않으려면 체크를 해제하세요." : "내용을 확인했습니다. 동의하려면 왼쪽 체크박스를 선택하세요.") : "끝까지 스크롤하면 확인으로 처리됩니다."}
                </p>
              </div>
            )}
          </div>
        );
      })}
    </section>
  );
}
