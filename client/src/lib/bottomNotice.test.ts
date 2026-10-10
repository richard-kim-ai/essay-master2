import { afterEach, describe, expect, it } from "vitest";
import {
  BOTTOM_NOTICE_PRIORITY,
  getActiveBottomNotice,
  releaseBottomNotice,
  requestBottomNotice,
} from "./bottomNotice";

afterEach(() => {
  for (const id of ["signup", "push", "install"]) releaseBottomNotice(id);
});

describe("bottom notice coordination", () => {
  it("요청이 없으면 활성 안내가 없다", () => {
    expect(getActiveBottomNotice()).toBeNull();
  });

  it("여러 안내가 동시에 보이려 하면 우선순위가 가장 높은 하나만 활성화된다", () => {
    requestBottomNotice("install", BOTTOM_NOTICE_PRIORITY.installApp);
    expect(getActiveBottomNotice()).toBe("install");

    requestBottomNotice("push", BOTTOM_NOTICE_PRIORITY.pushPermission);
    expect(getActiveBottomNotice()).toBe("push");

    requestBottomNotice("signup", BOTTOM_NOTICE_PRIORITY.signupBanner);
    expect(getActiveBottomNotice()).toBe("signup");
  });

  it("활성 안내가 닫히면 다음 우선순위 안내가 이어서 보인다", () => {
    requestBottomNotice("install", BOTTOM_NOTICE_PRIORITY.installApp);
    requestBottomNotice("signup", BOTTOM_NOTICE_PRIORITY.signupBanner);
    expect(getActiveBottomNotice()).toBe("signup");

    releaseBottomNotice("signup");
    expect(getActiveBottomNotice()).toBe("install");

    releaseBottomNotice("install");
    expect(getActiveBottomNotice()).toBeNull();
  });

  it("같은 안내를 다시 요청해도 중복되지 않고, 없는 안내를 해제해도 오류가 없다", () => {
    requestBottomNotice("push", BOTTOM_NOTICE_PRIORITY.pushPermission);
    requestBottomNotice("push", BOTTOM_NOTICE_PRIORITY.pushPermission);
    releaseBottomNotice("push");
    expect(getActiveBottomNotice()).toBeNull();
    expect(() => releaseBottomNotice("nothing")).not.toThrow();
  });
});
