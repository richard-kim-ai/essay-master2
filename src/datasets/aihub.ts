export type AihubEssayRecord = {
  id: string;
  prompt: string;
  essay: string;
  scores: Record<string, number>;
  metadata: Record<string, unknown>;
};

export const AIHUB_WRITING_DATASET_NOTE = {
  portal: "https://aihub.or.kr/aihubdata/data/list.do?currMenu=115&topMenu=100&&srchDataRealmCode=REALM002",
  intendedUse: "Korean AES training, calibration, validation, and rubric alignment",
  storagePolicy: [
    "Do not commit raw AIHub data to git.",
    "Keep downloaded data under a local or object-storage data root.",
    "Store only schema mapping, dataset version, and derived metrics in this repository.",
  ],
};

export function normalizeAihubScore(value: number, sourceMax = 5, targetMax = 100) {
  if (!Number.isFinite(value)) return 0;
  return Math.round((Math.max(0, Math.min(sourceMax, value)) / sourceMax) * targetMax);
}

export function mapAihubRecord(raw: Record<string, unknown>): AihubEssayRecord {
  const id = String(raw.id ?? raw["essay_id"] ?? raw["essayId"] ?? `aihub-${Date.now()}`);
  const prompt = String(raw.prompt ?? raw.question ?? raw.topic ?? "");
  const essay = String(raw.essay ?? raw.answer ?? raw.text ?? raw.content ?? "");
  const scores = Object.fromEntries(
    Object.entries(raw)
      .filter(([key, value]) => /score|점수|평가/.test(key) && typeof value === "number")
      .map(([key, value]) => [key, Number(value)]),
  );

  return {
    id,
    prompt,
    essay,
    scores,
    metadata: raw,
  };
}
