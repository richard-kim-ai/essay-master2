# Essay Evaluation Engine

한국어 논술 평가를 기본값으로 두고, 일반 작문·IELTS·대입 논술·직장인 글쓰기까지 확장할 수 있는 모듈형 평가 엔진입니다.

## 목표

- 논술 마스터의 AI 자동첨삭/실시간 채점에 즉시 연결 가능한 공통 엔진
- 루브릭 기반 점수, 문장/구조 특징, LLM 피드백, 모델 서버 예측을 하나의 결과로 합성
- 한국어 AES 모델, OpenAI/호환 LLM, vLLM, LoRA fine-tune 모델, KoBERT 계열 모델을 어댑터로 분리
- AIHub 글 평가 데이터를 내려받아 학습/검증/캘리브레이션에 사용할 수 있는 데이터 매핑 규칙 제공

## 기본 사용

```ts
import { createEssayEvaluationEngine, essayMasterRubric } from "@essay-master/evaluation-engine";

const engine = createEssayEvaluationEngine({
  rubric: essayMasterRubric,
  modules: {
    ruleBaseline: true,
    llmRubric: false,
    modelServer: false,
    selfConsistency: true,
  },
});

const result = await engine.evaluate({
  language: "ko",
  taskType: "essay_master",
  prompt: "학교 내 휴대전화 사용에 대한 자신의 견해를 쓰시오.",
  essay: "학교 안 휴대전화 사용은...",
});
```

## 엔진 레이어

1. **Feature extraction**: 길이, 문단 수, 문장 수, 연결어, 근거 표시, 한국어 문장성 지표
2. **Rule baseline**: 즉시 적용 가능한 휴리스틱 점수와 피드백
3. **LLM rubric scorer**: rubric JSON을 강제 출력하는 LLM 평가 어댑터
4. **Model server adapter**: vLLM/FastAPI/KoBERT/LoRA 모델 서버 점수 수신
5. **Self-consistency**: 여러 평가 결과를 중앙값/분산/신뢰도로 합성
6. **Calibration**: AIHub/교사 채점 데이터 기준으로 점수 스케일 보정

## 운영 검수 원칙

AI 평가 결과는 기본적으로 `draft` 상태로 저장하고, 공식 점수나 학습 리포트에 반영하기 전에 사람 검수 단계를 둡니다.

- 자동 통과: 낮은 위험도, 높은 confidence, 루브릭 항목 간 편차가 작은 결과만 허용
- 수기 검수: 장문 예시를 그대로 따라 쓴 답안, 근거 없이 길이만 긴 답안, 문항 재진술 의존도가 높은 답안
- 재채점: LLM scorer와 model server 점수 차이가 크거나 self-consistency 분산이 큰 답안
- 캘리브레이션: 사람 검수 점수를 누적해 모델별 보정 곡선을 갱신

## 참고 분석

상세 비교는 [docs/research-analysis.md](docs/research-analysis.md)를 확인하세요.
