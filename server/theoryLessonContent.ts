import { z } from "zod";

export const THEORY_LESSON_MASTER_PROMPT_VERSION = "2026-08-18-theory-lesson-v1";
export const THEORY_LESSON_CONTENT_SCOPE = "THEORY_LESSON" as const;
export const THEORY_LESSON_SEED_ITEM_COUNT = 48;

export const theoryLessonRequestSchema = z.object({
  course: z.enum(["ELEMENTARY", "MIDDLE_HIGH", "HIGH_ADMISSION", "GENERAL_WORK"]),
  theory_category: z.string().trim().min(1),
  theory_subcategory: z.string().trim().min(1).default("AUTO"),
  lesson_level: z.coerce.number().int().min(1).max(5).default(1),
  content_count: z.coerce.number().int().min(1).max(20).default(3),
  example_mode: z.enum(["TEXTBOOK_SIMILAR", "TEXTBOOK_PLUS_NEW"]).default("TEXTBOOK_PLUS_NEW"),
  context: z.string().trim().min(1).default("AUTO"),
});

export type TheoryLessonRequestInput = z.input<typeof theoryLessonRequestSchema>;
export type TheoryLessonRequest = z.infer<typeof theoryLessonRequestSchema>;

export type TheoryLessonSeedItem = {
  courseType: "elementary" | "middle_high" | "high_univ" | "general_adult";
  lessonLevel: number;
  theoryCategory: string;
  theorySubcategory: string;
  exampleMode: "TEXTBOOK_SIMILAR" | "TEXTBOOK_PLUS_NEW";
  title: string;
  contentData: string;
  sourceNote: string;
  isActive: number;
};

export const THEORY_LESSON_MASTER_PROMPT = `
# Essay Master Theory Lesson Content Generator MASTER PROMPT

Version: ${THEORY_LESSON_MASTER_PROMPT_VERSION}

You are a Korean essay-writing lesson designer. You create theory-learning examples and in-lesson practice content for Essay Master based on "논술의 기초".

This generator is not the question-bank generator. It must never create random assessment items for question_bank.

## Scope

All outputs must be lesson theory content with content_scope="${THEORY_LESSON_CONTENT_SCOPE}".

Use this structure for every theory unit:
1. core_concept: concise concept explanation.
2. textbook_anchor: a short textbook phrase/example if safely short, otherwise a clearly labeled reconstruction.
3. textbook_similar_example: a new example using the same principle.
4. wrong_example and improved_example.
5. in_lesson_check: a quick check question used during lecture.
6. answer_feedback: immediate answer and explanation.
7. next_step: connection to the next theory or practice tool.

## Copyright And Source Boundaries

- Follow the textbook's theory terms and structure.
- Do not reproduce long textbook passages.
- Label source-derived material as "교재 원리" or "교재식 짧은 예시".
- Label new material as "유사 예시" or "확장 예시".
- If the textbook does not contain a detail, mark it as an extension.

## Learner Context

- ELEMENTARY: school, family, friends, classroom rules, short and friendly vocabulary.
- MIDDLE_HIGH: school life, career, media, community, cause-and-effect vocabulary.
- HIGH_ADMISSION: society, science, ethics, critical reading, academic reasoning.
- GENERAL_WORK: reports, meetings, proposals, email, customer communication.

## Textbook Theory Map

A. 문장 쓰기: 경제성, 동어 반복 회피, 명료성, 정확성.
A04 details: 주어와 서술어 호응, 구조어 호응, 높임법, 시제, 조사, 인용법, 문장의 접속, 피동문의 과용, 서술어의 어색한 사용.
B. 단락 쓰기: 중심 생각, 소주제문, 뒷받침 문장, 통일성, 일관성, 연속성, 연역적 전개, 귀납적 전개, 시간적 질서, 공간적 질서.
C. 요약하기: 삭제, 상위어 대치, 주제문 선택, 주제문 창출, 단락 나누기, 단락 기능, 글 전체 구조, 좋은 요약문의 조건.
D. 주제 설정과 자료 수집: 가주제, 문제의 정리, 참주제, 제목, 주제문 작성, 자료 수집과 선정.

## Required JSON Output

Return JSON object only:
{
  "items": [
    {
      "content_scope": "THEORY_LESSON",
      "course": "ELEMENTARY|MIDDLE_HIGH|HIGH_ADMISSION|GENERAL_WORK",
      "theory_category": "A01",
      "theory_subcategory": "경제성",
      "lesson_level": 1,
      "title": "레슨 제목",
      "core_concept": "핵심 개념 설명",
      "textbook_anchor": { "kind": "교재 원리|교재식 짧은 예시|재구성", "text": "짧은 내용" },
      "textbook_similar_example": { "label": "유사 예시", "text": "새 예시" },
      "wrong_example": "잘못된 예",
      "improved_example": "개선 예",
      "in_lesson_check": { "question": "확인문제", "answer": "정답" },
      "answer_feedback": "즉시 피드백",
      "next_step": "다음 단계 연결",
      "audience_adjustment": "과정별 조정 설명",
      "source_boundary": "교재 원리/유사 예시/확장 예시 구분"
    }
  ]
}
`;

export function buildTheoryLessonUserPrompt(input: TheoryLessonRequestInput) {
  const request = theoryLessonRequestSchema.parse(input);
  return [
    `course=${request.course}`,
    `theory_category=${request.theory_category}`,
    `theory_subcategory=${request.theory_subcategory}`,
    `lesson_level=${request.lesson_level}`,
    `content_count=${request.content_count}`,
    `example_mode=${request.example_mode}`,
    `context=${request.context}`,
    `content_scope=${THEORY_LESSON_CONTENT_SCOPE}`,
  ].join(" / ");
}

function contentJson(input: {
  course: string;
  category: string;
  subcategory: string;
  level: number;
  title: string;
  coreConcept: string;
  anchorKind: "교재 원리" | "교재식 짧은 예시" | "재구성";
  anchorText: string;
  similarExample: string;
  wrongExample: string;
  improvedExample: string;
  checkQuestion: string;
  checkAnswer: string;
  feedback: string;
  nextStep: string;
  audience: string;
}) {
  return JSON.stringify({
    content_scope: THEORY_LESSON_CONTENT_SCOPE,
    master_prompt_version: THEORY_LESSON_MASTER_PROMPT_VERSION,
    course: input.course,
    theory_category: input.category,
    theory_subcategory: input.subcategory,
    lesson_level: input.level,
    title: input.title,
    core_concept: input.coreConcept,
    textbook_anchor: { kind: input.anchorKind, text: input.anchorText },
    textbook_similar_example: { label: "유사 예시", text: input.similarExample },
    wrong_example: input.wrongExample,
    improved_example: input.improvedExample,
    in_lesson_check: { question: input.checkQuestion, answer: input.checkAnswer },
    answer_feedback: input.feedback,
    next_step: input.nextStep,
    audience_adjustment: input.audience,
    source_boundary: "교재의 용어와 이론 구조를 따르며, 긴 원문은 재구성하고 신규 문장은 유사 예시로 표시한다.",
  });
}

const courseProfiles = {
  elementary: {
    course: "ELEMENTARY",
    audience: "학교, 가족, 친구, 생활 규칙을 중심으로 짧은 문장과 직접 피드백을 사용한다.",
    setting: "학교와 가정",
    sentenceTopic: "학급 청소",
    paragraphTopic: "학급 도서관",
    summaryTopic: "운동장 약속",
    topicTopic: "반려동물",
    claim: "함께 쓰는 공간은 모두가 규칙을 지킬 때 편리해진다.",
  },
  middle_high: {
    course: "MIDDLE_HIGH",
    audience: "학교생활, 진로, 미디어, 공동체 문제를 소재로 원인과 결과를 분명히 드러낸다.",
    setting: "학교생활과 미디어",
    sentenceTopic: "학교 축제 안내",
    paragraphTopic: "진로 동아리",
    summaryTopic: "미디어 사용",
    topicTopic: "교내 휴대전화",
    claim: "교내 휴대전화 사용은 편의와 수업 집중을 함께 고려한 공동 규칙이 필요하다.",
  },
  high_univ: {
    course: "HIGH_ADMISSION",
    audience: "사회, 과학, 윤리 쟁점을 다루며 제시문 분석과 비판적 판단을 요구한다.",
    setting: "사회·과학·윤리 쟁점",
    sentenceTopic: "AI 추천 알고리즘",
    paragraphTopic: "기후 정책",
    summaryTopic: "과학 기술 윤리",
    topicTopic: "플랫폼 노동",
    claim: "AI 추천 알고리즘은 편의를 높이지만 정보 편향을 줄이는 선택권이 함께 보장되어야 한다.",
  },
  general_adult: {
    course: "GENERAL_WORK",
    audience: "업무보고, 회의, 제안, 이메일 맥락에서 간결성과 실행 가능성을 강조한다.",
    setting: "업무보고와 협업",
    sentenceTopic: "회의 결과 보고",
    paragraphTopic: "신규 제안서",
    summaryTopic: "고객 응대 기록",
    topicTopic: "원격 근무",
    claim: "회의 결과 보고는 결정 사항과 담당자를 먼저 제시할 때 실행력이 높아진다.",
  },
} as const;

const theoryUnits = [
  {
    level: 1,
    category: "A01",
    subcategory: "경제성",
    sourceNote: "논술의 기초 문장 쓰기 - 경제성 원리 기반 재구성",
    build: (profile: (typeof courseProfiles)[keyof typeof courseProfiles]) => ({
      title: `${profile.sentenceTopic}: 필요한 만큼만 쓰기`,
      coreConcept: "경제성은 필요한 만큼의 말만 사용해 뜻을 정확하고 간결하게 전하는 원리이다.",
      anchorKind: "교재 원리" as const,
      anchorText: "의미가 중복되는 말과 불필요한 문장 성분을 줄인다.",
      similarExample: `${profile.sentenceTopic}에서 모두 다 함께 힘을 모았다. -> ${profile.sentenceTopic}에서 함께 힘을 모았다.`,
      wrongExample: `${profile.sentenceTopic}은 꼭 반드시 다시 한번 확인해야 할 중요한 일이다.`,
      improvedExample: `${profile.sentenceTopic}은 반드시 확인해야 할 일이다.`,
      checkQuestion: "다음 표현에서 줄여야 할 중복 표현을 찾으세요: 꼭 반드시 다시 한번 확인하다.",
      checkAnswer: "꼭/반드시 중 하나와 다시 한번 중 불필요한 반복을 줄인다.",
      feedback: "강조어가 겹치면 문장이 길어지고 핵심이 흐려진다. 하나만 남겨도 뜻은 충분하다.",
      nextStep: "반복되는 단어와 구절을 다루는 A02 동어 반복 회피로 연결한다.",
    }),
  },
  {
    level: 1,
    category: "A02",
    subcategory: "동어 반복 회피",
    sourceNote: "논술의 기초 문장 쓰기 - 동어 반복 회피 원리 기반 재구성",
    build: (profile: (typeof courseProfiles)[keyof typeof courseProfiles]) => ({
      title: `${profile.sentenceTopic}: 같은 말 되풀이 줄이기`,
      coreConcept: "강조 목적이 아니라면 같은 단어, 구절, 조사, 어미의 반복은 삭제하거나 다른 말로 바꾸어야 한다.",
      anchorKind: "교재 원리" as const,
      anchorText: "반복할 필요가 없는 부분은 삭제하거나 다른 말로 바꾼다.",
      similarExample: `${profile.sentenceTopic} 안내는 안내 내용을 짧게 정리한 안내문이다. -> ${profile.sentenceTopic} 안내문은 내용을 짧게 정리한 글이다.`,
      wrongExample: `${profile.sentenceTopic}은 중요한 행사이고, 이 행사는 모두가 준비해야 할 행사이다.`,
      improvedExample: `${profile.sentenceTopic}은 중요한 행사이므로 모두가 준비해야 한다.`,
      checkQuestion: "반복되는 낱말을 찾아 한 번만 쓰도록 고쳐 보세요.",
      checkAnswer: "행사",
      feedback: "같은 낱말을 계속 쓰면 문장이 단조롭다. 삭제하거나 지시어, 다른 표현으로 바꾸면 자연스럽다.",
      nextStep: "의미가 여러 갈래로 읽히지 않도록 A03 명료성으로 이동한다.",
    }),
  },
  {
    level: 1,
    category: "A03",
    subcategory: "명료성",
    sourceNote: "논술의 기초 문장 쓰기 - 명료성 원리 기반 재구성",
    build: (profile: (typeof courseProfiles)[keyof typeof courseProfiles]) => ({
      title: `${profile.setting}: 뜻이 하나로 읽히는 문장`,
      coreConcept: "명료성은 독자가 문장을 한 가지 의미로 정확하게 이해하도록 수식 관계와 어순을 분명히 하는 원리이다.",
      anchorKind: "교재식 짧은 예시" as const,
      anchorText: "사람들이 많은, 도시 / 사람들이, 많은 도시",
      similarExample: `새로 온 친구와 선생님이 준비한 자료를 보았다. -> 새로 온 친구가, 선생님이 준비한 자료를 보았다.`,
      wrongExample: `친구가 많은 도서관에 가면 조용히 공부하기 어렵다.`,
      improvedExample: `친구가 많이 오는 도서관에 가면 조용히 공부하기 어렵다.`,
      checkQuestion: "잘못된 예는 무엇이 많은지 분명한가요?",
      checkAnswer: "분명하지 않다. 친구가 많은지 도서관이 많은지 헷갈릴 수 있다.",
      feedback: "수식어가 어느 말을 꾸미는지 가까이 두거나 쉼표로 끊어 주면 의미가 분명해진다.",
      nextStep: "문법적으로 정확한 문장을 만드는 A04 정확성으로 이어진다.",
    }),
  },
  {
    level: 1,
    category: "A04-01",
    subcategory: "주어와 서술어 호응",
    sourceNote: "논술의 기초 문장 쓰기 - 정확성 중 주술 호응 기반 재구성",
    build: (profile: (typeof courseProfiles)[keyof typeof courseProfiles]) => ({
      title: `${profile.sentenceTopic}: 주어와 서술어 맞추기`,
      coreConcept: "정확한 문장은 주어가 실제로 할 수 있는 서술어와 짝을 이루어야 한다.",
      anchorKind: "재구성" as const,
      anchorText: "공사가 시작되고 도로가 개통된다처럼 주어를 각각 맞춘다.",
      similarExample: `${profile.sentenceTopic}이 시작되고 참가자가 모일 시간은 아직 정해지지 않았다.`,
      wrongExample: `${profile.sentenceTopic}이 시작되고 학생들이 언제 모일지는 아직 정해지지 않았다.`,
      improvedExample: `${profile.sentenceTopic}이 언제 시작되고 학생들이 언제 모일지는 아직 정해지지 않았다.`,
      checkQuestion: "잘못된 예에서 첫 서술어와 둘째 서술어의 주어가 같은가요?",
      checkAnswer: "같지 않다. 시작되는 것은 행사이고 모이는 것은 학생이다.",
      feedback: "서술어마다 어울리는 주어를 확인하면 비문을 줄일 수 있다.",
      nextStep: "구조어가 서로 짝을 이루는지 살피는 A04-02로 연결한다.",
    }),
  },
  {
    level: 2,
    category: "A04-05",
    subcategory: "조사의 선택",
    sourceNote: "논술의 기초 문장 쓰기 - 조사 선택 원리 기반 재구성",
    build: (profile: (typeof courseProfiles)[keyof typeof courseProfiles]) => ({
      title: `${profile.setting}: 조사 하나가 바꾸는 정확성`,
      coreConcept: "조사는 문장 성분의 관계를 표시하므로 대상의 성격과 서술어에 맞게 골라야 한다.",
      anchorKind: "교재 원리" as const,
      anchorText: "에게는 주로 사람이나 동물 같은 유정물에 쓴다.",
      similarExample: `학교는 이 문제를 학부모에게 알리고, 교육청에 보고했다.`,
      wrongExample: `학생회는 이 문제를 학교에게 강력히 요청했다.`,
      improvedExample: `학생회는 이 문제를 학교에 강력히 요청했다.`,
      checkQuestion: "학교에게와 학교에 중 더 자연스러운 표현은 무엇인가요?",
      checkAnswer: "학교에",
      feedback: "학교는 사람이나 동물이 아니므로 이 문맥에서는 '에게'보다 '에'가 자연스럽다.",
      nextStep: "문장을 이어 쓸 때 같은 성질의 내용을 연결하는 접속 원리로 나아간다.",
    }),
  },
  {
    level: 2,
    category: "B01",
    subcategory: "중심 생각과 소주제문",
    sourceNote: "논술의 기초 단락 쓰기 - 단락 구조 기반 재구성",
    build: (profile: (typeof courseProfiles)[keyof typeof courseProfiles]) => ({
      title: `${profile.paragraphTopic}: 중심 생각 찾기`,
      coreConcept: "단락은 여러 문장이 모여 하나의 중심 생각을 나타내는 글의 한 부분이다.",
      anchorKind: "교재 원리" as const,
      anchorText: "단락은 하나의 중심 생각과 뒷받침 문장으로 이루어진다.",
      similarExample: `${profile.claim} 이 기준이 있으면 갈등을 줄이고 참여자가 무엇을 해야 하는지 알 수 있다.`,
      wrongExample: `${profile.claim} 어제 날씨는 흐렸고 점심 메뉴는 인기가 많았다.`,
      improvedExample: `${profile.claim} 그래서 규칙의 목적과 적용 방법을 함께 안내해야 한다.`,
      checkQuestion: "개선 예에서 중심 생각은 무엇인가요?",
      checkAnswer: profile.claim,
      feedback: "중심 생각은 단락의 방향을 정하고, 나머지 문장은 그 생각을 설명하거나 뒷받침한다.",
      nextStep: "중심 생각에서 벗어난 문장을 가려내는 B04 통일성으로 이동한다.",
    }),
  },
  {
    level: 2,
    category: "B04",
    subcategory: "통일성",
    sourceNote: "논술의 기초 단락 쓰기 - 통일성 원리 기반 재구성",
    build: (profile: (typeof courseProfiles)[keyof typeof courseProfiles]) => ({
      title: `${profile.paragraphTopic}: 한 단락에 하나의 중심 생각`,
      coreConcept: "통일성은 단락의 모든 문장이 하나의 목표와 중심 생각을 향해 모이는 성질이다.",
      anchorKind: "교재 원리" as const,
      anchorText: "한 단락에는 반드시 하나의 중심 생각만을 다룬다.",
      similarExample: `${profile.paragraphTopic}은 공동의 기준이 있을 때 효과적으로 운영된다. 그래서 이용 시간과 정리 방법을 함께 정해야 한다.`,
      wrongExample: `${profile.paragraphTopic}은 규칙이 필요하다. 나는 어제 점심에 떡볶이를 먹었다. 규칙을 지키면 갈등이 줄어든다.`,
      improvedExample: `${profile.paragraphTopic}은 규칙이 필요하다. 이용 시간과 정리 방법을 정하면 갈등이 줄어든다.`,
      checkQuestion: "잘못된 예에서 단락의 중심 생각과 관련 없는 문장을 고르세요.",
      checkAnswer: "나는 어제 점심에 떡볶이를 먹었다.",
      feedback: "그 문장은 단락의 중심 생각인 규칙과 관련이 없어 통일성을 해친다.",
      nextStep: "문장들이 자연스럽게 이어지는 B05 일관성과 연속성으로 연결한다.",
    }),
  },
  {
    level: 2,
    category: "B07",
    subcategory: "연역적 전개",
    sourceNote: "논술의 기초 단락 전개 - 연역적 전개 기반 재구성",
    build: (profile: (typeof courseProfiles)[keyof typeof courseProfiles]) => ({
      title: `${profile.paragraphTopic}: 주장 먼저, 근거 나중`,
      coreConcept: "연역적 전개는 중심 생각을 먼저 밝히고 근거와 사례로 설명하거나 증명하는 방식이다.",
      anchorKind: "교재 원리" as const,
      anchorText: "소주제문 + 뒷받침 문장의 형식이다.",
      similarExample: `${profile.claim} 첫째, 기준이 있으면 행동을 예측할 수 있다. 둘째, 갈등이 생겼을 때 판단 근거가 생긴다.`,
      wrongExample: `기준이 있으면 행동을 예측할 수 있다. 갈등이 줄어든다. 그래서 무엇에 대한 글인지 나중에 생각해 보자.`,
      improvedExample: `${profile.claim} 기준은 행동을 예측하게 하고 갈등을 줄이는 근거가 된다.`,
      checkQuestion: "연역적 전개에서 보통 먼저 나와야 하는 문장은 무엇인가요?",
      checkAnswer: "중심 생각 또는 소주제문",
      feedback: "논술문에서는 먼저 판단을 밝히면 뒤의 근거가 무엇을 설명하는지 분명해진다.",
      nextStep: "구체적 사례에서 결론으로 가는 귀납적 전개와 비교한다.",
    }),
  },
  {
    level: 3,
    category: "C01",
    subcategory: "삭제와 핵심 보존",
    sourceNote: "논술의 기초 요약하기 - 삭제 규칙 기반 재구성",
    build: (profile: (typeof courseProfiles)[keyof typeof courseProfiles]) => ({
      title: `${profile.summaryTopic}: 요약할 때 버릴 것과 남길 것`,
      coreConcept: "요약은 글의 중심 내용을 보존하면서 사소한 설명, 반복, 지나친 예시를 삭제하는 활동이다.",
      anchorKind: "교재 원리" as const,
      anchorText: "사소하거나 불필요한 내용, 반복되는 내용은 삭제한다.",
      similarExample: `${profile.summaryTopic}은 모두가 지켜야 효과가 있다. 안내 문구의 색깔이나 게시판 위치보다 약속의 이유와 내용이 핵심이다.`,
      wrongExample: `${profile.summaryTopic} 안내문은 파란색 종이에 붙었고 글씨가 컸으며, 여러 사람이 보았다.`,
      improvedExample: `${profile.summaryTopic} 안내문은 모두가 지켜야 할 약속의 이유와 내용을 제시했다.`,
      checkQuestion: "요약에서 삭제해도 되는 정보는 무엇인가요?",
      checkAnswer: "색깔, 게시판 위치처럼 핵심 주장 이해에 꼭 필요하지 않은 세부 정보.",
      feedback: "요약은 자세한 묘사가 아니라 중심 생각과 주요 근거를 남기는 작업이다.",
      nextStep: "삭제 후 여러 하위 내용을 상위어로 묶는 C02 상위어 대치로 이동한다.",
    }),
  },
  {
    level: 3,
    category: "C02",
    subcategory: "상위어 대치",
    sourceNote: "논술의 기초 요약하기 - 상위어 대치 규칙 기반 재구성",
    build: (profile: (typeof courseProfiles)[keyof typeof courseProfiles]) => ({
      title: `${profile.summaryTopic}: 여러 내용을 한 말로 묶기`,
      coreConcept: "상위어 대치는 여러 하위 개념이나 사례를 더 넓은 개념으로 묶어 요약문을 짧고 분명하게 만드는 방법이다.",
      anchorKind: "교재 원리" as const,
      anchorText: "하위 개념들은 상위 개념으로 대치한다.",
      similarExample: `알림장, 게시판, 문자 안내 -> 공지 방법`,
      wrongExample: `${profile.summaryTopic}을 알리기 위해 알림장, 게시판, 문자 안내, 교실 방송을 사용했다.`,
      improvedExample: `${profile.summaryTopic}을 알리기 위해 여러 공지 방법을 사용했다.`,
      checkQuestion: "알림장, 게시판, 문자 안내를 묶는 상위어는 무엇인가요?",
      checkAnswer: "공지 방법",
      feedback: "요약문의 길이가 짧아질수록 여러 사례를 상위어로 묶는 힘이 중요해진다.",
      nextStep: "글 안에 있는 핵심 문장을 고르는 C03 또는 직접 만드는 C04로 이어진다.",
    }),
  },
  {
    level: 3,
    category: "C04",
    subcategory: "주제문 창출",
    sourceNote: "논술의 기초 요약하기 - 주제문 창출 과정 기반 재구성",
    build: (profile: (typeof courseProfiles)[keyof typeof courseProfiles]) => ({
      title: `${profile.summaryTopic}: 숨어 있는 주제문 만들기`,
      coreConcept: "글 속에 주제문이 직접 없을 때는 반복되는 말과 단락의 소주제를 종합해 새로운 주제문을 만든다.",
      anchorKind: "교재 원리" as const,
      anchorText: "글 속에 주제문이 없을 때는 스스로 창출한다.",
      similarExample: `여러 안내와 사례를 종합하면 '${profile.claim}'이라는 주제문을 만들 수 있다.`,
      wrongExample: `${profile.summaryTopic}은 여러 가지가 있다.`,
      improvedExample: profile.claim,
      checkQuestion: "잘못된 예가 주제문으로 약한 까닭은 무엇인가요?",
      checkAnswer: "무엇을 주장하는지 구체적 판단이 드러나지 않는다.",
      feedback: "좋은 주제문은 소재만 말하지 않고 글쓴이의 판단을 한 문장으로 드러낸다.",
      nextStep: "주제 설정에서 가주제와 참주제의 차이를 배운다.",
    }),
  },
  {
    level: 4,
    category: "D03",
    subcategory: "참주제와 주제문",
    sourceNote: "논술의 기초 주제 설정과 주제문 작성 원리 기반 재구성",
    build: (profile: (typeof courseProfiles)[keyof typeof courseProfiles]) => ({
      title: `${profile.topicTopic}: 넓은 소재를 쓸 수 있는 주장으로 좁히기`,
      coreConcept: "가주제는 넓은 소재이고 참주제는 글쓴이의 구체적인 태도와 판단이 담긴 좁은 주제이다.",
      anchorKind: "교재식 짧은 예시" as const,
      anchorText: "철학 -> 철학과 현실의 관계",
      similarExample: `${profile.topicTopic} -> ${profile.topicTopic}에 대한 공동 규칙은 권리와 책임을 함께 고려해야 한다.`,
      wrongExample: `${profile.topicTopic}에 대하여`,
      improvedExample: `${profile.topicTopic}은 구성원의 권리와 공동체 책임을 함께 고려해 정해야 한다.`,
      checkQuestion: `다음 중 주제문으로 더 적절한 것은 무엇인가요? A. ${profile.topicTopic}에 대하여 B. ${profile.topicTopic}은 권리와 책임을 함께 고려해야 한다.`,
      checkAnswer: "B",
      feedback: "B는 완전한 문장이고 글쓴이의 판단이 드러나므로 논술 주제문에 더 적합하다.",
      nextStep: "주제 설정 위저드에서 가주제를 참주제로 좁히고 근거를 붙인다.",
    }),
  },
] as const;

export function buildTheoryLessonSeedItems(): TheoryLessonSeedItem[] {
  return Object.entries(courseProfiles).flatMap(([courseType, profile]) => {
    const typedCourse = courseType as TheoryLessonSeedItem["courseType"];
    return theoryUnits.map((unit) => {
      const data = unit.build(profile);
      return {
        courseType: typedCourse,
        lessonLevel: unit.level,
        theoryCategory: unit.category,
        theorySubcategory: unit.subcategory,
        exampleMode: "TEXTBOOK_PLUS_NEW" as const,
        title: data.title,
        contentData: contentJson({
          course: profile.course,
          category: unit.category,
          subcategory: unit.subcategory,
          level: unit.level,
          title: data.title,
          coreConcept: data.coreConcept,
          anchorKind: data.anchorKind,
          anchorText: data.anchorText,
          similarExample: data.similarExample,
          wrongExample: data.wrongExample,
          improvedExample: data.improvedExample,
          checkQuestion: data.checkQuestion,
          checkAnswer: data.checkAnswer,
          feedback: data.feedback,
          nextStep: data.nextStep,
          audience: profile.audience,
        }),
        sourceNote: unit.sourceNote,
        isActive: 1,
      };
    });
  });
}
