# GitHub Actions 자동 검증과 로컬 동기화

## 자동으로 처리되는 범위

`.github/workflows/ci.yml`은 `main`에 push되거나 `main` 대상 pull request가 생성될 때 `pnpm install --frozen-lockfile`, `pnpm check`, `pnpm test`, `pnpm run build`를 순서대로 실행합니다. 테스트와 빌드가 실패하면 해당 실행은 실패하며, 성공한 빌드의 `dist/`는 7일 동안 Actions artifact로 보관됩니다.

GitHub Actions의 호스팅 러너는 개발자의 개인 PC 폴더에 직접 접근하지 않습니다. 개인 PC에 원격 `main`을 자동 반영하려면 `scripts/sync-main.sh`를 로컬에서 실행하도록 운영체제의 스케줄러를 등록해야 합니다.

## 로컬 동기화 스크립트

스크립트는 다음 조건에서만 fast-forward 동기화를 수행합니다.

| 검사 | 결과 |
|---|---|
| 현재 브랜치가 `main`이 아님 | 중단 |
| 추적되지 않은 파일 또는 로컬 수정이 있음 | 중단 |
| 로컬과 원격 이력이 분기됨 | 중단 후 수동 병합 요구 |
| 원격이 로컬보다 앞섬 | `git pull --ff-only` 실행 |
| 이미 같은 커밋임 | 성공 메시지만 출력 |

따라서 로컬에서 작업 중인 파일을 자동으로 덮어쓰지 않습니다. 프로젝트 경로는 `PROJECT_DIR` 환경 변수로 지정할 수 있고, 원격과 브랜치는 `SYNC_REMOTE`, `SYNC_BRANCH`로 변경할 수 있습니다.

```bash
cd /내/로컬/essay-master
PROJECT_DIR="$PWD" SYNC_REMOTE=origin SYNC_BRANCH=main ./scripts/sync-main.sh
```

## Linux·macOS 주기 실행

`crontab -e`에서 10분 주기를 등록할 수 있습니다.

```cron
*/10 * * * * cd /내/로컬/essay-master && PROJECT_DIR=/내/로컬/essay-master SYNC_REMOTE=origin SYNC_BRANCH=main ./scripts/sync-main.sh >> /내/로컬/essay-master/sync.log 2>&1
```

처음에는 스케줄 등록 전에 수동으로 실행해 원격 이름과 권한을 확인합니다.

```bash
cd /내/로컬/essay-master
git remote -v
git status
./scripts/sync-main.sh
```

Windows에서는 작업 스케줄러에서 `bash.exe` 또는 Git Bash를 10분 주기로 실행하도록 등록하면 됩니다. 로컬 변경이 있을 때는 스크립트가 실패하고 상태를 출력하므로, 로그를 확인한 후 직접 커밋하거나 별도 브랜치로 이동해야 합니다.

## 보안 및 운영 원칙

GitHub Actions에는 데이터베이스 비밀번호, API 키, `.env` 파일을 저장하지 않습니다. 현재 workflow는 저장소 읽기 권한만 사용하며, 별도의 미러 저장소 push 토큰을 추가하지 않습니다. `main` 보호 규칙에서 CI 성공을 필수 검사로 설정하면 타입 검사·테스트·빌드가 실패한 변경을 병합하지 않도록 할 수 있습니다.

로컬→원격 자동 push는 자동 충돌, 잘못된 커밋, 개인정보·비밀정보 업로드 위험이 있어 기본 설정에 포함하지 않았습니다. 필요한 경우에도 별도 브랜치와 pull request를 사용하고, 자동 `force push`는 사용하지 않는 것이 안전합니다.
