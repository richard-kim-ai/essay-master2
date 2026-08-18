import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { trpc } from "@/lib/trpc";
import { Award, Eye, CheckCircle2, AlertCircle, Printer, Download, FileImage, Share2, Link2, ExternalLink } from "lucide-react";
import { jsPDF } from "jspdf";
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

type CourseType = "elementary" | "middle_high" | "high_univ" | "general_adult";

const COURSE_DEFINITIONS: Array<{ type: CourseType; label: string; description: string; levels: number[]; accent: string; soft: string }> = [
  { type: "elementary", label: "초등 과정", description: "초등학생 대상 논술 교육 과정 단계별 수료증", levels: [1, 2, 3, 4], accent: "bg-blue-600 hover:bg-blue-700", soft: "bg-blue-50/50" },
  { type: "middle_high", label: "중고등 과정", description: "중고등학생 대상 논술 교육 과정 단계별 수료증", levels: [1, 2, 3, 4], accent: "bg-purple-600 hover:bg-purple-700", soft: "bg-purple-50/50" },
  { type: "high_univ", label: "고등/대입 과정", description: "고등학생 및 대입 수험생 대상 심층 논증 수료증", levels: [1, 2, 3], accent: "bg-indigo-600 hover:bg-indigo-700", soft: "bg-indigo-50/50" },
  { type: "general_adult", label: "일반/직장인 과정", description: "비즈니스 기획 및 실전 보고서 작성 수료증", levels: [1, 2, 3], accent: "bg-teal-600 hover:bg-teal-700", soft: "bg-teal-50/50" },
];

function courseTypeFromTag(tag?: string | null): CourseType {
  if (tag?.includes("중고등")) return "middle_high";
  if (tag?.includes("고등")) return "high_univ";
  if (tag?.includes("일반")) return "general_adult";
  return "elementary";
}

type CertificateExportData = { title: string; courseLabel: string; recipient: string; certificateNumber: string; issuedAt: string; preview?: boolean };

function drawCertificateCanvas(data: CertificateExportData) {
  const canvas = document.createElement("canvas");
  canvas.width = 1600;
  canvas.height = 1120;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("수료증 캔버스를 준비하지 못했습니다.");
  const { width, height } = canvas;
  context.fillStyle = "#fffdf6";
  context.fillRect(0, 0, width, height);
  context.strokeStyle = "#1d4ed8";
  context.lineWidth = 18;
  context.strokeRect(46, 46, width - 92, height - 92);
  context.strokeStyle = "#c9a227";
  context.lineWidth = 4;
  context.strokeRect(78, 78, width - 156, height - 156);
  context.textAlign = "center";
  context.fillStyle = "#1e3a8a";
  context.font = "700 34px Arial, sans-serif";
  context.fillText("ESSAY MASTER", width / 2, 180);
  context.fillStyle = "#0f172a";
  context.font = "700 72px Arial, sans-serif";
  context.fillText("수 료 증", width / 2, 300);
  context.fillStyle = "#475569";
  context.font = "500 32px Arial, sans-serif";
  context.fillText(data.courseLabel, width / 2, 375);
  context.fillStyle = "#0f172a";
  context.font = "700 46px Arial, sans-serif";
  context.fillText(data.recipient, width / 2, 505);
  context.font = "400 31px Arial, sans-serif";
  context.fillStyle = "#334155";
  context.fillText("위 학습자는 논술 마스터의 학습 기준을 충족하여", width / 2, 590);
  context.fillText(data.preview ? "수료증 예시를 미리 확인합니다." : "위 과정을 성실히 이수하였음을 증명합니다.", width / 2, 642);
  context.fillStyle = "#1e3a8a";
  context.font = "700 40px Arial, sans-serif";
  context.fillText(data.title, width / 2, 744);
  context.strokeStyle = "#cbd5e1";
  context.lineWidth = 2;
  context.beginPath();
  context.moveTo(210, 845);
  context.lineTo(width - 210, 845);
  context.stroke();
  context.fillStyle = "#475569";
  context.font = "500 25px Arial, sans-serif";
  context.textAlign = "left";
  context.fillText(`인증번호  ${data.certificateNumber}`, 220, 925);
  context.textAlign = "right";
  context.fillText(`발급일  ${data.issuedAt}`, width - 220, 925);
  context.textAlign = "center";
  context.fillStyle = "#1e3a8a";
  context.font = "700 27px Arial, sans-serif";
  context.fillText("논술 마스터 교육 플랫폼", width / 2, 1000);
  return canvas;
}

export default function Certificate() {
  const { user, isAuthenticated } = useAuth();
  const [certificates, setCertificates] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  // Preview Modal state
  const [previewOpen, setPreviewOpen] = useState(false);
  const [selectedCourse, setSelectedCourse] = useState<"elementary" | "middle_high" | "high_univ" | "general_adult">("elementary");
  const [selectedLevel, setSelectedLevel] = useState<number>(1);

  const [sharingId, setSharingId] = useState<number | null>(null);
  const isSampleUser = Boolean(user?.email?.includes("@sample.com") || user?.email?.includes("@sample."));
  const [sampleCourse, setSampleCourse] = useState<CourseType>(() => {
    if (typeof window === "undefined") return "elementary";
    const stored = window.localStorage.getItem("essaymaster-sample-course");
    return COURSE_DEFINITIONS.some((course) => course.type === stored) ? stored as CourseType : "elementary";
  });
  const activeCourse = isSampleUser ? sampleCourse : courseTypeFromTag(user?.tag);

  const getCertificatesQuery = trpc.certificate.getUserCertificates.useQuery(undefined, {
    enabled: isAuthenticated,
  });
  const eligibilityQuery = trpc.certificate.eligibility.useQuery(undefined, { enabled: isAuthenticated && !isSampleUser });
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
  const visibleCertificates = certificates.filter((certificate) => certificate.courseType === activeCourse);

  const isLevelEligible = (courseType: CourseType, level: number) => {
    if (isSampleUser || courseType !== activeCourse) return false;
    return Boolean(eligibilityQuery.data?.levelEligibility?.find((item: any) => item.level === level)?.isEligible);
  };

  const exportCertificate = (data: CertificateExportData, filename: string, format: "png" | "pdf") => {
    try {
      const canvas = drawCertificateCanvas(data);
      const image = canvas.toDataURL("image/png");
      if (format === "png") {
        const anchor = document.createElement("a");
        anchor.href = image;
        anchor.download = `${filename}.png`;
        anchor.click();
        toast.success("수료증 원본 이미지(PNG)를 다운로드했습니다.");
        return;
      }
      const orientation = canvas.width >= canvas.height ? "landscape" : "portrait";
      const pdf = new jsPDF({ orientation, unit: "px", format: [canvas.width, canvas.height], hotfixes: ["px_scaling"] });
      pdf.addImage(image, "PNG", 0, 0, canvas.width, canvas.height);
      pdf.save(`${filename}.pdf`);
      toast.success("수료증 원본만 포함된 PDF를 저장했습니다.");
    } catch (error) {
      console.error(error);
      toast.error("수료증 이미지·PDF 생성 중 오류가 발생했습니다.");
    }
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

    if (!isLevelEligible(selectedCourse, selectedLevel)) {
      toast.error(isSampleUser ? "샘플 모드에서는 수료증을 발급할 수 없습니다. 회원가입 후 학습을 완료해주세요." : "해당 레벨의 수료 기준을 충족한 뒤 발급할 수 있습니다.");
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
          <h1 className="text-3xl font-extrabold text-slate-900">수료증</h1>
          <p className="text-sm text-slate-600 mt-1">{isSampleUser ? "과정을 선택해 수료증 예시를 확인하고, 회원가입 후 실제 학습 기록으로 발급받으세요." : "가입 과정의 수료 기준을 충족한 뒤 수료증을 미리보기 및 발급받으세요."}</p>
          {isSampleUser && <label className="mt-4 flex max-w-sm flex-col gap-1.5 text-sm font-semibold text-slate-700">샘플 학습 과정 선택<select className="h-10 rounded-lg border border-indigo-200 bg-white px-3 text-sm font-medium text-indigo-900" value={sampleCourse} onChange={(event) => { const course = event.target.value as CourseType; setSampleCourse(course); window.localStorage.setItem("essaymaster-sample-course", course); }}><option value="elementary">초등 논술</option><option value="middle_high">중고등 논술</option><option value="high_univ">고등/대입 논술</option><option value="general_adult">일반/직장인 논술</option></select></label>}
        </div>

        {/* Issue New Certificate Section */}
        <div>
          <h2 className="text-xl font-bold text-slate-900 mb-6 flex items-center gap-2">
            <Award className="w-5 h-5 text-blue-600" />
            <span>수료증 신청 및 미리보기</span>
          </h2>

          <div className="grid md:grid-cols-2 gap-6">
            {/* Elementary */}
            <Card className={`border-slate-200 shadow-sm ${activeCourse === "elementary" ? "" : "hidden"}`}>
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
                  const unavailable = !isSampleUser && !isLevelEligible("elementary", level);
                  return (
                    <div key={level} className="flex items-center justify-between p-3 rounded-lg border border-slate-200 bg-white">
                      <div>
                        <p className="font-bold text-sm text-slate-900">Level {level} 수료증</p>
                        <p className="text-xs text-slate-500">{issued ? "이미 발급됨" : unavailable ? "수료 기준 미달" : isSampleUser ? "샘플 미리보기" : "발급 가능"}</p>
                      </div>
                      <Button
                        size="sm"
                        variant={issued || unavailable ? "secondary" : "default"}
                        className={issued || unavailable ? "bg-slate-100 text-slate-500 cursor-not-allowed" : "bg-blue-600 hover:bg-blue-700 text-white gap-1"}
                        onClick={() => handleOpenPreview("elementary", level)}
                        disabled={issued || unavailable}
                      >
                        {issued ? (
                          <>
                            <CheckCircle2 className="w-3.5 h-3.5" /> 발급 완료
                          </>
                        ) : unavailable ? (
                          <>수료 기준 미달</>
                        ) : (
                          <>
                            <Eye className="w-3.5 h-3.5" /> {isSampleUser ? "샘플 미리보기" : "미리보기 및 발급"}
                          </>
                        )}
                      </Button>
                    </div>
                  );
                })}
              </CardContent>
            </Card>

            {/* Middle/High */}
            <Card className={`border-slate-200 shadow-sm ${activeCourse === "middle_high" ? "" : "hidden"}`}>
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
                  const unavailable = !isSampleUser && !isLevelEligible("middle_high", level);
                  return (
                    <div key={level} className="flex items-center justify-between p-3 rounded-lg border border-slate-200 bg-white">
                      <div>
                        <p className="font-bold text-sm text-slate-900">Level {level} 수료증</p>
                        <p className="text-xs text-slate-500">{issued ? "이미 발급됨" : unavailable ? "수료 기준 미달" : isSampleUser ? "샘플 미리보기" : "발급 가능"}</p>
                      </div>
                      <Button
                        size="sm"
                        variant={issued || unavailable ? "secondary" : "default"}
                        className={issued || unavailable ? "bg-slate-100 text-slate-500 cursor-not-allowed" : "bg-purple-600 hover:bg-purple-700 text-white gap-1"}
                        onClick={() => handleOpenPreview("middle_high", level)}
                        disabled={issued || unavailable}
                      >
                        {issued ? (
                          <>
                            <CheckCircle2 className="w-3.5 h-3.5" /> 발급 완료
                          </>
                        ) : unavailable ? (
                          <>수료 기준 미달</>
                        ) : (
                          <>
                            <Eye className="w-3.5 h-3.5" /> {isSampleUser ? "샘플 미리보기" : "미리보기 및 발급"}
                          </>
                        )}
                      </Button>
                    </div>
                  );
                })}
              </CardContent>
            </Card>

            {/* High/Univ */}
            <Card className={`border-slate-200 shadow-sm ${activeCourse === "high_univ" ? "" : "hidden"}`}>
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
                  const unavailable = !isSampleUser && !isLevelEligible("high_univ", level);
                  return (
                    <div key={level} className="flex items-center justify-between p-3 rounded-lg border border-slate-200 bg-white">
                      <div>
                        <p className="font-bold text-sm text-slate-900">Level {level} 수료증</p>
                        <p className="text-xs text-slate-500">{issued ? "이미 발급됨" : unavailable ? "수료 기준 미달" : isSampleUser ? "샘플 미리보기" : "발급 가능"}</p>
                      </div>
                      <Button
                        size="sm"
                        variant={issued || unavailable ? "secondary" : "default"}
                        className={issued || unavailable ? "bg-slate-100 text-slate-500 cursor-not-allowed" : "bg-indigo-600 hover:bg-indigo-700 text-white gap-1"}
                        onClick={() => handleOpenPreview("high_univ", level)}
                        disabled={issued || unavailable}
                      >
                        {issued ? (
                          <>
                            <CheckCircle2 className="w-3.5 h-3.5" /> 발급 완료
                          </>
                        ) : unavailable ? (
                          <>수료 기준 미달</>
                        ) : (
                          <>
                            <Eye className="w-3.5 h-3.5" /> {isSampleUser ? "샘플 미리보기" : "미리보기 및 발급"}
                          </>
                        )}
                      </Button>
                    </div>
                  );
                })}
              </CardContent>
            </Card>

            {/* General/Adult */}
            <Card className={`border-slate-200 shadow-sm ${activeCourse === "general_adult" ? "" : "hidden"}`}>
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
                  const unavailable = !isSampleUser && !isLevelEligible("general_adult", level);
                  return (
                    <div key={level} className="flex items-center justify-between p-3 rounded-lg border border-slate-200 bg-white">
                      <div>
                        <p className="font-bold text-sm text-slate-900">Level {level} 수료증</p>
                        <p className="text-xs text-slate-500">{issued ? "이미 발급됨" : unavailable ? "수료 기준 미달" : isSampleUser ? "샘플 미리보기" : "발급 가능"}</p>
                      </div>
                      <Button
                        size="sm"
                        variant={issued || unavailable ? "secondary" : "default"}
                        className={issued || unavailable ? "bg-slate-100 text-slate-500 cursor-not-allowed" : "bg-teal-600 hover:bg-teal-700 text-white gap-1"}
                        onClick={() => handleOpenPreview("general_adult", level)}
                        disabled={issued || unavailable}
                      >
                        {issued ? (
                          <>
                            <CheckCircle2 className="w-3.5 h-3.5" /> 발급 완료
                          </>
                        ) : unavailable ? (
                          <>수료 기준 미달</>
                        ) : (
                          <>
                            <Eye className="w-3.5 h-3.5" /> {isSampleUser ? "샘플 미리보기" : "미리보기 및 발급"}
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
            <span>나의 발급된 수료증 목록 ({visibleCertificates.length}개)</span>
          </h2>

          {visibleCertificates.length === 0 ? (
            <Card className="border-slate-200 p-12 text-center">
              <AlertCircle className="w-10 h-10 text-slate-400 mx-auto mb-3" />
              <p className="text-slate-700 font-semibold">아직 발급받은 수료증이 없습니다.</p>
              <p className="text-xs text-slate-500 mt-1">위의 과정별 레벨에서 수료증을 미리보고 발급받아 보세요.</p>
            </Card>
          ) : (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {visibleCertificates.map((cert) => (
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
                          onClick={() => exportCertificate({ title: cert.title || `Level ${cert.level || 1} 수료증`, courseLabel: cert.courseType === "elementary" ? "초등 논술 과정" : cert.courseType === "middle_high" ? "중고등 논술 과정" : cert.courseType === "high_univ" ? "고등/대입 논술 과정" : "일반/직장인 논술 과정", recipient: user?.name || "학습자", certificateNumber: cert.certNumber || `CERT-2026-${cert.id}`, issuedAt: new Date(cert.createdAt).toLocaleDateString() }, `Certificate_${cert.certNumber || cert.id}`, "png")}
                        >
                          <FileImage className="w-3.5 h-3.5" /> 이미지 저장
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="flex-1 border-indigo-200 text-indigo-700 hover:bg-indigo-50 text-xs gap-1"
                          onClick={() => exportCertificate({ title: cert.title || `Level ${cert.level || 1} 수료증`, courseLabel: cert.courseType === "elementary" ? "초등 논술 과정" : cert.courseType === "middle_high" ? "중고등 논술 과정" : cert.courseType === "high_univ" ? "고등/대입 논술 과정" : "일반/직장인 논술 과정", recipient: user?.name || "학습자", certificateNumber: cert.certNumber || `CERT-2026-${cert.id}`, issuedAt: new Date(cert.createdAt).toLocaleDateString() }, `Certificate_${cert.certNumber || cert.id}`, "pdf")}
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
                          <Share2 className="w-3 h-3 text-pink-600" /> 인스타
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="flex-1 border-yellow-200 text-amber-800 hover:bg-yellow-50 text-[11px] h-7 gap-1"
                          disabled={sharingId === cert.id}
                          onClick={async () => {
                            setSharingId(cert.id);
                            const toastId = toast.loading("카카오톡 공유 템플릿을 준비 중입니다...");
                            try {
                              // Simulate brief network/SDK init latency with smooth loading spinner
                              await new Promise((r) => setTimeout(r, 600));

                              // Kakao SDK feed share fallback / standard share simulation with thumbnail template
                              const shareTitle = `[논술 마스터] ${cert.title} 수료증`;
                              const shareDesc = `인증번호: ${cert.certNumber || cert.id} | 성취도 우수 수료증 발급 완료!`;
                              const shareUrl = `${window.location.origin}/certificate?cert=${cert.certNumber || cert.id}`;

                              if ((window as any).Kakao && (window as any).Kakao.Share) {
                                try {
                                  (window as any).Kakao.Share.sendDefault({
                                    objectType: 'feed',
                                    content: {
                                      title: shareTitle,
                                      description: shareDesc,
                                      imageUrl: 'https://images.unsplash.com/photo-1456513080510-7bf3a84b82f8?w=800&auto=format&fit=crop&q=60',
                                      link: {
                                        mobileWebUrl: shareUrl,
                                        webUrl: shareUrl,
                                      },
                                    },
                                    buttons: [
                                      {
                                        title: '수료증 확인하기',
                                        link: {
                                          mobileWebUrl: shareUrl,
                                          webUrl: shareUrl,
                                        },
                                      },
                                    ],
                                  });
                                  toast.success("카카오톡 공유 템플릿이 호출되었습니다.", { id: toastId });
                                  setSharingId(null);
                                  return;
                                } catch {}
                              }

                              if (navigator.share) {
                                try {
                                  await navigator.share({ title: shareTitle, text: `${shareDesc}\n${shareUrl}`, url: shareUrl });
                                  toast.success("카카오톡(모바일 공유)으로 전송되었습니다.", { id: toastId });
                                  setSharingId(null);
                                  return;
                                } catch {}
                              }

                              navigator.clipboard.writeText(shareUrl);
                              toast.success("카카오톡 공유 링크 및 템플릿 주소가 복사되었습니다!", { id: toastId });
                            } finally {
                              setSharingId(null);
                            }
                          }}
                        >
                          {sharingId === cert.id ? (
                            <span className="animate-spin h-3 w-3 border-2 border-amber-600 border-t-transparent rounded-full inline-block" />
                          ) : (
                            <Share2 className="w-3 h-3 text-amber-600" />
                          )}
                          카카오톡
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
                onClick={() => exportCertificate({ title: `${selectedCourse === "elementary" ? "초등" : selectedCourse === "middle_high" ? "중고등" : selectedCourse === "high_univ" ? "고등/대입" : "일반/직장인"} 논술 과정 Level ${selectedLevel} 수료증`, courseLabel: selectedCourse === "elementary" ? "초등 논술 과정" : selectedCourse === "middle_high" ? "중고등 논술 과정" : selectedCourse === "high_univ" ? "고등/대입 논술 과정" : "일반/직장인 논술 과정", recipient: user?.name || "학습자", certificateNumber: "발급 전 미리보기", issuedAt: new Date().toLocaleDateString(), preview: true }, `Preview_Certificate_${selectedCourse}_Lv${selectedLevel}`, "png")}
              >
                <FileImage className="w-3.5 h-3.5" /> 이미지 다운로드
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="w-full sm:w-auto gap-1 text-xs"
                onClick={() => exportCertificate({ title: `${selectedCourse === "elementary" ? "초등" : selectedCourse === "middle_high" ? "중고등" : selectedCourse === "high_univ" ? "고등/대입" : "일반/직장인"} 논술 과정 Level ${selectedLevel} 수료증`, courseLabel: selectedCourse === "elementary" ? "초등 논술 과정" : selectedCourse === "middle_high" ? "중고등 논술 과정" : selectedCourse === "high_univ" ? "고등/대입 논술 과정" : "일반/직장인 논술 과정", recipient: user?.name || "학습자", certificateNumber: "발급 전 미리보기", issuedAt: new Date().toLocaleDateString(), preview: true }, `Preview_Certificate_${selectedCourse}_Lv${selectedLevel}`, "pdf")}
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
