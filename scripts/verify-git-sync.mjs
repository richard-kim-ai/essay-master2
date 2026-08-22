import { execFileSync } from "node:child_process";

export function evaluateGitSync({
  hasUserGithub,
  localOnly,
  githubOnly,
  isWorktreeClean,
  fetchFailures = [],
}) {
  const issues = [];

  if (!hasUserGithub) issues.push("협업 GitHub 원격(user_github)이 설정되어 있지 않습니다.");
  if (fetchFailures.length > 0) issues.push(`원격 최신화 실패: ${fetchFailures.join(", ")}`);
  if (!isWorktreeClean) issues.push("현재 작업 트리에 커밋되지 않은 변경이 있습니다.");
  if (localOnly > 0 || githubOnly > 0) {
    issues.push(`현재 Manus 체크포인트 기준과 user_github/main이 일치하지 않습니다. 현재 기준 전용 ${localOnly}개, GitHub 전용 ${githubOnly}개 커밋`);
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
  const [localOnly = "0", githubOnly = "0"] = refs.split(/\s+/);
  return { localOnly: Number(localOnly), githubOnly: Number(githubOnly) };
}

export function runGitSyncCheck() {
  const remotes = git(["remote"]).split(/\s+/).filter(Boolean);
  const hasUserGithub = remotes.includes("user_github");
  const fetchFailures = [];

  if (hasUserGithub && git(["fetch", "--quiet", "user_github"], { allowFailure: true }) === null) {
    fetchFailures.push("user_github");
  }

  const worktreeStatus = git(["status", "--porcelain"]);
  let localOnly = 0;
  let githubOnly = 0;
  if (hasUserGithub) {
    ({ localOnly, githubOnly } = formatRefCount(git(["rev-list", "--left-right", "--count", "HEAD...user_github/main"])));
  }

  const result = evaluateGitSync({
    hasUserGithub,
    localOnly,
    githubOnly,
    isWorktreeClean: worktreeStatus.length === 0,
    fetchFailures,
  });

  console.log("Git 동기화 상호 검증");
  console.log(`- 현재 Manus 체크포인트 기준 HEAD: ${localOnly}개 단독 커밋`);
  console.log(`- 협업 기준 user_github/main: ${githubOnly}개 단독 커밋`);
  console.log("- Manus origin은 체크포인트 저장 도구가 관리하므로 터미널 직접 fetch는 검사하지 않습니다.");
  console.log(`- 현재 작업 트리: ${worktreeStatus ? "미저장 변경 있음" : "깨끗함"}`);

  if (result.ok) {
    console.log("✓ 현재 Manus 체크포인트 기준, GitHub main, 작업 트리가 동기화되어 있습니다.");
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
