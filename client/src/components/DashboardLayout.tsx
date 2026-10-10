import { useAuth } from "@/_core/hooks/useAuth";
import { DashboardLayoutSkeleton } from './DashboardLayoutSkeleton';
import LoginRequired from "./LoginRequired";
import PreviewGate from "./PreviewGate";

// previewTitle을 넘긴 화면은 로그인하지 않은 방문자에게도 화면 전체를 "미리보기"로 보여준다(클릭·입력 차단).
// 넘기지 않은 화면은 기존처럼 로그인 안내를 보여준다.
export default function DashboardLayout({
  children,
  previewTitle,
}: {
  children: React.ReactNode;
  previewTitle?: string;
}) {
  const { loading, user } = useAuth();

  if (loading) {
    return <DashboardLayoutSkeleton />;
  }

  if (!user && !previewTitle) {
    return <LoginRequired />;
  }

  const body = (
    <div className="bg-slate-50/50 w-full">
      <div className="w-full mx-auto">
        {children}
      </div>
    </div>
  );

  return user ? body : <PreviewGate active title={previewTitle ?? ""}>{body}</PreviewGate>;
}
