import React from "react";
import { Input } from "@/components/ui/input";
import { GUARDIAN_RELATIONS, type GuardianRelation } from "@shared/guardian";

export interface GuardianInput {
  name: string;
  relation: GuardianRelation;
  email: string;
}

export const EMPTY_GUARDIAN: GuardianInput = { name: "", relation: "부", email: "" };

// 만 14세 미만 학생이 가입할 때 법정대리인(보호자) 정보를 받는 영역.
export function GuardianConsentFields({
  value,
  onChange,
  disabled,
}: {
  value: GuardianInput;
  onChange: (next: GuardianInput) => void;
  disabled?: boolean;
}) {
  return (
    <div className="space-y-3 rounded-xl border border-amber-200 bg-amber-50 p-3" role="group" aria-label="법정대리인 정보">
      <p className="text-xs leading-relaxed text-amber-950">
        <strong>초등 과정은 보호자(법정대리인)의 동의가 필요합니다.</strong> 아래 보호자 이메일로 동의 요청 메일이 발송되며, 보호자가 동의하기 전에는 서비스를 이용할 수 없습니다.
      </p>
      <label className="block text-sm font-medium text-slate-700">
        보호자 성명
        <Input
          className="mt-1"
          value={value.name}
          onChange={(event) => onChange({ ...value, name: event.target.value })}
          placeholder="보호자 성명"
          disabled={disabled}
        />
      </label>
      <label className="block text-sm font-medium text-slate-700">
        학생과의 관계
        <select
          value={value.relation}
          onChange={(event) => onChange({ ...value, relation: event.target.value as GuardianRelation })}
          disabled={disabled}
          className="mt-1 h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm outline-none ring-emerald-500 focus:ring-2"
        >
          {GUARDIAN_RELATIONS.map((relation) => (
            <option key={relation} value={relation}>{relation}</option>
          ))}
        </select>
      </label>
      <label className="block text-sm font-medium text-slate-700">
        보호자 이메일
        <Input
          className="mt-1"
          type="email"
          value={value.email}
          onChange={(event) => onChange({ ...value, email: event.target.value })}
          placeholder="guardian@email.com"
          disabled={disabled}
        />
      </label>
    </div>
  );
}
