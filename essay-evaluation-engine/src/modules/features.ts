import type { EssayEvaluationInput, WritingFeatureProfile } from "../types";

const KOREAN_SENTENCE_ENDINGS = /[.!?。！？]|(?:다|요|죠|니다|습니다)(?:\s|$)/g;
const CONNECTIVES = ["그러나", "하지만", "또한", "따라서", "그러므로", "예를 들어", "반면", "결국", "첫째", "둘째"];
const EVIDENCE_MARKERS = ["왜냐하면", "예를 들어", "근거", "사례", "자료", "이유", "때문"];
const COUNTERARGUMENT_MARKERS = ["반론", "물론", "반면", "그러나", "하지만", "그럼에도"];
const CONCLUSION_MARKERS = ["따라서", "결론", "결국", "그러므로", "종합하면"];

function countMarkers(text: string, markers: string[]) {
  return markers.reduce((count, marker) => count + (text.includes(marker) ? 1 : 0), 0);
}

export function extractWritingFeatures(input: EssayEvaluationInput): WritingFeatureProfile {
  const essay = input.essay.trim();
  const paragraphs = essay.split(/\n{2,}/).map(p => p.trim()).filter(Boolean);
  const sentenceMatches = essay.match(KOREAN_SENTENCE_ENDINGS);
  const sentenceCount = Math.max(1, sentenceMatches?.length ?? essay.split(/[.!?\n]/).filter(Boolean).length);
  const wordLikeCount = input.language === "ko"
    ? essay.replace(/\s+/g, "").length
    : essay.split(/\s+/).filter(Boolean).length;

  const normalizedPrompt = input.prompt.replace(/\s+/g, " ").trim();
  const questionRestatementScore = normalizedPrompt.length > 0 && essay.includes(normalizedPrompt.slice(0, Math.min(20, normalizedPrompt.length)))
    ? 1
    : 0;

  return {
    charCount: essay.length,
    wordLikeCount,
    sentenceCount,
    paragraphCount: Math.max(1, paragraphs.length),
    avgSentenceLength: Math.round((essay.length / sentenceCount) * 10) / 10,
    connectiveCount: countMarkers(essay, CONNECTIVES),
    evidenceMarkerCount: countMarkers(essay, EVIDENCE_MARKERS),
    counterargumentMarkerCount: countMarkers(essay, COUNTERARGUMENT_MARKERS),
    conclusionMarkerCount: countMarkers(essay, CONCLUSION_MARKERS),
    questionRestatementScore,
  };
}

