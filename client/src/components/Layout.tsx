import Navigation from "./Navigation";
import PageNavigator from "./PageNavigator";
import Footer from "./Footer";
import OfflineStatus from "./OfflineStatus";
import InstallPrompt from "./InstallPrompt";
import PushPermissionPrompt from "./PushPermissionPrompt";
import { SampleModeBanner } from "./SampleModeBanner";
import { OnboardingModal } from "./OnboardingModal";
import { useHasBottomNotice } from "@/lib/bottomNotice";

interface LayoutProps {
  children: React.ReactNode;
  // public: 홈·요금 정책·샘플 체험처럼 이미 가입 안내가 있는 공개 화면. 회원가입 배너와 온보딩 모달을 띄우지 않는다.
  variant?: "app" | "public";
}

export default function Layout({ children, variant = "app" }: LayoutProps) {
  const isPublic = variant === "public";
  // 하단에 고정 안내가 떠 있는 동안은 푸터와 페이지 하단이 가려지지 않도록 여백을 둔다.
  const hasBottomNotice = useHasBottomNotice();

  return (
    <div className={`flex min-h-screen flex-col bg-slate-50 ${hasBottomNotice ? "pb-44 sm:pb-24" : ""}`}>
      <Navigation />
      <PageNavigator />
      <OfflineStatus />
      {/* 화면 높이는 이 레이아웃이 맡는다. 페이지 최상위 요소(직계 자식)가 남은 높이를 채워 각 페이지 배경색이 푸터까지 이어진다. */}
      <main className="flex flex-1 flex-col [&>*]:flex-1">{children}</main>
      <Footer />
      <InstallPrompt />
      <PushPermissionPrompt />
      {!isPublic && <SampleModeBanner />}
      {!isPublic && <OnboardingModal />}
    </div>
  );
}
