import * as db from "./db";

export const EVALUATION_MODEL_SETTINGS_KEY = "writing_evaluation_models";
export type EvaluationModelPurpose = "evaluation" | "correction" | "both";
export type EvaluationModelProvider = "rule" | "openai" | "openai_compatible" | "vllm" | "kobert" | "lora" | "custom";
export type EvaluationModelProfile = { id: string; name: string; provider: EvaluationModelProvider; purpose: EvaluationModelPurpose; model: string; endpoint: string; enabled: boolean; priority: number; notes: string; managed: boolean };

export const DEFAULT_EVALUATION_MODELS: EvaluationModelProfile[] = [
  { id: "rule-baseline", name: "규칙 기반 평가", provider: "rule", purpose: "evaluation", model: "", endpoint: "", enabled: true, priority: 1, notes: "메인 v1.1 엔진의 기본 평가 모듈", managed: true },
  { id: "openai-correction", name: "LLM 자동 첨삭", provider: "openai", purpose: "correction", model: "", endpoint: "", enabled: true, priority: 1, notes: "학생 수준별 첨삭문 생성", managed: true },
  { id: "korean-essay-rater", name: "한국어 AES 모델", provider: "vllm", purpose: "evaluation", model: "", endpoint: "", enabled: false, priority: 10, notes: "vLLM/LoRA 서버 연결 후 활성화", managed: false },
  { id: "lora-self-consistency", name: "LoRA Self-Consistency AES", provider: "lora", purpose: "evaluation", model: "", endpoint: "", enabled: false, priority: 20, notes: "GPU 모델 서버 연결 후 활성화", managed: false },
  { id: "ielts-writing", name: "IELTS Writing Adapter", provider: "custom", purpose: "both", model: "", endpoint: "", enabled: false, priority: 30, notes: "영어 작문용 Provider", managed: false },
];

function parseProfiles(value: string | null | undefined): EvaluationModelProfile[] {
  if (!value) return DEFAULT_EVALUATION_MODELS;
  try {
    const parsed = JSON.parse(value);
    if (!Array.isArray(parsed)) return DEFAULT_EVALUATION_MODELS;
    const defaults = new Map(DEFAULT_EVALUATION_MODELS.map((item) => [item.id, item]));
    return parsed.filter((item) => item && typeof item.id === "string").map((item) => ({ ...(defaults.get(item.id) ?? DEFAULT_EVALUATION_MODELS[0]), ...item, managed: defaults.get(item.id)?.managed ?? false }));
  } catch { return DEFAULT_EVALUATION_MODELS; }
}

export async function getEvaluationModelProfiles() { return parseProfiles(await db.getSiteSetting(EVALUATION_MODEL_SETTINGS_KEY)); }
export async function saveEvaluationModelProfiles(profiles: EvaluationModelProfile[], adminId: number) {
  const normalized = profiles.map((profile) => ({ ...profile, id: profile.id.trim(), name: profile.name.trim(), model: profile.model.trim(), endpoint: profile.endpoint.trim(), notes: profile.notes.trim(), priority: Math.max(1, Math.min(999, Math.round(profile.priority))) }));
  await db.saveSiteSetting(EVALUATION_MODEL_SETTINGS_KEY, JSON.stringify(normalized), adminId);
  return normalized;
}
export async function getActiveCorrectionModel() {
  const profiles = await getEvaluationModelProfiles();
  return profiles.filter((profile) => profile.enabled && (profile.purpose === "correction" || profile.purpose === "both")).sort((a, b) => a.priority - b.priority)[0] ?? DEFAULT_EVALUATION_MODELS[1];
}

export async function getActiveEvaluationModel() {
  const profiles = await getEvaluationModelProfiles();
  return profiles
    .filter((profile) => profile.enabled && profile.endpoint && (profile.purpose === "evaluation" || profile.purpose === "both") && profile.provider !== "rule")
    .sort((a, b) => a.priority - b.priority)[0] ?? null;
}
