import { invokeLLM } from "./_core/llm";
import type { WritingEvaluationResult, WritingEvaluationRequest } from "./writingEvaluationEngine";

export interface WritingCorrectionResult {
  correction_version: "1.0.0";
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
): Promise<WritingCorrectionResult> {
  const levelGuide = {
    elementary: "초등 학습자가 이해할 수 있는 쉬운 말과 짧은 설명",
    middle_high: "중고등학생이 이해할 수 있는 구체적이고 교육적인 설명",
    high_univ: "고등·대학 논술에 맞는 논리적이고 정확한 설명",
    general_adult: "성인 학습자가 실무에 적용할 수 있는 간결하고 명료한 설명",
  }[request.metadata.education_level];

  const response = await invokeLLM({
    messages: [
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
            improvement_points: evaluation.improvement_points,
            error_patterns: evaluation.error_patterns,
            revision_steps: evaluation.feedback.revision_steps,
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
    ],
    responseFormat: { type: "json_object" },
  });

  try {
    const content = extractTextContent(response);
    const parsed = JSON.parse(content) as Partial<WritingCorrectionResult>;
    return {
      correction_version: "1.0.0",
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
      correction_version: "1.0.0",
      learner_level: request.metadata.education_level,
      original_text: request.submission.essay_text,
      revised_text: request.submission.essay_text,
      sentence_corrections: [],
      learner_explanation: evaluation.feedback.summary,
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
