import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { DEFAULT_REFUND_POLICY, REFUND_POLICY_KEY } from "./refundPolicy";
import { TEACHER_FEEDBACK_PASSES, formatKrw } from "../shared/plans";

const read = (path: string) => readFileSync(new URL(path, import.meta.url), "utf8");

describe("가격·환불정책 기본 문구", () => {
  it("게시용 문서의 13개 조항이 순서대로 모두 들어 있다", () => {
    const titles = [
      "1. 가격 및 제공 내용",
      "2. 무료 7일 체험 및 샘플 테스트",
      "3. 이용기간 및 AI 횟수 차감",
      "4. 교사 첨삭지도 및 결제 방식",
      "5. 묶음상품의 금액 배분",
      "6. 청약철회",
      "7. 일반 중도해지 및 환불",
      "8. 오류·장애·계약과 다른 서비스",
      "9. 관계 법령에 따른 반환 기준",
      "10. 미성년자 및 회원탈퇴",
      "11. 환불 신청 및 처리기한",
      "12. 환불 계산 예시",
      "13. 정책 변경 및 분쟁 해결",
    ];
    let cursor = -1;
    for (const title of titles) {
      const index = DEFAULT_REFUND_POLICY.indexOf(title);
      expect(index, title).toBeGreaterThan(cursor);
      cursor = index;
    }
  });

  it("운영자·환불 접수처와 핵심 환불 기준이 원문 그대로 들어 있다", () => {
    expect(DEFAULT_REFUND_POLICY.startsWith("논술마스터 가격 및 환불정책")).toBe(true);
    expect(DEFAULT_REFUND_POLICY).toContain("환불 접수 전화: 02-3487-0092");
    expect(DEFAULT_REFUND_POLICY).toContain("운영자: 굳프렌드 주식회사");
    expect(DEFAULT_REFUND_POLICY).toContain("사업자등록번호: 105-88-00735");
    expect(DEFAULT_REFUND_POLICY).toContain("총 환불액: 17,015원");
    expect(DEFAULT_REFUND_POLICY).toContain("3영업일 이내 환급합니다");
  });

  it("교사 첨삭은 건별이 아니라 첨삭지도권(1·3·5회분) 기준으로 안내하고, 가격이 상품 정의와 같다", () => {
    for (const product of TEACHER_FEEDBACK_PASSES) {
      expect(DEFAULT_REFUND_POLICY).toContain(`교사 첨삭지도권 ${product.sessions}회분 | ${formatKrw(product.priceKrw)} | 구매일부터 ${product.periodDays}일`);
    }
    // 폐지한 건별 상품과 건별 환불 문구가 남아 있지 않다.
    for (const removed of ["교사 핵심 첨삭지도", "교사 일반 첨삭지도", "교사 종합 첨삭지도", "3,900원/건", "교사 첨삭은 별도 신청·결제 상품", "별도 미제공 교사 지도 환불액"]) {
      expect(DEFAULT_REFUND_POLICY).not.toContain(removed);
    }
    // 신청 시 1회 차감, 전달 전 취소 시 횟수 복원, 미사용 권 환불식이 들어 있다.
    expect(DEFAULT_REFUND_POLICY).toContain("신청할 때마다 권의 횟수 1회가 사용됩니다");
    expect(DEFAULT_REFUND_POLICY).toContain("사용한 교사 첨삭지도권 1회가 그대로 돌아옵니다");
    expect(DEFAULT_REFUND_POLICY).toContain("교사 첨삭지도권 환불액 = 권의 실제 결제금액 × 미사용 횟수 ÷ 구매한 총 횟수");
    expect(DEFAULT_REFUND_POLICY).toContain("이용권(학습형·AI 기본형·AI 집중형·AI 추가권)을 이용 중인 이용자만 별도로 구매할 수 있으며");
  });

  it("설정 키는 refund_policy이다", () => {
    expect(REFUND_POLICY_KEY).toBe("refund_policy");
  });
});

describe("푸터·팝업·관리자 연결", () => {
  it("푸터는 개인정보처리방침 옆에서 환불정책 팝업을 연다", () => {
    const footer = read("../client/src/components/Footer.tsx");
    expect(footer).toContain('setModalType("refund")');
    expect(footer.indexOf('setModalType("privacy")')).toBeLessThan(footer.indexOf('setModalType("refund")'));
  });

  it("팝업은 refund_policy 설정을 읽고 제목을 '가격·환불정책'으로 보여 준다", () => {
    const modal = read("../client/src/components/TermsAndPrivacyModal.tsx");
    expect(modal).toContain('"refund_policy"');
    expect(modal).toContain("가격·환불정책");
  });

  it("관리자 약관 화면에 가격·환불정책 입력 탭이 있고 refund_policy로 저장한다", () => {
    const admin = read("../client/src/pages/AdminTermsManager.tsx");
    expect(admin).toContain('value="refund"');
    expect(admin).toContain('"refund_policy"');
    expect(admin).toContain("가격·환불정책 저장 및 공개 반영");
  });
});
