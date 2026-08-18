import { z } from "zod";

export const THEORY_LESSON_MASTER_PROMPT_VERSION = "2026-08-18-theory-lesson-v1";
export const THEORY_LESSON_CONTENT_SCOPE = "THEORY_LESSON" as const;

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

export const THEORY_LESSON_MASTER_PROMPT = `당신은 한국어 논술·글쓰기 이론 수업 설계자다. 이 출력은 question_bank의 랜덤 평가 문항이 아니라 content_scope="THEORY_LESSON"인 레슨 이론 콘텐츠다. 모든 단원은 core_concept, 교재 원리 또는 짧은 재구성(textbook_anchor), 신규 유사 예시, wrong_example, improved_example, in_lesson_check, answer_feedback, next_step을 포함한다. 교재의 긴 원문을 복제하지 않고 출처 기반 재구성은 '교재 원리' 또는 '교재식 짧은 예시', 새로운 문장은 '유사 예시'로 구분한다. 과정별 맥락은 초등=생활·학급, 중고등=진로·미디어·공동체, 고등/대입=사회·과학·윤리, 일반/직장인=보고·회의·제안·고객 소통이다. JSON만 반환한다.`;

export function buildTheoryLessonUserPrompt(input: TheoryLessonRequestInput) {
  const request = theoryLessonRequestSchema.parse(input);
  return [`course=${request.course}`, `theory_category=${request.theory_category}`, `theory_subcategory=${request.theory_subcategory}`, `lesson_level=${request.lesson_level}`, `content_count=${request.content_count}`, `example_mode=${request.example_mode}`, `context=${request.context}`, `content_scope=${THEORY_LESSON_CONTENT_SCOPE}`].join(" / ");
}

const profiles = {
  elementary: { course: "ELEMENTARY", level: 1, audience: "학교, 가족, 친구, 생활 규칙을 중심으로 짧은 문장과 직접 피드백을 사용한다.", topics: ["학급 청소", "학급 도서관", "운동장 약속", "반려동물"] },
  middle_high: { course: "MIDDLE_HIGH", level: 2, audience: "학교생활, 진로, 미디어, 공동체 문제를 소재로 원인과 결과를 분명히 드러낸다.", topics: ["학교 축제 안내", "진로 동아리", "미디어 사용", "교내 휴대전화"] },
  high_univ: { course: "HIGH_ADMISSION", level: 3, audience: "사회, 과학, 윤리 쟁점을 다루며 제시문 분석과 비판적 판단을 요구한다.", topics: ["AI 추천 알고리즘", "기후 정책", "과학 기술 윤리", "플랫폼 노동"] },
  general_adult: { course: "GENERAL_WORK", level: 2, audience: "업무보고, 회의, 제안, 이메일 맥락에서 간결성과 실행 가능성을 강조한다.", topics: ["회의 결과 보고", "신규 제안서", "고객 응대 기록", "원격 근무"] },
} as const;

const units = [
  { category: "A01", subcategory: "경제성", title: "필요한 만큼만 쓰기", concept: "경제성은 필요한 만큼의 말만 사용해 뜻을 정확하고 간결하게 전하는 원리이다.", anchor: "의미가 중복되는 말과 불필요한 문장 성분을 줄인다.", wrong: (topic: string) => `${topic}은 꼭 반드시 다시 한번 확인해야 할 중요한 일이다.`, improved: (topic: string) => `${topic}은 반드시 확인해야 할 일이다.`, check: "'꼭 반드시 다시 한번 확인하다'에서 줄일 수 있는 표현은 무엇인가요?", answer: "꼭/반드시 중 하나와 다시 한번 중 불필요한 반복을 줄인다.", next: "반복되는 단어와 구절을 다루는 동어 반복 회피로 연결한다." },
  { category: "B04", subcategory: "통일성과 일관성", title: "한 단락에 하나의 중심 생각", concept: "단락은 하나의 중심 생각과 이를 뒷받침하는 문장으로 이루어져야 한다.", anchor: "한 단락에는 반드시 하나의 중심 생각만을 다룬다.", wrong: (topic: string) => `${topic}은 규칙이 필요하다. 나는 어제 점심에 떡볶이를 먹었다. 규칙을 지키면 갈등이 줄어든다.`, improved: (topic: string) => `${topic}은 규칙이 필요하다. 이용 기준을 정하면 갈등이 줄어든다.`, check: "잘못된 예에서 중심 생각과 관련 없는 문장을 고르세요.", answer: "나는 어제 점심에 떡볶이를 먹었다.", next: "소주제문과 뒷받침 문장의 관계를 확인한 뒤 단락 재구성으로 연습한다." },
  { category: "C01", subcategory: "삭제와 핵심 보존", title: "요약할 때 버릴 것과 남길 것", concept: "요약은 글의 중심 내용을 보존하면서 사소한 설명, 반복, 지나친 예시를 삭제하는 활동이다.", anchor: "사소하거나 불필요한 내용, 반복되는 내용은 삭제한다.", wrong: (topic: string) => `${topic} 안내문은 파란색 종이에 붙었고 글씨가 컸으며 여러 사람이 보았다.`, improved: (topic: string) => `${topic} 안내문은 모두가 지켜야 할 약속의 이유와 내용을 제시했다.`, check: "요약에서 삭제해도 되는 정보는 무엇인가요?", answer: "색깔이나 위치처럼 핵심 주장 이해에 꼭 필요하지 않은 세부 정보.", next: "하위 내용을 상위어로 묶는 상위어 대치로 이동한다." },
  { category: "D03", subcategory: "참주제와 주제문", title: "넓은 소재를 쓸 수 있는 주장으로 좁히기", concept: "가주제는 넓은 소재이고 참주제는 글쓴이의 구체적인 태도와 판단이 담긴 좁은 주제이다.", anchor: "철학 → 철학과 현실의 관계", wrong: (topic: string) => `${topic}에 대하여`, improved: (topic: string) => `${topic}은 권리와 공동체 책임을 함께 고려해 정해야 한다.`, check: "두 문장 중 논술 주제문으로 더 적절한 것은 무엇인가요?", answer: "글쓴이의 판단이 드러나는 완전한 문장이다.", next: "주제 설정 위저드에서 가주제를 참주제로 좁히고 근거를 붙인다." },
] as const;

export function buildTheoryLessonSeedItems(): TheoryLessonSeedItem[] {
  return Object.entries(profiles).flatMap(([courseType, profile]) => units.map((unit, index) => {
    const topic = profile.topics[index];
    const title = `${topic}: ${unit.title}`;
    return {
      courseType: courseType as TheoryLessonSeedItem["courseType"], lessonLevel: profile.level, theoryCategory: unit.category, theorySubcategory: unit.subcategory, exampleMode: "TEXTBOOK_PLUS_NEW", title,
      contentData: JSON.stringify({ content_scope: THEORY_LESSON_CONTENT_SCOPE, master_prompt_version: THEORY_LESSON_MASTER_PROMPT_VERSION, course: profile.course, theory_category: unit.category, theory_subcategory: unit.subcategory, lesson_level: profile.level, title, core_concept: unit.concept, textbook_anchor: { kind: "교재 원리", text: unit.anchor }, textbook_similar_example: { label: "유사 예시", text: `${topic}에서 원리를 적용해 문장을 고쳐 봅시다.` }, wrong_example: unit.wrong(topic), improved_example: unit.improved(topic), in_lesson_check: { question: unit.check, answer: unit.answer }, answer_feedback: "핵심 개념과 예문을 함께 확인한 뒤 직접 고쳐 보세요.", next_step: unit.next, audience_adjustment: profile.audience, source_boundary: "교재의 용어와 이론 구조를 따르며, 긴 원문은 재구성하고 신규 문장은 유사 예시로 표시한다." }),
      sourceNote: `논술의 기초 ${unit.subcategory} 원리 기반 재구성`, isActive: 1,
    };
  }));
}
