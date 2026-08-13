import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

const adminPagePath = new URL("../client/src/pages/AdminDashboard.tsx", import.meta.url);
const navPath = new URL("../client/src/components/Navigation.tsx", import.meta.url);

describe("관리자 대시보드 및 모바일 네비게이션 검증", () => {
  it("관리자 대시보드 페이지가 권한 확인 및 학습자 전체 분석을 포함한다", () => {
    const source = readFileSync(adminPagePath, "utf8");
    expect(source).toContain("관리자 전용 페이지");
    expect(source).toContain("학습자 전체 분석 & 관리자 대시보드");
    expect(source).toContain("/admin/social-providers");
  });

  it("모바일 헤더에서 사이트명이 숨겨지지 않고 항상 표시된다", () => {
    const source = readFileSync(navPath, "utf8");
    expect(source).not.toContain("hidden sm:inline");
    expect(source).toContain("논술 마스터");
  });
});
