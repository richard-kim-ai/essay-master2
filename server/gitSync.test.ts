import { describe, expect, it } from "vitest";
import { evaluateGitSync } from "../scripts/verify-git-sync.mjs";

describe("Git 동기화 상호 검증", () => {
  it("현재 체크포인트 기준과 GitHub main·작업 트리가 모두 일치할 때 통과한다", () => {
    expect(evaluateGitSync({
      hasUserGithub: true,
      localOnly: 0,
      githubOnly: 0,
      isWorktreeClean: true,
    })).toEqual({ ok: true, issues: [] });
  });

  it("원격 main 불일치와 미저장 변경을 함께 차단한다", () => {
    const result = evaluateGitSync({
      hasUserGithub: true,
      localOnly: 2,
      githubOnly: 5,
      isWorktreeClean: false,
    });

    expect(result.ok).toBe(false);
    expect(result.issues).toContain("현재 작업 트리에 커밋되지 않은 변경이 있습니다.");
    expect(result.issues).toContain("현재 Manus 체크포인트 기준과 user_github/main이 일치하지 않습니다. 현재 기준 전용 2개, GitHub 전용 5개 커밋");
  });

  it("GitHub 원격 누락 또는 GitHub 최신화 실패를 차단한다", () => {
    const result = evaluateGitSync({
      hasUserGithub: false,
      localOnly: 0,
      githubOnly: 0,
      isWorktreeClean: true,
      fetchFailures: ["user_github"],
    });

    expect(result.ok).toBe(false);
    expect(result.issues).toContain("협업 GitHub 원격(user_github)이 설정되어 있지 않습니다.");
    expect(result.issues).toContain("원격 최신화 실패: user_github");
  });
});
