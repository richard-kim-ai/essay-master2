# 현 기준 문제은행 생성 보고서

- 생성일: 2026-08-18
- 파일: `generated/question-bank/question_bank_current_master_200.csv`
- 총 문항 수: 200
- 기존 courseType 분포: {'elementary': 50, 'middle_high': 50, 'high_univ': 50, 'general_adult': 50}
- 도구 분포: {'quiz': 40, 'reordering': 40, 'summary': 40, 'topic_wizard': 40, 'thesis_checklist': 40}
- 세부 커리큘럼 단계 분포: {'초등고학년': 50, '중학생': 50, '고등학생': 25, '대입수험생': 25, '일반인/직장인': 50}
- TOPIK 분포: {'TOPIK 3': 50, 'TOPIK 4': 50, 'TOPIK 5': 25, 'TOPIK 6 심화': 25, 'TOPIK 6 실무': 50}
- 문장 교정 필터 분포: {'불필요한 반복과 사족 제거': 8, '같은 어휘와 의미의 반복 삭제': 8, "'~의 가지는'을 '~이 지닌', '~에서 나타나는'으로 전환": 8, '명사형 주어와 서술어 짝 맞추기': 4, '이중 피동을 능동 또는 단순 피동으로 전환': 4, "'~함에 있어서', '~에 대한 확인'을 자연스러운 서술 구조로 전환": 4, "'좋은 시간을 가졌다', '그것은 중요하다'를 자연스러운 한국어 구조로 전환": 4}
- 검증 상태: 통과

## 반영 기준

- `docs/question-bank-master-prompt.md`의 최신 마스터 프롬프트 기준을 반영했습니다.
- 초등고학년, 중학생, 고등학생, 대입수험생, 일반인/직장인 5단계 세부 프로필을 `contentData`에 포함했습니다.
- TOPIK 3, TOPIK 4, TOPIK 5, TOPIK 6 심화, TOPIK 6 실무 기준을 반영했습니다.
- 주술 호응, 이중 피동, 영어식 소유 표현, 명사화 과다, 외국어 직역투 필터를 모든 문항 메타데이터에 포함했습니다.
- `concept_integration`, `ordering_logic`, 요약 alias 필드(`main_topic`, `key_claim`, `essential_points`, `removable_details`, `model_summary`)를 보강했습니다.

## 검증 항목

- 필수 메타데이터 누락
- TOPIK 매핑 오류
- 정답 유효성
- 정답 내 비문 잔존
- 조사 오류 및 사족 반복
- 8회 초과 반복 노출 문장
- 중복 제목/지문
