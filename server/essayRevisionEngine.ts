import { invokeLLMText } from "./_core/llmText";

// AI 첨삭의 '수정 답안'과 문장별 교정을 만든다. 평가 엔진(writingEvaluationEngine)은 점수·코멘트만 만들고
// 고친 글은 만들지 않으므로, 평가가 정상 완료된 뒤에 이 단계가 원문을 바탕으로 수정본을 만든다.

export type EssayCorrection = {
  original: string;
  revised: string;
  reason: string;
  competency: "structure" | "logic" | "expression" | "accuracy" | "economy";
  /** 검증을 통과한 교정은 항상 changed(원문과 달라진 것만 남긴다) — 기존 SentenceCorrection 형식과 맞춘다 */
  status: "changed";
};

export type EssayRevision = {
  revisedEssay: string;
  corrections: EssayCorrection[];
  tokenUsage: number;
};

export type EssayRevisionRequest = {
  essayTitle: string;
  essayContent: string;
  courseType: "elementary" | "middle_high" | "high_univ" | "general_adult";
  /** 평가에서 나온 보완점 — 수정의 우선순위로 쓴다 */
  weaknesses?: string[];
};

const AUDIENCE: Record<EssayRevisionRequest["courseType"], string> = {
  elementary: "초등학생",
  middle_high: "중·고등학생",
  high_univ: "고등·대입 수험생",
  general_adult: "일반·직장인 학습자",
};

const COMPETENCIES = new Set(["structure", "logic", "expression", "accuracy", "economy"]);
const MAX_CORRECTIONS = 8;
// 수정본 길이는 원문의 이 범위 안이어야 한다(내용을 지우거나 새로 쓰는 응답을 걸러낸다).
const MIN_LENGTH_RATIO = 0.5;
const MAX_LENGTH_RATIO = 1.8;

const SYSTEM_PROMPT = `당신은 논술 첨삭 교사입니다. 학생의 글을 고쳐 쓴 수정본과 문장별 교정 목록을 만듭니다.
규칙:
- 학생의 주장·의도·목소리를 유지하고, 새로운 주장이나 사실을 지어내지 않습니다.
- 맞춤법·호응·중복 표현·논리 연결·구조 문제만 고치고, 괜찮은 문장은 그대로 둡니다.
- 수정본은 원문과 비슷한 분량(원문의 절반~1.8배)으로 쓰고, 문단 나눔과 줄바꿈을 유지합니다.
- corrections의 original은 반드시 원문에 실제로 있는 문장(또는 구절)을 그대로 옮겨 적고, revised는 그것을 고친 표현입니다.
- reason은 학생이 이해할 수 있는 한 문장으로 씁니다. competency는 structure, logic, expression, accuracy, economy 중 하나입니다.
- 반드시 JSON만 응답합니다: {"revisedEssay": "...", "corrections": [{"original": "...", "revised": "...", "reason": "...", "competency": "expression"}]}`;

export function parseRevision(content: string, essayContent: string): { revisedEssay: string; corrections: EssayCorrection[] } | null {
  let raw: unknown;
  try {
    const match = content.match(/\{[\s\S]*\}/);
    raw = match ? JSON.parse(match[0]) : null;
  } catch {
    return null;
  }
  if (!raw || typeof raw !== "object") return null;
  const record = raw as { revisedEssay?: unknown; corrections?: unknown };
  const revisedEssay = typeof record.revisedEssay === "string" ? record.revisedEssay.trim() : "";
  const length = essayContent.trim().length;
  if (!revisedEssay || revisedEssay.length < length * MIN_LENGTH_RATIO || revisedEssay.length > length * MAX_LENGTH_RATIO) return null;

  const corrections: EssayCorrection[] = [];
  for (const item of Array.isArray(record.corrections) ? record.corrections : []) {
    if (!item || typeof item !== "object") continue;
    const { original, revised, reason, competency } = item as Record<string, unknown>;
    if (typeof original !== "string" || typeof revised !== "string" || typeof reason !== "string") continue;
    const originalText = original.trim();
    const revisedText = revised.trim();
    // 원문에 없는 문장을 '원문'이라고 내세우거나, 바뀐 것이 없는 교정은 버린다.
    if (!originalText || !revisedText || originalText === revisedText || !essayContent.includes(originalText)) continue;
    corrections.push({
      original: originalText,
      revised: revisedText,
      reason: reason.trim().slice(0, 300),
      competency: typeof competency === "string" && COMPETENCIES.has(competency) ? (competency as EssayCorrection["competency"]) : "expression",
      status: "changed",
    });
    if (corrections.length >= MAX_CORRECTIONS) break;
  }
  return { revisedEssay, corrections };
}

/** 수정 답안을 만든다. AI 호출이나 응답 검증에 실패하면 null — 호출한 쪽은 평가 결과만 보여 준다. */
export async function reviseEssayWithLLM(request: EssayRevisionRequest): Promise<EssayRevision | null> {
  try {
    const weaknesses = (request.weaknesses ?? []).filter(Boolean).slice(0, 5);
    const { text, totalTokens } = await invokeLLMText({
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        {
          role: "user",
          content: JSON.stringify({
            독자: AUDIENCE[request.courseType],
            제목: request.essayTitle,
            원문: request.essayContent,
            ...(weaknesses.length ? { 먼저_고칠_보완점: weaknesses } : {}),
          }),
        },
      ],
      response_format: { type: "json_object" },
    });
    const parsed = parseRevision(text, request.essayContent);
    if (!parsed) return null;
    return { ...parsed, tokenUsage: totalTokens };
  } catch (error) {
    console.warn("[AI 첨삭] 수정 답안 생성 실패(평가 결과만 제공):", error instanceof Error ? error.message.slice(0, 200) : error);
    return null;
  }
}
