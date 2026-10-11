// 수료증 이미지·PDF 생성. 모두 브라우저에서만 만들고, 서버에는 압축 이미지(WebP/JPEG)만 보관한다.
// - PDF: 발급하는 순간에만 만들어 내려받는다(저장하지 않는다).
// - 보관 이미지: 가로 1000px로 줄여 WebP(미지원 브라우저는 JPEG)로 압축한다.

export type CertificateExportData = { title: string; courseLabel: string; recipient: string; certificateNumber: string; issuedAt: string; preview?: boolean };

export type ArchiveImage = { imageBase64: string; mimeType: "image/webp" | "image/jpeg"; bytes: number };

const ARCHIVE_WIDTH = 1000;
const ARCHIVE_TARGET_BYTES = 280 * 1024;

export function courseLabelOf(courseType: string) {
  return courseType === "elementary" ? "초등 논술 과정" : courseType === "middle_high" ? "중고등 논술 과정" : courseType === "high_univ" ? "고등/대입 논술 과정" : "일반/직장인 논술 과정";
}

export function drawCertificateCanvas(data: CertificateExportData) {
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

/** 수료증 PDF를 만들어 바로 내려받는다. 만들어진 PDF는 어디에도 저장하지 않는다(발급 시점 전용). */
export async function downloadCertificatePdf(data: CertificateExportData, filename: string) {
  const canvas = drawCertificateCanvas(data);
  const image = canvas.toDataURL("image/png");
  const orientation = canvas.width >= canvas.height ? "landscape" : "portrait";
  const { jsPDF } = await import("jspdf");
  const pdf = new jsPDF({ orientation, unit: "px", format: [canvas.width, canvas.height], hotfixes: ["px_scaling"] });
  pdf.addImage(image, "PNG", 0, 0, canvas.width, canvas.height);
  pdf.save(`${filename}.pdf`);
}

function canvasToBlob(canvas: HTMLCanvasElement, type: string, quality: number) {
  return new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, type, quality));
}

function blobToBase64(blob: Blob) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result ?? "");
      resolve(result.slice(result.indexOf(",") + 1));
    };
    reader.onerror = () => reject(new Error("보관 이미지를 읽지 못했습니다."));
    reader.readAsDataURL(blob);
  });
}

/** 수료증을 가로 1000px로 줄여 WebP(안 되면 JPEG)로 압축한다. 서버 보관용이다. */
export async function createArchiveImage(data: CertificateExportData): Promise<ArchiveImage> {
  const source = drawCertificateCanvas(data);
  const scale = Math.min(1, ARCHIVE_WIDTH / source.width);
  const small = document.createElement("canvas");
  small.width = Math.round(source.width * scale);
  small.height = Math.round(source.height * scale);
  const context = small.getContext("2d");
  if (!context) throw new Error("보관 이미지를 준비하지 못했습니다.");
  context.drawImage(source, 0, 0, small.width, small.height);

  for (const quality of [0.8, 0.6, 0.4]) {
    // 브라우저가 WebP를 지원하지 않으면 PNG가 돌아오므로 JPEG로 다시 시도한다.
    let blob = await canvasToBlob(small, "image/webp", quality);
    if (!blob || blob.type !== "image/webp") blob = await canvasToBlob(small, "image/jpeg", quality);
    if (!blob) continue;
    if (blob.size <= ARCHIVE_TARGET_BYTES || quality === 0.4) {
      const mimeType = blob.type === "image/jpeg" ? "image/jpeg" : "image/webp";
      return { imageBase64: await blobToBase64(blob), mimeType, bytes: blob.size };
    }
  }
  throw new Error("보관 이미지를 만들지 못했습니다.");
}
