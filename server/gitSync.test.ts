import { describe, expect, it } from "vitest";
import { evaluateAutoSyncDecision } from "../scripts/auto-git-sync.mjs";
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

describe("Git 자동 최신화 판단", () => {
  it("원격만 앞서고 작업 트리가 깨끗하면 fast-forward를 허용한다", () => {
    expect(evaluateAutoSyncDecision({
      hasOrigin: true,
      isWorktreeClean: true,
      ahead: 0,
      behind: 3,
    })).toEqual({ ok: true, action: "fast_forward", issues: [] });
  });

  it("로컬 변경이 있는 상태에서 원격이 앞서면 자동 병합을 막는다", () => {
    const result = evaluateAutoSyncDecision({
      hasOrigin: true,
      isWorktreeClean: false,
      ahead: 0,
      behind: 2,
    });

    expect(result.ok).toBe(false);
    expect(result.action).toBe("blocked_dirty");
  });

  it("로컬과 원격이 모두 앞선 분기 상태는 자동 병합하지 않는다", () => {
    const result = evaluateAutoSyncDecision({
      hasOrigin: true,
      isWorktreeClean: true,
      ahead: 4,
      behind: 1,
    });

    expect(result.ok).toBe(false);
    expect(result.action).toBe("blocked_diverged");
  });
});
