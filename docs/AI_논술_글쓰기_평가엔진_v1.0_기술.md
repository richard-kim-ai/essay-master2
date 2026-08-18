# AI 논술·글쓰기 평가엔진 v1.0 기술 문서

## 1. 설계 목적

AI 논술·글쓰기 평가엔진 v1.0은 Essay Master의 기존 `논술의 기초` 교육 시스템과 `문제생성 Master Prompt`를 침범하지 않는 독립형 평가 모듈이다. 문제를 만드는 규칙과 글을 평가하는 규칙을 합치지 않고, 최소 메타데이터만 공유해 서비스 안에서 서로 충돌하지 않도록 설계한다.

이 엔진은 학생 글을 단순 점수화하지 않는다. 학생 글의 논제 이해, 중심생각, 이유, 근거, 논리 전개, 반론 처리, 문단 구성, 문장 표현을 분리해 진단하고, 기존 학생 글 데이터를 추가해 평가 시뮬레이션 학습 자료로 재사용할 수 있게 한다.

## 2. 평가 표현 정책

기존의 강한 제재형 표현은 사용하지 않는다. 평가 결과는 학생 지도와 운영 판정에 맞게 다음 용어로 바꾼다.

| 변경 전 용어 | 변경 표현 | 사용 상황 |
|---|---|---|
| 단어 선택 제재 | 표현 보완 지적 | 부정확한 단어 선택이나 어색한 표현을 고칠 때 |
| 감점 제재 | 평가 감점 사유 | 점수 산출 근거를 설명할 때 |
| 규칙 위반 제재 | 재작성 요청 | 분량, 형식, 필수 요소가 크게 부족할 때 |
| 평가 불가 | 평가 보류 또는 각하 | 답안이 공란, 무관한 내용, 복사문 등으로 평가 대상이 아닐 때 |
| 학생 잘못 | 보완 필요 지점 | 학습자가 수정해야 할 항목을 제시할 때 |

기본 피드백 톤은 `지도형`이다. 운영자가 별도 화면에서 강한 표현을 원할 경우 `질타형 지적`을 선택할 수 있으나, 학생 화면에는 인격 판단이나 비난을 노출하지 않는다.

## 3. 독립 운영 구조

```text
[문제생성 엔진]
  - question-bank-master-prompt.md
  - 문제, 보기, 정답, 해설 생성
  - 평가엔진의 루브릭과 채점 규칙을 소유하지 않음

        최소 공유 메타데이터만 전달

[AI 논술·글쓰기 평가엔진 v1.0]
  - 평가 Master Prompt
  - 평가 competency
  - rubric/error-pattern/feedback 데이터
  - 학생 글 시뮬레이션 학습 기능
  - 평가 API/서비스 레이어
```

공유 필드는 다음으로 제한한다.

| 필드 | 설명 | 예 |
|---|---|---|
| `curriculum_code` | 과정 코드 | `BASIC_WRITING` |
| `theory_category` | 이론 범주 | `claim_evidence_link` |
| `education_level` | 학습자 수준 | `middle_high` |
| `difficulty` | 난이도 | `3` |
| `writing_type` | 글 유형 | `ARGUMENTATIVE` |
| `task_id` | 문제 ID | `QB-001` |
| `prompt` | 학생에게 제시된 문제 | `스마트폰 사용 제한에 대해 논술하시오.` |

문제생성 Master Prompt 전문, 평가 Master Prompt 전문, 내부 점수 가중치 원본은 서로 공유하지 않는다.

## 4. `논술의 기초` 원론과 평가 competency 매핑

| 논술의 기초 원론 | 평가 competency | 평가 질문 |
|---|---|---|
| 논제 이해 | `task_understanding` | 논제가 묻는 대상과 조건을 파악했는가? |
| 중심생각/주장 | `central_claim` | 글 전체의 중심 주장이 분명한가? |
| 이유 | `reasoning_basis` | 주장을 뒷받침하는 이유가 있는가? |
| 근거 | `evidence_use` | 사례, 경험, 자료, 비교가 제시되었는가? |
| 주장-근거 연결 | `claim_evidence_link` | 근거가 왜 주장을 뒷받침하는지 설명했는가? |
| 논리적 추론 | `logical_inference` | 전제에서 결론까지 비약 없이 이어지는가? |
| 반론/재반박 | `counterargument_response` | 다른 관점을 검토하고 한계를 설명했는가? |
| 구조 | `macro_structure` | 서론-본론-결론 또는 문제-주장-근거-결론 흐름이 있는가? |
| 문단 | `paragraphing` | 한 문단에 하나의 중심 내용이 담겼는가? |
| 연결/일관성 | `coherence` | 문장과 문단이 자연스럽게 이어지는가? |
| 문장 표현 | `sentence_expression` | 문장이 명확하고 학습 수준에 맞는가? |
| 문법/맞춤법 | `language_conventions` | 기본 언어 규범을 지켰는가? |

## 5. 평가 결과 구조

| 평가 영역 | competency | 배점 |
|---|---|---:|
| 과제·논제 이해 | `task_understanding` | 10 |
| 내용·사고력 | `central_claim`, `reasoning_basis` | 15 |
| 주장·논증 | `evidence_use`, `claim_evidence_link`, `logical_inference` | 25 |
| 반론·비판 | `counterargument_response` | 10 |
| 구성·문단 | `macro_structure`, `paragraphing` | 15 |
| 연결·일관성 | `coherence` | 10 |
| 표현·언어규범 | `sentence_expression`, `language_conventions` | 15 |

## 6. 기존 학생 글 데이터 기반 시뮬레이션 학습

기존 학생 글 데이터는 평가엔진의 규칙을 바꾸는 데이터가 아니라, 평가 결과를 비교하고 보정 후보를 찾는 `시뮬레이션 학습 데이터`로 사용한다.

```text
[essay_submission]
  - 학생 원문
  - 제목
  - 과정/커리큘럼 ID

[ai_auto_feedback]
  - 과거 AI 점수
  - 강점/약점/수정 제안

        ↓

[Simulation Dataset Builder]
  - 학생 ID 비식별 처리
  - 글 길이, 문단 수, 문장 수 추출
  - 기존 평가 점수와 새 평가엔진 결과 비교

        ↓

[Simulation Learning Report]
  - 평균 점수
  - 반복 오류 패턴
  - 과거 점수와 새 점수의 편차
  - 다음 학습 권장 theory_category
  - 루브릭 보정 후보
```

개인정보 보호를 위해 시뮬레이션 결과에는 원문 전체를 기본 저장하지 않는다. 필요한 경우 120자 미리보기만 사용한다.

## 7. API 예시

### 단일 평가 요청

```json
{
  "metadata": {
    "task_id": "SIM-001",
    "curriculum_code": "BASIC_WRITING",
    "theory_category": "claim_reason_evidence",
    "education_level": "middle_high",
    "difficulty": 3,
    "writing_type": "ARGUMENTATIVE"
  },
  "task": {
    "prompt": "청소년 스마트폰 사용 시간을 제한해야 하는지 논술하시오.",
    "constraints": { "min_chars": 600, "max_chars": 1200 }
  },
  "submission": {
    "learner_id": "U00001",
    "essay_text": "저는 청소년의 스마트폰 사용 시간을 어느 정도 제한해야 한다고 생각합니다..."
  }
}
```

### 시뮬레이션 요청

```json
{
  "metadata": {
    "curriculum_code": "BASIC_WRITING",
    "theory_category": "claim_evidence_link",
    "education_level": "middle_high",
    "difficulty": 3,
    "writing_type": "ARGUMENTATIVE"
  },
  "task": {
    "prompt": "기존 학생 글 데이터를 평가엔진 v1.0으로 재평가한다."
  },
  "samples": [
    {
      "sample_id": "essay-101",
      "learner_id": "student-1",
      "essay_text": "저는 학교에서 휴대폰 사용을 제한해야 한다고 생각합니다...",
      "previous_score": 72
    }
  ]
}
```

## 8. 서비스 적용 위치

이번 구현은 기존 `server/aiFeedback.ts`를 대체하지 않는다. 독립 평가엔진은 별도 파일로 추가한다.

```text
server/writingEvaluationEngine.ts
server/writingEvaluationSimulation.ts
server/writingCorrectionEngine.ts
docs/AI_논술_글쓰기_평가엔진_v1.0_기술.md
docs/evaluation-master-prompt-v1.md
generated/evaluation-engine/
```

`server/routers.ts`에는 `writingEvaluationEngine` 라우터를 추가해 다음 기능을 제공한다.

| API | 기능 |
|---|---|
| `writingEvaluationEngine.evaluate` | 단일 글 평가 |
| `writingEvaluationEngine.evaluateAndCorrect` | 단일 글 평가와 사용자용 AI 첨삭문 생성 |
| `writingEvaluationEngine.simulate` | 전달된 샘플 글 배열 시뮬레이션 |
| `writingEvaluationEngine.simulateMyEssays` | 로그인한 사용자의 기존 글 데이터로 시뮬레이션 |

### 자유작문 사용자 흐름

```text
자유작문 입력
→ 글 유형·학습 수준 확인
→ 구조·문장 분석
→ 평가 점수 산출
→ 문장별 첨삭
→ 개선문 제안
→ 학생 수준별 설명
→ 재작성 과제
→ 재평가
```

`evaluateAndCorrect`의 첨삭 결과는 평가 점수를 대신하는 모범답안이 아니다. 원문의 의도와 학생의 목소리를 유지하면서 보완 이유를 설명하고, 학생이 직접 다시 써 볼 수 있게 하는 학습용 결과다.

## 9. 유사 서비스 대비 포지셔닝

| 항목 | 논술마스터(자사) | ai-nonsool.kr | nonsoolmate.com |
|---|---|---|---|
| 주 타깃 | 초등부터 일반인까지 자기주도 학습자 | 교사·기관 중심 | 대입 논술 수험생 |
| 핵심 가치 | 커리큘럼, 평가, 자유작문 첨삭, 게이미피케이션의 결합 | AI 자동 채점과 교사 검토 | 전문 교사의 유료 첨삭 |
| 피드백 방식 | 즉시 AI 평가·첨삭과 재작성·재평가 | AI 채점 중심 | 사람 첨삭 중심 |
| 차별화 | 기존 학생 글 시뮬레이션, 성장 추적, 전 연령 루브릭 | 채점 워크플로우 | 대학별 기출과 사람의 깊은 코멘트 |

자사의 직접 경쟁 포인트는 단순히 더 높은 점수를 제공하는 것이 아니라, `평가 → 첨삭 → 재작성 → 재평가 → 성장 기록`을 하나의 학습 루프로 제공하는 것이다. 기존 AI 첨삭 화면은 호환성을 유지하고, 신규 엔진의 `evaluateAndCorrect` API를 자유작문 전용 진입점으로 연결한다.

## 10. 운영 규칙

1. 평가엔진은 문제생성 Master Prompt를 수정하지 않는다.
2. 기존 학생 글은 루브릭 자동 변경이 아니라 시뮬레이션 리포트 생성에만 사용한다.
3. 실제 루브릭 변경은 관리자 또는 교사 검토 후 반영한다.
4. 학생에게는 `보완 필요`, `재작성 요청`, `평가 보류`를 사용한다.
5. 평가 보류 또는 각하는 공란, 무관 답안, 복사문처럼 학습 평가가 불가능한 경우에만 사용한다.
