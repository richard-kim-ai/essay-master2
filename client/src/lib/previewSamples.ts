// 로그인하지 않은 방문자에게 보여주는 학습 화면 미리보기용 샘플 내용.
// 서비스의 실제 문제 은행 문항은 내려주지 않고, 화면이 비어 보이지 않도록 직접 쓴 짧은 예시만 사용한다.
// id가 음수인 것은 샘플이라는 표시이며, 미리보기에서는 서버로 전송되지 않는다.

export const PREVIEW_QUIZ_QUESTIONS = [
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
];

export const PREVIEW_REORDERING_QUESTIONS = [
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
];

export const PREVIEW_SUMMARY_QUESTIONS = [
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
];

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
