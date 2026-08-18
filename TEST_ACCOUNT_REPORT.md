# 과정별 테스트 계정 및 과제 권한 검증 기록

생성일: 2026-08-18

본 기록은 논술 마스터의 과정별 학생·교사 권한 흐름을 점검하기 위해 만든 전용 QA 계정의 배정 현황입니다. 계정 비밀번호는 코드와 저장소에 기록하지 않았으며, 운영자가 별도로 전달받은 임시 비밀번호를 사용해야 합니다.

| 과정 | 담당 교사 테스트 계정 | 학생 테스트 계정 | 전용 반 | 검증 결과 |
|---|---|---|---|---|
| 초등 | qa.teacher.elementary.a@essaymaster.test | qa.student.elementary.a@essaymaster.test | QA 테스트 · 초등 A반 | 제출·AI 초안 생성·교사 채점·학생 결과 조회 확인 |
| 초등 | qa.teacher.elementary.b@essaymaster.test | qa.student.elementary.b@essaymaster.test | QA 테스트 · 초등 B반 | 제출·교사 채점·학생 결과 조회 확인 |
| 중고등 | qa.teacher.middlehigh@essaymaster.test | qa.student.middlehigh@essaymaster.test | QA 테스트 · 중고등 논술반 | 제출·교사 채점·학생 결과 조회 확인 |
| 고등/대입 | qa.teacher.highuniv@essaymaster.test | qa.student.highuniv@essaymaster.test | QA 테스트 · 고등/대입 논술반 | 제출·교사 채점·학생 결과 조회 확인 |
| 일반/직장인 | qa.teacher.generaladult@essaymaster.test | qa.student.generaladult@essaymaster.test | QA 테스트 · 일반/직장인 논술반 | 제출·교사 채점·학생 결과 조회 확인 |

## 검증 범위

각 테스트 학생은 해당 과정의 전용 반에 편성되고, 해당 반의 승인 교사가 담당 교사와 추천 교사로 지정되었습니다. 교사가 반 과제를 배정한 뒤 학생이 답안을 제출하고, 담당 교사만 제출물을 조회·채점할 수 있음을 확인했습니다. 초등 A반에서는 교사 검토 완료 후에만 AI 1차 첨삭이 학생 조회 결과에 포함됨도 확인했습니다.

## 발견 및 조치

반 편성 함수가 빈 배열을 참조값으로 평가해 학생 추가를 건너뛰던 결함을 수정했습니다. 이제 기존 편성 레코드가 실제로 있을 때만 중복 삽입을 막고, 비어 있는 반에는 첫 학생이 정상적으로 추가됩니다.
