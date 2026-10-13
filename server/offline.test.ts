import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
const source = (path: string) => readFileSync(new URL(path, import.meta.url), "utf8");
describe("오프라인 논술 보관함 연결", () => {
  it("온라인 작성과 오프라인 보관은 같은 글쓰기·첨삭 작업 화면을 사용한다", () => {
    expect(source("../client/src/pages/OfflineEssays.tsx")).toContain("<EssayWorkspace offline");
    expect(source("../client/src/pages/EssaySubmission.tsx")).toContain("<EssayWorkspace");
    expect(source("../client/src/lib/essayStorage.ts")).toContain("essay_master_offline_essays_v2_${userId}");
    expect(source("../client/src/hooks/useEssayWorkspace.ts")).toContain("navigator.onLine");
    expect(source("../client/src/hooks/useEssayWorkspace.ts")).toContain('window.addEventListener("online"');
  });
});
