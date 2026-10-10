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
    <div className="flex min-h-screen flex-col bg-gray-50">
      <Navigation />
      <OfflineStatus />
      <main className="flex-1">{children}</main>
      <Footer />
      <InstallPrompt />
      <PushPermissionPrompt />
      <SampleModeBanner />
      <OnboardingModal />
    </div>
  );
}
