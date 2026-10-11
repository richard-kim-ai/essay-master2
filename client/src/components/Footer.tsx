import React, { useState } from "react";
import { Link } from "wouter";
import { BookOpen } from "lucide-react";
import { TermsAndPrivacyModal } from "@/components/TermsAndPrivacyModal";
import { COMPANY_INFO, CONTACT_EMAIL, CONTACT_MAILTO, COPYRIGHT_INFO } from "@/lib/contact";

const COMPANY_LABELS: ReadonlyArray<[keyof typeof COMPANY_INFO, string]> = [
  ["name", "상호"],
  ["ceo", "대표자"],
  ["businessNumber", "사업자등록번호"],
  ["mailOrderNumber", "통신판매업 신고번호"],
  ["address", "주소"],
  ["privacyOfficer", "개인정보 보호책임자"],
];

// 푸터 메뉴는 헤더(Navigation) 메뉴 순서를 따른다: 커리큘럼 → 아카이브 → 요금정책 → 학습 도구 → 샘플 체험.
export const FOOTER_MENU: ReadonlyArray<{ title: string; links: ReadonlyArray<{ label: string; href: string }> }> = [
  {
    title: "서비스",
    links: [
      { label: "커리큘럼", href: "/curriculum" },
      { label: "아카이브", href: "/essay-archive" },
      { label: "요금정책", href: "/pricing" },
    ],
  },
  {
    title: "학습 도구",
    links: [
      { label: "AI 문장 교정", href: "/quiz" },
      { label: "단락 재구성", href: "/paragraph-reordering" },
      { label: "요약 연습", href: "/summary-practice" },
      { label: "오답 노트", href: "/mistake-notebook" },
      { label: "주제 설정", href: "/topic-wizard" },
      { label: "주제문 점검", href: "/thesis-checklist" },
    ],
  },
  {
    title: "시작하기",
    links: [
      { label: "샘플 체험", href: "/sample" },
      { label: "로그인", href: "/login" },
      { label: "회원가입", href: "/signup" },
      { label: "교사 회원가입", href: "/teacher-signup" },
    ],
  },
];

// 모든 화면에서 같은 푸터를 쓰기 위한 공통 컴포넌트.
// default: 일반 화면용(소개·바로가기 포함), compact: 로그인·가입 같은 인증 화면용(약관·문의만).
export default function Footer({ variant = "default" }: { variant?: "default" | "compact" }) {
  const [modalType, setModalType] = useState<"terms" | "privacy" | "refund" | null>(null);
  const [numberCopied, setNumberCopied] = useState(false);
  const companyLines = COMPANY_LABELS.filter(([key]) => COMPANY_INFO[key]).map(([key, label]) => `${label} ${COMPANY_INFO[key]}`);

  const legalLinks = (
    <>
      <button type="button" onClick={() => setModalType("terms")} className="hover:underline">이용약관</button>
      <button type="button" onClick={() => setModalType("privacy")} className="font-bold hover:underline">개인정보처리방침</button>
      <button type="button" onClick={() => setModalType("refund")} className="hover:underline">가격·환불정책</button>
      <a href={CONTACT_MAILTO} className="hover:underline">문의 {CONTACT_EMAIL}</a>
    </>
  );

  // 약관 모달은 열 때만 마운트한다(모달 안의 약관 조회 요청을 푸터가 보이는 모든 화면에서 보내지 않도록).
  const modal = modalType ? <TermsAndPrivacyModal type={modalType} onClose={() => setModalType(null)} /> : null;
  const copyright = `© ${new Date().getFullYear()} 논술 마스터. All rights reserved.`;
  // 등록번호가 있을 때만 표기한다(비어 있으면 줄 자체를 숨김).
  const registrationNumber = COPYRIGHT_INFO.registrationNumber;
  const copyRegistrationNumber = async () => {
    if (!registrationNumber) return;
    try {
      await navigator.clipboard.writeText(registrationNumber);
      setNumberCopied(true);
      setTimeout(() => setNumberCopied(false), 2000);
    } catch {
      // 클립보드 권한이 없으면 번호가 화면에 보이므로 직접 선택해 복사할 수 있다.
    }
  };
  const copyrightRegistration = registrationNumber ? (
    <p className="mt-2 text-xs leading-6" data-testid="copyright-registration">
      기초 이론 콘텐츠는 『{COPYRIGHT_INFO.workTitle}』{COPYRIGHT_INFO.author ? `(${COPYRIGHT_INFO.author})` : ""} 저작물을 기반으로 합니다. 저작권등록번호 {registrationNumber}{" "}
      <button type="button" onClick={copyRegistrationNumber} className="rounded border border-current px-1.5 py-0.5 text-[11px] hover:text-white" aria-label="저작권등록번호 복사">{numberCopied ? "복사됨" : "번호 복사"}</button> ·{" "}
      <a href={COPYRIGHT_INFO.verifyUrl} target="_blank" rel="noopener noreferrer" className="underline hover:text-white">등록 확인(한국저작권위원회)</a>
    </p>
  ) : null;

  if (variant === "compact") {
    return (
      <footer className="px-4 py-6 text-center text-xs text-slate-500" aria-label="사이트 정보">
        <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2">{legalLinks}</div>
        {companyLines.length > 0 && <p className="mt-2">{companyLines.join(" · ")}</p>}
        {copyrightRegistration}
        <p className="mt-2">{copyright}</p>
        {modal}
      </footer>
    );
  }

  return (
    <footer className="bg-slate-950 px-4 py-10 text-slate-400 sm:px-6 lg:px-8" aria-label="사이트 정보">
      <div className="mx-auto flex max-w-7xl flex-col justify-between gap-8 md:flex-row md:items-start">
        <div>
          <div className="flex items-center gap-2 font-extrabold text-white"><BookOpen className="h-5 w-5 text-cyan-300" aria-hidden="true" />논술 마스터</div>
          <p className="mt-3 max-w-sm text-sm leading-6">읽고, 생각하고, 설득력 있게 쓰는 과정을 함께하는 단계별 논술 학습 플랫폼입니다.</p>
        </div>
        <nav aria-label="푸터 메뉴" className="grid grid-cols-2 gap-x-10 gap-y-6 text-sm sm:grid-cols-3">
          {FOOTER_MENU.map((group) => (
            <div key={group.title}>
              <p className="font-bold text-white">{group.title}</p>
              <ul className="mt-3 space-y-2">
                {group.links.map((link) => <li key={link.href}><Link href={link.href} className="hover:text-white">{link.label}</Link></li>)}
              </ul>
            </div>
          ))}
        </nav>
      </div>
      <div className="mx-auto mt-8 max-w-7xl border-t border-slate-800 pt-6 text-sm">
        <div className="flex flex-wrap items-center gap-x-5 gap-y-2 [&_button]:text-slate-300 [&_a]:text-slate-300">{legalLinks}</div>
        {companyLines.length > 0 && <p className="mt-3 text-xs leading-6">{companyLines.join(" · ")}</p>}
        {copyrightRegistration}
        <p className="mt-3">{copyright}</p>
      </div>
      {modal}
    </footer>
  );
}
