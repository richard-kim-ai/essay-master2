import { describe, expect, it } from "vitest";
import { calculateAge, maskName, parseBirthDate, requiresGuardianConsent } from "../shared/guardian";

const NOW = new Date(Date.UTC(2026, 9, 11)); // 2026-10-11

describe("calculateAge", () => {
  it("생일이 지나기 전에는 한 살을 더하지 않는다", () => {
    expect(calculateAge("2012-10-12", NOW)).toBe(13);
    expect(calculateAge("2012-10-11", NOW)).toBe(14);
    expect(calculateAge("2012-10-10", NOW)).toBe(14);
  });

  it("윤년 생일과 월 경계를 처리한다", () => {
    expect(calculateAge("2012-02-29", NOW)).toBe(14);
    expect(calculateAge("2012-11-01", NOW)).toBe(13);
  });

  it("형식이 잘못됐거나 존재하지 않는 날짜, 미래 날짜는 null을 반환한다", () => {
    expect(calculateAge("2012/10/11", NOW)).toBeNull();
    expect(calculateAge("2012-13-01", NOW)).toBeNull();
    expect(calculateAge("2013-02-29", NOW)).toBeNull();
    expect(calculateAge("2027-01-01", NOW)).toBeNull();
    expect(parseBirthDate("")).toBeNull();
  });
});

describe("requiresGuardianConsent", () => {
  it("만 14세 미만만 보호자 동의 대상이다", () => {
    expect(requiresGuardianConsent("2012-10-12", NOW)).toBe(true);
    expect(requiresGuardianConsent("2012-10-11", NOW)).toBe(false);
    expect(requiresGuardianConsent("2018-05-01", NOW)).toBe(true);
    expect(requiresGuardianConsent("1990-05-01", NOW)).toBe(false);
  });

  it("잘못된 생년월일은 동의 대상으로 판정하지 않는다(입력 검증은 호출부에서 한다)", () => {
    expect(requiresGuardianConsent("abc", NOW)).toBe(false);
  });
});

describe("maskName", () => {
  it("이름 가운데를 가린다", () => {
    expect(maskName("홍길동")).toBe("홍*동");
    expect(maskName("김철")).toBe("김*");
    expect(maskName("남궁민수")).toBe("남**수");
    expect(maskName("")).toBe("아동");
    expect(maskName(null)).toBe("아동");
  });
});
