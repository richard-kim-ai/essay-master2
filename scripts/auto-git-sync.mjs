import { execFileSync } from "node:child_process";

export function evaluateAutoSyncDecision({
  hasOrigin,
  fetchFailed = false,
  isWorktreeClean,
  ahead,
  behind,
}) {
  const issues = [];

  if (!hasOrigin) issues.push("origin 원격이 설정되어 있지 않습니다.");
  if (fetchFailed) issues.push("origin 최신화에 실패했습니다.");

  if (issues.length > 0) return { ok: false, action: "blocked", issues };
  if (behind === 0) return { ok: true, action: "up_to_date", issues: [] };

  if (!isWorktreeClean) {
    return {
      ok: false,
      action: "blocked_dirty",
      issues: [`origin/main보다 ${behind}개 커밋 뒤처져 있지만 커밋되지 않은 로컬 변경이 있어 자동 병합하지 않았습니다.`],
    };
  }

  if (ahead > 0 && behind > 0) {
    return {
      ok: false,
      action: "blocked_diverged",
      issues: [`로컬과 origin/main이 분기되었습니다. 로컬 전용 ${ahead}개, 원격 전용 ${behind}개 커밋이 있습니다.`],
    };
  }

  return { ok: true, action: "fast_forward", issues: [] };
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

function parseAheadBehind(value) {
  const [ahead = "0", behind = "0"] = value.split(/\s+/);
  return { ahead: Number(ahead), behind: Number(behind) };
}

export function runAutoGitSync() {
  const remotes = git(["remote"]).split(/\s+/).filter(Boolean);
  const hasOrigin = remotes.includes("origin");
  const fetchFailed = hasOrigin && git(["fetch", "--quiet", "origin"], { allowFailure: true }) === null;
  const isWorktreeClean = git(["status", "--porcelain"]).length === 0;
  const counts = hasOrigin && !fetchFailed
    ? parseAheadBehind(git(["rev-list", "--left-right", "--count", "HEAD...origin/main"]))
    : { ahead: 0, behind: 0 };

  const decision = evaluateAutoSyncDecision({
    hasOrigin,
    fetchFailed,
    isWorktreeClean,
    ahead: counts.ahead,
    behind: counts.behind,
  });

  console.log("Git 자동 최신화 확인");
  console.log(`- 로컬 전용 커밋: ${counts.ahead}개`);
  console.log(`- origin/main 전용 커밋: ${counts.behind}개`);
  console.log(`- 작업 트리: ${isWorktreeClean ? "깨끗함" : "미커밋 변경 있음"}`);

  if (!decision.ok) {
    console.error("✗ 자동 최신화 중단");
    for (const issue of decision.issues) console.error(`  - ${issue}`);
    console.error("  로컬 변경을 먼저 커밋하거나 백업 브랜치로 보호한 뒤 병합하세요.");
    return 1;
  }

  if (decision.action === "fast_forward") {
    git(["merge", "--ff-only", "origin/main"]);
    console.log("✓ origin/main 최신 커밋을 fast-forward로 반영했습니다.");
    return 0;
  }

  console.log("✓ 이미 origin/main 최신 상태입니다.");
  return 0;
}

if (process.argv[1] && import.meta.url === new URL(`file://${process.argv[1]}`).href) {
  process.exitCode = runAutoGitSync();
}
