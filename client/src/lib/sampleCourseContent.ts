export type SampleCourseKey = "elementary" | "middle_high" | "high_univ" | "general_adult";

export interface SampleCourseContent {
  label: string;
  audience: string;
  goal: string;
  // 과정별로 무엇을 연습하는지(실제 커리큘럼 레벨 구성 기준)
  levels: ReadonlyArray<{ title: string; summary: string }>;
  practice: {
    heading: string;
    passage: string;
    question: string;
    choices: readonly [string, string, string];
    correctIndex: number;
    correctMessage: string;
    wrongMessage: string;
  };
  aiTask: string;
  aiPlaceholder: string;
}

export const SAMPLE_COURSE_CONTENT: Record<SampleCourseKey, SampleCourseContent> = {
  elementary: {
    label: "초등 논술",
    audience: "글쓰기를 처음 시작하는 초등 학생",
    goal: "낱말과 문장을 익히고, 내 생각을 짧은 글로 표현하는 힘을 기릅니다.",
    levels: [
      { title: "Level 1. 재미있는 낱말과 문장", summary: "낱말 익히기, 짧은 문장 만들기, 주어와 서술어 찾기" },
      { title: "Level 2. 이야기 만들기", summary: "그림 보고 이야기 꾸미기, 육하원칙으로 글쓰기" },
      { title: "Level 3. 생각 정리하기", summary: "중요한 내용 찾기, 짧은 글 요약하기, 내 생각 말하기" },
      { title: "Level 4. 상상력 키우기", summary: "동화·편지·일기 쓰기" },
    ],
    practice: {
      heading: "생각과 이유를 구분해 보세요.",
      passage: "“쉬는 시간에 책을 읽으면 좋겠다. 책을 읽으면 새로운 것을 알 수 있기 때문이다.”",
      question: "글쓴이가 가장 말하고 싶은 생각은 어느 문장인가요?",
      choices: ["쉬는 시간에 책을 읽으면 좋겠다.", "책을 읽으면 새로운 것을 알 수 있다.", "쉬는 시간이 있다."],
      correctIndex: 0,
      correctMessage: "맞았습니다. ‘좋겠다’가 글쓴이의 생각이고, 뒤 문장은 그렇게 생각한 이유입니다.",
      wrongMessage: "다시 살펴보세요. ‘~면 좋겠다’처럼 바라는 것을 말한 문장이 글쓴이의 생각입니다.",
    },
    aiTask: "쉬는 시간에 책을 읽는 것이 좋은지 나쁜지, 이유를 들어 2~3문장으로 써보세요.",
    aiPlaceholder: "여기에 내 생각과 이유를 써 보세요. (최대 300자)",
  },
  middle_high: {
    label: "중고등 논술",
    audience: "근거를 갖춰 주장하는 글을 쓰려는 중·고등 학생",
    goal: "문장과 단락을 논리적으로 연결하고, 구조를 갖춘 글로 자기 견해를 논증합니다.",
    levels: [
      { title: "Level 1. 문장의 기초", summary: "정확한 어휘 선택, 문장 성분 호응, 경제적이고 명료한 표현" },
      { title: "Level 2. 단락의 논리적 연결", summary: "소주제문과 뒷받침 문장, 연역·귀납 전개, 단락 재구성 실습" },
      { title: "Level 3. 구조적 분석 및 요약", summary: "서론-본론-결론 구조, 개요 작성, 요약 규칙" },
      { title: "Level 4. 비판적 사고와 주제 설정", summary: "제시문 분석, 견해 논증, 가주제에서 참주제로" },
    ],
    practice: {
      heading: "주장과 근거를 구분해 보세요.",
      passage: "“학교 급식에 지역 농산물 사용을 늘려야 한다. 학생에게 더 신선한 식재료를 제공하고 지역 농가에도 도움이 되기 때문이다.”",
      question: "위 글에서 주장을 가장 잘 나타내는 문장은 무엇인가요?",
      choices: ["학교 급식에 지역 농산물 사용을 늘려야 한다.", "학생에게 더 신선한 식재료를 제공한다.", "지역 농가에도 도움이 된다."],
      correctIndex: 0,
      correctMessage: "맞았습니다. ‘늘려야 한다’가 글쓴이의 주장이고, 뒤 문장은 이유입니다.",
      wrongMessage: "다시 살펴보세요. ‘늘려야 한다’처럼 해야 할 일을 말한 문장이 주장입니다.",
    },
    aiTask: "학교 급식에 지역 농산물 사용을 늘려야 한다는 주장에 대해, 이유를 들어 자신의 생각을 3~5문장으로 써보세요.",
    aiPlaceholder: "여기에 답안을 작성해 보세요. (최대 300자)",
  },
  high_univ: {
    label: "고등 / 대입 논술",
    audience: "대입 논술을 준비하는 고등 학생·수험생",
    goal: "여러 제시문을 비교·분석하고, 논리적 오류를 점검하며 구조적으로 논증하는 힘을 기릅니다.",
    levels: [
      { title: "Level 1. 인문·사회 제시문 심층 분석", summary: "제시문의 공통점·차이점 추출, 비판적 독해와 논지 재구성" },
      { title: "Level 2. 수리·과학적 사고와 논증", summary: "도표·통계 자료 해석, 논리적 오류 검증, 가설 검증형 논증" },
      { title: "Level 3. 대학별 모의논술 실전 파이널", summary: "기출 유형 분석, 시간 관리와 개요 작성, 모의논술 첨삭" },
    ],
    practice: {
      heading: "두 제시문의 관점을 비교해 보세요.",
      passage: "(가) “학생부 중심 전형을 확대해야 한다. 한 번의 시험보다 꾸준한 성장 과정을 더 잘 평가할 수 있기 때문이다.”\n(나) “수능 중심 전형이 더 공정하다. 모든 학생이 같은 기준으로 평가받아 결과를 받아들이기 쉽기 때문이다.”",
      question: "(가)와 (나)가 서로 다른 방식으로 중시하는 공통 가치는 무엇인가요?",
      choices: ["평가가 타당하고 공정해야 한다는 것", "입시 비용을 줄여야 한다는 것", "사교육 참여를 늘려야 한다는 것"],
      correctIndex: 0,
      correctMessage: "맞았습니다. 두 글은 방식은 다르지만 모두 ‘좋은 평가란 무엇인가’라는 타당성과 공정성을 기준으로 주장합니다.",
      wrongMessage: "다시 살펴보세요. 두 글 모두 평가 방식이 학생을 제대로, 공정하게 평가하는지를 근거로 삼고 있습니다.",
    },
    aiTask: "대입 전형을 ‘학생부 중심’(꾸준한 성장 과정 평가)과 ‘수능 중심’(같은 기준의 공정성)으로 나눌 때, 두 관점을 비교하고 한쪽을 택해 근거를 들어 4~5문장으로 써보세요.",
    aiPlaceholder: "두 관점을 비교하고 내 선택의 근거를 써 보세요. (최대 300자)",
  },
  general_adult: {
    label: "일반 / 직장인",
    audience: "업무·일상에서 논리적으로 쓰고 설득해야 하는 성인",
    goal: "결론부터 쓰는 구조와 타당한 근거로 보고서·메일·제안서를 명확하게 씁니다.",
    levels: [
      { title: "Level 1. 비즈니스 기획서와 보고서 작성법", summary: "결론 우선 두괄식 구조, 핵심 데이터 개요, 설득을 위한 기획서" },
      { title: "Level 2. 논리적 설득 스피치와 논설문", summary: "타당한 근거 배치, 반박에 대응하는 방어 논리, 설득력 있는 어휘" },
      { title: "Level 3. 실무 에세이 및 칼럼 기고문", summary: "문제 정의와 시사점, 독자 맞춤형 문체, 칼럼 편집" },
    ],
    practice: {
      heading: "결론을 먼저 쓰는 두괄식을 연습해 보세요.",
      passage: "“목요일에는 팀원 대부분이 외부 일정이 있습니다. 그래서 다음 주 정기 회의를 금요일 오후로 옮기고자 합니다.”",
      question: "두괄식으로 고친다면 글의 맨 앞에 와야 할 핵심 문장은 무엇인가요?",
      choices: ["다음 주 정기 회의를 금요일 오후로 옮기고자 합니다.", "목요일에는 팀원 대부분이 외부 일정이 있습니다.", "팀원들의 일정이 서로 다릅니다."],
      correctIndex: 0,
      correctMessage: "맞았습니다. 상대가 해야 할 결정(요청)을 먼저 말하고, 이유는 뒤에 덧붙이는 것이 두괄식입니다.",
      wrongMessage: "다시 살펴보세요. 읽는 사람이 가장 먼저 알아야 할 것은 이유가 아니라 ‘무엇을 요청하는지’입니다.",
    },
    aiTask: "팀 정기 회의를 금요일 오후로 옮기자고 제안하는 업무 메일 본문을, 결론을 먼저 쓰고 이유를 덧붙여 3~5문장으로 써보세요.",
    aiPlaceholder: "결론을 먼저 쓰고 이유를 덧붙여 보세요. (최대 300자)",
  },
};
