import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { trpc } from "@/lib/trpc";
import { Link } from "wouter";
import { BookOpen, Loader2, Download, Share2, Award } from "lucide-react";
import { useState, useEffect } from "react";
import { toast } from "sonner";

export default function Certificate() {
  const { user, isAuthenticated } = useAuth();
  const [certificates, setCertificates] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const getCertificatesQuery = trpc.certificate.getUserCertificates.useQuery();
  const issueMutation = trpc.certificate.issue.useMutation();

  useEffect(() => {
    if (getCertificatesQuery.data) {
      setCertificates(getCertificatesQuery.data);
    }
  }, [getCertificatesQuery.data]);

  if (!isAuthenticated) {
    return <div className="text-center py-12">로그인이 필요합니다.</div>;
  }

  const handleIssueCertificate = async (courseType: "elementary" | "middle_high", level: number) => {
    setLoading(true);
    try {
      const result = await issueMutation.mutateAsync({
        courseType,
        level,
        certificateType: "level_certificate",
      });
      toast.success("수료증이 발급되었습니다.");
      getCertificatesQuery.refetch();
    } catch (error) {
      console.error("Error issuing certificate:", error);
      toast.error("수료증 발급 중 오류가 발생했습니다.");
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = (cert: any) => {
    if (cert.pdfUrl) {
      window.open(cert.pdfUrl, "_blank");
    } else {
      toast.error("다운로드 링크가 없습니다.");
    }
  };

  const handleShare = (cert: any) => {
    const shareUrl = `${window.location.origin}/certificate/${cert.shareToken}`;
    navigator.clipboard.writeText(shareUrl);
    toast.success("공유 링크가 복사되었습니다.");
  };

  return (
    <div className="min-h-screen bg-gray-50 py-12">
      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <h1 className="text-4xl font-bold text-gray-900 mb-8">수료증</h1>

        {/* Issue New Certificate */}
        <div className="mb-12">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">새 수료증 발급</h2>
          <div className="grid md:grid-cols-2 gap-6">
            {/* Elementary */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Award className="w-5 h-5 text-blue-600" />
                  초등 과정
                </CardTitle>
                <CardDescription>
                  초등학생 대상 논술 교육 과정
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {[1, 2, 3, 4].map((level) => (
                  <Button
                    key={level}
                    onClick={() => handleIssueCertificate("elementary", level)}
                    disabled={loading}
                    variant="outline"
                    className="w-full"
                  >
                    {loading ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        발급 중...
                      </>
                    ) : (
                      `Level ${level} 수료증 발급`
                    )}
                  </Button>
                ))}
              </CardContent>
            </Card>

            {/* Middle/High */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Award className="w-5 h-5 text-purple-600" />
                  중고등 과정
                </CardTitle>
                <CardDescription>
                  중고등학생 대상 논술 교육 과정
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {[1, 2, 3, 4].map((level) => (
                  <Button
                    key={level}
                    onClick={() => handleIssueCertificate("middle_high", level)}
                    disabled={loading}
                    variant="outline"
                    className="w-full"
                  >
                    {loading ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        발급 중...
                      </>
                    ) : (
                      `Level ${level} 수료증 발급`
                    )}
                  </Button>
                ))}
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Issued Certificates */}
        <div>
          <h2 className="text-2xl font-bold text-gray-900 mb-6">
            발급된 수료증 ({certificates.length})
          </h2>

          {certificates.length > 0 ? (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {certificates.map((cert) => (
                <Card key={cert.id} className="border-2 border-indigo-200 bg-gradient-to-br from-indigo-50 to-purple-50">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Award className="w-5 h-5 text-indigo-600" />
                      {cert.courseType === "elementary" ? "초등" : "중고등"} Level {cert.level}
                    </CardTitle>
                    <CardDescription>
                      {cert.certificateType === "level_certificate" ? "레벨 수료증" : "졸업증서"}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="text-sm text-gray-600">
                      <p>발급일: {new Date(cert.createdAt).toLocaleDateString("ko-KR")}</p>
                      <p>공유 토큰: {cert.shareToken.substring(0, 8)}...</p>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        onClick={() => handleDownload(cert)}
                        variant="outline"
                        size="sm"
                        className="flex-1"
                      >
                        <Download className="w-4 h-4 mr-2" />
                        다운로드
                      </Button>
                      <Button
                        onClick={() => handleShare(cert)}
                        variant="outline"
                        size="sm"
                        className="flex-1"
                      >
                        <Share2 className="w-4 h-4 mr-2" />
                        공유
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <Card>
              <CardContent className="py-12 text-center">
                <Award className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                <p className="text-gray-500">
                  아직 발급된 수료증이 없습니다.
                </p>
                <p className="text-sm text-gray-400 mt-2">
                  과정을 완료하면 수료증을 발급받을 수 있습니다.
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
