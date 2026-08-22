const courseLabels: Record<string, string> = {
  elementary: "초등 논술",
  middle_high: "중고등 논술",
  high_univ: "고등/대입 논술",
  general_adult: "일반/직장인",
};

const toolLabels: Record<string, string> = {
  quiz: "문장 교정",
  reordering: "단락 재구성",
  summary: "요약 연습",
  topic_wizard: "주제 설정",
  thesis_checklist: "주제문 점검",
};

const difficultyLabels: Record<string, string> = {
  easy: "기초",
  medium: "표준",
  hard: "심화",
};

export const formatLearningCourse = (courseType: string) => courseLabels[courseType] || "논술 과정";
export const formatLearningTool = (toolType: string) => toolLabels[toolType] || "논술 연습";
export const formatLearningDifficulty = (difficulty: string) => difficultyLabels[difficulty] || "표준";
