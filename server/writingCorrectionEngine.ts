import { invokeLLM } from "./_core/llm";
import type { WritingEvaluationResult, WritingEvaluationRequest } from "./writingEvaluationEngine";

export interface WritingCorrectionResult {
  correction_version: "1.1";
  correction_status: "completed" | "fallback" | "failed";
  fallback_used: boolean;
  provider_error?: string;
  latency_ms: number;
  model_id?: string;
  learner_level: WritingEvaluationRequest["metadata"]["education_level"];
  original_text: string;
  revised_text: string;
  sentence_corrections: Array<{
    original: string;
    revised: string;
    reason: string;
    competency: string;
  }>;
  learner_explanation: string;
  next_revision_task: string;
}

export async function generateWritingCorrection(
  request: WritingEvaluationRequest,
  evaluation: WritingEvaluationResult,
  options: { model?: string; endpoint?: string; modelId?: string } = {},
): Promise<WritingCorrectionResult> {
  const startedAt = Date.now();
  const levelGuide = {
    elementary: "초등 학습자가 이해할 수 있는 쉬운 말과 짧은 설명",
    middle_high: "중고등학생이 이해할 수 있는 구체적이고 교육적인 설명",
    high_univ: "고등·대학 논술에 맞는 논리적이고 정확한 설명",
    general_adult: "성인 학습자가 실무에 적용할 수 있는 간결하고 명료한 설명",
  }[request.metadata.education_level];

  const messages = [
      {
        role: "system",
        content: `당신은 학생의 글을 존중하며 개선을 돕는 한국어 글쓰기 첨삭 전문가입니다.
${levelGuide}을 사용하세요. 학생의 생각과 목소리를 임의로 바꾸지 말고, 필요한 부분만 고칩니다.
강한 제재나 인격 판단 표현을 사용하지 말고, 보완 지점과 재작성 방향으로 설명합니다.
반드시 JSON 객체만 출력하세요.`,
      },
      {
        role: "user",
        content: JSON.stringify({
          task: request.task,
          original_text: request.submission.essay_text,
          evaluation: {
            total_score: evaluation.total_score,
            rubric_profile: evaluation.rubric_profile,
            improvement_points: evaluation.improvement_points,
            error_patterns: evaluation.error_patterns,
            revision_steps: evaluation.feedback.revision_steps,
            evidence_audit: evaluation.evidence_audit,
            validation: evaluation.validation,
          },
          output_contract: {
            revised_text: "원문의 의도와 학생의 목소리를 유지한 전체 개선문",
            sentence_corrections: [
              {
                original: "원문 일부",
                revised: "개선한 문장",
                reason: "왜 보완했는지 학생 눈높이 설명",
                competency: "연결·일관성 등 평가 competency",
              },
            ],
            learner_explanation: "전체 글에서 잘한 점과 가장 먼저 고칠 점",
            next_revision_task: "학생이 직접 다시 써 볼 짧은 과제",
          },
        }),
      },
    ];

  let response: unknown;
  try {
    if (options.endpoint) {
      const endpointUrl = new URL(options.endpoint);
      if (endpointUrl.protocol !== "https:") throw new Error("첨삭 모델 Endpoint는 HTTPS만 사용할 수 있습니다.");
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 30_000);
      try {
        const remote = await fetch(endpointUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ model: options.model || undefined, messages, response_format: { type: "json_object" } }),
          signal: controller.signal,
        });
        if (!remote.ok) throw new Error(`첨삭 모델이 ${remote.status} 상태를 반환했습니다.`);
        response = await remote.json();
      } finally {
        clearTimeout(timeout);
      }
    } else {
      response = await invokeLLM({ messages, responseFormat: { type: "json_object" }, ...(options.model ? { model: options.model } : {}) });
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "첨삭 Provider 호출에 실패했습니다.";
    return {
      correction_version: "1.1", correction_status: "fallback", fallback_used: true, provider_error: message,
      latency_ms: Date.now() - startedAt, model_id: options.modelId, learner_level: request.metadata.education_level,
      original_text: request.submission.essay_text, revised_text: request.submission.essay_text, sentence_corrections: [],
      learner_explanation: "첨삭 모델 연결이 원활하지 않아 원문을 보존했습니다. 잠시 후 다시 시도해 주세요.",
      next_revision_task: evaluation.feedback.revision_steps[0] || "가장 중요한 보완 지점 한 가지를 골라 문단을 다시 써 보세요.",
    };
  }

  try {
    const content = extractTextContent(response);
    const parsed = JSON.parse(content) as Partial<WritingCorrectionResult>;
    return {
      correction_version: "1.1",
      correction_status: "completed",
      fallback_used: false,
      latency_ms: Date.now() - startedAt,
      model_id: options.modelId,
      learner_level: request.metadata.education_level,
      original_text: request.submission.essay_text,
      revised_text: parsed.revised_text?.trim() || request.submission.essay_text,
      sentence_corrections: Array.isArray(parsed.sentence_corrections) ? parsed.sentence_corrections : [],
      learner_explanation: parsed.learner_explanation?.trim() || evaluation.feedback.summary,
      next_revision_task: parsed.next_revision_task?.trim() || evaluation.feedback.revision_steps[0] || "가장 중요한 보완 지점 한 가지를 골라 문단을 다시 써 보세요.",
    };
  } catch (error) {
    console.error("Failed to parse writing correction:", error);
    return {
      correction_version: "1.1",
      correction_status: "fallback",
      fallback_used: true,
      provider_error: "첨삭 모델 응답을 JSON으로 해석하지 못했습니다.",
      latency_ms: Date.now() - startedAt,
      model_id: options.modelId,
      learner_level: request.metadata.education_level,
      original_text: request.submission.essay_text,
      revised_text: request.submission.essay_text,
      sentence_corrections: [],
      learner_explanation: "첨삭 모델 응답을 확인하지 못해 원문을 보존했습니다. 다시 시도해 주세요.",
      next_revision_task: evaluation.feedback.revision_steps[0] || "가장 중요한 보완 지점 한 가지를 골라 문단을 다시 써 보세요.",
    };
  }
}

function extractTextContent(response: unknown): string {
  const value = response as any;
  const content = value?.choices?.[0]?.message?.content ?? value?.message?.content ?? value;
  if (typeof content === "string") return content;
  if (Array.isArray(content)) return content.map((part) => part?.text ?? "").join("");
  throw new Error("LLM response did not contain text content");
}
