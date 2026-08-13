import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

const offlinePagePath = new URL("../client/src/pages/OfflineEssays.tsx", import.meta.url);

describe("오프라인 논술 보관함 컴포넌트", () => {
  it("localStorage에서 오프라인 논술 캐시를 읽어오는 로직을 포함한다", () => {
    const source = readFileSync(offlinePagePath, "utf8");
    expect(source).toContain("essay_master_offline_essays");
    expect(source).toContain("navigator.onLine");
    expect(source).toContain("window.addEventListener");
  });
});
