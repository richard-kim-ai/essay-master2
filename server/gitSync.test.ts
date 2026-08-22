import { describe, expect, it } from "vitest";
import { evaluateGitSync } from "../scripts/verify-git-sync.mjs";

describe("Git 동기화 상호 검증", () => {
  it("두 main 기준과 작업 트리가 모두 일치할 때 통과한다", () => {
    expect(evaluateGitSync({
      hasOrigin: true,
      hasUserGithub: true,
      originOnly: 0,
      githubOnly: 0,
      isWorktreeClean: true,
    })).toEqual({ ok: true, issues: [] });
  });

  it("원격 main 불일치와 미저장 변경을 함께 차단한다", () => {
    const result = evaluateGitSync({
      hasOrigin: true,
      hasUserGithub: true,
      originOnly: 2,
      githubOnly: 5,
      isWorktreeClean: false,
    });

    expect(result.ok).toBe(false);
    expect(result.issues).toContain("현재 작업 트리에 커밋되지 않은 변경이 있습니다.");
    expect(result.issues).toContain("두 main 기준이 일치하지 않습니다. origin 전용 2개, user_github 전용 5개 커밋");
  });

  it("GitHub 원격 누락 또는 GitHub 최신화 실패를 차단한다", () => {
    const result = evaluateGitSync({
      hasOrigin: true,
      hasUserGithub: false,
      originOnly: 0,
      githubOnly: 0,
      isWorktreeClean: true,
      fetchFailures: ["user_github"],
    });

    expect(result.ok).toBe(false);
    expect(result.issues).toContain("협업 GitHub 원격(user_github)이 설정되어 있지 않습니다.");
    expect(result.issues).toContain("원격 최신화 실패: user_github");
  });
});
