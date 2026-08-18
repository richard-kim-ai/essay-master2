import { getDifficultyOperationPreset, getRandomQuestions, saveDifficultyOperationPreset } from "../server/db";

const adminId = 1;
const before = await getDifficultyOperationPreset();
try {
  const saved = await saveDifficultyOperationPreset("advanced", adminId);
  if (saved.mode !== "advanced") throw new Error("심화 프리셋 저장값을 확인하지 못했습니다.");
  const questions = await getRandomQuestions("elementary", "quiz", 10);
  const distribution = questions.reduce((acc, question) => {
    acc[question.difficulty] = (acc[question.difficulty] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);
  if (questions.length !== 10) throw new Error(`예상 문항 수와 다릅니다: ${questions.length}`);
  console.log(JSON.stringify({ savedMode: saved.mode, distribution }, null, 2));
} finally {
  await saveDifficultyOperationPreset(before.mode, adminId);
}
