import React, { useState } from "react";
import { useSearch } from "wouter";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { trpc } from "@/lib/trpc";
import { CONTACT_EMAIL } from "@/lib/contact";
import Footer from "@/components/Footer";

// 만 14세 미만 학생의 법정대리인(보호자)이 메일 링크로 들어와 동의서를 확인하고 동의하는 페이지.
export default function GuardianConsent() {
  const search = useSearch();
  const token = new URLSearchParams(search).get("token") ?? "";
  const [guardianName, setGuardianName] = useState("");
  const [agreeCollection, setAgreeCollection] = useState(false);
  const [agreeGuardian, setAgreeGuardian] = useState(false);

  const consentQuery = trpc.guardian.getConsent.useQuery({ token }, { enabled: token.length >= 32, retry: false });
  const confirm = trpc.guardian.confirm.useMutation({
    onSuccess: () => {
      toast.success("법정대리인 동의가 완료되었습니다.");
      consentQuery.refetch();
    },
    onError: (error) => toast.error(error.message || "동의 처리 중 오류가 발생했습니다."),
  });

  const data = consentQuery.data;

  const shell = (children: React.ReactNode) => (
    <div className="min-h-screen bg-gradient-to-br from-emerald-50 to-green-100 px-4 py-10 sm:py-16">
      <div className="mx-auto w-full max-w-2xl">
        <h1 className="mb-6 text-center text-3xl font-bold text-slate-900">논술 마스터</h1>
        {children}
      </div>
      <Footer variant="compact" />
    </div>
  );

  if (token.length < 32 || (!consentQuery.isLoading && (!data || data.state === "invalid"))) {
    return shell(
      <Card className="p-8 text-center">
        <h2 className="text-lg font-bold text-slate-900">유효하지 않은 동의 링크입니다.</h2>
        <p className="mt-2 text-sm text-slate-600">메일의 링크를 다시 확인해 주세요. 문제가 계속되면 {CONTACT_EMAIL}으로 문의해 주세요.</p>
      </Card>,
    );
  }

  if (consentQuery.isLoading || !data) {
    return shell(<Card className="p-8 text-center text-slate-600">동의서를 불러오는 중입니다...</Card>);
  }

  if (data.state === "expired") {
    return shell(
      <Card className="p-8 text-center">
        <h2 className="text-lg font-bold text-slate-900">동의 링크가 만료되었습니다.</h2>
        <p className="mt-2 text-sm text-slate-600">{CONTACT_EMAIL}으로 문의하시면 동의 메일을 다시 보내 드립니다.</p>
      </Card>,
    );
  }

  if (data.state === "approved") {
    return shell(
      <Card className="p-8 text-center">
        <h2 className="text-lg font-bold text-emerald-700">법정대리인 동의가 완료되었습니다.</h2>
        <p className="mt-2 text-sm text-slate-600">이제 자녀가 로그인해 서비스를 이용할 수 있습니다. 동의 철회·열람·정정은 {CONTACT_EMAIL}으로 요청해 주세요.</p>
      </Card>,
    );
  }

  if (data.state !== "pending") {
    return shell(
      <Card className="p-8 text-center">
        <h2 className="text-lg font-bold text-slate-900">유효하지 않은 동의 링크입니다.</h2>
        <p className="mt-2 text-sm text-slate-600">문제가 계속되면 {CONTACT_EMAIL}으로 문의해 주세요.</p>
      </Card>,
    );
  }

  const canSubmit = agreeCollection && agreeGuardian && guardianName.trim().length >= 2 && !confirm.isPending;

  return shell(
    <Card className="space-y-6 p-6 sm:p-8">
      <div>
        <h2 className="text-xl font-bold text-slate-900">{data.title}</h2>
        <p className="mt-3 text-sm leading-6 text-slate-600">{data.intro}</p>
      </div>
      <div className="rounded-xl bg-slate-50 p-4 text-sm text-slate-700">
        <p>아동: <strong>{data.childNameMasked}</strong> (출생연도 {data.childBirthYear}년)</p>
        <p className="mt-1">가입 시 입력된 관계: {data.relation}</p>
      </div>
      <div className="space-y-4">
        {data.sections.map((section) => (
          <section key={section.title}>
            <h3 className="font-bold text-slate-900">{section.title}</h3>
            <ul className="mt-1 list-disc space-y-1 pl-5 text-sm leading-6 text-slate-700">
              {section.items.map((item) => <li key={item}>{item}</li>)}
            </ul>
          </section>
        ))}
      </div>
      <div className="space-y-3 rounded-xl border border-slate-200 p-4">
        <label className="flex items-start gap-2 text-sm text-slate-800">
          <input type="checkbox" className="mt-1" checked={agreeCollection} onChange={(event) => setAgreeCollection(event.target.checked)} />
          <span>{data.labels.agreeCollection}</span>
        </label>
        <label className="flex items-start gap-2 text-sm text-slate-800">
          <input type="checkbox" className="mt-1" checked={agreeGuardian} onChange={(event) => setAgreeGuardian(event.target.checked)} />
          <span>{data.labels.agreeGuardian}</span>
        </label>
        <label className="block text-sm font-medium text-slate-700">
          법정대리인 성명 (가입 시 입력된 보호자 성명과 같아야 합니다)
          <Input className="mt-1" value={guardianName} onChange={(event) => setGuardianName(event.target.value)} placeholder="성명 입력" disabled={confirm.isPending} />
        </label>
      </div>
      <Button
        className="w-full bg-emerald-600 hover:bg-emerald-700"
        disabled={!canSubmit}
        onClick={() => confirm.mutate({ token, guardianName: guardianName.trim(), agreeCollection: true, agreeGuardian: true })}
      >
        {confirm.isPending ? "처리 중..." : "동의합니다"}
      </Button>
      <p className="text-xs text-slate-500">동의하지 않으려면 이 창을 닫으세요. 동의하지 않으면 자녀의 가입은 완료되지 않습니다.</p>
    </Card>,
  );
}
