import { describe, expect, it } from "vitest";
import { getPageTrail, normalizePath } from "./pageTrail";

describe("getPageTrail", () => {
  it("홈과 표에 없는 경로에는 이동 바를 보여 주지 않는다", () => {
    expect(getPageTrail("/")).toBeNull();
    expect(getPageTrail("/no-such-page")).toBeNull();
  });

  it("최상위 메뉴 화면은 현재 화면 이름만 보여 주고 이전 기록이 없으면 홈으로 보낸다", () => {
    const trail = getPageTrail("/pricing");
    expect(trail?.items).toEqual([{ label: "요금정책" }]);
    expect(trail?.fallbackHref).toBe("/");
  });

  it("하위 화면은 상위 화면 링크를 거쳐 홈까지 이어지고, 이전 기록이 없으면 상위 화면으로 보낸다", () => {
    const trail = getPageTrail("/workbook/elementary/3");
    expect(trail?.items).toEqual([{ label: "커리큘럼", href: "/curriculum" }, { label: "워크북" }]);
    expect(trail?.fallbackHref).toBe("/curriculum");
    expect(trail?.fallbackLabel).toBe("커리큘럼");
  });

  it("두 단계 아래 화면은 상위 경로를 모두 보여 준다", () => {
    const trail = getPageTrail("/ai-feedback-compare/12");
    expect(trail?.items.map((item) => item.label)).toEqual(["마이페이지", "AI 자동 첨삭", "AI 첨삭 비교"]);
    expect(trail?.fallbackHref).toBe("/ai-auto-feedback");
  });

  it("학습 도구는 링크 없는 그룹 이름 아래에 놓이고 이전 기록이 없으면 홈으로 보낸다", () => {
    const trail = getPageTrail("/quiz");
    expect(trail?.items).toEqual([{ label: "학습 도구" }, { label: "AI 문장 교정" }]);
    expect(trail?.fallbackHref).toBe("/");
  });

  it("관리자 화면은 관리자 아래에 놓인다", () => {
    expect(getPageTrail("/admin/billing")?.items).toEqual([{ label: "관리자", href: "/admin" }, { label: "결제 관리" }]);
    expect(getPageTrail("/admin")?.items).toEqual([{ label: "관리자" }]);
  });

  it("쿼리·해시·끝 슬래시는 무시한다", () => {
    expect(normalizePath("/checkout/?plan=ai_basic#top")).toBe("/checkout");
    expect(getPageTrail("/checkout?plan=ai_basic")?.items).toEqual([{ label: "요금정책", href: "/pricing" }, { label: "이용권 결제" }]);
  });
});

describe("교사·관리자의 글 제출 화면 경로", () => {
  it("교사가 여는 /essay-submission은 '교사 마이페이지 > 첨삭 관리 센터'이고 이전 기록이 없으면 교사 마이페이지로 보낸다", () => {
    const trail = getPageTrail("/essay-submission", "teacher");
    expect(trail?.items).toEqual([{ label: "교사 마이페이지", href: "/teacher-mypage" }, { label: "첨삭 관리 센터" }]);
    expect(trail?.fallbackHref).toBe("/teacher-mypage");
  });

  it("관리자는 '관리자 > 첨삭 관리 센터', 학생·방문자는 기존 '마이페이지 > 글 제출'을 유지한다", () => {
    expect(getPageTrail("/essay-submission", "admin")?.items).toEqual([{ label: "관리자", href: "/admin" }, { label: "첨삭 관리 센터" }]);
    expect(getPageTrail("/essay-submission", "user")?.items).toEqual([{ label: "마이페이지", href: "/mypage" }, { label: "글 제출" }]);
    expect(getPageTrail("/essay-submission")?.items.map((item) => item.label)).toEqual(["마이페이지", "글 제출"]);
  });

  it("역할을 넘겨도 다른 화면 경로는 달라지지 않는다", () => {
    expect(getPageTrail("/pricing", "teacher")?.items).toEqual([{ label: "요금정책" }]);
  });
});

describe("교사 계정의 마이페이지 경로", () => {
  it("교사가 여는 첨삭 결과 화면의 상위 경로는 '마이페이지'가 아니라 '교사 마이페이지'이다", () => {
    const trail = getPageTrail("/teacher-feedback/5", "teacher");
    expect(trail?.items).toEqual([{ label: "교사 마이페이지", href: "/teacher-mypage" }, { label: "교사 첨삭" }]);
    expect(trail?.fallbackHref).toBe("/teacher-mypage");
    // 학생은 기존대로
    expect(getPageTrail("/teacher-feedback/5", "user")?.items).toEqual([{ label: "마이페이지", href: "/mypage" }, { label: "교사 첨삭" }]);
  });
});
