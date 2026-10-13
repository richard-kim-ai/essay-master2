import React from "react";
import { trpc } from "@/lib/trpc";

export const SOCIAL_PROVIDERS = ["google", "kakao", "naver"] as const;
export type SocialProvider = (typeof SOCIAL_PROVIDERS)[number];
export const SOCIAL_LABELS: Record<SocialProvider, string> = { google: "Google", kakao: "카카오", naver: "네이버" };

// 각 서비스의 브랜드 색을 쓴 원형 아이콘. 글자 없이 아이콘만 보여주고, 접근성 이름은 aria-label로 제공한다.
const ICONS: Record<SocialProvider, { className: string; svg: React.ReactNode }> = {
  google: {
    className: "border border-slate-200 bg-white hover:bg-slate-50",
    svg: (
      <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden="true">
        <path fill="#4285F4" d="M23.5 12.27c0-.85-.08-1.67-.22-2.45H12v4.64h6.45a5.52 5.52 0 0 1-2.4 3.62v3h3.88c2.27-2.09 3.57-5.17 3.57-8.81z" />
        <path fill="#34A853" d="M12 24c3.24 0 5.96-1.07 7.95-2.92l-3.88-3c-1.07.72-2.45 1.15-4.07 1.15-3.13 0-5.78-2.11-6.73-4.96H1.27v3.1A12 12 0 0 0 12 24z" />
        <path fill="#FBBC05" d="M5.27 14.27a7.2 7.2 0 0 1 0-4.54v-3.1H1.27a12 12 0 0 0 0 10.74l4-3.1z" />
        <path fill="#EA4335" d="M12 4.77c1.76 0 3.34.61 4.59 1.8l3.44-3.44C17.95 1.19 15.24 0 12 0A12 12 0 0 0 1.27 6.63l4 3.1C6.22 6.88 8.87 4.77 12 4.77z" />
      </svg>
    ),
  },
  kakao: {
    className: "bg-[#FEE500] hover:brightness-95",
    svg: (
      <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden="true">
        <path fill="#191919" d="M12 3C6.48 3 2 6.58 2 10.99c0 2.86 1.87 5.37 4.68 6.78l-.95 3.47c-.08.3.26.54.52.37l4.13-2.74c.53.07 1.07.12 1.62.12 5.52 0 10-3.58 10-7.99S17.52 3 12 3z" />
      </svg>
    ),
  },
  naver: {
    className: "bg-[#03C75A] hover:brightness-95",
    svg: (
      <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden="true">
        <path fill="#fff" d="M16.27 12.85 7.38 0H0v24h7.73V11.15L16.62 24H24V0h-7.73z" />
      </svg>
    ),
  },
};

/**
 * 관리자 설정에서 활성화된 소셜 로그인 제공자만 아이콘 버튼으로 보여준다.
 * 활성화된 제공자가 하나도 없으면 구분선("또는")까지 포함해 아무것도 그리지 않는다.
 */
export default function SocialLoginButtons({ next }: { next?: string }) {
  const providers = trpc.social.providers.useQuery();
  const enabled = SOCIAL_PROVIDERS.filter((provider) => providers.data?.find((item) => item.provider === provider)?.enabled);
  if (enabled.length === 0) return null;

  const start = (provider: SocialProvider) => {
    window.location.href = `/api/social/${provider}/start?origin=${encodeURIComponent(window.location.origin)}${next ? `&next=${encodeURIComponent(next)}` : ""}`;
  };

  return (
    <div className="mt-6" data-testid="social-login">
      <div className="relative">
        <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-slate-200" /></div>
        <div className="relative flex justify-center"><span className="bg-white px-3 text-sm text-slate-500">또는</span></div>
      </div>
      <div className="mt-4 flex items-center justify-center gap-3">
        {enabled.map((provider) => (
          <button
            key={provider}
            type="button"
            title={`${SOCIAL_LABELS[provider]}(으)로 계속하기`}
            aria-label={`${SOCIAL_LABELS[provider]}(으)로 계속하기`}
            onClick={() => start(provider)}
            className={`flex h-11 w-11 items-center justify-center rounded-full shadow-sm transition ${ICONS[provider].className}`}
          >
            {ICONS[provider].svg}
          </button>
        ))}
      </div>
    </div>
  );
}
