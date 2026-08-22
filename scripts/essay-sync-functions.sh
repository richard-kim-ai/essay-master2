#!/usr/bin/env zsh
# essay-master2 동기화 체크리스트 자동화 스크립트
#
# 설치 방법:
#   ~/.zshrc 맨 아래에 아래 한 줄만 추가하세요 (경로는 이 저장소 안의 실제 위치):
#        source "$HOME/Desktop/AI수익화프로젝트/essay-master/scripts/essay-sync-functions.sh"
#   추가 후 새 터미널을 열거나 `source ~/.zshrc` 실행
#
# 저장소 경로가 다르면 아래 ESSAY_MASTER_DIR 값을 본인 환경에 맞게 수정하세요.

export ESSAY_MASTER_DIR="$HOME/Desktop/AI수익화프로젝트/essay-master"

# ── essay-start : 작업 시작 전 체크리스트 (AGENTS.md 1~2단계 자동화) ──────────
essay-start() {
  if [[ ! -d "$ESSAY_MASTER_DIR/.git" ]]; then
    echo "❌ ESSAY_MASTER_DIR 경로가 잘못됐습니다: $ESSAY_MASTER_DIR"
    return 1
  fi

  pushd "$ESSAY_MASTER_DIR" > /dev/null

  echo "🔄 origin 최신 상태 가져오는 중..."
  git fetch origin --quiet

  local behind
  behind=$(git rev-list --count HEAD..origin/main 2>/dev/null)
  local ahead
  ahead=$(git rev-list --count origin/main..HEAD 2>/dev/null)

  echo ""
  echo "── 현재 상태: local main이 origin/main보다 ${ahead}개 앞서고 ${behind}개 뒤처져 있음 ──"

  if [[ "$behind" -gt 0 ]]; then
    echo ""
    echo "⚠️  그 사이 origin/main에 새 커밋이 있습니다 (Manus/Local 등):"
    git log --oneline --no-merges HEAD..origin/main
    echo ""
    echo "   👉 작업 영역이 겹칠 수 있으니, 아래로 todo.md의 Claim 섹션을 확인하고"
    echo "      필요하면 먼저 'git rebase origin/main' 또는 'git merge origin/main'을 실행하세요."
  else
    echo "✅ origin/main과 동일한 최신 상태입니다."
  fi

  echo ""
  echo "── todo.md 진행 중(Claim) 섹션 ──────────────────────────────────────"
  if [[ -f todo.md ]]; then
    awk '/^## 진행 중 \(Claim\)/{flag=1; print; next} /^## /{flag=0} flag' todo.md
  else
    echo "(todo.md 파일을 찾을 수 없습니다)"
  fi
  echo "────────────────────────────────────────────────────────────────────"
  echo ""
  echo "다음 단계: 겹치지 않는 작업임을 확인했다면 todo.md에 본인 Claim을 추가하고"
  echo "  git add todo.md && git commit -m \"docs: claim <작업요약> [local]\""
  echo "먼저 커밋한 뒤 작업을 시작하세요."

  popd > /dev/null
}

# ── essay-check : 장시간 작업 중 재확인용 (AGENTS.md 3단계 자동화) ───────────
essay-check() {
  if [[ ! -d "$ESSAY_MASTER_DIR/.git" ]]; then
    echo "❌ ESSAY_MASTER_DIR 경로가 잘못됐습니다: $ESSAY_MASTER_DIR"
    return 1
  fi
  pushd "$ESSAY_MASTER_DIR" > /dev/null
  git fetch origin --quiet
  local behind
  behind=$(git rev-list --count HEAD..origin/main 2>/dev/null)
  if [[ "$behind" -gt 0 ]]; then
    echo "⚠️  origin/main에 새 커밋 ${behind}개 있음 (작업 중이던 파일과 겹치는지 확인하세요):"
    git log --oneline --no-merges HEAD..origin/main
  else
    echo "✅ 최신 상태 유지 중"
  fi
  popd > /dev/null
}

# ── essay-done : 작업 완료 후 테스트 체크리스트 안내 (AGENTS.md 4단계) ───────
essay-done() {
  echo "완료 체크리스트:"
  echo "  1) todo.md의 Claim 항목을 '## 완료' 섹션으로 이동했는지 확인"
  echo "  2) tsc --noEmit -p . 실행 결과 0 errors 확인"
  echo "  3) pnpm vitest run 실행 결과 전체 통과 확인"
  echo "  4) 위 3개를 모두 확인한 뒤에만 git push"
}

alias essay-start='essay-start'
alias essay-check='essay-check'
alias essay-done='essay-done'
