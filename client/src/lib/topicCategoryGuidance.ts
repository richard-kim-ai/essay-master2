export const TOPIC_CATEGORY_GUIDANCE = {
  "사회 현상": { example: "1인 가구 증가에 맞춰 지역 돌봄 서비스를 어떻게 개선해야 할까?", hint: "사람들의 생활 방식, 세대·지역 간 변화, 공동체 문제를 중심으로 살펴보세요.", keywords: ["인구", "가구", "세대", "지역", "돌봄", "청년", "고령", "주거", "복지", "격차", "공동체"] },
  "환경 문제": { example: "일회용품 사용을 줄이기 위해 학교와 지역사회는 어떤 역할을 나누어야 할까?", hint: "자원·에너지·기후 변화와 생활 속 실천 방안을 함께 생각해 보세요.", keywords: ["환경", "기후", "탄소", "재활용", "일회용", "쓰레기", "오염", "에너지", "생태", "플라스틱", "물"] },
  "기술 발전": { example: "생성형 AI를 교육에 활용할 때 학교는 어떤 기준을 마련해야 할까?", hint: "새 기술의 편의성과 함께 안전·공정성·책임의 기준을 함께 다뤄 보세요.", keywords: ["AI", "인공지능", "기술", "로봇", "데이터", "플랫폼", "디지털", "자동화", "가상", "알고리즘", "생성형"] },
  "교육": { example: "학생의 자기주도 학습을 돕기 위해 학교의 평가 방식은 어떻게 달라져야 할까?", hint: "학습 방법, 학교 제도, 교사·학생의 역할을 구체적으로 정해 보세요.", keywords: ["학교", "학생", "교사", "교육", "학습", "수업", "평가", "시험", "대학", "진로", "교과"] },
  "문화": { example: "지역의 전통문화를 젊은 세대와 공유하기 위해 어떤 방식이 필요할까?", hint: "예술·언어·전통·대중문화의 가치와 변화에 초점을 맞춰 보세요.", keywords: ["문화", "예술", "전통", "언어", "콘텐츠", "영화", "음악", "축제", "한류", "유산", "지역"] },
  "경제": { example: "청소년 금융교육을 강화하기 위해 학교와 금융기관은 무엇을 해야 할까?", hint: "가격·일자리·소비·기업 활동이 개인과 사회에 미치는 영향을 살펴보세요.", keywords: ["경제", "금융", "소비", "가격", "일자리", "기업", "시장", "소득", "물가", "투자", "고용"] },
  "정치": { example: "청소년의 정치 참여를 넓히기 위해 학교 교육은 어떤 역할을 해야 할까?", hint: "시민의 권리와 책임, 공공 의사결정, 제도의 공정성을 함께 생각해 보세요.", keywords: ["정치", "선거", "정부", "국회", "정책", "시민", "민주", "법", "권리", "참여", "공공"] },
  "과학": { example: "유전자 편집 기술을 의료에 활용할 때 어떤 윤리 기준이 필요할까?", hint: "과학적 근거와 함께 안전성·윤리성·사회적 영향을 함께 검토해 보세요.", keywords: ["과학", "유전자", "의료", "실험", "연구", "우주", "생명", "물리", "화학", "질병", "백신"] },
} as const;

export type TopicCategory = keyof typeof TOPIC_CATEGORY_GUIDANCE;

export function getTopicCategoryGuidance(category: string) {
  return category in TOPIC_CATEGORY_GUIDANCE ? TOPIC_CATEGORY_GUIDANCE[category as TopicCategory] : null;
}

export function findConflictingTopicCategories(category: string, topic: string) {
  const selected = getTopicCategoryGuidance(category);
  const normalizedTopic = topic.trim().toLowerCase();
  if (!selected || !normalizedTopic) return [];
  const hasSelectedKeyword = selected.keywords.some((keyword) => normalizedTopic.includes(keyword.toLowerCase()));
  if (hasSelectedKeyword) return [];
  return (Object.entries(TOPIC_CATEGORY_GUIDANCE) as [TopicCategory, typeof TOPIC_CATEGORY_GUIDANCE[TopicCategory]][])
    .filter(([otherCategory, guidance]) => otherCategory !== category && guidance.keywords.some((keyword) => normalizedTopic.includes(keyword.toLowerCase())))
    .map(([otherCategory]) => otherCategory);
}
