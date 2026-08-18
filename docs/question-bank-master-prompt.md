# Essay Master 공통 문항 생성·QA 엔진

관리자 AI 문항 생성, 미리보기 개별·일괄 승인, CSV 업로드·덮어쓰기는 모두 서버 측 공통 QA를 통과합니다. 생성은 `server/questionGeneration.ts`의 Master Prompt와 구조화된 짧은 User Prompt를 사용하고, 저장 직전에는 빈 문항, placeholder, 중복, 객관식 정답, 도구별 JSON 구조, 난이도 메트릭을 다시 검사합니다.

| 구간 | 공통 처리 |
| --- | --- |
| AI 생성 | 과정·도구·이론 분류·1~5 난이도·소재 입력, 구조화 JSON 응답 |
| 미리보기 | QA 상태·차단 사유·중복 유사도 표시, JSON 편집 후 재검증 |
| 저장 | 개별 생성 승인, 일괄 승인, CSV 업로드·Upsert 모두 서버 QA 재실행 |

기존 `question_bank.difficulty`는 `easy`·`medium`·`hard`를 유지합니다. 세부 난이도 1~5와 7개 난이도 메트릭은 `contentData`에 보존해 기존 학습 도구와 호환합니다.
