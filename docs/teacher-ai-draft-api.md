# 교사 승인형 AI 초안·수정 비교 API 설계

> **설계 초안** — 모든 AI 초안은 교사 승인 전 학생에게 공개되지 않는다. 학생 식별 정보는 초안 생성 컨텍스트와 승인 사례에서 최소화·가명처리한다.

## 데이터 흐름

1. 교사가 담당 학생의 제출물을 열고 `generateDraft`를 요청한다.
2. 서버는 교사 프로필의 활성 여부, 담당 학생 권한, 정책 동의 상태를 확인한다.
3. 교사 프로필·승인 사례·루브릭을 컨텍스트로 넣어 구조화된 AI 초안을 생성한다.
4. AI 초안과 교사 최종 수정본을 별도 버전으로 저장하고 비교한다.
5. 교사가 최종 승인한 뒤에만 학생에게 공개한다. 개선 사례 활용은 별도 `learningApproval` 승인 후에만 후보가 된다.

## 제안 tRPC 계약

| 프로시저 | 권한 | 입력 | 출력 | 핵심 안전 장치 |
|---|---|---|---|---|
| `teacherAi.generateDraft` | 승인 교사 | `essayId`, `profileVersion` | `draftId`, `draftComment`, `evaluation` | 담당 학생 확인, 활성 프로필 확인, 모델·토큰 사용 로그 |
| `teacherAi.getDraft` | 작성 교사/관리자 | `draftId` | 초안·수정 버전·상태 | 학생 직접 접근 차단 |
| `teacherAi.saveRevision` | 작성 교사 | `draftId`, `revisedComment`, `changeSummary` | `revisionId`, diff | 교사만 수정, 새 버전 추가 |
| `teacherAi.approveDraft` | 작성 교사 | `draftId`, `revisionId`, `shareWithStudent` | 승인 상태 | 승인 전 학생 공개 금지 |
| `teacherAi.setLearningApproval` | 작성 교사 | `revisionId`, `approved` | 승인 상태 | 가명처리·동의·보관 기간 검증 |
| `teacherAi.withdrawExample` | 작성 교사/관리자 | `exampleId` | 철회 상태 | 신규 AI 컨텍스트에서 즉시 제외 |
| `aiGovernance.reviewExample` | 관리자 | `exampleId`, `status` | 검수 상태 | 교사 승인 뒤 관리자 검수 |

## 초안 생성 응답 JSON

```json
{
  "summary": "답안의 핵심 주장과 현재 논증 상태",
  "rubric": {
    "logic": { "score": 0, "evidence": ["답안 인용"], "feedback": "근거 기반 설명" },
    "evidence": { "score": 0, "evidence": ["답안 인용"], "feedback": "근거 기반 설명" },
    "expression": { "score": 0, "evidence": ["답안 인용"], "feedback": "근거 기반 설명" },
    "structure": { "score": 0, "evidence": ["답안 인용"], "feedback": "근거 기반 설명" }
  },
  "draftComment": "교사 스타일을 반영한 초안",
  "safetyFlags": ["개인정보 가능성", "근거 부족"]
}
```

## 수정 비교 원칙

수정 비교 화면은 **AI 초안 / 교사 최종본 / 변경 요약**을 나란히 보여준다. 학생에게는 교사가 승인한 최종본만 공개하며, AI 초안·승인 사례·운영 메모는 교사와 관리자의 권한 영역에만 남긴다.
