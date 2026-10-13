import { describe, expect, it } from "vitest";
import {
  getHomePrimaryAction,
  getHomeSecondaryAction,
} from "./homeExperience";

describe("home experience actions", () => {
  it("guides a visitor to curriculum discovery before authentication", () => {
    expect(getHomePrimaryAction(false)).toMatchObject({
      href: "/curriculum",
      label: "나에게 맞는 과정 찾기",
    });
    expect(getHomeSecondaryAction(false)).toEqual({
      href: "/login",
      label: "로그인 / 회원가입",
    });
  });

  it("guides learners, teachers, and administrators to their relevant next step", () => {
    expect(getHomePrimaryAction(true, "student").href).toBe("/mypage");
    expect(getHomePrimaryAction(true, "teacher").href).toBe("/teacher-mypage");
    expect(getHomePrimaryAction(true, "admin").href).toBe("/admin");
    expect(getHomeSecondaryAction(true)).toEqual({
      href: "/curriculum",
      label: "다른 과정 살펴보기",
    });
  });
});
