# AI 논술·글쓰기 평가엔진 v1.0 적용 자료

이 폴더는 평가엔진 운영에 필요한 스키마와 샘플 데이터를 모아 둔 위치입니다.

## 파일

- `evaluation.schema.json`: 단일 평가 요청 검증 스키마
- `correction.schema.json`: 사용자용 첨삭 결과 검증 스키마
- `rubric.sample.json`: 기본 루브릭 및 표현 정책
- `error-patterns.sample.json`: 오류 패턴 샘플
- `feedback.sample.json`: 피드백 템플릿 샘플
- `student-simulation.sample.json`: 기존 학생 글 데이터 기반 시뮬레이션 요청 예시

## 서버 연결

구현 파일은 다음 위치에 있습니다.

- `server/writingEvaluationEngine.ts`
- `server/writingEvaluationSimulation.ts`
- `server/writingCorrectionEngine.ts`
- `server/routers.ts`의 `writingEvaluationEngine` 라우터

## 호출 가능한 기능

- `writingEvaluationEngine.evaluate`: 단일 글 평가
- `writingEvaluationEngine.evaluateAndCorrect`: 평가와 실제 사용자용 첨삭문 생성
- `writingEvaluationEngine.simulate`: 샘플 배열 기반 시뮬레이션
- `writingEvaluationEngine.simulateMyEssays`: 로그인한 학생의 기존 글 데이터 기반 시뮬레이션

## 표현 정책

학생 화면에는 강한 제재형 표현을 쓰지 않습니다. 대신 `표현 보완 지적`, `재작성 요청`, `평가 보류`, `각하`를 사용합니다.
