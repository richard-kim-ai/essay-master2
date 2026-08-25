import "dotenv/config";
import { seedLessonTheoryContentIfNeeded, getLessonTheoryContentList } from "../server/db.ts";

await seedLessonTheoryContentIfNeeded();

const courseTypes = ["elementary", "middle_high", "high_univ", "general_adult"];
const counts = {};
for (const courseType of courseTypes) {
  const rows = await getLessonTheoryContentList({ courseType });
  counts[courseType] = rows.length;
}

console.log("[Theory Lessons] Seed complete:", counts);
process.exit(0);
