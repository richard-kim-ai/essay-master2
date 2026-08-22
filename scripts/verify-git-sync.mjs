import { execFileSync } from "node:child_process";

export function evaluateGitSync({
  hasOrigin,
  hasUserGithub,
  originOnly,
  githubOnly,
  isWorktreeClean,
  fetchFailures = [],
}) {
  const issues = [];

  if (!hasOrigin) issues.push("Manus 원격(origin)이 설정되어 있지 않습니다.");
  if (!hasUserGithub) issues.push("협업 GitHub 원격(user_github)이 설정되어 있지 않습니다.");
  if (fetchFailures.length > 0) issues.push(`원격 최신화 실패: ${fetchFailures.join(", ")}`);
  if (!isWorktreeClean) issues.push("현재 작업 트리에 커밋되지 않은 변경이 있습니다.");
  if (originOnly > 0 || githubOnly > 0) {
    issues.push(`두 main 기준이 일치하지 않습니다. origin 전용 ${originOnly}개, user_github 전용 ${githubOnly}개 커밋`);
  }

  return { ok: issues.length === 0, issues };
}

function git(args, { allowFailure = false } = {}) {
  try {
    return execFileSync("git", args, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
  } catch (error) {
    if (allowFailure) return null;
    const detail = error.stderr?.toString().trim() || error.message;
    throw new Error(detail);
  }
}

function formatRefCount(refs) {
  const [originOnly = "0", githubOnly = "0"] = refs.split(/\s+/);
  return { originOnly: Number(originOnly), githubOnly: Number(githubOnly) };
}

export function runGitSyncCheck() {
  const remotes = git(["remote"]).split(/\s+/).filter(Boolean);
  const hasOrigin = remotes.includes("origin");
  const hasUserGithub = remotes.includes("user_github");
  const fetchFailures = [];

  for (const remote of ["origin", "user_github"]) {
    if (!remotes.includes(remote)) continue;
    if (git(["fetch", "--quiet", remote], { allowFailure: true }) === null) {
      if (remote === "user_github") fetchFailures.push(remote);
      else console.warn("! origin 자동 최신화가 제한되어 마지막으로 확인된 origin/main 참조를 사용합니다.");
    }
  }

  const worktreeStatus = git(["status", "--porcelain"]);
  let originOnly = 0;
  let githubOnly = 0;
  if (hasOrigin && hasUserGithub) {
    ({ originOnly, githubOnly } = formatRefCount(git(["rev-list", "--left-right", "--count", "origin/main...user_github/main"])));
  }

  const result = evaluateGitSync({
    hasOrigin,
    hasUserGithub,
    originOnly,
    githubOnly,
    isWorktreeClean: worktreeStatus.length === 0,
    fetchFailures,
  });

  console.log("Git 동기화 상호 검증");
  console.log(`- Manus 기준 origin/main: ${originOnly}개 단독 커밋`);
  console.log(`- 협업 기준 user_github/main: ${githubOnly}개 단독 커밋`);
  console.log(`- 현재 작업 트리: ${worktreeStatus ? "미저장 변경 있음" : "깨끗함"}`);

  if (result.ok) {
    console.log("✓ 두 원격의 main 기준과 현재 작업 트리가 동기화되어 있습니다.");
    return 0;
  }

  console.error("✗ Git 동기화 점검 실패");
  for (const issue of result.issues) console.error(`  - ${issue}`);
  console.error("  다음 작업 전에는 git fetch user_github && git merge --ff-only user_github/main으로 협업 기준을 반영하고, 체크포인트 저장으로 Manus origin을 갱신하세요.");
  return 1;
}

if (process.argv[1] && import.meta.url === new URL(`file://${process.argv[1]}`).href) {
  process.exitCode = runGitSyncCheck();
}
