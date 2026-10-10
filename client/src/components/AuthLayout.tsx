import React from "react";
import { Link } from "wouter";
import { BookOpen } from "lucide-react";
import Footer from "@/components/Footer";

const WIDTHS = { md: "max-w-md", lg: "max-w-2xl" } as const;

// 로그인·회원가입·이메일 인증·비밀번호 찾기·보호자 동의·404처럼 헤더 없이 보여주는 인증 계열 화면의 공통 레이아웃.
// 로고, 인디고 배경, 가운데 정렬, 화면 하단에 붙는 푸터를 한 곳에서 맡아 화면마다 다르던 배경·로고·푸터 위치를 통일한다.
export default function AuthLayout({
  children,
  tagline,
  brandName = "논술 마스터",
  BrandIcon = BookOpen,
  width = "md",
}: {
  children: React.ReactNode;
  tagline?: string;
  brandName?: string;
  BrandIcon?: React.ComponentType<{ className?: string }>;
  width?: keyof typeof WIDTHS;
}) {
  return (
    <div className="flex min-h-screen flex-col bg-gradient-to-br from-indigo-50 to-indigo-100">
      <main className="flex flex-1 items-center justify-center px-4 py-10 sm:py-16">
        <div className={`w-full ${WIDTHS[width]}`}>
          <div className="mb-8 text-center">
            <Link href="/" className="inline-flex items-center gap-2">
              <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-600 to-indigo-800">
                <BrandIcon className="h-6 w-6 text-white" />
              </span>
              <span className="text-3xl font-bold text-slate-900">{brandName}</span>
            </Link>
            {tagline && <p className="mt-4 text-slate-600">{tagline}</p>}
          </div>
          {children}
        </div>
      </main>
      <Footer variant="compact" />
    </div>
  );
}
