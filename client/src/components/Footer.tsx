import React, { useState } from "react";
import { Link } from "wouter";
import { BookOpen } from "lucide-react";
import { TermsAndPrivacyModal } from "@/components/TermsAndPrivacyModal";
import { COMPANY_INFO, CONTACT_EMAIL, CONTACT_MAILTO } from "@/lib/contact";

const COMPANY_LABELS: ReadonlyArray<[keyof typeof COMPANY_INFO, string]> = [
  ["name", "상호"],
  ["ceo", "대표자"],
  ["businessNumber", "사업자등록번호"],
  ["mailOrderNumber", "통신판매업 신고번호"],
  ["address", "주소"],
  ["privacyOfficer", "개인정보 보호책임자"],
];

// 모든 화면에서 같은 푸터를 쓰기 위한 공통 컴포넌트.
// default: 일반 화면용(소개·바로가기 포함), compact: 로그인·가입 같은 인증 화면용(약관·문의만).
export default function Footer({ variant = "default" }: { variant?: "default" | "compact" }) {
  const [modalType, setModalType] = useState<"terms" | "privacy" | null>(null);
  const companyLines = COMPANY_LABELS.filter(([key]) => COMPANY_INFO[key]).map(([key, label]) => `${label} ${COMPANY_INFO[key]}`);

  const legalLinks = (
    <>
      <button type="button" onClick={() => setModalType("terms")} className="hover:underline">이용약관</button>
      <button type="button" onClick={() => setModalType("privacy")} className="font-bold hover:underline">개인정보처리방침</button>
      <a href={CONTACT_MAILTO} className="hover:underline">문의 {CONTACT_EMAIL}</a>
    </>
  );

  // 약관 모달은 열 때만 마운트한다(모달 안의 약관 조회 요청을 푸터가 보이는 모든 화면에서 보내지 않도록).
  const modal = modalType ? <TermsAndPrivacyModal type={modalType} onClose={() => setModalType(null)} /> : null;
  const copyright = `© ${new Date().getFullYear()} 논술 마스터. All rights reserved.`;

  if (variant === "compact") {
    return (
      <footer className="px-4 py-6 text-center text-xs text-slate-500" aria-label="사이트 정보">
        <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2">{legalLinks}</div>
        {companyLines.length > 0 && <p className="mt-2">{companyLines.join(" · ")}</p>}
        <p className="mt-2">{copyright}</p>
        {modal}
      </footer>
    );
  }

  return (
    <footer className="bg-slate-950 px-4 py-10 text-slate-400 sm:px-6 lg:px-8" aria-label="사이트 정보">
      <div className="mx-auto flex max-w-7xl flex-col justify-between gap-8 md:flex-row md:items-end">
        <div>
          <div className="flex items-center gap-2 font-extrabold text-white"><BookOpen className="h-5 w-5 text-cyan-300" aria-hidden="true" />논술 마스터</div>
          <p className="mt-3 max-w-sm text-sm leading-6">읽고, 생각하고, 설득력 있게 쓰는 과정을 함께하는 단계별 논술 학습 플랫폼입니다.</p>
        </div>
        <div className="flex flex-wrap justify-start gap-x-5 gap-y-3 text-sm font-semibold md:justify-end">
          <Link href="/curriculum" className="hover:text-white">커리큘럼</Link>
          <Link href="/essay-archive" className="hover:text-white">추천 아카이브</Link>
          <Link href="/topic-wizard" className="hover:text-white">주제 설정</Link>
          <Link href="/pricing" className="hover:text-white">요금정책</Link>
          <Link href="/sample" className="hover:text-white">샘플 체험</Link>
        </div>
      </div>
      <div className="mx-auto mt-8 max-w-7xl border-t border-slate-800 pt-6 text-sm">
        <div className="flex flex-wrap items-center gap-x-5 gap-y-2 [&_button]:text-slate-300 [&_a]:text-slate-300">{legalLinks}</div>
        {companyLines.length > 0 && <p className="mt-3 text-xs leading-6">{companyLines.join(" · ")}</p>}
        <p className="mt-3">{copyright}</p>
      </div>
      {modal}
    </footer>
  );
}
