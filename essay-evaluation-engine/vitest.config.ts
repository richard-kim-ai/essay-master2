import { defineConfig } from "vitest/config";
import path from "path";

const engineRoot = path.resolve(import.meta.dirname);

export default defineConfig({
  root: engineRoot,
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts", "tests/**/*.spec.ts"],
  },
});
