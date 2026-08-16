import Navigation from "./Navigation";
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
    <div className="min-h-screen bg-gray-50">
      <Navigation />
      <OfflineStatus />
      <main>{children}</main>
      <InstallPrompt />
      <PushPermissionPrompt />
      <SampleModeBanner />
      <OnboardingModal />
    </div>
  );
}
