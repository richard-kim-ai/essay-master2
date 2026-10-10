import { useAuth } from "@/_core/hooks/useAuth";
import { DashboardLayoutSkeleton } from './DashboardLayoutSkeleton';
import LoginRequired from "./LoginRequired";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { loading, user } = useAuth();

  if (loading) {
    return <DashboardLayoutSkeleton />;
  }

  if (!user) {
    return <LoginRequired />;
  }

  return (
    <div className="bg-slate-50/50 w-full">
      <div className="w-full mx-auto">
        {children}
      </div>
    </div>
  );
}
