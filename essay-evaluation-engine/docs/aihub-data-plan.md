# AIHub Data Plan

AIHub 언어/글 평가 데이터 포털:

https://aihub.or.kr/aihubdata/data/list.do?currMenu=115&topMenu=100&&srchDataRealmCode=REALM002

## 원칙

- 원천 데이터는 라이선스와 접근권한을 확인한 뒤 별도 data root에 저장한다.
- raw dataset은 git에 커밋하지 않는다.
- 이 repo에는 schema mapping, preprocessing script, derived metrics, calibration config만 저장한다.

## 예상 파이프라인

1. AIHub에서 한국어 글 평가 데이터 다운로드
2. local/object storage에 압축 해제
3. `mapAihubRecord`로 prompt/essay/scores/metadata 표준화
4. 교사 채점 항목을 `korean_aes_8_trait_v1` 루브릭에 매핑
5. train/valid/test split 생성
6. baseline 성능 측정
7. LoRA/KoBERT/vLLM 모델 학습 또는 calibration
8. QWK, MAE, criterion-wise correlation 산출

## 점수 매핑

원본 점수 체계가 0~5, 1~5, 0~10, 0~100 등으로 다를 수 있으므로 모든 점수는 내부적으로 0~100 `normalizedScore`와 criterion별 원점수를 함께 저장한다.

