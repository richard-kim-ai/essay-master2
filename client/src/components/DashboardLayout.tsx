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
    <div className="min-h-screen bg-slate-50/50 w-full">
      <main className="w-full mx-auto">
        {children}
      </main>
    </div>
  );
}
