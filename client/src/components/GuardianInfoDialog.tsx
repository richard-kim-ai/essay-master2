import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { calculateAge } from "@shared/guardian";
import { EMPTY_GUARDIAN, GuardianConsentFields, type GuardianInput } from "@/components/GuardianConsentFields";
import { ShieldCheck } from "lucide-react";

export type GuardianInfoValue = { birthDate: string; guardian: GuardianInput };
export const EMPTY_GUARDIAN_INFO: GuardianInfoValue = { birthDate: "", guardian: EMPTY_GUARDIAN };

/** 초등 과정 가입에 필요한 생년월일·보호자 정보를 확인한다. 문제가 있으면 안내 문구를, 없으면 null을 돌려준다. */
export function validateGuardianInfo(value: GuardianInfoValue, studentEmail: string): string | null {
  if (!value.birthDate) return "생년월일을 입력해 주세요.";
  if (calculateAge(value.birthDate) === null) return "생년월일을 정확히 입력해 주세요.";
  if (value.guardian.name.trim().length < 2) return "보호자 성명을 입력해 주세요.";
  if (!value.guardian.email.trim()) return "보호자 이메일을 입력해 주세요.";
  if (studentEmail.trim() && value.guardian.email.trim().toLowerCase() === studentEmail.trim().toLowerCase()) return "보호자 이메일은 학생 이메일과 달라야 합니다.";
  return null;
}

type Props = {
  value: GuardianInfoValue;
  onChange: (value: GuardianInfoValue) => void;
  studentEmail: string;
  disabled?: boolean;
};

// 초등 과정 가입 화면에서는 보호자 입력란을 펼쳐 두지 않고, 요약 한 줄과 팝업으로 입력받아 가입 화면을 짧게 유지한다.
export function GuardianInfoDialog({ value, onChange, studentEmail, disabled }: Props) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<GuardianInfoValue>(value);
  const [error, setError] = useState<string | null>(null);
  const todayDate = new Date().toISOString().slice(0, 10);
  const completed = validateGuardianInfo(value, studentEmail) === null;

  const openDialog = () => {
    setDraft(value);
    setError(null);
    setOpen(true);
  };
  const save = () => {
    const problem = validateGuardianInfo(draft, studentEmail);
    if (problem) return setError(problem);
    onChange(draft);
    setOpen(false);
  };

  return (
    <div className="rounded-xl border border-amber-200 bg-amber-50 p-3" role="group" aria-label="보호자 정보">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0 text-xs leading-relaxed text-amber-950">
          <p className="font-bold">초등 과정은 보호자(법정대리인)의 동의가 필요합니다.</p>
          {completed
            ? <p className="mt-0.5 text-emerald-700">보호자 {value.guardian.name.trim()}({value.guardian.relation}) · {value.guardian.email.trim()}</p>
            : <p className="mt-0.5">생년월일과 보호자 정보를 입력해 주세요. 보호자 이메일로 동의 요청이 발송됩니다.</p>}
        </div>
        <Button type="button" size="sm" variant={completed ? "outline" : "default"} className={completed ? "shrink-0 bg-white" : "shrink-0 bg-indigo-600 hover:bg-indigo-700"} onClick={openDialog} disabled={disabled}>
          {completed ? "수정" : "보호자 정보 입력"}
        </Button>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90vh] max-w-md overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><ShieldCheck className="h-5 w-5 text-indigo-600" />보호자(법정대리인) 정보</DialogTitle>
            <DialogDescription>입력한 보호자 이메일로 동의 요청이 발송되며, 보호자가 동의하기 전에는 서비스를 이용할 수 없습니다.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <label className="block text-sm font-medium text-slate-700">
              학생 생년월일
              <Input type="date" name="birthDate" value={draft.birthDate} max={todayDate} onChange={(event) => setDraft({ ...draft, birthDate: event.target.value })} className="mt-1" />
              <span className="mt-1 block text-[11px] font-normal text-slate-500">생년월일은 동의 기록에만 사용합니다.</span>
            </label>
            <GuardianConsentFields value={draft.guardian} onChange={(guardian) => setDraft({ ...draft, guardian })} />
            {error && <p className="text-sm font-medium text-rose-600" role="alert">{error}</p>}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>취소</Button>
            <Button type="button" className="bg-indigo-600 hover:bg-indigo-700" onClick={save}>저장</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
