import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { trpc } from "@/lib/trpc";
import { Award, Eye, CheckCircle2, AlertCircle, Printer, Download, FileImage, Share2, Link2, ExternalLink } from "lucide-react";
import html2canvas from "html2canvas";
import { useState, useEffect } from "react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export default function Certificate() {
  const { user, isAuthenticated } = useAuth();
  const [certificates, setCertificates] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  // Preview Modal state
  const [previewOpen, setPreviewOpen] = useState(false);
  const [selectedCourse, setSelectedCourse] = useState<"elementary" | "middle_high" | "high_univ" | "general_adult">("elementary");
  const [selectedLevel, setSelectedLevel] = useState<number>(1);

  const getCertificatesQuery = trpc.certificate.getUserCertificates.useQuery(undefined, {
    enabled: isAuthenticated,
  });
  const issueMutation = trpc.certificate.issue.useMutation();

  useEffect(() => {
    if (getCertificatesQuery.data) {
      setCertificates(getCertificatesQuery.data);
    }
  }, [getCertificatesQuery.data]);

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <Card className="max-w-md w-full p-6 text-center shadow-md">
          <Award className="w-12 h-12 text-blue-600 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-slate-900">로그인이 필요합니다</h2>
          <p className="text-sm text-slate-600 mt-2">수료증을 발급받고 관리하려면 로그인해주세요.</p>
          <Button onClick={() => window.location.href = "/login"} className="mt-6 w-full bg-blue-600 hover:bg-blue-700">
            로그인하기
          </Button>
        </Card>
      </div>
    );
  }

  // Check if user already has certificate for this course & level
  const hasAlreadyIssued = (courseType: string, level: number) => {
    return certificates.some((c) => c.courseType === courseType && c.level === level);
  };

  const handleOpenPreview = (courseType: "elementary" | "middle_high" | "high_univ" | "general_adult", level: number) => {
    if (hasAlreadyIssued(courseType, level)) {
      toast.error("이미 해당 레벨의 수료증이 발급되었습니다. 아래 발급 목록에서 확인하세요.");
      return;
    }
    setSelectedCourse(courseType);
    setSelectedLevel(level);
    setPreviewOpen(true);
  };

  const handleConfirmIssue = async () => {
    // 중복 발급 프론트 검사
    if (hasAlreadyIssued(selectedCourse, selectedLevel)) {
      toast.error("이미 해당 레벨의 수료증이 발급되었습니다.");
      setPreviewOpen(false);
      return;
    }

    setLoading(true);
    try {
      await issueMutation.mutateAsync({
        courseType: selectedCourse,
        level: selectedLevel,
        certificateType: "level_certificate",
      });
      toast.success("수료증이 성공적으로 발급되었습니다!");
      setPreviewOpen(false);
      getCertificatesQuery.refetch();
    } catch (error: any) {
      console.error("Error issuing certificate:", error);
      toast.error(error.message || "수료증 발급 중 오류가 발생했습니다.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-6xl mx-auto space-y-12">
        <div>
          <h1 className="text-3xl font-extrabold text-slate-900">수료증 센터</h1>
          <p className="text-sm text-slate-600 mt-1">단계별 과정을 수료하고 수료증을 미리보기 및 발급받으세요. (레벨당 1회 발급)</p>
        </div>

        {/* Issue New Certificate Section */}
        <div>
          <h2 className="text-xl font-bold text-slate-900 mb-6 flex items-center gap-2">
            <Award className="w-5 h-5 text-blue-600" />
            <span>새 수료증 신청 및 미리보기</span>
          </h2>

          <div className="grid md:grid-cols-2 gap-6">
            {/* Elementary */}
            <Card className="border-slate-200 shadow-sm">
              <CardHeader className="bg-blue-50/50">
                <CardTitle className="flex items-center gap-2 text-blue-900">
                  <Award className="w-5 h-5 text-blue-600" />
                  초등 과정 (Elementary Level 1~4)
                </CardTitle>
                <CardDescription>초등학생 대상 논술 교육 과정 단계별 수료증</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3 pt-6">
                {[1, 2, 3, 4].map((level) => {
                  const issued = hasAlreadyIssued("elementary", level);
                  return (
                    <div key={level} className="flex items-center justify-between p-3 rounded-lg border border-slate-200 bg-white">
                      <div>
                        <p className="font-bold text-sm text-slate-900">Level {level} 수료증</p>
                        <p className="text-xs text-slate-500">{issued ? "이미 발급됨" : "발급 가능"}</p>
                      </div>
                      <Button
                        size="sm"
                        variant={issued ? "secondary" : "default"}
                        className={issued ? "bg-slate-100 text-slate-500 cursor-not-allowed" : "bg-blue-600 hover:bg-blue-700 text-white gap-1"}
                        onClick={() => handleOpenPreview("elementary", level)}
                        disabled={issued}
                      >
                        {issued ? (
                          <>
                            <CheckCircle2 className="w-3.5 h-3.5" /> 발급 완료
                          </>
                        ) : (
                          <>
                            <Eye className="w-3.5 h-3.5" /> 미리보기 및 발급
                          </>
                        )}
                      </Button>
                    </div>
                  );
                })}
              </CardContent>
            </Card>

            {/* Middle/High */}
            <Card className="border-slate-200 shadow-sm">
              <CardHeader className="bg-purple-50/50">
                <CardTitle className="flex items-center gap-2 text-purple-900">
                  <Award className="w-5 h-5 text-purple-600" />
                  중고등 과정 (Middle & High Level 1~4)
                </CardTitle>
                <CardDescription>중고등학생 대상 논술 교육 과정 단계별 수료증</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3 pt-6">
                {[1, 2, 3, 4].map((level) => {
                  const issued = hasAlreadyIssued("middle_high", level);
                  return (
                    <div key={level} className="flex items-center justify-between p-3 rounded-lg border border-slate-200 bg-white">
                      <div>
                        <p className="font-bold text-sm text-slate-900">Level {level} 수료증</p>
                        <p className="text-xs text-slate-500">{issued ? "이미 발급됨" : "발급 가능"}</p>
                      </div>
                      <Button
                        size="sm"
                        variant={issued ? "secondary" : "default"}
                        className={issued ? "bg-slate-100 text-slate-500 cursor-not-allowed" : "bg-purple-600 hover:bg-purple-700 text-white gap-1"}
                        onClick={() => handleOpenPreview("middle_high", level)}
                        disabled={issued}
                      >
                        {issued ? (
                          <>
                            <CheckCircle2 className="w-3.5 h-3.5" /> 발급 완료
                          </>
                        ) : (
                          <>
                            <Eye className="w-3.5 h-3.5" /> 미리보기 및 발급
                          </>
                        )}
                      </Button>
                    </div>
                  );
                })}
              </CardContent>
            </Card>

            {/* High/Univ */}
            <Card className="border-slate-200 shadow-sm">
              <CardHeader className="bg-indigo-50/50">
                <CardTitle className="flex items-center gap-2 text-indigo-900">
                  <Award className="w-5 h-5 text-indigo-600" />
                  고등 / 대입 과정 (High & Univ Level 1~3)
                </CardTitle>
                <CardDescription>고등학생 및 대입 수험생 대상 심층 논증 수료증</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3 pt-6">
                {[1, 2, 3].map((level) => {
                  const issued = hasAlreadyIssued("high_univ", level);
                  return (
                    <div key={level} className="flex items-center justify-between p-3 rounded-lg border border-slate-200 bg-white">
                      <div>
                        <p className="font-bold text-sm text-slate-900">Level {level} 수료증</p>
                        <p className="text-xs text-slate-500">{issued ? "이미 발급됨" : "발급 가능"}</p>
                      </div>
                      <Button
                        size="sm"
                        variant={issued ? "secondary" : "default"}
                        className={issued ? "bg-slate-100 text-slate-500 cursor-not-allowed" : "bg-indigo-600 hover:bg-indigo-700 text-white gap-1"}
                        onClick={() => handleOpenPreview("high_univ", level)}
                        disabled={issued}
                      >
                        {issued ? (
                          <>
                            <CheckCircle2 className="w-3.5 h-3.5" /> 발급 완료
                          </>
                        ) : (
                          <>
                            <Eye className="w-3.5 h-3.5" /> 미리보기 및 발급
                          </>
                        )}
                      </Button>
                    </div>
                  );
                })}
              </CardContent>
            </Card>

            {/* General/Adult */}
            <Card className="border-slate-200 shadow-sm">
              <CardHeader className="bg-teal-50/50">
                <CardTitle className="flex items-center gap-2 text-teal-900">
                  <Award className="w-5 h-5 text-teal-600" />
                  일반 / 직장인 과정 (General & Adult Level 1~3)
                </CardTitle>
                <CardDescription>비즈니스 기획 및 실전 보고서 작성 수료증</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3 pt-6">
                {[1, 2, 3].map((level) => {
                  const issued = hasAlreadyIssued("general_adult", level);
                  return (
                    <div key={level} className="flex items-center justify-between p-3 rounded-lg border border-slate-200 bg-white">
                      <div>
                        <p className="font-bold text-sm text-slate-900">Level {level} 수료증</p>
                        <p className="text-xs text-slate-500">{issued ? "이미 발급됨" : "발급 가능"}</p>
                      </div>
                      <Button
                        size="sm"
                        variant={issued ? "secondary" : "default"}
                        className={issued ? "bg-slate-100 text-slate-500 cursor-not-allowed" : "bg-teal-600 hover:bg-teal-700 text-white gap-1"}
                        onClick={() => handleOpenPreview("general_adult", level)}
                        disabled={issued}
                      >
                        {issued ? (
                          <>
                            <CheckCircle2 className="w-3.5 h-3.5" /> 발급 완료
                          </>
                        ) : (
                          <>
                            <Eye className="w-3.5 h-3.5" /> 미리보기 및 발급
                          </>
                        )}
                      </Button>
                    </div>
                  );
                })}
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Issued Certificates List Section */}
        <div className="pt-6 border-t border-slate-200">
          <h2 className="text-xl font-bold text-slate-900 mb-6 flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 text-emerald-600" />
            <span>나의 발급된 수료증 목록 ({certificates.length}개)</span>
          </h2>

          {certificates.length === 0 ? (
            <Card className="border-slate-200 p-12 text-center">
              <AlertCircle className="w-10 h-10 text-slate-400 mx-auto mb-3" />
              <p className="text-slate-700 font-semibold">아직 발급받은 수료증이 없습니다.</p>
              <p className="text-xs text-slate-500 mt-1">위의 과정별 레벨에서 수료증을 미리보고 발급받아 보세요.</p>
            </Card>
          ) : (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {certificates.map((cert) => (
                <Card key={cert.id} id={`cert-card-${cert.id}`} className="border-indigo-100 shadow-sm bg-gradient-to-br from-white to-indigo-50/20">
                  <CardHeader className="pb-3">
                    <span className="text-[11px] uppercase tracking-wider font-bold text-indigo-600">
                      {cert.courseType === "elementary" ? "초등 과정" : cert.courseType === "middle_high" ? "중고등 과정" : cert.courseType === "high_univ" ? "고등/대입 과정" : "일반/직장인 과정"}
                    </span>
                    <CardTitle className="text-lg font-bold text-slate-900">{cert.title || `${cert.courseType} Level ${cert.level || 1} 수료증`}</CardTitle>
                    <CardDescription className="text-xs font-slate-600 font-semibold">인증번호: {cert.certNumber || `CERT-2026-${cert.id}`}</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="p-3 bg-white rounded-lg border border-indigo-100 text-xs text-slate-600 space-y-1">
                      <p>발급일: {new Date(cert.createdAt).toLocaleDateString()}</p>
                      <p className="text-indigo-600 font-medium">상태: 정식 인증됨 (Active)</p>
                    </div>
                    <div className="space-y-2 pt-2">
                      <div className="flex items-center gap-2">
                        <Button
                          size="sm"
                          className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white text-xs gap-1"
                          onClick={async () => {
                            const element = document.getElementById(`cert-card-${cert.id}`);
                            if (!element) return;
                            try {
                              const canvas = await html2canvas(element, {
                                scale: 2,
                                useCORS: true,
                                backgroundColor: "#ffffff",
                                onclone: (clonedDoc) => {
                                  // Tailwind 4 oklch 및 그라데이션 색상 파싱 오류 방지를 위해 스타일 정리
                                  const clonedEl = clonedDoc.getElementById(`cert-card-${cert.id}`);
                                  if (clonedEl) {
                                    clonedEl.style.background = "#ffffff";
                                    clonedEl.style.color = "#1e293b";
                                  }
                                },
                              });
                              const image = canvas.toDataURL("image/png");
                              const a = document.createElement("a");
                              a.href = image;
                              a.download = `Certificate_${cert.certNumber || cert.id}.png`;
                              a.click();
                              toast.success("고해상도 수료증 이미지(PNG)가 다운로드되었습니다.");
                            } catch (e) {
                              console.error(e);
                              toast.error("이미지 다운로드 중 오류가 발생했습니다.");
                            }
                          }}
                        >
                          <FileImage className="w-3.5 h-3.5" /> 이미지 저장
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="flex-1 border-indigo-200 text-indigo-700 hover:bg-indigo-50 text-xs gap-1"
                          onClick={() => {
                            window.print();
                            toast.success("수료증 인쇄 및 PDF 저장 창이 호출되었습니다.");
                          }}
                        >
                          <Download className="w-3.5 h-3.5" /> PDF 저장
                        </Button>
                      </div>
                      <div className="flex items-center gap-1.5 pt-1">
                        <Button
                          size="sm"
                          variant="outline"
                          className="flex-1 border-slate-200 text-slate-700 hover:bg-slate-50 text-[11px] h-7 gap-1"
                          onClick={() => {
                            const shareUrl = `${window.location.origin}/certificate?cert=${cert.certNumber || cert.id}`;
                            navigator.clipboard.writeText(shareUrl);
                            toast.success("클립보드에 복사되었습니다", {
                              description: "소셜 미디어나 메신저에 붙여넣어 수료증을 공유하세요.",
                            });
                          }}
                        >
                          <Link2 className="w-3 h-3 text-indigo-600" /> 링크 복사
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="flex-1 border-blue-200 text-blue-700 hover:bg-blue-50 text-[11px] h-7 gap-1"
                          onClick={() => {
                            const text = `논술 마스터 ${cert.title} 수료 완료! (인증번호: ${cert.certNumber || cert.id})`;
                            const linkedinUrl = `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(window.location.href)}`;
                            window.open(linkedinUrl, "_blank");
                            toast.success("LinkedIn 공유 창이 열렸습니다.");
                          }}
                        >
                          <ExternalLink className="w-3 h-3 text-blue-600" /> LinkedIn
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="flex-1 border-pink-200 text-pink-700 hover:bg-pink-50 text-[11px] h-7 gap-1"
                          onClick={() => {
                            const shareUrl = window.location.href;
                            navigator.clipboard.writeText(shareUrl);
                            toast.success("인스타그램 공유용 링크가 복사되었습니다. 스토리나 피드에 붙여넣으세요!");
                          }}
                        >
                          <Share2 className="w-3 h-3 text-pink-600" /> 인스타그램
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Certificate Preview Modal */}
      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold text-center">🏆 수료증 사전 미리보기</DialogTitle>
            <DialogDescription className="text-center text-xs text-slate-500">
              발급 전 수료증에 기재될 내용을 미리 확인하세요.
            </DialogDescription>
          </DialogHeader>

          {/* Certificate Mockup Preview Box */}
          <div id="preview-certificate-box" className="p-8 my-4 border-4 border-double border-indigo-300 bg-gradient-to-b from-amber-50/40 via-white to-blue-50/30 rounded-2xl text-center space-y-4 shadow-inner">
            <div className="w-12 h-12 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center mx-auto">
              <Award className="w-6 h-6" />
            </div>
            <h3 className="text-xs font-bold tracking-widest uppercase text-indigo-700">Certificate of Completion</h3>
              <h2 className="text-2xl font-extrabold text-slate-900">
                {selectedCourse === "elementary" ? "초등 논술 과정" : selectedCourse === "middle_high" ? "중고등 논술 과정" : selectedCourse === "high_univ" ? "고등/대입 논술 과정" : "일반/직장인 논술 과정"} Level {selectedLevel}
              </h2>
            <div className="py-2">
              <p className="text-sm text-slate-600">본 수료증은 위 과정을 성실히 이수하였음을 증명합니다.</p>
              <p className="text-lg font-bold text-slate-900 mt-2">{user?.name || "학습자"} 귀하</p>
            </div>
            <div className="pt-4 border-t border-slate-200 flex items-center justify-between text-xs text-slate-500">
              <span>논술 마스터 교육 플랫폼</span>
              <span>{new Date().toLocaleDateString()}</span>
            </div>
          </div>

          <DialogFooter className="flex flex-col sm:flex-row gap-2 sm:justify-between items-center w-full">
            <div className="flex items-center gap-2 w-full sm:w-auto">
              <Button
                variant="outline"
                size="sm"
                className="w-full sm:w-auto gap-1 text-xs border-indigo-200 text-indigo-700 hover:bg-indigo-50"
                onClick={async () => {
                  const element = document.getElementById("preview-certificate-box");
                  if (!element) return;
                  try {
                    const canvas = await html2canvas(element, {
                      scale: 2,
                      useCORS: true,
                      backgroundColor: "#ffffff",
                      onclone: (clonedDoc) => {
                        const clonedEl = clonedDoc.getElementById("preview-certificate-box");
                        if (clonedEl) {
                          clonedEl.style.background = "#ffffff";
                          clonedEl.style.color = "#1e293b";
                        }
                      },
                    });
                    const image = canvas.toDataURL("image/png");
                    const a = document.createElement("a");
                    a.href = image;
                    a.download = `Preview_Certificate_${selectedCourse}_Lv${selectedLevel}.png`;
                    a.click();
                    toast.success("고해상도 수료증 이미지(PNG)가 다운로드되었습니다.");
                  } catch (e) {
                    console.error(e);
                    toast.error("이미지 다운로드 중 오류가 발생했습니다.");
                  }
                }}
              >
                <FileImage className="w-3.5 h-3.5" /> 이미지 다운로드
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="w-full sm:w-auto gap-1 text-xs"
                onClick={() => {
                  window.print();
                  toast.success("수료증 인쇄창이 호출되었습니다.");
                }}
              >
                <Printer className="w-3.5 h-3.5" /> PDF 저장 (인쇄)
              </Button>
            </div>
            <div className="flex gap-2 w-full sm:w-auto justify-end">
              <Button variant="outline" size="sm" onClick={() => setPreviewOpen(false)}>
                취소
              </Button>
              <Button
                size="sm"
                disabled={loading}
                className="bg-indigo-600 hover:bg-indigo-700 text-white gap-2 text-xs"
                onClick={handleConfirmIssue}
              >
                {loading ? "발급 중..." : "최종 수료증 발급하기"}
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
