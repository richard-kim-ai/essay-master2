import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const dbPath = new URL("./db.ts", import.meta.url);
const notificationsPath = new URL("../client/src/pages/Notifications.tsx", import.meta.url);
const bannerPath = new URL("../client/src/components/EvaluationReviewNotificationBanner.tsx", import.meta.url);

describe("첨삭 검수·이의제기 학습자 알림", () => {
  it("검수 완료와 최종 이의제기 결과를 중복 없이 인앱 알림으로 저장한다", () => {
    const source = readFileSync(dbPath, "utf8");
    expect(source).toContain("AI 첨삭 인간 검수 완료");
    expect(source).toContain("AI 첨삭 이의제기");
    expect(source).toContain('category: "evaluation_review"');
    expect(source).toContain('existing.status !== "resolved"');
    expect(source).toContain("finalStatuses.includes(input.status as");
  });

  it("알림 센터가 첨삭 검수 결과 전용 필터와 식별 UI를 제공한다", () => {
    const source = readFileSync(notificationsPath, "utf8");
    expect(source).toContain('filterType === "evaluation_review"');
    expect(source).toContain("첨삭 검수");
    expect(source).toContain("ShieldCheck");
    expect(source).toContain("EvaluationReviewNotificationBanner");
    expect(readFileSync(bannerPath, "utf8")).toContain("결과 확인");
  });
});
