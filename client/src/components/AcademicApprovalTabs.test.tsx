// @vitest-environment jsdom
import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { TabsContent } from "@/components/ui/tabs";
import { AcademicApprovalTabs } from "./AcademicApprovalTabs";

describe("AcademicApprovalTabs keyboard navigation", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(async () => {
    (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    await act(async () => {
      root.render(
        <AcademicApprovalTabs>
          <TabsContent value="permissions">권한 내용</TabsContent>
          <TabsContent value="policies">조건 내용</TabsContent>
          <TabsContent value="approvals">승인 내용</TabsContent>
        </AcademicApprovalTabs>,
      );
    });
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
  });

  it("moves focus and the active panel through the tab sequence with ArrowRight", async () => {
    const tabs = Array.from(container.querySelectorAll<HTMLButtonElement>('[role="tab"]'));
    expect(tabs).toHaveLength(3);
    expect(tabs[0]?.getAttribute("aria-selected")).toBe("true");

    const user = userEvent.setup();
    await act(async () => {
      await user.tab();
    });
    expect(document.activeElement).toBe(tabs[0]);

    await act(async () => {
      await user.keyboard("{ArrowRight}");
    });
    expect(document.activeElement).toBe(tabs[1]);
    expect(tabs[1]?.getAttribute("aria-selected")).toBe("true");
    expect(container.textContent).toContain("조건 내용");

    await act(async () => {
      await user.keyboard("{ArrowRight}");
    });
    expect(document.activeElement).toBe(tabs[2]);
    expect(tabs[2]?.getAttribute("aria-selected")).toBe("true");
    expect(container.textContent).toContain("승인 내용");
  });
});
