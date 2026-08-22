# 교사별 AI 보조 봇·동의 기반 데이터 처리 설계 근거

## 연구 메모

교사 첨삭 사례를 AI 개선에 사용할 때에는 자동 재학습보다 승인된 고품질 사례·독립 평가 세트·프롬프트 개선을 먼저 운영한다. 작은 양의 정제된 사례가 대량의 저품질 사례보다 효과적일 수 있으며, 학습 데이터와 평가 데이터를 분리해야 한다.

개인정보가 포함된 학생 답안과 교사 코멘트는 설계 단계부터 목적 제한, 가명처리, 재식별 방지, 투명성, 삭제·열람 요구 대응을 고려해야 한다. 모델 개선 데이터는 별도 동의와 교사 승인 사례에 한정하고, 원본 식별자는 운영 데이터와 분리한다.

## 출처

1. OpenAI, [Fine-tuning best practices](https://developers.openai.com/api/docs/guides/fine-tuning-best-practices) — 2026-08-18 확인. 데이터 품질·일관성·훈련/평가 분리 원칙.
2. OpenAI, [Model optimization](https://developers.openai.com/api/docs/guides/model-optimization) — 2026-08-18 확인. 평가, 프롬프트 개선, 필요 시 미세조정을 반복하는 개선 과정.
3. 개인정보보호위원회, [Policy Direction for Safe Usage of Personal Data in the Age of A.I.](https://www.pipc.go.kr/eng/user/ltn/new/noticeDetail.do?bbsId=BBSMSTR_000000000001&nttId=2275) — 2026-08-18 확인. Privacy by Design, 가명처리·재식별 방지, 서비스 투명성·정보주체 권리 고려.
