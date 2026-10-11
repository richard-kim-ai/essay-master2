import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(join(process.cwd(), "client/src/pages/Dashboard.tsx"), "utf8");

describe("학습 대시보드는 임의 값 없이 실제 학습 기록으로 그린다", () => {
  it("성장·능력 차트에 고정 숫자 배열(45, 52, 58… / 75, 82, 68…)이 남아 있지 않다", () => {
    for (const fake of ['week: "1주", score: 45', 'week: "2주", score: 52', 'skill: "경제성", value: 75', 'skill: "명료성", value: 82', 'skill: "정확성", value: 68']) {
      expect(source).not.toContain(fake);
    }
  });

  it("능력·성장·추천은 서버 집계(progress.analytics)와 공용 계산 함수에서 온다", () => {
    expect(source).toContain("trpc.progress.analytics.useQuery");
    expect(source).toContain("buildRecommendations");
    expect(source).toContain("analytics.weekly");
    expect(source).toContain("analytics.skills");
  });

  it("예전 고정 추천 문구가 없고, 기록이 없을 때는 빈 상태를 보여 준다", () => {
    for (const fixed of ["정확성 영역 강화 학습", "Level 2를 완료했습니다", "작성한 논술에 대해 AI 자동 첨삭을 받아보세요"]) {
      expect(source).not.toContain(fixed);
    }
    expect(source).toContain("레벨 학습 기록이 아직 없습니다.");
    expect(source).toContain("최근 8주 동안 점수 기록이 없습니다.");
    expect(source).toContain("측정 전");
  });

  it("레벨 차트는 기록 순서가 아니라 커리큘럼의 실제 레벨 번호로 이름을 붙인다", () => {
    expect(source).not.toContain("Level ${idx + 1}");
    expect(source).toContain("Level ${row.level}");
  });

  it("진도율·완료 수는 진도 기록 개수가 아니라 현재 과정의 레벨 수를 기준으로 한다", () => {
    expect(source).toContain("const totalProgress = currentProgress.total;");
    expect(source).toContain("const completedProgress = currentProgress.completedCount;");
  });
});
