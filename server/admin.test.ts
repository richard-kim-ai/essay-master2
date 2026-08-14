import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

const adminPagePath = new URL("../client/src/pages/AdminDashboard.tsx", import.meta.url);
const navPath = new URL("../client/src/components/Navigation.tsx", import.meta.url);
const certificatesPagePath = new URL("../client/src/pages/AdminCertificates.tsx", import.meta.url);
const curriculumManagerPath = new URL("../client/src/pages/AdminCurriculumManager.tsx", import.meta.url);
const routersPath = new URL("./routers.ts", import.meta.url);

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

  it("수료증 관리 화면에 발행·발행취소·삭제 흐름이 포함된다", () => {
    const source = readFileSync(certificatesPagePath, "utf8");
    expect(source).toContain("관리자 수료증 발행");
    expect(source).toContain("발행취소 확정");
    expect(source).toContain("삭제 확정");
    expect(source).toContain("동일 조건의 활성 수료증은 중복 발행할 수 없습니다.");
  });

  it("동적 커리큘럼 관리자 화면에 추가·수정·삭제 흐름이 포함된다", () => {
    const source = readFileSync(curriculumManagerPath, "utf8");
    expect(source).toContain("새 커리큘럼 카테고리 추가");
    expect(source).toContain("커리큘럼 카테고리 수정");
    expect(source).toContain("카테고리 삭제 확인");
    expect(source).toContain("getCurriculumCategoriesAdmin");
  });

  it("관리자 라우터가 수료증과 카테고리 CRUD를 노출한다", () => {
    const source = readFileSync(routersPath, "utf8");
    expect(source).toContain("issueCertificateAdmin");
    expect(source).toContain("revokeCertificateAdmin");
    expect(source).toContain("deleteCurriculumCategoryAdmin");
    expect(source).toContain("ctx.user.role !== \"admin\"");
  });
});
