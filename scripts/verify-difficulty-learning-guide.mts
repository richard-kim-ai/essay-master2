import { generateDifficultyLearningGuide } from "../server/db";

const userId = Number(process.env.QA_STUDENT_ID || 15330007);
const courseType = (process.env.QA_COURSE_TYPE || "elementary") as "elementary" | "middle_high" | "high_univ" | "general_adult";

const guide = await generateDifficultyLearningGuide(userId, courseType);
const required = ["headline", "summary", "recommendedDifficulty", "focus", "nextAction", "basis", "presetMode"] as const;
for (const key of required) {
  if (!guide[key]) throw new Error(`추천 가이드 필수 값이 없습니다: ${key}`);
}
if (!["easy", "medium", "hard"].includes(guide.recommendedDifficulty)) throw new Error("추천 난이도 값이 유효하지 않습니다.");
console.log(JSON.stringify({
  source: guide.source,
  presetMode: guide.presetMode,
  recommendedDifficulty: guide.recommendedDifficulty,
  headline: guide.headline,
  basis: guide.basis,
}, null, 2));
