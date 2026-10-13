import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync(new URL("./AdminAcademicPermissions.tsx", import.meta.url), "utf8");
const tabsSource = readFileSync(new URL("../components/AcademicApprovalTabs.tsx", import.meta.url), "utf8");

describe("AdminAcademicPermissions approval tabs", () => {
  it("renders the central administration menu as a horizontal, labelled tab bar", () => {
    expect(source).toContain("<AcademicApprovalTabs>");
    expect(tabsSource).toContain('aria-label="학습 권한 및 수료 승인 관리"');
    expect(tabsSource).toContain("!flex h-auto w-full gap-1 overflow-x-auto");
    expect(tabsSource).toContain('value="permissions"');
    expect(tabsSource).toContain('value="policies"');
    expect(tabsSource).toContain('value="approvals"');
  });

  it("preserves active, focus-visible, and mobile touch-target styles for each tab", () => {
    expect(tabsSource.match(/data-\[state=active\]:bg-/g)).toHaveLength(3);
    expect(tabsSource.match(/focus-visible:ring-/g)).toHaveLength(3);
    expect(tabsSource.match(/min-w-40 shrink-0/g)).toHaveLength(3);
  });
});
