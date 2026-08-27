#!/usr/bin/env bash
set -euo pipefail

PROJECT_DIR="${PROJECT_DIR:-$(git rev-parse --show-toplevel 2>/dev/null || true)}"
REMOTE="${SYNC_REMOTE:-origin}"
BRANCH="${SYNC_BRANCH:-main}"

if [[ -z "$PROJECT_DIR" || ! -d "$PROJECT_DIR/.git" ]]; then
  echo "Git 프로젝트 폴더를 찾지 못했습니다. PROJECT_DIR을 지정하세요." >&2
  exit 1
fi

cd "$PROJECT_DIR"
current_branch="$(git branch --show-current)"
if [[ "$current_branch" != "$BRANCH" ]]; then
  echo "현재 브랜치가 $BRANCH가 아니므로 동기화를 중단했습니다: ${current_branch:-detached}" >&2
  exit 1
fi

if [[ -n "$(git status --porcelain)" ]]; then
  echo "로컬 변경 사항이 있어 자동 동기화를 중단했습니다." >&2
  git status --short
  exit 1
fi

git fetch "$REMOTE" "$BRANCH"
local_sha="$(git rev-parse HEAD)"
remote_sha="$(git rev-parse "$REMOTE/$BRANCH")"

if [[ "$local_sha" == "$remote_sha" ]]; then
  echo "[$(date -u '+%Y-%m-%dT%H:%M:%SZ')] 이미 최신 상태입니다: $remote_sha"
  exit 0
fi

if ! git merge-base --is-ancestor HEAD "$REMOTE/$BRANCH"; then
  echo "원격과 로컬 이력이 분기되어 자동 동기화를 중단했습니다." >&2
  echo "수동 검토가 필요합니다: $local_sha ↔ $remote_sha" >&2
  exit 1
fi

git pull --ff-only "$REMOTE" "$BRANCH"
echo "[$(date -u '+%Y-%m-%dT%H:%M:%SZ')] 동기화 완료: $remote_sha"
