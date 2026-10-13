# 화면 로딩 속도 최적화 기록 (2026-10-13)

화면 로딩이 느리다는 제보에 따라 빌드 산출물과 운영 서버를 실측하고, 원인별로 개선했습니다.
측정은 `npm run build` 뒤 `NODE_ENV=production node dist/index.js`를 띄워 `curl`로 전송 바이트를 잰 값입니다. 브라우저 체감 시간(LCP 등)은 측정하지 않았습니다.

## 1. 진단

| 순위 | 원인 | 근거 |
|---|---|---|
| 1 | 응답 압축 없음 | Express에 압축 설정이 없어 진입 JS 305kB·`index.html` 371kB가 원본 그대로 전송 |
| 2 | 정적 파일 캐시 없음 | 해시가 붙은 `assets/*`도 매 방문 재검증, `index.html` 정책 없음 |
| 3 | `index.html`의 인라인 Manus 런타임 | 367kB 스크립트가 `<body>` 맨 앞에서 파싱·실행됨 (§4 참고) |
| 4 | 카카오 SDK가 동기 스크립트 | `<head>`에서 외부 CDN을 받는 동안 화면 표시 지연 |
| 5 | 요청마다 DB 쓰기 | 인증이 모든 API 요청에서 `lastSignedIn`을 UPDATE |
| 6 | 인덱스 사실상 없음 | 스키마에 보조 인덱스가 0개(유니크 3개 제외), `userId`·`email` 조회가 전체 스캔 |
| 7 | 개수만 필요한데 전체 행 조회 | 관리자 통계·AI 호출 횟수 조회가 테이블을 통째로 읽음 |
| 8 | 진입 번들에 라이브러리 혼재 | 앱 코드가 바뀔 때마다 react-dom 등도 다시 내려받음 |

이미 양호했던 것: 라우트 51개 전부 `lazy` 분할, `staleTime` 60초·포커스 재요청 없음·tRPC 배치, 서비스 워커는 API 미개입, 100kB 넘는 이미지 없음, `jspdf`/`html2canvas`는 동적 import.

## 2. 개선 내용

| 구분 | 변경 | 파일 |
|---|---|---|
| 압축 | 빌드 후 `.br`/`.gz` 사전 압축, 서버가 `Accept-Encoding`에 맞춰 전송(실행 중 CPU 비용 없음) | `scripts/precompress.mjs`, `server/_core/staticAssets.ts`, `package.json`(build) |
| 압축 | tRPC JSON 응답 1kB 이상이면 gzip | `server/_core/staticAssets.ts`, `server/_core/index.ts` |
| 캐시 | `assets/*` 1년 `immutable`, `index.html` `no-cache`, 기타 1시간 | `server/_core/staticAssets.ts`, `server/_core/vite.ts` |
| 렌더링 | 카카오 SDK `defer` + `load` 뒤 초기화 | `client/index.html` |
| 번들 | react / 데이터(trpc·react-query) / UI(radix) 청크 분리 | `vite.config.ts` |
| 서버 | `lastSignedIn`을 5분에 한 번만 기록 | `server/_core/sdk.ts` |
| DB | 인덱스 30개(`users.email`, 각 테이블 `userId` 등) | `drizzle/schema.ts`, `drizzle/0052_performance_indexes.sql` |
| DB | 개수 조회를 `COUNT(*)`로 변경(관리자 통계, AI 호출 횟수) | `server/db.ts` |
| 도구 | 마이그레이션 스크립트가 일반 `CREATE INDEX`를 멱등 적용 | `scripts/apply-migration.mjs` |

## 3. 측정 결과 (운영 모드, 전송 바이트)

| 파일 | 원본 | gzip | brotli | 감소 |
|---|---|---|---|---|
| `index.html` | 371,536 | 106,701 | 90,946 | 76% |
| 진입 JS `index-*.js` | 305,696 | 57,314 | 46,052 | 85% |
| `vendor-react-*.js` | 397,288 | 116,878 | 96,678 | 76% |

- 사전 압축: 79개 파일 4,865kB → brotli 868kB.
- 진입 번들은 891kB(gzip 236kB) → 306kB(gzip 58kB)로 쪼개졌으며 라이브러리 청크 합계는 이전과 비슷합니다. **첫 방문 이득은 압축에서, 분리의 이득은 재배포 후 캐시 재사용에서** 나옵니다.
- 헤더 확인: `assets/*`는 `Content-Encoding: br`, `Cache-Control: public, max-age=31536000, immutable`, `Vary: Accept-Encoding`. `index.html`은 `no-cache`. SPA 경로(`/mypage`)도 동일하게 압축 응답.
- 배포 환경(Manus)의 프록시가 이미 압축하고 있었다면 개선 폭은 위 수치보다 작을 수 있습니다.

## 4. Manus 런타임 인라인 스크립트 제거 (적용됨)

`vite-plugin-manus-runtime`이 모든 HTML에 367kB 스크립트를 인라인으로 넣고 있었습니다. 사용자가 제거를 선택해 `package.json`의 `build`에 `DISABLE_MANUS_RUNTIME=true`를 고정했습니다(`vite.config.ts`가 이 값을 빌드 때 읽음).

- `index.html`: 371,536 → 4,165바이트(brotli 1,146바이트). `manus-runtime` 문자열 0건.
- 운영 빌드를 가짜 DB로 띄워 헤드리스 Chrome으로 `/login`, `/`가 정상 렌더링되는 것까지 확인했습니다. Manus 플랫폼 쪽 기능(미리보기·배포·관리)은 확인하지 못했습니다.
- 문제가 생기면 `package.json`의 build에서 `DISABLE_MANUS_RUNTIME=true `만 지우면 원래대로 돌아갑니다. 개발 서버(`pnpm dev`)는 이 값을 주지 않아 그대로 켜져 있습니다.
- 로컬 빌드에서 `VITE_ANALYTICS_ENDPOINT`가 비어 있으면 분석 스크립트가 `/umami`로 빌드되어 콘솔에 `Unexpected token '<'`가 납니다(런타임 제거와 무관, 기존 동작).

## 5. 배포 시 해야 할 일

1. `node scripts/apply-migration.mjs drizzle/0052_performance_indexes.sql` (계획 확인) → `--apply`. 이미 있는 인덱스는 건너뛰므로 재실행해도 안전합니다. 테이블이 클수록 인덱스 생성에 시간이 걸리니 사용량이 적은 시간에 실행하세요.
2. 인덱스는 코드가 배포되기 전에 먼저 적용해도 안전합니다(조회만 빨라짐).

## 6. 남은 과제

- 같은 방식으로 전체 행을 읽는 목록·통계 쿼리(`server/db.ts`의 사용자 전체, 학습 진도 전체, 문제은행·퀴즈 답안 전체 조회). 관리자 화면 위주지만 데이터가 늘면 느려집니다.
- `/dashboard-detail`(`Dashboard-*.js` 521kB, recharts)는 지연 로딩이라 첫 화면엔 영향이 없지만, 해당 화면에서는 무겁습니다.
- 인덱스가 실제로 쓰이는지는 운영 DB에서 `EXPLAIN`으로 확인이 필요합니다(로컬 DB 없이 SQL 생성만 검증함).
- 브라우저 실측(Lighthouse/LCP)은 미실시.
