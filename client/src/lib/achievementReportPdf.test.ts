import { describe, expect, it } from "vitest";
import { exportAchievementReportPdf, formatAchievementBadgeLabel, getAchievementReportPdfFilename } from "./achievementReportPdf";

describe("성취 요약 리포트 PDF", () => {
  it("날짜를 포함한 전용 PDF 파일명을 만든다", () => {
    expect(getAchievementReportPdfFilename(new Date("2026-08-19T00:00:00.000Z"))).toBe("EssayMaster_Achievement_Report_2026-08-19.pdf");
  });

  it("갤러리의 뱃지 내부 식별자를 학습자용 명칭으로 바꾼다", () => {
    expect(formatAchievementBadgeLabel("topic_wizard")).toBe("주제 설정 뱃지");
    expect(formatAchievementBadgeLabel("unknown")).toBe("학습 성취 뱃지");
  });

  it("PDF 생성기를 비동기 작업으로 제공해 필요한 시점에만 PDF 모듈을 불러온다", async () => {
    const exportTask = exportAchievementReportPdf({
      learnerName: "테스트 학습자",
      courseLabel: "초등 논술 과정",
      courseProgress: 25,
      completedLevels: 1,
      totalLevels: 4,
      overallProgress: 25,
      averageScore: 80,
      quizCorrectRate: 75,
      learningDays: 3,
      certificates: [],
      badges: [],
      progressData: [],
      growthData: [],
      skillData: [],
    });

    expect(exportTask).toBeInstanceOf(Promise);
    await expect(exportTask).rejects.toThrow();
  });
});
