import { invokeLLM } from "./_core/llm";

interface SentenceFeedback {
  economyScore: number; // 0-100
  clarityScore: number; // 0-100
  accuracyScore: number; // 0-100
  feedback: string;
  suggestion: string;
}

interface SummaryFeedback {
  keywordsIncluded: string[];
  keywordsMissing: string[];
  logicScore: number; // 0-100
  lengthScore: number; // 0-100
  overallScore: number; // 0-100
  feedback: string;
}

interface EssayFeedback {
  structureScore: number; // 0-100
  logicScore: number; // 0-100
  expressionScore: number; // 0-100
  overallScore: number; // 0-100
  strengths: string[];
  weaknesses: string[];
  suggestions: string[];
  overallComment: string;
  revisedEssay: string;
}

/**
 * 문장의 경제성, 명료성, 정확성을 평가합니다.
 */
export async function evaluateSentence(
  sentence: string,
  courseType: "elementary" | "middle_high" | "high_univ" | "general_adult"
): Promise<SentenceFeedback> {
  const prompt =
    courseType === "elementary"
      ? `초등학생 수준의 문장을 평가해주세요. 문장: "${sentence}"

다음 항목을 0-100점으로 평가하고 JSON 형식으로 응답해주세요:
{
  "economyScore": 불필요한 단어가 없는가 (0-100),
  "clarityScore": 명확하고 이해하기 쉬운가 (0-100),
  "accuracyScore": 맞춤법과 띄어쓰기가 정확한가 (0-100),
  "feedback": "평가 의견",
  "suggestion": "개선 제안"
}`
      : `중고등학생 수준의 문장을 평가해주세요. 문장: "${sentence}"

다음 항목을 0-100점으로 평가하고 JSON 형식으로 응답해주세요:
{
  "economyScore": 경제적 표현인가 (0-100),
  "clarityScore": 명료한 표현인가 (0-100),
  "accuracyScore": 정확한 표현인가 (주술호응, 조사 등) (0-100),
  "feedback": "평가 의견",
  "suggestion": "개선 제안"
}`;

  const response = await invokeLLM({
    messages: [
      {
        role: "system",
        content:
          "당신은 논술 교육 전문가입니다. 학생의 문장을 평가하고 피드백을 제공합니다. 항상 JSON 형식으로 응답하세요.",
      },
      { role: "user", content: prompt },
    ],
  });

  try {
    const responseText = typeof response === "string" ? response : (response as any).message?.content || "";
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error("Invalid JSON response");
    const result = JSON.parse(jsonMatch[0]);
    return {
      economyScore: result.economyScore || 0,
      clarityScore: result.clarityScore || 0,
      accuracyScore: result.accuracyScore || 0,
      feedback: result.feedback || "",
      suggestion: result.suggestion || "",
    };
  } catch (error) {
    console.error("Failed to parse sentence feedback:", error);
    return {
      economyScore: 50,
      clarityScore: 50,
      accuracyScore: 50,
      feedback: "평가 중 오류가 발생했습니다.",
      suggestion: "다시 시도해주세요.",
    };
  }
}

/**
 * 요약문을 평가합니다.
 */
export async function evaluateSummary(
  originalText: string,
  summary: string,
  courseType: "elementary" | "middle_high" | "high_univ" | "general_adult"
): Promise<SummaryFeedback> {
  const prompt =
    courseType === "elementary"
      ? `원문: "${originalText}"

학생의 요약: "${summary}"

요약을 평가하고 JSON 형식으로 응답해주세요:
{
  "keywordsIncluded": ["포함된 핵심 단어들"],
  "keywordsMissing": ["빠진 핵심 단어들"],
  "logicScore": 논리적 흐름이 유지되었는가 (0-100),
  "lengthScore": 적절한 길이인가 (0-100),
  "overallScore": 전체 평가 점수 (0-100),
  "feedback": "평가 의견"
}`
      : `원문: "${originalText}"

학생의 요약: "${summary}"

요약을 평가하고 JSON 형식으로 응답해주세요:
{
  "keywordsIncluded": ["포함된 핵심 단어들"],
  "keywordsMissing": ["빠진 핵심 단어들"],
  "logicScore": 논리적 흐름이 유지되었는가 (0-100),
  "lengthScore": 적절한 길이인가 (0-100),
  "overallScore": 전체 평가 점수 (0-100),
  "feedback": "평가 의견"
}`;

  const response = await invokeLLM({
    messages: [
      {
        role: "system",
        content:
          "당신은 논술 교육 전문가입니다. 학생의 요약을 평가하고 피드백을 제공합니다. 항상 JSON 형식으로 응답하세요.",
      },
      { role: "user", content: prompt },
    ],
  });

  try {
    const responseText = typeof response === "string" ? response : (response as any).message?.content || "";
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error("Invalid JSON response");
    const result = JSON.parse(jsonMatch[0]);
    return {
      keywordsIncluded: result.keywordsIncluded || [],
      keywordsMissing: result.keywordsMissing || [],
      logicScore: result.logicScore || 0,
      lengthScore: result.lengthScore || 0,
      overallScore: result.overallScore || 0,
      feedback: result.feedback || "",
    };
  } catch (error) {
    console.error("Failed to parse summary feedback:", error);
    return {
      keywordsIncluded: [],
      keywordsMissing: [],
      logicScore: 50,
      lengthScore: 50,
      overallScore: 50,
      feedback: "평가 중 오류가 발생했습니다.",
    };
  }
}

/**
 * 전체 논술을 평가합니다.
 */
export async function evaluateEssay(
  essayContent: string,
  courseType: "elementary" | "middle_high" | "high_univ" | "general_adult",
  difficultyMode: "standard" | "advanced" = "standard",
): Promise<EssayFeedback> {
  const difficultyDirective = difficultyMode === "advanced"
    ? "심화 운영 기준입니다. 주장과 근거의 대응, 근거의 구체성, 반론 검토, 판단 기준의 일관성을 엄격히 확인하세요. 평균적 표현에는 과도한 고득점을 주지 말고, 개선 과제는 한 단계 높은 수준으로 제시하세요."
    : "표준 운영 기준입니다. 과정 수준에 맞춰 주장·근거·구조의 기본기를 우선 확인하고, 실행 가능한 보완 과제를 제시하세요.";
  let prompt = "";
  if (courseType === "elementary") {
    prompt = `학생의 논술: "${essayContent}"

초등학생 수준의 논술을 종합적으로 평가하고 JSON 형식으로 응답해주세요:
{
  "structureScore": 글의 구조가 명확한가 (0-100),
  "logicScore": 논리적으로 일관성이 있는가 (0-100),
  "expressionScore": 표현이 명확하고 재미있는가 (0-100),
  "overallScore": 전체 평가 점수 (0-100),
  "strengths": ["강점 1", "강점 2"],
  "weaknesses": ["약점 1", "약점 2"],
  "suggestions": ["개선 제안 1", "개선 제안 2"],
  "overallComment": "종합 평가",
  "revisedEssay": "원문의 핵심 의도와 학생의 목소리를 유지하면서 문장·구조·논리를 개선한 전체 답안"
}`;
  } else if (courseType === "middle_high") {
    prompt = `학생의 논술: "${essayContent}"

중고등학생 수준의 논술을 종합적으로 평가하고 JSON 형식으로 응답해주세요:
{
  "structureScore": 서론-본론-결론 구조가 명확한가 (0-100),
  "logicScore": 논리적 일관성과 설득력이 있는가 (0-100),
  "expressionScore": 표현이 정확하고 효과적인가 (0-100),
  "overallScore": 전체 평가 점수 (0-100),
  "strengths": ["강점 1", "강점 2"],
  "weaknesses": ["약점 1", "약점 2"],
  "suggestions": ["개선 제안 1", "개선 제안 2"],
  "overallComment": "종합 평가",
  "revisedEssay": "원문의 핵심 의도와 학생의 목소리를 유지하면서 문장·구조·논리를 개선한 전체 답안"
}`;
  } else if (courseType === "high_univ") {
    prompt = `학생의 논술: "${essayContent}"

고등/대입 수험생 수준의 논술(대학별 고사, 심층 논증, 제시문 비교 분석)을 종합적으로 평가하고 JSON 형식으로 응답해주세요:
{
  "structureScore": 제시문 간 비교와 논증 구조가 정교한가 (0-100),
  "logicScore": 비판적 분석력과 논리적 엄밀성이 돋보이는가 (0-100),
  "expressionScore": 학술적이고 설득력 있는 어휘와 문장력인가 (0-100),
  "overallScore": 전체 평가 점수 (0-100),
  "strengths": ["강점 1", "강점 2"],
  "weaknesses": ["약점 1", "약점 2"],
  "suggestions": ["개선 제안 1", "개선 제안 2"],
  "overallComment": "대학별 논술 심층 평가",
  "revisedEssay": "원문의 핵심 의도와 학생의 목소리를 유지하면서 문장·구조·논리를 개선한 전체 답안"
}`;
  } else {
    prompt = `학생의 논술: "${essayContent}"

일반/직장인 수준의 논술 및 비즈니스 글쓰기(보고서, 기획서, 실무 설득력)를 종합적으로 평가하고 JSON 형식으로 응답해주세요:
{
  "structureScore": 논리적 구조와 결론 중심의 전개가 명확한가 (0-100),
  "logicScore": 실무적 타당성과 설득력 있는 근거인가 (0-100),
  "expressionScore": 간결하고 명료한 프로페셔널 표현력인가 (0-100),
  "overallScore": 전체 평가 점수 (0-100),
  "strengths": ["강점 1", "강점 2"],
  "weaknesses": ["약점 1", "약점 2"],
  "suggestions": ["개선 제안 1", "개선 제안 2"],
  "overallComment": "비즈니스 글쓰기 종합 평가",
  "revisedEssay": "원문의 핵심 의도와 학생의 목소리를 유지하면서 문장·구조·논리를 개선한 전체 답안"
}`;
  }

  const response = await invokeLLM({
    messages: [
      {
        role: "system",
        content: `당신은 논술 교육 전문가입니다. 학생의 논술을 종합적으로 평가하고 피드백을 제공합니다. ${difficultyDirective} 항상 JSON 형식으로 응답하세요.`,
      },
      { role: "user", content: prompt },
    ],
  });

  try {
    const responseText = typeof response === "string" ? response : (response as any).message?.content || "";
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error("Invalid JSON response");
    const result = JSON.parse(jsonMatch[0]);
    return {
      structureScore: result.structureScore || 0,
      logicScore: result.logicScore || 0,
      expressionScore: result.expressionScore || 0,
      overallScore: result.overallScore || 0,
      strengths: result.strengths || [],
      weaknesses: result.weaknesses || [],
      suggestions: result.suggestions || [],
      overallComment: result.overallComment || "",
      revisedEssay: result.revisedEssay || essayContent,
    };
  } catch (error) {
    console.error("Failed to parse essay feedback:", error);
    return {
      structureScore: 50,
      logicScore: 50,
      expressionScore: 50,
      overallScore: 50,
      strengths: [],
      weaknesses: [],
      suggestions: [],
      overallComment: "평가 중 오류가 발생했습니다.",
      revisedEssay: essayContent,
    };
  }
}
