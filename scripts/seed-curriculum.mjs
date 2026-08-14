import { seedHighUnivAndGeneralAdultCategories } from "../server/db.ts";

await seedHighUnivAndGeneralAdultCategories();
console.log("[Curriculum] high_univ and general_adult sample categories ensured.");
process.exit(0);
