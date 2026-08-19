import type { EvaluationLanguage, EvaluationTaskType } from "./types";

export type ModelAdapterKind =
  | "rule"
  | "llm_rubric"
  | "model_server"
  | "self_consistency"
  | "feature_model";

export type ModelDescriptor = {
  id: string;
  label: string;
  kind: ModelAdapterKind;
  languages: EvaluationLanguage[];
  taskTypes: EvaluationTaskType[];
  defaultRubricId: string;
  source:
    | "internal"
    | "securehst_ai_essay_evaluator"
    | "korean_essay_rater"
    | "aes_llm_training"
    | "lora_self_consistency_aes"
    | "aihub_aes_v2"
    | "aes_ukta_exp"
    | "automated_essay_scoring"
    | "aiielts_writing";
  status: "ready" | "adapter_ready" | "research_reference";
  notes: string;
};

export const modelRegistry: ModelDescriptor[] = [
  {
    id: "essay-master-rule-baseline-v1",
    label: "Essay Master rule and feature baseline",
    kind: "rule",
    languages: ["ko", "en", "mixed"],
    taskTypes: ["essay_master", "korean_school_essay", "admission_essay", "business_writing", "general_writing"],
    defaultRubricId: "essay_master_korean_v1",
    source: "internal",
    status: "ready",
    notes: "즉시 실행 가능한 기본 평가 모듈. 길이, 문단, 근거 표지, 반론/결론 표지, 문항 재진술 의존도를 함께 본다.",
  },
  {
    id: "openai-compatible-rubric-judge",
    label: "OpenAI-compatible rubric judge",
    kind: "llm_rubric",
    languages: ["ko", "en", "mixed"],
    taskTypes: ["essay_master", "korean_school_essay", "admission_essay", "business_writing", "general_writing", "ielts_task_1", "ielts_task_2"],
    defaultRubricId: "essay_master_korean_v1",
    source: "securehst_ai_essay_evaluator",
    status: "adapter_ready",
    notes: "다중 패스 채점, 루브릭 기반 피드백, 비용/로그 추적 패턴을 반영할 LLM 어댑터 자리.",
  },
  {
    id: "korean-vllm-eight-trait",
    label: "Korean vLLM eight-trait evaluator",
    kind: "model_server",
    languages: ["ko"],
    taskTypes: ["korean_school_essay", "admission_essay", "essay_master"],
    defaultRubricId: "korean_aes_eight_trait_v1",
    source: "korean_essay_rater",
    status: "adapter_ready",
    notes: "FastAPI/vLLM 기반 한국어 8개 항목 평가 서버와 연결하기 위한 표준 HTTP 어댑터 대상.",
  },
  {
    id: "kanana-8b-qlora-aes",
    label: "Kanana 8B QLoRA AES",
    kind: "model_server",
    languages: ["ko"],
    taskTypes: ["korean_school_essay", "admission_essay"],
    defaultRubricId: "korean_aes_eight_trait_v1",
    source: "aes_llm_training",
    status: "research_reference",
    notes: "AIHub 기반 LoRA/QLoRA 학습 파이프라인을 별도 추론 서버로 붙일 수 있는 후보.",
  },
  {
    id: "llama-lora-self-consistency-aes",
    label: "LoRA self-consistency AES",
    kind: "self_consistency",
    languages: ["ko", "en"],
    taskTypes: ["korean_school_essay", "admission_essay", "general_writing"],
    defaultRubricId: "essay_master_korean_v1",
    source: "lora_self_consistency_aes",
    status: "research_reference",
    notes: "여러 샘플/모듈 결과를 합의시켜 안정도를 높이는 자기일관성 전략의 기준 구현 후보.",
  },
  {
    id: "kobert-gru-aihub",
    label: "KoBERT-GRU AIHub scorer",
    kind: "model_server",
    languages: ["ko"],
    taskTypes: ["korean_school_essay"],
    defaultRubricId: "korean_aes_eight_trait_v1",
    source: "aihub_aes_v2",
    status: "research_reference",
    notes: "AIHub 점수 예측형 모델. 운영 적용 전 데이터 라이선스, 점수 스케일, calibration 검증이 필요하다.",
  },
  {
    id: "kobert-linguistic-feature-aes",
    label: "KoBERT plus Korean linguistic features",
    kind: "feature_model",
    languages: ["ko"],
    taskTypes: ["korean_school_essay", "essay_master"],
    defaultRubricId: "korean_aes_eight_trait_v1",
    source: "aes_ukta_exp",
    status: "research_reference",
    notes: "한국어 언어 특성 피처를 결합하는 평가 모델 후보. 엔진의 feature profile과 결합하기 좋다.",
  },
  {
    id: "ielts-llm-writing",
    label: "IELTS writing LLM adapter",
    kind: "llm_rubric",
    languages: ["en"],
    taskTypes: ["ielts_task_1", "ielts_task_2", "general_writing"],
    defaultRubricId: "ielts_writing_public_band_v1",
    source: "aiielts_writing",
    status: "adapter_ready",
    notes: "IELTS band 기준, 오류 하이라이트, actionable feedback 형태를 일반 영어 작문 평가로 확장하는 어댑터.",
  },
];

export function findModelDescriptors(filters: {
  language?: EvaluationLanguage;
  taskType?: EvaluationTaskType;
  status?: ModelDescriptor["status"];
  kind?: ModelAdapterKind;
} = {}): ModelDescriptor[] {
  return modelRegistry.filter((model) => {
    if (filters.language && !model.languages.includes(filters.language)) return false;
    if (filters.taskType && !model.taskTypes.includes(filters.taskType)) return false;
    if (filters.status && model.status !== filters.status) return false;
    if (filters.kind && model.kind !== filters.kind) return false;
    return true;
  });
}
