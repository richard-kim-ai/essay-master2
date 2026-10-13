import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { FileText, Shield, Save, ArrowLeft, ReceiptText } from "lucide-react";
import { Link } from "wouter";

export default function AdminTermsManager() {
  const [activeTab, setActiveTab] = useState<"terms" | "privacy" | "refund">("terms");
  const [termsContent, setTermsContent] = useState("");
  const [privacyContent, setPrivacyContent] = useState("");
  const [refundContent, setRefundContent] = useState("");

  const { data: fetchedTerms, isLoading: termsLoading } = trpc.admin.getSiteSettingAdmin.useQuery({ settingKey: "terms_of_service" });
  const { data: fetchedPrivacy, isLoading: privacyLoading } = trpc.admin.getSiteSettingAdmin.useQuery({ settingKey: "privacy_policy" });
  const { data: fetchedRefund, isLoading: refundLoading } = trpc.admin.getSiteSettingAdmin.useQuery({ settingKey: "refund_policy" });

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

  useEffect(() => {
    if (fetchedRefund !== undefined && fetchedRefund !== null) {
      setRefundContent(fetchedRefund);
    }
  }, [fetchedRefund]);

  const saveMutation = trpc.admin.saveSiteSettingAdmin.useMutation({
    onSuccess: () => {
      toast.success("정책 내용이 성공적으로 저장되어 로그인 화면에 즉시 반영되었습니다.");
    },
    onError: (err) => {
      toast.error(err.message || "저장 중 오류가 발생했습니다.");
    },
  });

  const handleSave = () => {
    const settingKey = activeTab === "terms" ? "terms_of_service" : activeTab === "refund" ? "refund_policy" : "privacy_policy";
    const content = activeTab === "terms" ? termsContent : activeTab === "refund" ? refundContent : privacyContent;
    saveMutation.mutate({ settingKey, content });
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto py-6 px-4">
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <Link href="/admin">
              <Button variant="ghost" size="sm" className="gap-1 text-slate-600 pl-0">
                <ArrowLeft className="h-4 w-4" /> 관리자 대시보드로 돌아가기
              </Button>
            </Link>
          </div>
          <h1 className="text-2xl font-bold text-slate-900">이용약관·개인정보처리방침·가격환불정책 관리</h1>
          <p className="text-sm text-slate-500">사이트 푸터 링크에서 이용자가 확인하게 될 공식 약관과 정책을 직접 편집하고 저장합니다.</p>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={(val) => setActiveTab(val as any)} className="space-y-4">
        <TabsList className="grid w-full grid-cols-3 max-w-xl">
          <TabsTrigger value="terms" className="gap-2">
            <FileText className="h-4 w-4" /> 이용약관 관리
          </TabsTrigger>
          <TabsTrigger value="privacy" className="gap-2">
            <Shield className="h-4 w-4" /> 개인정보처리방침
          </TabsTrigger>
          <TabsTrigger value="refund" className="gap-2">
            <ReceiptText className="h-4 w-4" /> 가격·환불정책
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
                    className="w-full min-h-[360px] rounded-xl border border-slate-200 p-4 font-mono text-sm leading-relaxed text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                  <div className="flex justify-end">
                    <Button onClick={handleSave} disabled={saveMutation.isPending} className="gap-2 bg-indigo-600 hover:bg-indigo-700 text-white">
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
                    className="w-full min-h-[360px] rounded-xl border border-slate-200 p-4 font-mono text-sm leading-relaxed text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                  <div className="flex justify-end">
                    <Button onClick={handleSave} disabled={saveMutation.isPending} className="gap-2 bg-indigo-600 hover:bg-indigo-700 text-white">
                      <Save className="h-4 w-4" /> {saveMutation.isPending ? "저장 중..." : "개인정보처리방침 저장 및 공개 반영"}
                    </Button>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="refund">
          <Card className="border-slate-200 shadow-sm">
            <CardHeader>
              <CardTitle className="text-lg font-bold">가격·환불정책 본문 수정</CardTitle>
              <CardDescription>상품 가격과 제공 내용, 청약철회·환불 기준, 환불 접수 방법을 입력하세요. 저장하면 푸터의 '가격·환불정책'에 바로 반영됩니다.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {refundLoading ? (
                <div className="p-12 text-center text-slate-500">가격·환불정책 불러오는 중...</div>
              ) : (
                <>
                  <textarea
                    value={refundContent}
                    onChange={(e) => setRefundContent(e.target.value)}
                    placeholder="가격·환불정책 내용을 입력하세요..."
                    className="w-full min-h-[480px] rounded-xl border border-slate-200 p-4 font-mono text-sm leading-relaxed text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                  <div className="flex justify-end">
                    <Button onClick={handleSave} disabled={saveMutation.isPending} className="gap-2 bg-indigo-600 hover:bg-indigo-700 text-white">
                      <Save className="h-4 w-4" /> {saveMutation.isPending ? "저장 중..." : "가격·환불정책 저장 및 공개 반영"}
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
