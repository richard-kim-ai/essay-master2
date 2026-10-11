# 논술 마스터 (Essay Master) — 사이트 개요

> 기준: 2026-10-13, main `88536ff`. 코드(`client/`, `server/`, `shared/`, `drizzle/`, `scripts/`)와 `todo.md`·`docs/`를 직접 확인해 작성했습니다.
> 루트 `README.md`는 Next.js·Prisma를 가정한 초기 기획 초안이라 현재 구현과 다릅니다. 현재 상태는 이 문서를 기준으로 봅니다.
> 확인하지 못한 부분은 본문에 "미확인"으로 표시했습니다.

목차: 1 개념 · 2 사용자와 권한 · 3 기술 구조 · 4 화면 지도 · 5 학습 콘텐츠 · 6 AI 기능 · 7 교사·학부모·기관 · 8 가입·동의·인증 · 9 결제·이용권 · 10 데이터 모델 · 11 운영·배포 · 12 한계와 남은 과제 · 13 관련 문서

---

## 1. 기본 개념

**논술 마스터**는 『논술의 기초』 교재(한국저작권위원회 등록번호 C-2026-044488)를 바탕으로 한 AI 논술 학습 플랫폼입니다.
문장 → 단락 → 요약 → 주제 설정 → 실전 논술 순으로 이론과 실습을 이어 가고, AI 첨삭과 교사 첨삭을 함께 제공합니다.

| 항목 | 내용 |
|---|---|
| 학습 과정 4개 | 초등 `elementary` · 중고등 `middle_high` · 고등·대입 `high_univ` · 일반·직장인 `general_adult` |
| 학습 흐름 | 이론 레슨 → 워크북(객관식·서술형) → 학습 도구 6종 → 논술 제출 → AI/교사 첨삭 → 오답 노트 → 수료증 |
| 핵심 원칙 | ① AI가 만든 교사용 초안은 교사 검토·승인 뒤에만 학생에게 공개 ② AI 품질 개선용 데이터 활용은 선택 동의 ③ 만 14세 미만(초등 가입)은 보호자 이메일 동의 ④ 정답·점수는 서버가 판정 |
| 운영 주체 | 굳프렌드 주식회사 / DBOOKS · 문의 ceo@ufinsu.com |
| 저작권 표기 | 푸터에 저작물명·등록번호·번호 복사·한국저작권위원회 확인 링크 (`client/src/lib/contact.ts`의 `COPYRIGHT_INFO`, 번호를 비우면 숨김) |

---

## 2. 사용자와 권한

`users.role`: `user` · `teacher` · `admin`. 학부모와 기관은 별도 role이 아니라 연결 관계·계약으로 표현합니다. 학생의 과정은 `users.tag`(기본 "일반")를 `shared/course.ts`로 과정 코드에 매핑합니다.

| 주체 | 설명 | 주요 화면 |
|---|---|---|
| 학생 (`user`) | 가입 시 과정 선택. 담당 교사는 가입 후 마이페이지에서 선택(미선택 시 AI 첨삭 전용 봇이 기본 담당) | 마이페이지, 학습 도구, 워크북, 논술 제출 |
| 학부모 | 자녀와 연결(학생 승인 필요), 학습 현황 열람·코멘트 | `/parent-portal` |
| 교사 (`teacher`) | `teacherStatus` pending/approved/rejected, `teacherLevel` 1 주니어 · 2 시니어 · 3 수석(커리큘럼·반 관리). 승인 후 활동 | `/teacher-mypage`, `/teacher/*` |
| 관리자 (`admin`) | 콘텐츠·회원·결제·정책 관리. 세분화된 교사 권한 부여(`teacher_permission_grants`) 별도 | `/admin/*`, `/master-admin` |
| 기관 | 계약(`institution_contracts`)과 소속 회원·반 연결로 비용·정산 처리 | 관리자 결제 화면의 기관 계약 탭 |

---

## 3. 기술 구조

| 계층 | 구성 |
|---|---|
| 클라이언트 | React 19, Vite 7, wouter, Tailwind 4, Radix UI, tRPC 클라이언트 (`client/src`) |
| 서버 | Express 4 + tRPC 11 + zod. 진입 `server/_core/index.ts`, 라우터 `server/routers.ts`(+ `billingRouter.ts`, `institutionRouter.ts`) |
| DB | MySQL + Drizzle ORM. `drizzle/schema.ts`(테이블 73개), 마이그레이션 SQL 54개(최신 0051) |
| 공유 | `shared/` — `plans.ts`(이용권), `course.ts`, `nextPath.ts`, `institution.ts` 등 |
| 파일 저장 | S3 호환 스토리지(`@aws-sdk/client-s3`), `/manus-storage/*` 프록시 |
| 인증 | 이메일·비밀번호 + JWT 쿠키 세션. 세션에 비밀번호 해시 지문(`pv`) 연결 → 비밀번호 변경·재설정 시 기존 세션 무효. 소셜 로그인(Google·카카오·네이버)은 관리자 설정 시에만 노출. Manus OAuth(`/api/oauth/callback`)는 `OWNER_OPEN_ID` 계정에만 관리자 자동 부여 |
| 메일 | Resend (인증·비밀번호 재설정·보호자 동의·관리자 일괄 안내) |
| AI | 외부 LLM(`server/_core/llm.ts`). 글 평가 `writingEvaluationEngine.ts`, 교정 `writingCorrectionEngine.ts`, 문장 피드백 `sentenceFeedbackEngine.ts`, 평가 모델 레지스트리 `evaluationModelRegistry.ts`, 이론 생성 `theoryLessonContent.ts`, 문항 생성 `questionGeneration.ts` |
| 알림 | 앱 내 알림(`app_notifications`) + 웹 푸시(`push.ts`) |
| HTTP 엔드포인트 | `/api/trpc`, `/api/oauth/callback`, `/api/social/:provider/start|callback`, `/api/scheduled/question-bank-trash-cleanup`(휴지통 정리 배치), `/manus-storage/*` |
| 품질 | Vitest 약 400개, `tsc --noEmit`, GitHub Actions CI |
| 협업 | Manus(자율 커밋)·Local(사용자+Claude Code)·Codex. 절차 `AGENTS.md`, 현황 `todo.md` |

---

## 4. 화면 지도 (경로는 `client/src/App.tsx` 기준)

### 4.1 공개
| 경로 | 화면 |
|---|---|
| `/` | 홈 |
| `/pricing` | 요금 정책 — 7일 무료 체험, 학습형, AI 기본형, AI 집중형, AI 추가권, 교사·기관 문의 |
| `/sample` | 샘플 체험 — 저장 없이 4개 과정 둘러보기, 제한된 AI 첨삭 체험 |
| `/curriculum`, `/curriculum/:courseType/:level` | 커리큘럼 소개·상세 |
| `/essay-archive`, 학습 도구 6종 | 비로그인 시 **미리보기**(클릭·입력·서버 요청 차단, 클릭하면 로그인 팝업) |

### 4.2 계정
`/login` · `/signup` · `/teacher-signup` · `/verify-email` · `/guardian-consent` · `/forgot-password` · `/reset-password`

### 4.3 학생
| 경로 | 화면 |
|---|---|
| `/mypage`, `/dashboard` | 마이페이지 허브: 학습 현황, **담당 교사 선택**, **AI 개인 맞춤 첨삭 동의/철회**, 학부모 연결 승인 |
| `/dashboard-detail` | 상세 학습 대시보드 |
| `/workbook/:courseType/:level` | 레벨별 워크북 |
| `/essay-submission` | 논술 제출 |
| `/ai-auto-feedback`, `/ai-feedback-compare/:id` | AI 자동 첨삭, 비교 |
| `/teacher-feedback/:essayId` | 교사 첨삭 확인 |
| `/my-assignments` | 반 과제 제출 |
| `/offline-essays` | 오프라인 논술 |
| `/certificate` | 수료증 |
| `/notifications` | 알림 |
| `/checkout` | 이용권 결제 |
| `/writing-examples` | 승인된 글쓰기 예시 라이브러리 |
| `/ai-guide-history` | AI 학습 가이드 이력 |
| `/essay-archive` | **아카이브**(논술 아카이브 & 주간 학습 플래너) |

### 4.4 학습 도구 6종
AI 문장 교정 `/quiz` · 단락 재구성 `/paragraph-reordering` · 요약 연습 `/summary-practice` · 오답 노트 `/mistake-notebook` · 주제 설정 `/topic-wizard` · 주제문 점검 `/thesis-checklist`

### 4.5 교사·학부모
`/teacher-mypage`(담당 학생·반·첨삭·과제·출결·공지) · `/teacher/writing-examples` · `/teacher/settlement` · `/parent-portal`

### 4.6 관리자
| 경로 | 기능 |
|---|---|
| `/admin` | 운영 대시보드 (통계, 일괄 공지) |
| `/admin/curriculum` | 고등·대입/일반·직장인 등 커리큘럼 카테고리 추가·수정·순서·복제·활성 전환 |
| `/admin/theory-content` | 이론 레슨 콘텐츠 생성(AI 미리보기)·검수·승인·반려 |
| `/admin/lesson-connections` | 레슨–워크북 연결 |
| `/admin/question-bank` | 문제은행 (CSV 가져오기, AI 문항 생성, 휴지통, 난이도, 피드백) |
| `/admin/evaluation-models` | AI 평가 모델, 운영 지표, 검수 큐 |
| `/admin/ai-governance` | AI 학습 데이터 거버넌스 |
| `/admin/terms` | 이용약관·개인정보처리방침·가격환불정책(푸터 팝업에 반영), 사이트 설정(회사 정보 등) |
| `/admin/guardian-consents` | 보호자 동의 관리대장 (재발송·철회) |
| `/admin/social-providers` | 소셜 로그인 제공자 설정 |
| `/admin/certificates` | 수료증, 승인 정책·요청 |
| `/admin/billing` | 결제·환불·이용권·교사 정산·기관 계약 |
| `/admin/academic-permissions` | 교사 세부 권한 부여 |
| `/admin/student/:id` | 학생 상세 |
| `/master-admin` | 마스터 관리 콘솔 (전체 회원·역할, 관리자 계정 생성, 교사 승인·레벨 조정, 학습 그룹, 감사 로그) |

### 4.7 공통 요소
- 헤더: 커리큘럼 · 아카이브 · 요금정책 · 학습 도구(6종 하위 메뉴) · 로그인/회원가입. 푸터 메뉴는 헤더와 같은 순서.
- 푸터: 회사 정보, 교사 회원가입 링크, 저작권등록 표기.
- 레이아웃: 공개 화면·인증 화면(AuthLayout)·로그인 후 화면(Layout) 통일, 브랜드 색 인디고.

---

## 5. 학습 콘텐츠

### 5.1 과정별 레벨
**초등 (4레벨, `Curriculum.tsx` 정적 데이터)**
| Level | 제목 | 내용 |
|---|---|---|
| 1 | 재미있는 낱말과 문장 | 낱말 익히기, 짧은 문장 만들기, 주어-서술어 |
| 2 | 이야기 만들기 | 그림으로 이야기 꾸미기, 문장 연결, 육하원칙 |
| 3 | 생각 정리하기 | 핵심 찾기, 요약, 내 의견 표현 |
| 4 | 상상력 키우기 | 동화·편지·일기(창의적 글쓰기) |

**중고등 (4레벨, 정적 데이터)**
| Level | 제목 | 내용 | 연결 도구 |
|---|---|---|---|
| 1 | 문장의 기초 | 어휘 선택, 문장 성분 호응, 경제성·명료성·정확성 | AI 문장 교정 |
| 2 | 단락의 논리적 연결 | 소주제문·뒷받침, 연역·귀납·시간·공간적 전개 | 단락 재구성 |
| 3 | 구조적 분석 및 요약 | 서론-본론-결론, 개요, 요약 규칙 | 요약 연습 |
| 4 | 비판적 사고와 주제 설정 | 제시문 분석, 견해 논증, 가주제→참주제 | 주제 설정 위저드 |

**고등·대입 (3레벨, DB `dynamic_curriculum` 시드)**: ① 인문·사회 제시문 심층 분석 ② 수리·과학적 사고와 논증 ③ 대학별 모의논술 실전 파이널

**일반·직장인 (3레벨, 같은 시드)**: ① 비즈니스 기획서와 보고서 작성법 ② 논리적 설득 스피치와 논설문 ③ 실무 에세이 및 칼럼 기고문

- 고등·대입/일반·직장인은 정적 목록이 비어 있고 DB에서 읽습니다. 관리자가 수정할 수 있어 시드 값과 운영 값이 다를 수 있습니다.
- `dynamic_curriculum`: 제목·설명·주제(JSON)·AI 요약·AI 태그·샘플 PDF·활성 여부. 요약·태그는 LLM 생성, 실패 시 기본 문구.

### 5.2 이론 레슨 (`lesson_theory_content`)
- 구성: 과정 · 레슨 레벨 · 이론 카테고리/하위 카테고리 · 예시 모드(`TEXTBOOK_SIMILAR`/`TEXTBOOK_PLUS_NEW`) · 본문 JSON · 출처 메모 · 활성 여부.
- 단원 구성: 핵심 개념 → 교재 원리 → 유사 예시 → 틀린 예/고친 예 → 레슨 내 확인 문제 → 다음 단계. 교재 원문과 신규 예시는 구분 표시.
- 기본 시드(`scripts/seed-theory-lessons.mjs`): 단원 4개 × 과정 4개 = **16개**.
  | 카테고리 | 하위 카테고리 | 단원 |
  |---|---|---|
  | A01 | 경제성 | 필요한 만큼만 쓰기 |
  | B04 | 통일성과 일관성 | 한 단락에 하나의 중심 생각 |
  | C01 | 삭제와 핵심 보존 | 요약할 때 버릴 것과 남길 것 |
  | D03 | 참주제와 주제문 | 넓은 소재를 쓸 수 있는 주장으로 좁히기 |
  시드의 레슨 레벨은 초등 1, 중고등 2, 고등·대입 3, 일반·직장인 2. 고등·대입/일반 과정에는 지문·과제·모범답안·연습 문항이 추가됩니다.
- 나머지 카테고리 체계(A01~D03 사이 전체 코드표)는 교재 정리본 기반이며 코드로 한 곳에 정의되어 있지 않아 **미확인**. 관리자 `/admin/theory-content`에서 AI 생성·검수로 늘립니다.
- 학습자 진행: `lesson_theory_progress`(확인 문제 완료). 생성 API의 레슨 레벨 입력 범위는 1~5.

### 5.3 워크북·문제은행
- 문제은행 `question_bank`(과정·유형·난이도), 휴지통 `question_bank_trash`와 자동 정리 설정, 작업 로그, 학습자 피드백·북마크.
- 워크북 `curriculum_workbook_questions` / `_answers`, 레슨 연결 `workbook_lesson_connections`, 오답 `workbook_mistakes`·`learning_tool_mistakes`.
- **학습자 응답에서 정답·해설·정답 순서는 제거**되고 제출 결과로만 반환(교사·관리자는 원본). 단락 재구성은 서버가 섞음.
- 진행 기록은 서버가 채점 답안으로 계산: 레벨의 모든 문항을 풀고 평균 60점 이상이면 완료. 클라이언트가 보낸 점수·완료 값은 쓰지 않음.

### 5.4 학습 도구 6종
| 도구 | 내용 |
|---|---|
| AI 문장 교정 (`/quiz`) | 비문 교정 퀴즈, 서버 판정, 상세 문장 피드백(캐시 `sentence_feedback_cache`) |
| 단락 재구성 | 섞인 단락 순서 맞추기, 서버 판정 |
| 요약 연습 | 요약 규칙 적용 연습 |
| 오답 노트 | 틀린 문항 복습·삭제 |
| 주제 설정 위저드 | 가주제 → 참주제, 가이드 |
| 주제문 점검 | 주제문 체크리스트·분석 |
시도 기록은 `learning_tool_attempts`에 저장.

### 5.5 수료증·배지
레벨별 수료증(입력 검증·소유자 검사), 공유 토큰 조회, 관리자 발급·취소, 교사 요청·승인 정책(`certificate_approval_*`). 배지 `user_badges`, 주간 요약, 알림. **PDF는 발급하는 순간에만 브라우저에서 만들어 내려받고 서버에는 남기지 않으며**, 관리자 화면에는 압축 이미지(WebP/JPEG, 약 20kB)로 보관·조회(`certificate_archives`).

---

## 6. AI 기능

| 기능 | 설명 |
|---|---|
| 글 평가 엔진 | 서술형 글을 항목별(논리·구조·표현 등) 점수와 보완점으로 평가. 마스터 프롬프트 v1.1(`docs/evaluation-master-prompt-v1.1.md`). 평가 기록 `writing_evaluation_records`, 검수 큐, 이의 제기 `evaluation_appeals` |
| AI 자동 첨삭 (`aiAutoFeedback`) | 학생이 글을 제출하면 AI가 첨삭. 일일/기간 한도 조회(`getTodayQuota`, `getWeeklyUsage`). 사용량은 선예약해 동시 요청 초과를 막고, AI 대체 결과·저장 실패 시 횟수 환불 |
| 개인 맞춤 첨삭 | **AI 품질 개선용 학습 데이터 활용에 동의한 학생에게만** 최근 첨삭 5건의 요약(평균 점수·약한 항목·반복 보완점, 글 본문 제외)을 시스템 프롬프트에 추가. 응답에 `personalized` 표시, 화면에 "개인 맞춤 첨삭 적용" 배지. 마이페이지에서 켜기/철회, 철회 시 `withdraw_ai_learning` 처리 요청 기록 |
| 교사 AI 보조 (`teacherAi`) | 교사별 프로필·스타일 예시(`teacher_ai_*`)로 AI 초안 생성 → 교사 수정(개정 이력) → 승인해야 학생에게 공개. 승인 전 AI 호출은 횟수 제한 |
| 반 과제 AI 피드백 | `class_assignment_ai_feedbacks` |
| 샘플 체험 AI | 세션 3회·IP 10회/24시간·300자 제한(`sample_ai_usage_log`) |
| 문항·이론 생성 | 관리자 AI 문항 생성(미리보기→저장), 이론 레슨 생성(초안→승인) |
| 거버넌스 | 승인된 교사 사례만 가명처리·검수 후 AI 컨텍스트에 포함, 모델 재학습으로 직접 전송하지 않음 (`docs/ai-learning-data-governance-policy.md`) |

---

## 7. 교사·학부모·기관

### 7.1 교사
- 가입(`/teacher-signup`) → 관리자 승인(`/master-admin`의 `approveTeacher`) → 활동. 필수 동의: AI 보조 봇 운영·승인 규정 등.
- 담당 학생 관리, 반(학습 그룹), 출결, 공지, 과제 생성·검토, 첨삭 템플릿, 월별 과제 통계·마감 임박 알림.
- 첨삭 작성·수정·코멘트는 **배정 교사·관리자만**. 글 조회는 글 주인·배정 교사·관리자.
- 글쓰기 예시 게시(`approved_writing_examples`)와 철회. 수료 승인 요청.
- 정산(`/teacher/settlement`): 활동 시점 정책 스냅샷 기준 집계, 활동별 수동 제외(사유 필수), 월별 정산서 확인.

### 7.2 학부모
학부모가 자녀를 연결 요청 → 학생이 승인해야 열람. 자녀 학습 현황과 코멘트 작성.

### 7.3 기관
계약별 이용 방식: **기간제**(기간 중 횟수 무제한, 사용 횟수는 기록) / **횟수제**(예산 소진 시 차단 또는 경고 후 계속, 초과 기록). 소속 회원·반 연결, 예산의 원자적 차감과 환불, 정산 제외, 감사 기록. 상세 `docs/institution-contracts.md`.

---

## 8. 가입·동의·인증

### 8.1 가입 화면 (`/signup`)
- 필드를 최소화: 이메일·비밀번호·이름·과정 선택. **교사 선택은 가입 후 마이페이지에서**.
- 초등 과정 선택 시: 생년월일과 보호자 정보를 **팝업**으로 입력(`GuardianInfoDialog`).
- 가입 전 필수 확인·동의: 각 문서를 **팝업으로 열어 읽고 "내용을 확인했습니다(동의)"를 누르면 자동 체크**. 선택 항목(AI 품질 개선용 학습 데이터 활용)은 "동의합니다/동의하지 않음". 선택에 동의하지 않아도 서비스 이용에는 영향 없음.
- 소셜 로그인 아이콘(Google·카카오·네이버)은 로그인·가입 화면에서 **관리자 설정이 완료된 제공자만** 표시, 아무것도 설정되지 않았으면 영역 전체 숨김.

### 8.2 동의 모델
`policy_documents`(policyKey: terms_of_service, privacy_policy, ai_learning_consent, teacher_ai_code; 버전·필수 여부·대상 역할) + `user_policy_consents`(accepted/withdrawn, 철회 시각, 증빙). 사용자별 최신 행이 현재 상태. 관리자는 `/admin/terms`에서 문서 관리.

### 8.3 만 14세 미만 보호자 동의
초등 과정 가입자 → 보호자 이메일로 동의 메일 → `/guardian-consent`에서 확인 전까지 로그인 차단. 관리자 재발송·철회(철회는 즉시 적용). 재발송은 로그인 화면에서도 가능.

### 8.4 계정 보안
- 이메일 인증, 비밀번호 재설정(토큰 원자적 1회 사용, 메일 링크 주소는 `PUBLIC_BASE_URL`로 고정).
- 로그인·메일·가입 시도 제한(인메모리 제한기).
- 메일 발송 실패 원문은 사용자에게 보여 주지 않고 서버 로그에만 기록(가입 여부 노출 방지).
- 세션-비밀번호 연결: 비밀번호를 바꾸면 기존 로그인 전부 무효. 소셜 전용 계정은 영향 없음.
- 소셜 로그인: state 쿠키 검증, `next` 복귀 경로 검증, 제공자 시크릿은 암호화 저장.

---

## 9. 결제·이용권

| 항목 | 내용 |
|---|---|
| 이용권 정의 | `shared/plans.ts` 한 곳(가격·환불정책 1·5조와 동일): 학습형 14,900원/30일(AI 0회) · AI 기본형 24,900원/30일(AI 10회) · AI 집중형 39,900원/30일(AI 20회) · AI 추가권 14,900원/90일(AI 10회, 중복 구매). 30일 상품은 결제 후 '유료 이용 시작'을 눌러야 기간이 시작되고(`subscriptions.awaitingStart`), 추가권은 구매일부터 시작 |
| 7일 무료 체험 | 가입일부터 7일, 계정 체험 AI 평가·첨삭 2회(`trialPolicy.ts`) + 샘플 체험 1회 = 무료 총 3회 |
| AI 차감 순서 | 기관 계약 > (무료 체험분 먼저 → 유료 이용권은 먼저 만료되는 것부터, 같으면 먼저 산 것부터). 이용권별로 `essay_feedback:<이용권 id>`로 기록·예약(`server/billing/entitlements.ts`, `service.ts`). 교사·관리자는 학습자용 한도 대상 아님 |
| 결제 | 제공자 추상화(`PAYMENT_PROVIDER`)와 **임시 mock 결제**. 실제 PG 미연동 |
| 교사 첨삭지도권(횟수권) | 이용권 결제자가 앱 안에서 일반 첨삭 1종을 1회분 6,900원·3회분 19,900원·5회분 31,900원(구매일부터 90일)으로 구매하고, 신청할 때마다 1회 차감(`teacher_feedback_passes`, `teacher_feedback_requests`). 완료 예정일=신청일부터 3영업일, 전달 전 취소 시 횟수 복원, 신청 없는 글은 교사가 첨삭 등록 불가(기관 계약 학생 예외). 교사 지급은 계약급여로 별건 |
| 이용권 화면 | `/checkout`: 플랜 조회, 결제 시작, 구독 취소(결제 기간 끝까지 유효) |
| 관리자 | 결제 요약·주문·구독·환불, 교사 정산 산출·대사·확정·지급 표시, 단가·원천징수율 설정 |
| 교사 정산 | 확정 정산서는 초안 갱신이 덮어쓰지 못함, 테스트 주문은 매출 제외 |

---

## 10. 데이터 모델 (73개 테이블)

| 영역 | 테이블 |
|---|---|
| 계정·권한 | `users`, `parent_student_links`, `guardian_consents`, `teacher_permission_grants`, `admin_audit_logs`, `admin_memo_history`, `site_settings`, `app_secret_config`, `social_provider_config` |
| 정책·동의 | `policy_documents`, `user_policy_consents`, `data_processing_requests` |
| 커리큘럼·이론 | `curriculum`, `dynamic_curriculum`, `lesson_theory_content`, `lesson_theory_drafts`, `lesson_theory_progress`, `workbook_lesson_connections` |
| 문제·워크북 | `question_bank`, `question_bank_trash`, `question_bank_maintenance_settings`, `question_bank_operation_logs`, `question_feedbacks`, `question_bookmarks`, `curriculum_workbook_questions`, `curriculum_workbook_answers`, `workbook_mistakes`, `workbook_teacher_feedback`, `learning_tool_mistakes`, `learning_tool_attempts`, `quiz_answer`, `sentence_feedback_cache` |
| 진행·성과 | `progress`, `certificate`, `certificate_archives`, `certificate_approval_policies`, `certificate_approval_requests`, `user_badges`, `ai_lesson_guide_histories` |
| 논술·첨삭 | `essay_submission`, `teacher_feedback`, `teacher_feedback_passes`, `teacher_feedback_requests`, `feedback_comment`, `teacher_feedback_templates`, `approved_writing_examples` |
| AI | `ai_auto_feedback`, `ai_usage_logs`, `sample_ai_usage_log`, `evaluation_model_configs`, `writing_evaluation_records`, `evaluation_model_operations`, `evaluation_review_queue`, `evaluation_appeals`, `teacher_ai_profiles`, `teacher_ai_style_examples`, `teacher_ai_drafts`, `teacher_ai_draft_revisions` |
| 반 운영 | `learning_groups`, `learning_group_members`, `class_attendance`, `class_announcements`, `class_assignments`, `class_assignment_submissions`, `class_assignment_ai_feedbacks` |
| 알림 | `app_notifications`, `push_subscription` |
| 결제·정산 | `payment_orders`, `subscriptions`, `teacher_settlement_rates`, `teacher_settlements` |
| 기관 | `institution_contracts`, `institution_members`, `institution_usage`, `teacher_activity_accounting`, `institution_audit_logs` |

---

## 11. 운영·배포

### 11.1 환경 변수 (코드에서 참조되는 것)
`DATABASE_URL` · `JWT_SECRET` · `PORT` · `NODE_ENV` · `PUBLIC_BASE_URL`(메일 링크·소셜 콜백 기준) · `RESEND_API_KEY` · `EMAIL_FROM`(Resend에서 인증한 도메인의 주소) · `OWNER_OPEN_ID` · `OAUTH_SERVER_URL` · `VITE_APP_ID` · `BUILT_IN_FORGE_API_URL` / `BUILT_IN_FORGE_API_KEY`(LLM·스토리지) · `PAYMENT_PROVIDER` · `TRUSTED_PROXY_HOPS`(클라이언트 IP 판별)

### 11.2 명령
| 명령 | 용도 |
|---|---|
| `pnpm dev` / `build` / `start` | 개발·빌드·운영 실행 |
| `pnpm check` / `test` | 타입 검사 / Vitest |
| `pnpm db:migrate`, `scripts/apply-migration.mjs <sql> --apply` | 마이그레이션 (0047~0051은 수동 적용) |
| `pnpm local-db:up|down|logs` | 로컬 MySQL(Docker) |
| `scripts/seed-curriculum.mjs`, `seed-theory-lessons.mjs` | 커리큘럼·이론 시드 |
| `scripts/import-question-bank-csv.mjs`, `replace-…`, `audit-…` | 문제은행 CSV 가져오기·교체·점검 |
| `scripts/seed_course_test_accounts.mjs` | 과정별 테스트 계정 |
| `pnpm git:sync:check`, `scripts/sync-main.sh` | Git 동기화 |

### 11.3 협업 규칙 (`AGENTS.md`)
작업 전 `git fetch` → `todo.md` Claim 확인 → Claim 커밋 → 작은 커밋 → 완료로 이동 → `tsc`·`vitest` 통과 후 푸시. 강제 푸시 금지.

---

## 12. 한계와 남은 과제

| 구분 | 내용 |
|---|---|
| 결제 | 실제 PG 미연동(mock). 연동 시 `docs/payment-integration.md` |
| DB 반영 | 0047~0051을 순서대로 수동 적용해야 함 |
| 운영 설정 | Resend `EMAIL_FROM` 도메인 일치·재시작, `PUBLIC_BASE_URL`, 소셜 제공자 키와 Redirect URI |
| 배포 영향 | 세션-비밀번호 연결 도입으로 비밀번호 계정은 배포 후 1회 재로그인 |
| 관리자 생성 | 첫 관리자는 Manus OAuth(`OWNER_OPEN_ID`)로만 자동 부여. Manus 없이 쓰려면 `npx tsx scripts/set-login-password.mts <이메일> --apply [--make-admin] [--name "이름"]`로 비밀번호 설정·관리자 생성(기본은 계획만 출력) |
| AI 동의 연동 | 맞춤 학습 가이드(`difficultyLearningGuide`)·문장 맞춤 피드백은 아직 동의와 연동되지 않음 |
| 정책 | 워크북 서술형 AI 평가 횟수, 소셜 가입 시 과정 선택, 문항별 제출 횟수 제한 |
| 데이터 무결성 | 교사 첨삭 DB 유니크 제약, 정산 경합 처리 |
| 안정성 | 보호자 동의·가입 메일 실패 시 안전 발송 래퍼 미적용, 시도 제한이 인메모리라 다중 인스턴스에 부적합 |
| 검증 | 최근 다수 화면(가입 팝업, 마이페이지 설정, 소셜 아이콘, 푸터 복사, 결제, 기관 계약)은 육안 확인 미실시 |
| 법무 | 개인정보처리방침·AI 데이터 정책·보호자 동의 문구는 법률 검토 전 초안 |
| 미확인 | 이론 카테고리 코드 전체표, 홈 화면 세부 구성, 각 관리자 화면의 모든 버튼 동작 |

---

## 13. 관련 문서

| 문서 | 용도 |
|---|---|
| `AGENTS.md` | 3주체 협업 절차 |
| `todo.md` | 진행(Claim)·완료·로드맵 |
| `ESSAY_MASTER_MINDMAP.md/.mmd`, `docs/current-work-mindmap.md` | 마인드맵 |
| `docs/institution-contracts.md` | 기관 계약·정산 제외 |
| `docs/teacher-feedback-purchase-design.md` | 교사 첨삭지도권(횟수권) 설계·구현 기록 |
| `docs/payment-integration.md` | 결제 연동 |
| `docs/ai-learning-data-governance-policy.md` | AI 학습 데이터 정책 |
| `docs/privacy-policy-under14-section.md` | 만 14세 미만 개인정보처리방침 초안 |
| `docs/evaluation-master-prompt-v1.1.md`, `docs/AI_논술_글쓰기_평가엔진_v1.1_기술.md` | 글 평가 엔진 |
| `docs/teacher-ai-draft-api.md` | 교사 AI 초안 |
| `docs/runtime-efficiency-policy.md` | 런타임 효율 정책 |
| `docs/loading-performance.md` | 화면 로딩 속도 최적화 기록·측정·남은 과제 |
| `docs/development-work-boundaries.md`, `docs/worktree-management.md`, `docs/github-actions-sync.md` | 개발 경계·동기화 |
