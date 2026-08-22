import { z } from "zod";
import { invokeLLM, listLLMModels } from "./_core/llm";

export const THEORY_LESSON_MASTER_PROMPT_VERSION = "2026-08-18-theory-lesson-v1";
export const THEORY_LESSON_DATA_VERSION = "2026-08-22-passage-v1";
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

export const THEORY_LESSON_MASTER_PROMPT = `당신은 한국어 논술·글쓰기 이론 수업 설계자다. 이 출력은 question_bank의 랜덤 평가 문항이 아니라 content_scope="THEORY_LESSON"인 레슨 이론 콘텐츠다. 모든 단원은 core_concept, 교재 원리 또는 짧은 재구성(textbook_anchor), 신규 유사 예시, wrong_example, improved_example, in_lesson_check, answer_feedback, next_step을 포함한다. 고교/대입과 일반/직장인 과정은 lesson_passage와 lecture_practice_items를 포함해 강의 중 읽고 분석할 실제형 지문과 즉시 확인문항을 제공한다. 교재의 긴 원문을 복제하지 않고 출처 기반 재구성은 '교재 원리' 또는 '교재식 짧은 예시', 새로운 문장은 '유사 예시'로 구분한다. 과정별 맥락은 초등=생활·학급, 중고등=진로·미디어·공동체, 고등/대입=사회·과학·윤리, 일반/직장인=보고·회의·제안·고객 소통이다. JSON만 반환한다.`;

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
    const lessonExtras = buildAdvancedLessonExtras(courseType as TheoryLessonSeedItem["courseType"], unit.category, topic);
    return {
      courseType: courseType as TheoryLessonSeedItem["courseType"], lessonLevel: profile.level, theoryCategory: unit.category, theorySubcategory: unit.subcategory, exampleMode: "TEXTBOOK_PLUS_NEW", title,
      contentData: JSON.stringify({ content_scope: THEORY_LESSON_CONTENT_SCOPE, master_prompt_version: THEORY_LESSON_MASTER_PROMPT_VERSION, data_version: THEORY_LESSON_DATA_VERSION, course: profile.course, theory_category: unit.category, theory_subcategory: unit.subcategory, lesson_level: profile.level, title, core_concept: unit.concept, textbook_anchor: { kind: "교재 원리", text: unit.anchor }, textbook_similar_example: { label: "유사 예시", text: `${topic}에서 원리를 적용해 문장을 고쳐 봅시다.` }, wrong_example: unit.wrong(topic), improved_example: unit.improved(topic), in_lesson_check: { question: unit.check, answer: unit.answer }, answer_feedback: "핵심 개념과 예문을 함께 확인한 뒤 직접 고쳐 보세요.", next_step: unit.next, audience_adjustment: profile.audience, ...(lessonExtras ?? {}), source_boundary: lessonExtras ? "학습자료의 논제·제시문 구성 방식을 참고해 새로 재구성한 강의용 지문이며, 교재 원문과 신규 유사 예시를 구분한다." : "교재의 용어와 이론 구조를 따르며, 긴 원문은 재구성하고 신규 문장은 유사 예시로 표시한다." }),
      sourceNote: `논술의 기초 ${unit.subcategory} 원리 기반 재구성`, isActive: 1,
    };
  }));
}

type AdvancedLessonExtras = {
  lesson_passage: {
    label: string;
    source_type: string;
    text: string;
    tasks: string[];
    model_answer: string;
    feedback: string;
  };
  lecture_practice_items: Array<{ question: string; answer: string; explanation: string }>;
};

function buildAdvancedLessonExtras(courseType: TheoryLessonSeedItem["courseType"], category: string, _topic: string) {
  if (courseType === "high_univ") return highAdmissionExtras[category] ?? highAdmissionExtras.A01;
  if (courseType === "general_adult") return generalWorkExtras[category] ?? generalWorkExtras.A01;
  return null;
}

const highAdmissionExtras: Record<string, AdvancedLessonExtras> = {
  A01: {
    lesson_passage: {
      label: "대입형 제시문 기반 재구성",
      source_type: "자료 유형 기반 재구성",
      text: "제시문 (가)는 맞춤형 추천 기술이 이용자의 탐색 시간을 줄이고 관심 있는 정보를 빠르게 연결한다고 본다. 반면 제시문 (나)는 추천 기술이 비슷한 관점만 반복적으로 노출해 판단의 폭을 좁힐 수 있다고 지적한다. 두 글은 모두 기술이 선택에 영향을 준다는 점을 인정하지만, (가)는 효율을, (나)는 자율적 판단의 약화를 더 중시한다.",
      tasks: ["두 제시문의 공통 주제를 한 문장으로 쓰시오.", "반복되거나 장황한 표현을 줄여 120자 안팎으로 요약하시오."],
      model_answer: "추천 기술은 정보 선택을 편리하게 하지만, 이용자의 판단 범위를 좁힐 위험도 있다.",
      feedback: "공통 주제와 차이점을 모두 살리되 '빠르게', '반복적으로' 같은 세부 표현은 필요할 때만 남긴다.",
    },
    lecture_practice_items: [
      { question: "위 지문에서 요약에 반드시 남겨야 할 대비 축은 무엇인가요?", answer: "효율성 대 자율적 판단의 약화", explanation: "두 제시문의 핵심 차이를 만드는 기준이므로 삭제하면 비교 요약이 흐려집니다." },
      { question: "'이용자의 탐색 시간을 줄이고 관심 있는 정보를 빠르게 연결한다'를 더 간결하게 고치세요.", answer: "이용자가 필요한 정보를 빠르게 찾게 한다.", explanation: "동일 의미를 더 짧은 술어 구조로 바꾸어 경제성을 높입니다." },
    ],
  },
  B04: {
    lesson_passage: {
      label: "인문논술 분류·요약형 재구성",
      source_type: "자료 유형 기반 재구성",
      text: "제시문 (가)는 사회가 기본 권리를 넓게 보장할수록 개인의 출발선 차이가 완화된다고 본다. 제시문 (나)는 국가가 선의를 내세워 개입하더라도 복잡한 사회의 결과를 예측하기 어렵다고 말한다. 제시문 (다)는 제도에 순응하는 집단의 모습을 통해 개인의 자유가 쉽게 위축되는 장면을 보여 준다. 이 세 제시문은 공동체의 개입과 개인의 자유라는 같은 문제를 다루지만, 각 문단이 맡은 기능은 서로 다르다.",
      tasks: ["각 제시문의 중심 생각을 한 문장씩 쓰시오.", "세 문장을 하나의 통일된 비교 단락으로 배열하시오."],
      model_answer: "(가)는 권리 보장을 통한 평등을, (나)는 국가 개입의 한계를, (다)는 집단 질서 속 자유의 위축을 강조한다.",
      feedback: "한 단락 안에서 제도, 개입, 자유라는 중심어가 유지되어야 통일성이 생깁니다.",
    },
    lecture_practice_items: [
      { question: "세 제시문을 묶는 상위 주제는 무엇인가요?", answer: "공동체 질서와 개인 자유의 관계", explanation: "각 제시문의 소재는 달라도 모두 제도와 개인의 관계를 다룹니다." },
      { question: "비교 단락에 넣으면 통일성을 해치는 문장은 무엇인가요?", answer: "특정 학교의 시험 시간표처럼 중심 쟁점과 무관한 사실", explanation: "단락의 모든 문장은 공동체 개입과 개인 자유라는 중심 생각을 뒷받침해야 합니다." },
    ],
  },
  C01: {
    lesson_passage: {
      label: "과학논술 설명형 재구성",
      source_type: "자료 유형 기반 재구성",
      text: "어떤 면역 질환은 외부 물질을 공격하던 항체가 몸속 단백질을 비슷한 구조로 잘못 인식할 때 악화된다. 이때 손상 부위에 염증이 생기면 면역 세포가 평소보다 쉽게 모여들고, 장벽이 약해진 조직 안으로 침투할 가능성도 커진다. 따라서 같은 감염 경험을 가진 사람이라도 유전적 조건, 염증 여부, 조직의 방어 상태에 따라 증상이 다르게 나타날 수 있다.",
      tasks: ["발병 과정을 원인-과정-결과 순서로 요약하시오.", "사소한 부연을 삭제하고 핵심 인과만 남기시오."],
      model_answer: "항체가 몸속 단백질을 외부 물질처럼 오인하고 염증으로 면역 세포 침투가 쉬워지면 조직 손상이 악화된다.",
      feedback: "요약에서는 병명보다 '오인-침투-손상'이라는 인과 흐름을 남기는 것이 중요합니다.",
    },
    lecture_practice_items: [
      { question: "이 지문에서 삭제하면 안 되는 핵심 과정 세 가지는 무엇인가요?", answer: "항체의 오인, 면역 세포 침투, 조직 손상", explanation: "세 요소가 빠지면 과학적 설명의 인과가 끊어집니다." },
      { question: "'같은 감염 경험을 가진 사람이라도...' 문장의 역할은 무엇인가요?", answer: "조건에 따라 결과가 달라질 수 있음을 보충한다.", explanation: "핵심 인과 뒤에 변수를 설명하는 보조 문장입니다." },
    ],
  },
  D03: {
    lesson_passage: {
      label: "대입 논제화 연습 지문",
      source_type: "자료 유형 기반 재구성",
      text: "플랫폼 노동은 일감을 빠르게 연결해 노동자가 시간과 장소를 선택할 수 있게 한다. 그러나 알고리즘이 배차, 평점, 노출 순서를 통제하면 노동자는 형식상 독립되어 있어도 실질적으로는 플랫폼의 규칙에 종속될 수 있다. 그러므로 플랫폼 노동을 단순히 자유로운 부업으로 볼지, 새로운 고용 관계로 볼지에 따라 보호 제도의 방향이 달라진다.",
      tasks: ["가주제와 참주제를 구분하시오.", "찬반이 아니라 판단 기준이 드러나는 주제문을 쓰시오."],
      model_answer: "플랫폼 노동의 자유는 알고리즘 통제 정도와 사회적 보호 필요성을 함께 기준으로 판단해야 한다.",
      feedback: "참주제는 소재명에 머물지 않고 판단 기준과 글쓴이의 방향을 포함해야 합니다.",
    },
    lecture_practice_items: [
      { question: "'플랫폼 노동'은 가주제인가요, 참주제인가요?", answer: "가주제", explanation: "넓은 소재일 뿐 아직 판단이나 쟁점이 담기지 않았습니다." },
      { question: "참주제로 발전시키려면 어떤 요소가 필요하나요?", answer: "판단 기준과 구체적 관점", explanation: "알고리즘 통제, 노동자 보호처럼 논증할 기준이 들어가야 합니다." },
    ],
  },
} as const;

const generalWorkExtras: Record<string, AdvancedLessonExtras> = {
  A01: {
    lesson_passage: {
      label: "업무보고 지문",
      source_type: "업무 상황 재구성",
      text: "지난 2주 동안 고객 문의 응답 시간이 평균 18시간에서 11시간으로 줄었다. 자동 분류 양식을 적용한 뒤 단순 문의가 담당자에게 바로 배정되었기 때문이다. 다만 환불 문의는 승인 절차가 남아 있어 처리 시간이 거의 줄지 않았다. 다음 주에는 환불 승인 기준을 한 장으로 정리해 담당자 교육에 반영할 필요가 있다.",
      tasks: ["임원 보고용 핵심 요약을 2문장으로 쓰시오.", "중복되는 표현 없이 다음 행동을 포함하시오."],
      model_answer: "자동 분류 양식 도입 후 평균 응답 시간이 18시간에서 11시간으로 단축됐다. 환불 문의는 승인 기준을 정리해 담당자 교육에 반영해야 한다.",
      feedback: "성과 수치와 남은 과제를 분리하면 보고 문장이 짧고 분명해집니다.",
    },
    lecture_practice_items: [
      { question: "보고 요약에서 반드시 남겨야 할 수치는 무엇인가요?", answer: "18시간에서 11시간으로 단축", explanation: "성과 판단의 근거가 되는 핵심 변화입니다." },
      { question: "'다음 주에는 ... 필요가 있다'를 실행 문장으로 바꾸세요.", answer: "다음 주 환불 승인 기준을 정리해 담당자 교육에 반영한다.", explanation: "명사형 표현을 동작 중심 문장으로 고치면 간결해집니다." },
    ],
  },
  B04: {
    lesson_passage: {
      label: "회의록 정리 지문",
      source_type: "업무 상황 재구성",
      text: "신규 온보딩 개선 회의에서 세 가지 의견이 나왔다. 영업팀은 첫 주에 제품 데모 시간을 늘려야 한다고 했다. 고객지원팀은 자주 묻는 질문을 먼저 제공하면 반복 문의가 줄어든다고 했다. 인사팀은 교육 자료가 부서마다 달라 신입 구성원이 혼란을 겪는다고 보았다. 회의의 결론은 공통 교육 자료를 만들고, 부서별 세부 교육은 둘째 주부터 진행하자는 것이었다.",
      tasks: ["회의 내용을 하나의 중심 생각으로 묶으시오.", "결론과 관련 없는 세부를 제거해 보고 문단을 만드시오."],
      model_answer: "온보딩 혼란을 줄이기 위해 첫 주에는 공통 교육 자료와 FAQ를 제공하고, 부서별 세부 교육은 둘째 주부터 진행하기로 했다.",
      feedback: "여러 부서 의견을 나열하는 데서 끝내지 말고 회의 결론을 중심으로 재배열해야 합니다.",
    },
    lecture_practice_items: [
      { question: "이 문단의 중심 생각은 무엇인가요?", answer: "온보딩 자료와 일정의 표준화", explanation: "세 의견이 모두 신입 교육의 혼란을 줄이는 방향으로 모입니다." },
      { question: "보고 문단에서 부서명을 모두 반복하지 않아도 되는 이유는 무엇인가요?", answer: "결론 중심 요약에서는 세부 발언자보다 결정 사항이 중요하기 때문", explanation: "통일성 있는 보고서는 결정과 실행 항목을 중심에 둡니다." },
    ],
  },
  C01: {
    lesson_passage: {
      label: "고객응대 기록 요약 지문",
      source_type: "업무 상황 재구성",
      text: "고객은 정기 결제 해지 후에도 알림 메일을 받았다고 문의했다. 확인 결과 결제는 정상 해지되었지만 마케팅 수신 동의가 별도로 남아 있었다. 상담자는 수신 동의를 해제하고, 결제 정보와 마케팅 수신 설정이 분리되어 있음을 안내했다. 고객은 해지 절차에서 두 항목이 따로 표시되면 혼란이 줄어들 것이라고 제안했다.",
      tasks: ["상담 기록을 내부 공유용으로 요약하시오.", "고객 감정 표현보다 원인과 개선 제안을 남기시오."],
      model_answer: "결제 해지 후에도 마케팅 수신 동의가 남아 알림 메일이 발송됐다. 수신 동의를 해제했으며, 해지 화면에서 결제와 마케팅 설정을 분리 안내할 필요가 있다.",
      feedback: "상담 요약은 발생 원인, 처리 내용, 개선 제안을 남기고 반복 설명은 삭제합니다.",
    },
    lecture_practice_items: [
      { question: "요약에 남겨야 할 세 요소는 무엇인가요?", answer: "원인, 처리 내용, 개선 제안", explanation: "업무 공유자가 다음 조치를 판단하는 데 필요한 정보입니다." },
      { question: "삭제해도 되는 내용은 무엇인가요?", answer: "고객이 여러 번 같은 불편을 말했다는 반복 묘사", explanation: "감정 배경은 필요할 때만 짧게 남기고 핵심 조치에 집중합니다." },
    ],
  },
  D03: {
    lesson_passage: {
      label: "제안서 주제 설정 지문",
      source_type: "업무 상황 재구성",
      text: "사내 지식 공유 채널의 글 수는 늘었지만 실제 검색 이용률은 낮다. 구성원 인터뷰에서는 자료 제목이 제각각이고 최신 여부를 확인하기 어렵다는 의견이 반복되었다. 따라서 단순히 게시물을 늘리는 방식보다 제목 규칙, 갱신 표시, 추천 태그를 표준화하는 방식이 더 효과적일 수 있다.",
      tasks: ["가주제와 참주제를 구분하시오.", "실행 방향이 드러나는 제안서 제목을 쓰시오."],
      model_answer: "가주제는 사내 지식 공유이고, 참주제는 검색 이용률을 높이기 위한 자료 표준화 방안이다.",
      feedback: "업무 제안의 참주제는 문제 상황과 해결 방향을 함께 담아야 검토자가 바로 판단할 수 있습니다.",
    },
    lecture_practice_items: [
      { question: "'사내 지식 공유'만으로 부족한 이유는 무엇인가요?", answer: "너무 넓어 해결 방향이 보이지 않기 때문", explanation: "제안서 제목은 문제와 실행 방향을 함께 보여 주어야 합니다." },
      { question: "더 적절한 제목을 쓰세요.", answer: "검색 이용률 개선을 위한 지식 자료 제목·태그 표준화 제안", explanation: "대상, 목적, 실행 수단이 모두 드러납니다." },
    ],
  },
} as const;

const theoryPayloadSchema = z.object({
  core_concept: z.string().trim().min(24),
  textbook_anchor: z.object({ kind: z.string().trim().min(2), text: z.string().trim().min(12) }),
  textbook_similar_example: z.object({ label: z.string().trim().min(2), text: z.string().trim().min(12) }),
  wrong_example: z.string().trim().min(8),
  improved_example: z.string().trim().min(8),
  in_lesson_check: z.object({ question: z.string().trim().min(8), answer: z.string().trim().min(4) }),
  lesson_passage: z.object({
    label: z.string().trim().min(2),
    source_type: z.string().trim().min(2),
    text: z.string().trim().min(80),
    tasks: z.array(z.string().trim().min(6)).min(1).max(4),
    model_answer: z.string().trim().min(12),
    feedback: z.string().trim().min(12),
  }).optional(),
  lecture_practice_items: z.array(z.object({
    question: z.string().trim().min(8),
    answer: z.string().trim().min(4),
    explanation: z.string().trim().min(8),
  })).min(1).max(4).optional(),
  answer_feedback: z.string().trim().min(8),
  next_step: z.string().trim().min(8),
  source_boundary: z.string().trim().min(12),
});

export type TheoryLessonDraftCandidate = {
  courseType: TheoryLessonSeedItem["courseType"];
  lessonLevel: number;
  theoryCategory: string;
  theorySubcategory: string;
  exampleMode: TheoryLessonSeedItem["exampleMode"];
  title: string;
  contentData: string;
  sourceNote: string;
  qaIssues: string[];
};

const courseTypeMap = {
  ELEMENTARY: "elementary",
  MIDDLE_HIGH: "middle_high",
  HIGH_ADMISSION: "high_univ",
  GENERAL_WORK: "general_adult",
} as const;

const generatedTheorySchema = {
  type: "object",
  properties: {
    items: {
      type: "array",
      minItems: 1,
      maxItems: 6,
      items: {
        type: "object",
        properties: {
          title: { type: "string" },
          theory_subcategory: { type: "string" },
          core_concept: { type: "string" },
          textbook_anchor: { type: "object", properties: { kind: { type: "string" }, text: { type: "string" } }, required: ["kind", "text"], additionalProperties: false },
          textbook_similar_example: { type: "object", properties: { label: { type: "string" }, text: { type: "string" } }, required: ["label", "text"], additionalProperties: false },
          wrong_example: { type: "string" },
          improved_example: { type: "string" },
          in_lesson_check: { type: "object", properties: { question: { type: "string" }, answer: { type: "string" } }, required: ["question", "answer"], additionalProperties: false },
          lesson_passage: {
            type: "object",
            properties: {
              label: { type: "string" },
              source_type: { type: "string" },
              text: { type: "string" },
              tasks: { type: "array", items: { type: "string" } },
              model_answer: { type: "string" },
              feedback: { type: "string" },
            },
            required: ["label", "source_type", "text", "tasks", "model_answer", "feedback"],
            additionalProperties: false,
          },
          lecture_practice_items: {
            type: "array",
            items: {
              type: "object",
              properties: { question: { type: "string" }, answer: { type: "string" }, explanation: { type: "string" } },
              required: ["question", "answer", "explanation"],
              additionalProperties: false,
            },
          },
          answer_feedback: { type: "string" },
          next_step: { type: "string" },
          source_boundary: { type: "string" },
        },
        required: ["title", "theory_subcategory", "core_concept", "textbook_anchor", "textbook_similar_example", "wrong_example", "improved_example", "in_lesson_check", "answer_feedback", "next_step", "source_boundary"],
        additionalProperties: false,
      },
    },
  },
  required: ["items"],
  additionalProperties: false,
} as const;

export function qaTheoryLessonCandidate(candidate: TheoryLessonDraftCandidate) {
  const issues: string[] = [];
  if (!candidate.title || candidate.title.trim().length < 4) issues.push("제목은 4자 이상이어야 합니다.");
  if (/placeholder|seed|test|테스트 문항/i.test(candidate.title)) issues.push("제목에 개발용 표현을 사용할 수 없습니다.");
  try {
    const content = theoryPayloadSchema.parse(JSON.parse(candidate.contentData));
    if (content.wrong_example === content.improved_example) issues.push("바꿔 볼 문장과 개선 예는 서로 달라야 합니다.");
    if (!content.source_boundary.includes("교재") && !content.source_boundary.includes("유사")) issues.push("출처·유사 예시 구분 안내가 필요합니다.");
    if (["high_univ", "general_adult"].includes(candidate.courseType) && !content.lesson_passage) issues.push("고교/대입 및 일반/직장인 콘텐츠에는 강의용 실제형 지문이 필요합니다.");
  } catch (error) {
    issues.push(error instanceof Error ? `이론 콘텐츠 구조가 유효하지 않습니다: ${error.message}` : "이론 콘텐츠 구조가 유효하지 않습니다.");
  }
  return issues;
}

export async function generateTheoryLessonDrafts(input: TheoryLessonRequestInput): Promise<{ modelId: string | null; items: TheoryLessonDraftCandidate[] }> {
  const request = theoryLessonRequestSchema.parse(input);
  const requestedCount = Math.min(6, request.content_count);
  const { data: models } = await listLLMModels();
  const modelId = ["gpt-5-mini", "claude-haiku-4-5", "gemini-3-flash-preview"].find((candidate) => models.some((model) => model.id === candidate)) ?? models[0]?.id ?? null;
  const response = await invokeLLM({
    model: modelId ?? undefined,
    messages: [
      { role: "system", content: THEORY_LESSON_MASTER_PROMPT },
      { role: "user", content: `${buildTheoryLessonUserPrompt({ ...request, content_count: requestedCount })}\n\n각 결과는 하나의 독립 이론 레슨입니다. 실제 출처의 긴 문장을 복제하지 말고, 교재 원리와 새 유사 예시를 구분하세요. 모든 확인문제는 학습자가 즉시 답할 수 있도록 명료하게 작성하세요.` },
    ],
    responseFormat: {
      type: "json_schema",
      json_schema: { name: "lesson_theory_draft", strict: true, schema: generatedTheorySchema },
    },
  });
  const raw = response.choices?.[0]?.message?.content;
  if (typeof raw !== "string" || !raw.trim()) throw new Error("AI 이론 콘텐츠 응답이 비어 있습니다.");
  const parsed = JSON.parse(raw) as { items?: unknown[] };
  if (!Array.isArray(parsed.items) || parsed.items.length !== requestedCount) throw new Error("AI가 요청한 개수와 다른 이론 콘텐츠를 반환했습니다.");
  const courseType = courseTypeMap[request.course];
  const items = parsed.items.map((item, index) => {
    const candidate = item as Record<string, unknown>;
    const payload = theoryPayloadSchema.parse({
      core_concept: candidate.core_concept,
      textbook_anchor: candidate.textbook_anchor,
      textbook_similar_example: candidate.textbook_similar_example,
      wrong_example: candidate.wrong_example,
      improved_example: candidate.improved_example,
      in_lesson_check: candidate.in_lesson_check,
      lesson_passage: candidate.lesson_passage,
      lecture_practice_items: candidate.lecture_practice_items,
      answer_feedback: candidate.answer_feedback,
      next_step: candidate.next_step,
      source_boundary: candidate.source_boundary,
    });
    const draft: TheoryLessonDraftCandidate = {
      courseType,
      lessonLevel: request.lesson_level,
      theoryCategory: request.theory_category,
      theorySubcategory: typeof candidate.theory_subcategory === "string" ? candidate.theory_subcategory.trim() : request.theory_subcategory,
      exampleMode: request.example_mode,
      title: typeof candidate.title === "string" ? candidate.title.trim() : `이론 레슨 ${index + 1}`,
      contentData: JSON.stringify({ content_scope: THEORY_LESSON_CONTENT_SCOPE, master_prompt_version: THEORY_LESSON_MASTER_PROMPT_VERSION, course: request.course, theory_category: request.theory_category, theory_subcategory: candidate.theory_subcategory, lesson_level: request.lesson_level, ...payload }),
      sourceNote: "AI 생성 이론 콘텐츠 · 관리자 승인 필요",
      qaIssues: [],
    };
    return { ...draft, qaIssues: qaTheoryLessonCandidate(draft) };
  });
  return { modelId, items };
}
