import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { TRIAL_AI_EVALUATION_LIMIT, TRIAL_DURATION_DAYS } from "../../server/trialPolicy";

const read = (relative: string) => readFileSync(join(process.cwd(), relative), "utf8");

// 무료 체험 안내 문구가 실제 한도(서버 정책 상수)와 어긋나지 않도록 지킨다.
describe("무료 체험 안내 문구와 실제 한도", () => {
  it("실제 한도: 가입 후 7일, AI 평가·첨삭 2회 (샘플 방문당 1회와 별도)", () => {
    expect(TRIAL_DURATION_DAYS).toBe(7);
    expect(TRIAL_AI_EVALUATION_LIMIT).toBe(2);
    expect(read("server/routers.ts")).toContain("const SAMPLE_AI_SESSION_LIMIT = 1;");
  });

  it("요금정책은 샘플(가입 전 방문당 1회)과 가입 후 7일 체험(2회)이 별도임과 각 체험의 범위를 구분해 안내한다", () => {
    const pricing = read("client/src/pages/Pricing.tsx");
    expect(pricing).toContain("가입 전 샘플 체험에서 방문당 1회, 가입 후 7일 무료 체험에서 2회가 각각 별도로 제공됩니다");
    expect(pricing).not.toContain("합쳐 총 3회");
    expect(pricing).toContain('ai: "AI 평가·첨삭 1회"');
    expect(pricing).toContain('ai: "AI 평가·첨삭 2회"');
    expect(pricing).toContain("입력한 글과 결과는 저장되지 않습니다");
    expect(pricing).toContain("교사 첨삭지도와 유료 전체 문제은행은 포함되지 않습니다");
  });

  it("샘플 체험 화면은 로그인 없이 방문당 1회·저장 안 됨·가입 후 2회 추가를 안내한다", () => {
    const sample = read("client/src/pages/SampleExperience.tsx");
    expect(sample).toContain("방문당 1회");
    expect(sample).toContain("AI 평가·첨삭 2회를 별도로 더 이용할 수 있습니다");
    expect(sample).not.toContain("무료 총 3회");
    expect(sample).toContain("AI 평가·첨삭을 2회 더 받아볼 수 있습니다");
  });

  it("체험 AI를 '레슨 1 첫 서술형 1회'로 한정하던 옛 문구가 화면에 남아 있지 않다(실제로는 레슨 제한 없이 2회)", () => {
    for (const file of ["client/src/pages/AIAutoFeedback.tsx", "client/src/components/EssayWorkspace.tsx", "client/src/pages/Pricing.tsx", "client/src/pages/SampleExperience.tsx"]) {
      const source = read(file);
      expect(source, file).not.toContain("레슨 1의 첫 서술형");
      expect(source, file).not.toContain("레슨 1 첫 서술형");
    }
    expect(read("client/src/pages/AIAutoFeedback.tsx")).toContain("AI 평가·첨삭을 2회 이용할 수 있고");
  });
});
