# AGENTS.md

이 저장소(`essay-master2`)는 세 주체가 동시에 작업합니다.

- **Manus** — `origin/main`에 자율적으로, 평균 약 55분 간격으로 직접 커밋합니다.
- **Local** — 사용자 본인 + Claude Code가 사용자의 Mac에서 작업합니다.
- **Codex** (또는 이 파일을 읽는 다른 코딩 에이전트) — 이 문서를 읽는 주체입니다.

세 주체가 같은 로드맵(`todo.md`)을 각자 해석해 같은 파일을 동시에 건드리면서 대규모 병합 충돌이 발생한 이력이 있습니다.
이 문서는 그 재발을 막기 위한 필수 절차입니다. **세션을 시작할 때마다 아래 순서를 예외 없이 따르세요.**

## 1. 작업 시작 전 (필수, 매 세션)

1. `git fetch origin`
2. `git log --oneline HEAD..origin/main` — 마지막으로 본 이후 Manus/Local이 무엇을 바꿨는지 확인
3. `todo.md`의 `## 진행 중 (Claim)` 섹션을 읽고, 다른 주체가 이미 작업 중인 파일/기능 영역과 겹치지 않는지 확인
4. 위에서 변경 사항이 있고 내가 작업하려는 영역과 겹친다면, 새 작업을 시작하기 전에 먼저
   `git rebase origin/main` (충돌이 걱정되면 `git merge origin/main`)으로 반영

이 4단계를 건너뛰고 바로 코드를 수정하지 마세요. 이번 대규모 충돌(로컬 7커밋 vs origin 55커밋, 13개 파일 충돌)은 정확히 이 단계를 생략해서 발생했습니다.

### 원격 이름과 인증 (`origin`이 실패할 때)

이 저장소의 원격은 **같은 GitHub 저장소(`richard-kim-ai/essay-master2`)를 가리키는 두 이름**입니다. 주소 방식만 다릅니다.

| 원격 | 주소 방식 | 비고 |
|---|---|---|
| `origin` | SSH (`git@github.com:...`) | 사용자의 Mac처럼 SSH 키가 있는 환경에서만 동작합니다. Manus 샌드박스 등 키가 없거나 만료된 환경에서는 인증에 실패합니다. |
| `user_github` | HTTPS (`https://github.com/...`) | 토큰으로 접근합니다. `origin`이 실패하면 이쪽을 씁니다. |

- 위 1단계의 `origin`은 **그 환경에서 인증되는 원격으로 바꿔 읽으세요.** `git fetch origin`이 인증 오류로 실패하면 `git fetch user_github`, `git log --oneline HEAD..user_github/main`, `git merge user_github/main`을 씁니다. 두 원격은 같은 저장소라 받는 내용이 같습니다.
- 로컬의 `origin/main`은 푸시하지 않는 쪽의 추적 브랜치라 **낡아 있을 수 있습니다.** 최신 여부는 인증되는 원격을 `fetch`한 뒤 그 원격의 `main`으로 판단하세요.
- 로컬 Claude Code 세션은 `user_github`로 fetch·push합니다(`git push user_github main`).
- **동기화는 항상 병합(또는 리베이스)으로 합니다.** "원격 최신 main을 기준으로 동기화"하더라도 `git reset --hard`, `git checkout -f`, 강제 푸시(`--force`)로 로컬·원격 커밋을 덮어쓰지 마세요. 원격이 앞서 있으면 먼저 병합하고, `tsc --noEmit -p .`와 `pnpm vitest run`을 다시 통과한 뒤에만 푸시합니다.
- 인증 실패는 어느 원격이든 사용자에게 알리고, 토큰·키 값은 출력하거나 커밋하지 마세요.

## 2. 작업 시작 시 — Claim 남기기

실제 코드를 수정하기 전에, `todo.md`의 `## 진행 중 (Claim)` 섹션에 아래 형식으로 한 줄을 추가하고 그 변경만 별도로 커밋합니다.

```
## 진행 중 (Claim)
- [Codex] <작업 요약> — 시작 <YYYY-MM-DD HH:MM>
```

커밋 메시지: `docs: claim <작업 요약> [codex]`

이미 같은 영역이 Claim되어 있다면 그 작업이 끝날 때까지 다른 영역을 먼저 진행하거나, 사용자에게 조율을 요청하세요.

## 3. 작업 중

- 2~3시간 이상 이어지는 세션에서는, 특히 `schema.ts` / `server/db.ts` / `server/routers.ts`처럼 여러 기능이 공유하는 핵심 파일을 수정하기 직전에 `git fetch origin`으로 다시 확인
- 커밋은 작은 단위로 나누고, 관련 없는 변경을 한 커밋에 섞지 않음
- 커밋 메시지에 건드린 파일/기능 범위를 구체적으로 명시

## 4. 작업 완료 후

1. `todo.md`의 해당 Claim 항목을 `## 완료` 섹션으로 이동하고 커밋
2. 병합/푸시 전 반드시 아래를 모두 그린으로 확인:
   - `tsc --noEmit -p .`
   - `pnpm vitest run`

## 5. 충돌이 발생했을 때 (표준 절차)

1. `git merge-base HEAD origin/main` — 마지막 공통 조상 확인
2. `git log --oneline --no-merges <base>..HEAD` 와 `<base>..origin/main` 으로 양쪽이 각각 무엇을 했는지 나열
3. 파일 단위로 "완전히 다른 파일(무충돌 병합 가능)"과 "실제 로직 충돌"을 구분
4. 로직 충돌 원칙: **더 최근/더 발전된 구현을 base로 삼고, 상대측의 고유 기능을 포팅한다**
   (예: origin의 CSV 업로드 아키텍처를 base로 하고, local의 human-review 체크리스트 기능을 이식)
5. 병합 후 `tsc --noEmit -p .` + `pnpm vitest run` 그린 확인 후에만 push

## 참고

- 이 파일은 Codex 등 저장소 루트의 `AGENTS.md`를 자동으로 읽는 에이전트를 위한 것입니다. Manus는 이 파일을 자동으로 읽지 않으므로, 동일한 규칙을 Manus 프로젝트 설정(시스템 프롬프트)에 별도로 등록해야 합니다.
- 이 파일의 규칙이 실제로 지켜지고 있는지는 `todo.md`의 Claim 섹션에 항목이 꾸준히 쌓이는지로 확인할 수 있습니다. Claim 없이 커밋이 계속 들어온다면 이 파일이 무시되고 있다는 신호입니다.
