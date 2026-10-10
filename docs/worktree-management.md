# 로컬 작업 폴더 관리

기준 폴더는 `essay-master`, 기준 브랜치는 `main`입니다.

- `essay-master-evaluation-integration`: 평가 통합 작업용 worktree. 동기화 브랜치는 `sync/evaluation-integration-current`.
- `essay-master-reconcile`: 병합 검증용 worktree. 동기화 브랜치는 `sync/reconcile-current`.
- 기존 `feat/evaluation-platform-integration`, `manus/reconcile-local-github-main` 브랜치는 이전 작업 기록으로 보존합니다.

세 폴더는 같은 Git 저장소를 공유하지만 파일 변경은 자동으로 전파되지 않습니다. 일반 수정은 기준 폴더에서 진행하고, 별도 폴더에서 새 기능을 개발할 때는 최신 main에서 작업 브랜치를 만들고 AGENTS.md의 Claim 절차를 따릅니다. 비밀 설정(.env), node_modules, 빌드 결과는 폴더별로 관리합니다.

## 이후 동기화

먼저 세 폴더에서 `git status --short`를 확인합니다. 미커밋 변경은 검토·커밋하거나 따로 보존하며, 강제 초기화하지 않습니다. 기준 폴더에서 원격 인증을 확인하고 `git fetch origin`으로 원격 변경을 검토합니다. main을 업데이트한 뒤 TypeScript와 Vitest를 검증합니다.

각 별도 폴더에서 작업 내용이 없는 것을 확인한 뒤 다음 명령을 실행합니다.

```sh
git merge --ff-only main
```

동기화 브랜치에 고유 커밋이 있어 fast-forward가 불가능하면 중단하고 차이를 검토합니다. 새 작업은 `git switch -c <작업-브랜치> main`으로 시작합니다. 과거 보존 브랜치를 현재 main에 무조건 병합하지 않습니다.

## 이번 동기화

2026-10-11: 두 worktree의 이전 계정 Git 경로를 복구하고 현재 main 기준의 동기화 브랜치로 통일했습니다. 기준 폴더의 미커밋 Pricing.tsx 변경은 별도 폴더에도 동일하게 복사하여 보존합니다. 이 변경이 남아 있는 동안 이후 동기화 전에 세 사본을 검토해야 합니다.
