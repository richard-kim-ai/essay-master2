import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const source = readFileSync(
  fileURLToPath(new URL("./AIAutoFeedback.tsx", import.meta.url)),
  "utf8"
);

// 결제 기능이 없는 동안 구매 완료를 흉내 내는 버튼이나, 파일 내용을 읽지 않고 지어낸 본문을 넣는 처리가 없어야 한다.
describe("AI 자동 첨삭 화면의 실제성", () => {
  it("결제·충전이 완료된 것처럼 보이는 가짜 버튼과 가격을 두지 않는다", () => {
    for (const fake of [
      "시뮬레이션",
      "구독하기",
      "충전하기",
      "Pro Pass",
      "Extra Credit",
      "₩9,900",
      "₩3,000",
      "프리미엄 업그레이드",
    ]) {
      expect(source, fake).not.toContain(fake);
    }
  });

  it("PDF·Word 파일의 내용을 읽은 것처럼 지어낸 본문을 입력창에 넣지 않는다", () => {
    expect(source).not.toContain("문서 내용 자동 추출 결과");
    expect(source).toContain('accept=".txt,text/plain"');
  });
});
