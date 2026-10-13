import { describe, expect, it } from "vitest";
import { getTrialStatus } from "./trialExperience";

describe("getTrialStatus", () => {
  const now = new Date("2026-08-25T00:00:00.000Z");

  it("가입 후 7일 이내에는 남은 체험 일수를 계산한다", () => {
    const status = getTrialStatus("2026-08-23T00:00:00.000Z", now);
    expect(status).toMatchObject({ isActive: true, daysRemaining: 5 });
  });

  it("7일이 지나면 체험 종료 상태를 반환한다", () => {
    const status = getTrialStatus("2026-08-17T00:00:00.000Z", now);
    expect(status).toMatchObject({ isActive: false, daysRemaining: 0 });
  });

  it("유효하지 않은 가입일에는 체험 상태를 만들지 않는다", () => {
    expect(getTrialStatus("not-a-date", now)).toBeNull();
  });
});
