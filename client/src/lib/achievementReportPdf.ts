import { jsPDF } from "jspdf";

export type AchievementReportData = {
  learnerName: string;
  courseLabel: string;
  courseProgress: number;
  completedLevels: number;
  totalLevels: number;
  overallProgress: number;
  averageScore: number;
  quizCorrectRate: number;
  learningDays: number;
  certificates: Array<{ title?: string | null; level?: number | null }>;
  badges: Array<{ badgeType?: string | null }>;
  progressData: Array<{ name: string; score: number }>;
  growthData: Array<{ week: string; score: number }>;
  skillData: Array<{ skill: string; value: number }>;
};

function drawRoundedRect(context: CanvasRenderingContext2D, x: number, y: number, width: number, height: number, radius: number, fill: string, stroke?: string) {
  context.beginPath();
  context.moveTo(x + radius, y);
  context.arcTo(x + width, y, x + width, y + height, radius);
  context.arcTo(x + width, y + height, x, y + height, radius);
  context.arcTo(x, y + height, x, y, radius);
  context.arcTo(x, y, x + width, y, radius);
  context.closePath();
  context.fillStyle = fill;
  context.fill();
  if (stroke) {
    context.strokeStyle = stroke;
    context.lineWidth = 1;
    context.stroke();
  }
}

function clamp(value: number) {
  return Math.max(0, Math.min(100, Number.isFinite(value) ? value : 0));
}

function truncate(value: string, length = 28) {
  return value.length > length ? `${value.slice(0, length - 1)}…` : value;
}

export function formatAchievementBadgeLabel(badgeType?: string | null) {
  const labels: Record<string, string> = {
    summary: "요약 연습 뱃지",
    reordering: "단락 재구성 뱃지",
    quiz: "문장 교정 뱃지",
    thesis_checklist: "주제문 점검 뱃지",
    topic_wizard: "주제 설정 뱃지",
    review_king: "복습 왕 뱃지",
  };
  return badgeType ? labels[badgeType] || "학습 성취 뱃지" : "학습 성취 뱃지";
}

function drawMetric(context: CanvasRenderingContext2D, x: number, y: number, label: string, value: string, accent: string) {
  drawRoundedRect(context, x, y, 330, 112, 16, "#ffffff", "#dbe4f0");
  context.fillStyle = "#64748b";
  context.font = "600 18px sans-serif";
  context.fillText(label, x + 22, y + 34);
  context.fillStyle = accent;
  context.font = "800 37px sans-serif";
  context.fillText(value, x + 22, y + 82);
}

function drawProgressChart(context: CanvasRenderingContext2D, x: number, y: number, width: number, height: number, data: AchievementReportData["progressData"]) {
  const values = data.length ? data.slice(-6) : [{ name: "기록 없음", score: 0 }];
  const plotX = x + 34;
  const plotY = y + 36;
  const plotWidth = width - 56;
  const plotHeight = height - 70;
  context.strokeStyle = "#e2e8f0";
  context.lineWidth = 1;
  [0, 50, 100].forEach((value) => {
    const lineY = plotY + plotHeight - (value / 100) * plotHeight;
    context.beginPath(); context.moveTo(plotX, lineY); context.lineTo(plotX + plotWidth, lineY); context.stroke();
  });
  const barWidth = Math.min(38, (plotWidth / values.length) * 0.56);
  values.forEach((item, index) => {
    const gap = plotWidth / values.length;
    const barHeight = (clamp(item.score) / 100) * plotHeight;
    const barX = plotX + index * gap + (gap - barWidth) / 2;
    drawRoundedRect(context, barX, plotY + plotHeight - barHeight, barWidth, Math.max(barHeight, 2), 5, "#4f46e5");
    context.fillStyle = "#64748b"; context.font = "500 11px sans-serif"; context.textAlign = "center";
    context.fillText(truncate(item.name, 8), barX + barWidth / 2, plotY + plotHeight + 18);
  });
  context.textAlign = "left";
}

function drawGrowthChart(context: CanvasRenderingContext2D, x: number, y: number, width: number, height: number, data: AchievementReportData["growthData"]) {
  const values = data.length ? data : [{ week: "이번 주", score: 0 }];
  const plotX = x + 32; const plotY = y + 36; const plotWidth = width - 54; const plotHeight = height - 70;
  context.strokeStyle = "#e2e8f0"; context.lineWidth = 1;
  [0, 50, 100].forEach((value) => { const lineY = plotY + plotHeight - (value / 100) * plotHeight; context.beginPath(); context.moveTo(plotX, lineY); context.lineTo(plotX + plotWidth, lineY); context.stroke(); });
  const points = values.map((item, index) => ({ x: plotX + (values.length === 1 ? plotWidth / 2 : (index / (values.length - 1)) * plotWidth), y: plotY + plotHeight - (clamp(item.score) / 100) * plotHeight }));
  context.strokeStyle = "#059669"; context.lineWidth = 4; context.beginPath(); points.forEach((point, index) => index ? context.lineTo(point.x, point.y) : context.moveTo(point.x, point.y)); context.stroke();
  points.forEach((point, index) => { context.fillStyle = "#ffffff"; context.beginPath(); context.arc(point.x, point.y, 5, 0, Math.PI * 2); context.fill(); context.strokeStyle = "#059669"; context.lineWidth = 3; context.stroke(); context.fillStyle = "#64748b"; context.font = "500 11px sans-serif"; context.textAlign = "center"; context.fillText(values[index].week, point.x, plotY + plotHeight + 18); });
  context.textAlign = "left";
}

function drawSkillChart(context: CanvasRenderingContext2D, x: number, y: number, width: number, height: number, data: AchievementReportData["skillData"]) {
  const values = data.length ? data : [{ skill: "기록 없음", value: 0 }];
  const centerX = x + width / 2; const centerY = y + height / 2 + 4; const radius = Math.min(width, height) * 0.3;
  for (let ring = 1; ring <= 4; ring += 1) { context.strokeStyle = "#e2e8f0"; context.lineWidth = 1; context.beginPath(); values.forEach((_, index) => { const angle = -Math.PI / 2 + (Math.PI * 2 * index) / values.length; const pointX = centerX + Math.cos(angle) * radius * ring / 4; const pointY = centerY + Math.sin(angle) * radius * ring / 4; index ? context.lineTo(pointX, pointY) : context.moveTo(pointX, pointY); }); context.closePath(); context.stroke(); }
  values.forEach((item, index) => { const angle = -Math.PI / 2 + (Math.PI * 2 * index) / values.length; const pointX = centerX + Math.cos(angle) * radius; const pointY = centerY + Math.sin(angle) * radius; context.strokeStyle = "#cbd5e1"; context.beginPath(); context.moveTo(centerX, centerY); context.lineTo(pointX, pointY); context.stroke(); context.fillStyle = "#475569"; context.font = "600 12px sans-serif"; context.textAlign = "center"; context.fillText(item.skill, centerX + Math.cos(angle) * (radius + 24), centerY + Math.sin(angle) * (radius + 24) + 4); });
  context.fillStyle = "rgba(139, 92, 246, 0.32)"; context.strokeStyle = "#7c3aed"; context.lineWidth = 3; context.beginPath(); values.forEach((item, index) => { const angle = -Math.PI / 2 + (Math.PI * 2 * index) / values.length; const pointX = centerX + Math.cos(angle) * radius * clamp(item.value) / 100; const pointY = centerY + Math.sin(angle) * radius * clamp(item.value) / 100; index ? context.lineTo(pointX, pointY) : context.moveTo(pointX, pointY); }); context.closePath(); context.fill(); context.stroke(); context.textAlign = "left";
}

export function getAchievementReportPdfFilename(date = new Date()) {
  return `EssayMaster_Achievement_Report_${date.toISOString().slice(0, 10)}.pdf`;
}

export function exportAchievementReportPdf(data: AchievementReportData) {
  const canvas = document.createElement("canvas");
  canvas.width = 1600;
  canvas.height = 1130;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("성취 리포트 PDF를 준비하지 못했습니다.");
  context.fillStyle = "#f8fafc"; context.fillRect(0, 0, canvas.width, canvas.height);
  drawRoundedRect(context, 36, 32, 1528, 1066, 24, "#ffffff", "#dbe4f0");
  context.fillStyle = "#1e293b"; context.font = "800 38px sans-serif"; context.fillText("논술 마스터 성취 요약 리포트", 76, 96);
  context.fillStyle = "#64748b"; context.font = "500 17px sans-serif"; context.fillText(`${data.learnerName} · ${data.courseLabel} · ${new Date().toLocaleDateString()}`, 76, 126);
  context.fillStyle = "#4f46e5"; context.font = "700 17px sans-serif"; context.textAlign = "right"; context.fillText("개인 학습 성과 전용 리포트", 1520, 96); context.textAlign = "left";
  drawMetric(context, 76, 162, "과정 진도", `${data.courseProgress}%`, "#4f46e5");
  drawMetric(context, 426, 162, "전체 진도율", `${data.overallProgress}%`, "#0f766e");
  drawMetric(context, 776, 162, "평균 점수 · 퀴즈 정답률", `${data.averageScore}점 · ${data.quizCorrectRate}%`, "#2563eb");
  drawMetric(context, 1126, 162, "학습 일수", `${data.learningDays}일`, "#9333ea");
  drawRoundedRect(context, 76, 298, 1448, 118, 16, "#f8fafc", "#dbe4f0");
  context.fillStyle = "#0f172a"; context.font = "800 19px sans-serif"; context.fillText("성취 갤러리", 100, 336);
  context.fillStyle = "#475569"; context.font = "500 16px sans-serif"; context.fillText(`수료증 ${data.certificates.length}건 · 뱃지 ${data.badges.length}개 · 과정 내 ${data.completedLevels}/${data.totalLevels}개 레벨 수료`, 100, 366);
  const certificateText = data.certificates.length ? data.certificates.slice(0, 2).map((certificate) => truncate(certificate.title || `Level ${certificate.level ?? ""} 수료증`, 25)).join("  |  ") : "발급된 수료증이 없습니다.";
  const badgeText = data.badges.length ? data.badges.slice(0, 3).map((badge) => truncate(formatAchievementBadgeLabel(badge.badgeType), 16)).join(" · ") : "획득한 뱃지가 없습니다.";
  context.fillStyle = "#065f46"; context.font = "600 14px sans-serif"; context.fillText(`수료증: ${certificateText}`, 100, 394); context.fillStyle = "#92400e"; context.fillText(`뱃지: ${badgeText}`, 800, 394);
  const chartY = 474; const chartWidth = 448; const chartHeight = 390; const chartXs = [76, 576, 1076];
  ["진도", "성장", "능력"].forEach((title, index) => { drawRoundedRect(context, chartXs[index], chartY, chartWidth, chartHeight, 16, "#ffffff", "#dbe4f0"); context.fillStyle = "#0f172a"; context.font = "800 18px sans-serif"; context.fillText(title, chartXs[index] + 22, chartY + 32); });
  drawProgressChart(context, chartXs[0], chartY + 36, chartWidth, chartHeight - 50, data.progressData);
  drawGrowthChart(context, chartXs[1], chartY + 36, chartWidth, chartHeight - 50, data.growthData);
  drawSkillChart(context, chartXs[2], chartY + 36, chartWidth, chartHeight - 50, data.skillData);
  context.fillStyle = "#94a3b8"; context.font = "500 13px sans-serif"; context.fillText("이 문서는 현재 학습 기록을 기준으로 생성된 개인 성취 요약입니다.", 76, 1054);
  context.textAlign = "right"; context.fillText("논술 마스터", 1524, 1054); context.textAlign = "left";
  const pdf = new jsPDF({ orientation: "landscape", unit: "px", format: [canvas.width, canvas.height], hotfixes: ["px_scaling"] });
  pdf.addImage(canvas.toDataURL("image/png"), "PNG", 0, 0, canvas.width, canvas.height);
  pdf.save(getAchievementReportPdfFilename());
}
