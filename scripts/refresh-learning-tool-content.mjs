import { replaceLegacyLearningToolContent } from "../server/db.ts";

const result = await replaceLegacyLearningToolContent();
console.log(JSON.stringify(result));
