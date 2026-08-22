import { useAuth } from "@/_core/hooks/useAuth";
import { DashboardLayoutSkeleton } from './DashboardLayoutSkeleton';
import { Button } from "./ui/button";
import { startLogin } from "@/const";

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
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="flex flex-col items-center gap-8 p-8 max-w-md w-full">
          <div className="flex flex-col items-center gap-6">
            <h1 className="text-2xl font-semibold tracking-tight text-center">
              로그인이 필요합니다
            </h1>
            <p className="text-sm text-muted-foreground text-center max-w-sm">
              이 페이지에 접근하려면 로그인이 필요합니다. 로그인 페이지로 이동하세요.
            </p>
          </div>
          <Button
            onClick={() => startLogin()}
            size="lg"
            className="w-full shadow-lg hover:shadow-xl transition-all"
          >
            로그인하기
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50/50 w-full">
      <main className="w-full mx-auto">
        {children}
      </main>
    </div>
  );
}
