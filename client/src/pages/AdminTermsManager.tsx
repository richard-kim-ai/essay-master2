import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { FileText, Shield, Save, ArrowLeft } from "lucide-react";
import { Link } from "wouter";

export default function AdminTermsManager() {
  const [activeTab, setActiveTab] = useState<"terms" | "privacy">("terms");
  const [termsContent, setTermsContent] = useState("");
  const [privacyContent, setPrivacyContent] = useState("");

  const { data: fetchedTerms, isLoading: termsLoading } = trpc.admin.getSiteSettingAdmin.useQuery({ settingKey: "terms_of_service" });
  const { data: fetchedPrivacy, isLoading: privacyLoading } = trpc.admin.getSiteSettingAdmin.useQuery({ settingKey: "privacy_policy" });

  useEffect(() => {
    if (fetchedTerms !== undefined && fetchedTerms !== null) {
      setTermsContent(fetchedTerms);
    }
  }, [fetchedTerms]);

  useEffect(() => {
    if (fetchedPrivacy !== undefined && fetchedPrivacy !== null) {
      setPrivacyContent(fetchedPrivacy);
    }
  }, [fetchedPrivacy]);

  const saveMutation = trpc.admin.saveSiteSettingAdmin.useMutation({
    onSuccess: () => {
      toast.success("정책 내용이 성공적으로 저장되어 로그인 화면에 즉시 반영되었습니다.");
    },
    onError: (err) => {
      toast.error(err.message || "저장 중 오류가 발생했습니다.");
    },
  });

  const handleSave = () => {
    const settingKey = activeTab === "terms" ? "terms_of_service" : "privacy_policy";
    const content = activeTab === "terms" ? termsContent : privacyContent;
    saveMutation.mutate({ settingKey, content });
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto py-6 px-4">
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <Link href="/admin">
              <Button variant="ghost" size="sm" className="gap-1 text-slate-600 pl-0">
                <ArrowLeft className="h-4 w-4" /> 관리자 대시보드로 돌아가기
              </Button>
            </Link>
          </div>
          <h1 className="text-2xl font-bold text-slate-900">이용약관 및 개인정보처리방침 관리</h1>
          <p className="text-sm text-slate-500">로그인 화면의 푸터 링크에서 학생들이 확인하게 될 공식 약관을 직접 편집하고 저장합니다.</p>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={(val) => setActiveTab(val as any)} className="space-y-4">
        <TabsList className="grid w-full grid-cols-2 max-w-md">
          <TabsTrigger value="terms" className="gap-2">
            <FileText className="h-4 w-4" /> 이용약관 관리
          </TabsTrigger>
          <TabsTrigger value="privacy" className="gap-2">
            <Shield className="h-4 w-4" /> 개인정보처리방침
          </TabsTrigger>
        </TabsList>

        <TabsContent value="terms">
          <Card className="border-slate-200 shadow-sm">
            <CardHeader>
              <CardTitle className="text-lg font-bold">서비스 이용약관 본문 수정</CardTitle>
              <CardDescription>회원 가입 및 서비스 이용 시 적용되는 약관 규정 조항을 마크다운 또는 텍스트 형식으로 작성하세요.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {termsLoading ? (
                <div className="p-12 text-center text-slate-500">이용약관 불러오는 중...</div>
              ) : (
                <>
                  <textarea
                    value={termsContent}
                    onChange={(e) => setTermsContent(e.target.value)}
                    placeholder="이용약관 내용을 입력하세요..."
                    className="w-full min-h-[360px] rounded-xl border border-slate-200 p-4 font-mono text-sm leading-relaxed text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <div className="flex justify-end">
                    <Button onClick={handleSave} disabled={saveMutation.isPending} className="gap-2 bg-blue-600 hover:bg-blue-700 text-white">
                      <Save className="h-4 w-4" /> {saveMutation.isPending ? "저장 중..." : "이용약관 저장 및 공개 반영"}
                    </Button>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="privacy">
          <Card className="border-slate-200 shadow-sm">
            <CardHeader>
              <CardTitle className="text-lg font-bold">개인정보처리방침 본문 수정</CardTitle>
              <CardDescription>수집하는 개인정보 항목, 이용 목적, 보유 및 파기 절차에 관한 방침을 입력하세요.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {privacyLoading ? (
                <div className="p-12 text-center text-slate-500">개인정보처리방침 불러오는 중...</div>
              ) : (
                <>
                  <textarea
                    value={privacyContent}
                    onChange={(e) => setPrivacyContent(e.target.value)}
                    placeholder="개인정보처리방침 내용을 입력하세요..."
                    className="w-full min-h-[360px] rounded-xl border border-slate-200 p-4 font-mono text-sm leading-relaxed text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <div className="flex justify-end">
                    <Button onClick={handleSave} disabled={saveMutation.isPending} className="gap-2 bg-blue-600 hover:bg-blue-700 text-white">
                      <Save className="h-4 w-4" /> {saveMutation.isPending ? "저장 중..." : "개인정보처리방침 저장 및 공개 반영"}
                    </Button>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
