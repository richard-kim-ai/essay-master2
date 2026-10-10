import Navigation from "./Navigation";
import Footer from "./Footer";
import OfflineStatus from "./OfflineStatus";
import InstallPrompt from "./InstallPrompt";
import PushPermissionPrompt from "./PushPermissionPrompt";
import { SampleModeBanner } from "./SampleModeBanner";
import { OnboardingModal } from "./OnboardingModal";

interface LayoutProps {
  children: React.ReactNode;
}

export default function Layout({ children }: LayoutProps) {
  return (
    <div className="flex min-h-screen flex-col bg-slate-50">
      <Navigation />
      <OfflineStatus />
      {/* 화면 높이는 이 레이아웃이 맡는다. 페이지 최상위 요소(직계 자식)가 남은 높이를 채워 각 페이지 배경색이 푸터까지 이어진다. */}
      <main className="flex flex-1 flex-col [&>*]:flex-1">{children}</main>
      <Footer />
      <InstallPrompt />
      <PushPermissionPrompt />
      <SampleModeBanner />
      <OnboardingModal />
    </div>
  );
}
