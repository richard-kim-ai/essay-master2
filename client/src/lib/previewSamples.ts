import type { CourseType } from "@shared/course";

// 로그인하지 않은 방문자에게 보여주는 학습 화면 미리보기용 샘플 내용.
// 서비스의 실제 문제 은행 문항은 내려주지 않고, 화면이 비어 보이지 않도록 직접 쓴 짧은 예시만 사용한다.
// id가 음수인 것은 샘플이라는 표시이며, 미리보기에서는 서버로 전송되지 않는다.

type PreviewQuestion = {
  id: number;
  title: string;
  courseType: CourseType;
  toolType: "quiz" | "reordering" | "summary";
  difficulty: "easy" | "medium" | "hard";
  contentData: string;
};

const previewQuizQuestions: Record<CourseType, PreviewQuestion[]> = {
  elementary: [
  {
    id: -1,
    title: "문장 다듬기: 겹쳐 쓴 표현 고치기",
    courseType: "elementary",
    toolType: "quiz",
    difficulty: "easy",
    contentData: JSON.stringify({
      prompt: "문장을 읽고 더 알맞게 고친 문장을 골라 보세요.",
      sentence: "나는 어제 친구랑 놀이터에서 놀았었다.",
      options: [
        "나는 어제 친구와 놀이터에서 놀았다.",
        "나는 어제 친구랑 놀이터에서 놀았었었다.",
        "어제 나는 친구 놀이터 놀았다.",
        "나는 어제 친구와 놀이터에서 논다.",
      ],
      answer: "나는 어제 친구와 놀이터에서 놀았다.",
      explanation: "'놀았었다'처럼 같은 뜻을 겹쳐 쓰지 않고 '놀았다'로 간결하게 쓰면 문장이 더 분명해집니다.",
    }),
  },
  ],
  middle_high: [{
    id: -11,
    title: "문장 다듬기: 주어와 서술어 호응시키기",
    courseType: "middle_high",
    toolType: "quiz",
    difficulty: "medium",
    contentData: JSON.stringify({
      prompt: "문장을 읽고 더 정확하고 자연스러운 교정문을 골라 보세요.",
      sentence: "학생들의 꾸준한 토론 참여는 비판적으로 생각하는 힘을 기르게 한다.",
      options: [
        "학생들의 꾸준한 토론 참여는 비판적으로 생각하는 힘을 기르게 한다.",
        "학생들이 꾸준히 토론에 참여하면 비판적으로 생각하는 힘을 기를 수 있다.",
        "학생들의 토론 참여를 비판적으로 생각하는 힘을 기른다.",
        "학생들이 토론은 비판적으로 생각하는 힘을 길렀다.",
      ],
      answer: "학생들이 꾸준히 토론에 참여하면 비판적으로 생각하는 힘을 기를 수 있다.",
      explanation: "'참여'가 '기르게 한다'의 주체가 되지 않도록, 학생을 주어로 두고 조건과 결과를 분명히 연결합니다.",
    }),
  }],
  high_univ: [{
    id: -21,
    title: "문장 다듬기: 논증의 인과 관계 분명히 하기",
    courseType: "high_univ",
    toolType: "quiz",
    difficulty: "hard",
    contentData: JSON.stringify({
      prompt: "주장과 근거의 관계가 가장 분명한 문장을 골라 보세요.",
      sentence: "청소년 독서율이 낮아서 도서관 예산을 늘려야 한다.",
      options: [
        "청소년 독서율이 낮아서 도서관 예산을 늘려야 한다.",
        "청소년 독서율이 낮으므로 도서관 예산은 늘린다.",
        "청소년의 독서 접근성을 높이기 위해 도서관 자료와 프로그램 예산을 확대할 필요가 있다.",
        "도서관 예산이 독서율보다 낮아서 청소년을 늘려야 한다.",
      ],
      answer: "청소년의 독서 접근성을 높이기 위해 도서관 자료와 프로그램 예산을 확대할 필요가 있다.",
      explanation: "예산 확대가 독서율 향상으로 이어지는 경로를 '독서 접근성'으로 밝혀 주장의 근거가 분명해집니다.",
    }),
  }],
  general_adult: [{
    id: -31,
    title: "문장 다듬기: 업무 요청을 명확하게 쓰기",
    courseType: "general_adult",
    toolType: "quiz",
    difficulty: "medium",
    contentData: JSON.stringify({
      prompt: "업무 요청의 대상과 기한이 분명한 문장을 골라 보세요.",
      sentence: "회의 자료는 빨리 보내 주시면 좋겠습니다.",
      options: [
        "회의 자료는 빨리 보내 주시면 좋겠습니다.",
        "회의 자료를 가능한 한 보내 주세요.",
        "내일 오후 3시 회의용 자료를 오늘 오후 5시까지 공유해 주시겠습니까?",
        "회의를 위해 자료가 보내지면 좋겠습니다.",
      ],
      answer: "내일 오후 3시 회의용 자료를 오늘 오후 5시까지 공유해 주시겠습니까?",
      explanation: "자료의 용도와 마감 시각을 함께 제시하면 상대가 바로 행동할 수 있는 요청이 됩니다.",
    }),
  }],
};

/** 선택한 공개 미리보기 과정에만 맞는 직접 작성 샘플을 돌려준다. */
export function getPreviewQuizQuestions(courseType: CourseType = "elementary") { return previewQuizQuestions[courseType]; }
/** 기존 소비처와의 호환을 위한 초등 과정 기본 export. */
export const PREVIEW_QUIZ_QUESTIONS = getPreviewQuizQuestions();

const previewReorderingQuestions: Record<CourseType, PreviewQuestion[]> = {
  elementary: [
  {
    id: -1,
    title: "단락 재구성: 급식 잔반 줄이기",
    courseType: "elementary",
    toolType: "reordering",
    difficulty: "easy",
    contentData: JSON.stringify({
      prompt: "글의 흐름이 자연스럽도록 단락을 알맞은 순서로 놓아 보세요.",
      paragraphs: [
        { id: "p1", content: "요즘 학교에서는 급식 잔반을 줄이자는 캠페인이 활발합니다.", correctOrder: 1 },
        { id: "p2", content: "먼저 음식을 먹을 만큼만 받으면 버려지는 음식이 크게 줄어듭니다.", correctOrder: 2 },
        { id: "p3", content: "또한 잔반이 줄면 환경 부담과 급식 비용도 함께 줄일 수 있습니다.", correctOrder: 3 },
        { id: "p4", content: "따라서 우리 모두가 먹을 만큼만 받는 습관을 길러야 합니다.", correctOrder: 4 },
      ],
      explanation: "문제 제기 → 방법 → 효과 → 결론 순서로 이어지면 글의 흐름이 자연스럽습니다.",
      difficultyProfile: { learningFocus: "글의 처음-중간-끝 구조 파악" },
    }),
  },
  ],
  middle_high: [{
    id: -12,
    title: "단락 재구성: 교내 휴대전화 사용 규칙",
    courseType: "middle_high",
    toolType: "reordering",
    difficulty: "medium",
    contentData: JSON.stringify({
      prompt: "주장 글의 흐름에 맞게 단락을 배열해 보세요.",
      paragraphs: [
        { id: "p1", content: "수업 시간의 휴대전화 사용은 학습 집중을 방해할 수 있어 학교 차원의 기준이 필요합니다.", correctOrder: 1 },
        { id: "p2", content: "다만 쉬는 시간이나 긴급 연락처럼 필요한 경우까지 일률적으로 막는 것은 적절하지 않습니다.", correctOrder: 2 },
        { id: "p3", content: "따라서 수업 중에는 보관하고, 필요한 때에는 교사의 안내 아래 사용할 수 있도록 규칙을 정할 수 있습니다.", correctOrder: 3 },
        { id: "p4", content: "이처럼 학습권과 개인의 필요를 함께 고려한 규칙이 학생들의 자율적인 사용 습관에도 도움이 됩니다.", correctOrder: 4 },
      ],
      explanation: "문제 제기 → 예외 고려 → 대안 → 기대 효과 순서가 자연스럽습니다.",
      difficultyProfile: { learningFocus: "주장 글의 조건과 대안 연결" },
    }),
  }],
  high_univ: [{
    id: -22,
    title: "단락 재구성: 지역 문화 공간의 공공성",
    courseType: "high_univ",
    toolType: "reordering",
    difficulty: "hard",
    contentData: JSON.stringify({
      prompt: "논증의 전개 방식이 드러나도록 단락을 배열해 보세요.",
      paragraphs: [
        { id: "p1", content: "지역 문화 공간은 공연과 전시를 제공하는 곳을 넘어 주민이 의견을 나누고 관계를 만드는 공적 기반이 될 수 있다.", correctOrder: 1 },
        { id: "p2", content: "그러나 이용료와 프로그램 정보의 접근성이 낮으면 이러한 공간은 일부 계층만 이용하는 시설로 남을 위험이 있다.", correctOrder: 2 },
        { id: "p3", content: "지방자치단체는 무료 또는 저비용 프로그램, 이동 지원, 주민 기획 참여를 통해 접근 장벽을 낮출 수 있다.", correctOrder: 3 },
        { id: "p4", content: "공공성은 건물의 소유 형태가 아니라 다양한 주민이 문화적 의사소통에 참여할 수 있는 조건에서 실현된다.", correctOrder: 4 },
      ],
      explanation: "개념 제시 → 한계 진단 → 정책 대안 → 논지 확장 순서입니다.",
      difficultyProfile: { learningFocus: "개념 정의와 반론·대안의 논증 구조" },
    }),
  }],
  general_adult: [{
    id: -32,
    title: "단락 재구성: 회의 시간 줄이기",
    courseType: "general_adult",
    toolType: "reordering",
    difficulty: "medium",
    contentData: JSON.stringify({
      prompt: "업무 제안문의 흐름에 맞게 단락을 배열해 보세요.",
      paragraphs: [
        { id: "p1", content: "최근 정기 회의가 길어지면서 실무에 쓸 시간이 줄어든다는 의견이 많습니다.", correctOrder: 1 },
        { id: "p2", content: "회의 전 안건과 자료를 공유하면 참석자는 필요한 내용을 미리 검토할 수 있습니다.", correctOrder: 2 },
        { id: "p3", content: "또한 안건별 제한 시간을 정하고 결정 사항은 회의록으로 남기면 논의가 반복되는 일을 줄일 수 있습니다.", correctOrder: 3 },
        { id: "p4", content: "이 방법을 한 달간 시범 운영한 뒤 회의 시간과 후속 업무의 변화를 함께 점검해 보기를 제안합니다.", correctOrder: 4 },
      ],
      explanation: "현황 → 준비 방법 → 운영 방법 → 실행 제안 순서로 구성합니다.",
      difficultyProfile: { learningFocus: "업무 제안의 문제-해결-실행 구조" },
    }),
  }],
};

export function getPreviewReorderingQuestions(courseType: CourseType = "elementary") { return previewReorderingQuestions[courseType]; }
export const PREVIEW_REORDERING_QUESTIONS = getPreviewReorderingQuestions();

const previewSummaryQuestions: Record<CourseType, PreviewQuestion[]> = {
  elementary: [
  {
    id: -1,
    title: "요약 연습: 우리 동네 도서관 이야기",
    courseType: "elementary",
    toolType: "summary",
    difficulty: "medium",
    contentData: JSON.stringify({
      prompt:
      "우리 동네 도서관은 올해부터 저녁 8시까지 문을 엽니다. 학교가 끝난 뒤에도 책을 빌리고 숙제를 할 수 있어서 학생들이 많이 찾습니다. 도서관에서는 매주 토요일 책 읽어 주기 시간도 열립니다. 어린이들은 이야기를 듣고 느낀 점을 친구들과 나누며 생각을 키웁니다. 도서관 선생님은 앞으로 더 많은 책을 마련해 모두가 편하게 읽을 수 있도록 하겠다고 말했습니다.",
    }),
  },
  ],
  middle_high: [{
    id: -13,
    title: "요약 연습: 학교 텃밭 프로젝트",
    courseType: "middle_high",
    toolType: "summary",
    difficulty: "medium",
    contentData: JSON.stringify({
      prompt: "한 중학교는 빈 운동장 한쪽에 작은 텃밭을 만들고 과학·가정 수업과 연결했다. 학생들은 토양의 상태를 기록하고 계절에 맞는 작물을 고르면서 생태계의 변화를 관찰했다. 수확한 채소 일부는 급식에 사용했고, 남은 작물은 지역 복지관에 전달했다. 담당 교사는 텃밭 활동이 지식 암기에 그치지 않고 지역사회와 환경을 함께 생각하는 계기가 되었다고 설명했다.",
    }),
  }],
  high_univ: [{
    id: -23,
    title: "요약 연습: 알고리즘 추천과 정보 다양성",
    courseType: "high_univ",
    toolType: "summary",
    difficulty: "hard",
    contentData: JSON.stringify({
      prompt: "온라인 플랫폼의 추천 알고리즘은 이용자가 선호할 가능성이 높은 정보를 빠르게 제시해 탐색 비용을 줄인다. 그러나 과거 클릭 기록에 지나치게 의존하면 이용자는 비슷한 관점의 콘텐츠만 반복해서 접할 수 있다. 연구자들은 추천 기준의 투명성을 높이고, 이용자가 추천 범위를 조절하거나 낯선 관점을 선택할 수 있는 기능을 제공해야 한다고 제안한다. 편의성과 정보 다양성을 함께 확보하려면 기술의 정확도뿐 아니라 이용자의 선택권도 설계에 포함되어야 한다.",
    }),
  }],
  general_adult: [{
    id: -33,
    title: "요약 연습: 재택근무 협업 원칙",
    courseType: "general_adult",
    toolType: "summary",
    difficulty: "medium",
    contentData: JSON.stringify({
      prompt: "재택근무가 늘면서 업무 진행 상황을 보이지 않게 되는 문제가 생겼다. 한 팀은 매일 아침 10분 동안 우선순위와 막힌 일을 공유하고, 결정이 필요한 내용은 협업 문서에 기록하기로 했다. 즉시 답이 필요하지 않은 요청에는 응답 기한을 함께 적어 불필요한 메신저 알림도 줄였다. 팀장은 이러한 원칙이 근무 장소와 관계없이 책임을 분명히 하고 집중 시간을 지키는 데 도움이 되었다고 평가했다.",
    }),
  }],
};

export function getPreviewSummaryQuestions(courseType: CourseType = "elementary") { return previewSummaryQuestions[courseType]; }
export const PREVIEW_SUMMARY_QUESTIONS = getPreviewSummaryQuestions();

export const PREVIEW_ARCHIVE_QUESTIONS = [
  { id: -1, title: "문장 다듬기: 겹쳐 쓴 표현 고치기", courseType: "elementary", toolType: "quiz", difficulty: "easy", contentData: JSON.stringify({ prompt: "문장을 읽고 간결하고 분명하게 고친 문장을 골라 보세요." }) },
  { id: -2, title: "단락 재구성: 급식 잔반 줄이기", courseType: "elementary", toolType: "reordering", difficulty: "easy", contentData: JSON.stringify({ prompt: "흩어진 단락을 글의 흐름에 맞게 순서대로 배열해 보세요." }) },
  { id: -3, title: "요약 연습: 우리 동네 도서관 이야기", courseType: "elementary", toolType: "summary", difficulty: "medium", contentData: JSON.stringify({ prompt: "글을 읽고 중심 내용을 두세 문장으로 요약해 보세요." }) },
  { id: -4, title: "주제 설정: 학교 규칙 정하기", courseType: "elementary", toolType: "topic_wizard", difficulty: "easy", contentData: JSON.stringify({ prompt: "관심 있는 문제에서 글로 쓸 만한 주제를 단계별로 좁혀 보세요." }) },
  { id: -5, title: "주제문 점검: 숙제는 꼭 필요할까?", courseType: "elementary", toolType: "thesis_checklist", difficulty: "medium", contentData: JSON.stringify({ prompt: "내 생각이 담긴 주제문이 분명하고 근거를 이끌 수 있는지 점검해 보세요." }) },
  { id: -6, title: "문장 다듬기: 호응 관계 살피기", courseType: "elementary", toolType: "quiz", difficulty: "medium", contentData: JSON.stringify({ prompt: "주어와 서술어가 알맞게 호응하는 문장을 골라 보세요." }) },
];

export const PREVIEW_ARCHIVE_STATS = [
  { id: -1, totalAttempts: 128, correctRate: 82 },
  { id: -2, totalAttempts: 96, correctRate: 74 },
  { id: -3, totalAttempts: 71, correctRate: 61 },
  { id: -4, totalAttempts: 54, correctRate: 88 },
  { id: -5, totalAttempts: 63, correctRate: 57 },
  { id: -6, totalAttempts: 112, correctRate: 69 },
];

export const PREVIEW_MISTAKES = [
  {
    id: -1,
    source: "learning_tool",
    toolType: "quiz",
    questionTitle: "문장 다듬기: 겹쳐 쓴 표현 고치기",
    userAnswer: "나는 어제 친구랑 놀이터에서 놀았었었다.",
    score: 0,
    createdAt: "2026-10-05T09:00:00.000Z",
    aiFeedback: "같은 뜻을 겹쳐 쓰면 문장이 길어지고 분명하지 않습니다. '놀았다'로 간결하게 고쳐 보세요.",
  },
  {
    id: -2,
    source: "learning_tool",
    toolType: "reordering",
    questionTitle: "단락 재구성: 급식 잔반 줄이기",
    userAnswer: "1. 따라서 우리 모두가 …\n2. 먼저 음식을 …",
    score: 50,
    createdAt: "2026-10-06T09:00:00.000Z",
    aiFeedback: "결론은 글의 맨 끝에 와야 합니다. 문제 제기 → 방법 → 효과 → 결론 순서를 다시 확인해 보세요.",
  },
  {
    id: -3,
    source: "learning_tool",
    toolType: "summary",
    questionTitle: "요약 연습: 우리 동네 도서관 이야기",
    userAnswer: "도서관이 저녁까지 열고 책 읽어 주기도 합니다.",
    score: 70,
    createdAt: "2026-10-07T09:00:00.000Z",
    aiFeedback: "중심 내용은 잘 찾았습니다. 도서관이 앞으로 책을 더 늘리겠다는 내용까지 담으면 더 좋습니다.",
  },
];

export const PREVIEW_RECOMMENDED = [
  { id: -1, title: "소주제문과 뒷받침 문장 구분하기", prompt: "소주제문을 찾고 뒷받침 문장을 연결해 보세요.", courseType: "elementary", level: 2 },
  { id: -2, title: "중요한 내용 찾아 요약하기", prompt: "글에서 중요한 내용을 찾아 한 문장으로 줄여 보세요.", courseType: "elementary", level: 3 },
];
