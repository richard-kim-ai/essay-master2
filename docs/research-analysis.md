# Reference Project Analysis

작성일: 2026-08-19

## 분석 대상

- `securehst/ai-essay-evaluator`
- `NirDiamant/GenAI_Agents`
- `ghko99/korean-essay-rater`
- `ghko99/aes-llm-training`
- `ghko99/lora-self-consistency-aes`
- `ghko99/aihub-aes-v2`
- `ghko99/aes-ukta-exp`
- `ghko99/Automated-Essay-Scoring`
- `maruf009sultan/AIELTS-WRITING`
- AIHub 언어/글 평가 데이터 포털

## 핵심 관찰

### securehst/ai-essay-evaluator

Python 기반의 자동 에세이 평가 프레임워크다. 공개 README 기준으로 OpenAI GPT 모델, fine-tuning JSONL, 다중 채점 포맷, batch processing, multi-pass grading, 비용 추적, retry/rate-limit 처리, logging을 제공한다.

논술 마스터에 가져올 점:

- project folder 단위로 `prompt`, `rubric`, `input.csv`, `output`을 분리하는 운영 방식
- multi-pass grading과 consistency check
- fine-tuning 데이터 생성/검증 파이프라인
- 비용·토큰 추적

### ghko99/korean-essay-rater

GitHub 메타 설명 기준 FastAPI + vLLM 기반 한국어 에세이 자동 채점 웹 앱이다. 에세이를 8개 루브릭 항목으로 채점하고 상세 피드백을 스트리밍한다.

논술 마스터에 가져올 점:

- 한국어 전용 8개 루브릭 항목 구조
- vLLM 모델 서버를 독립 배치하고 앱은 API로 호출하는 구조
- 스트리밍 피드백 UX

### ghko99/aes-llm-training

Kanana 8B 기반 AES LoRA fine-tuning 프로젝트다. 설명 기준 Unsloth + 4-bit QLoRA를 사용한다.

논술 마스터에 가져올 점:

- LLM fine-tune adapter를 별도 모듈로 분리
- 한국어 모델 계열을 `modelServerProvider` 뒤에 숨기는 구조
- 교사 채점 데이터가 쌓이면 LoRA 학습 세트로 변환

### ghko99/lora-self-consistency-aes

LLaMA 3.1 기반 AES, LoRA, dynamic loss weighting, self-consistency, QWK 성능 개선을 다룬다.

논술 마스터에 가져올 점:

- 단일 채점 결과보다 여러 평가 pass의 중앙값/합의도를 사용
- 신뢰도와 점수 분산을 함께 저장
- QWK(Quadratic Weighted Kappa)를 모델 평가 지표로 사용

### ghko99/aihub-aes-v2 / Automated-Essay-Scoring / aes-ukta-exp

AIHub 에세이 글 평가 데이터와 KoBERT/GRU 또는 한국어 언어학적 자질 결합 모델 실험 계열이다.

논술 마스터에 가져올 점:

- AIHub 데이터는 raw 데이터를 repo에 넣지 않고 schema mapping과 calibration 결과만 저장
- KoBERT/GRU, KoBERT+linguistic-features는 low-latency 보조 scorer로 적합
- LLM 채점 전후의 calibration baseline으로 활용 가능

### maruf009sultan/AIELTS-WRITING

TypeScript 기반 IELTS/general English writing grader다. OpenAI 또는 호환 API를 통해 band score, error highlight, actionable feedback을 제공하는 방향이다.

논술 마스터에 가져올 점:

- IELTS 4개 기준(Task Response, Coherence, Lexical, Grammar)을 별도 rubric으로 제공
- 영어·일반 작문 확장을 `taskType`과 `rubric`으로 분리
- UI에서 criterion별 score와 error highlight를 제공

### NirDiamant/GenAI_Agents

평가 모델 자체보다는 agent orchestration 패턴의 참고 자료다. 다중 에이전트, RAG, tool use, production workflow 튜토리얼을 제공한다.

논술 마스터에 가져올 점:

- 평가를 단일 LLM 호출로 끝내지 않고 `채점자`, `검수자`, `교정자`, `캘리브레이터` 역할로 분리
- 나중에 multi-agent review pipeline으로 확장 가능

## 결론

현재 프로젝트 목적에는 순수 모델 하나보다 hybrid architecture가 맞다.

1. 즉시 적용: rule baseline + LLM rubric scorer + self-consistency
2. 한국어 특화: AIHub/교사채점 데이터로 calibration
3. 성능 고도화: vLLM/KoBERT/LoRA model server adapter
4. UX 확장: IELTS/general writing rubrics and highlights

이 repository는 위 네 단계를 한 엔진 안에서 모듈화한다.
