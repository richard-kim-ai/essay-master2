import { describe, expect, it } from "vitest";
import { COURSE_OPTIONS, getCourseTag, getCourseTypeFromUserTag } from "@shared/course";

describe("학생 과정 선택 매핑", () => {
  it("4개 과정 선택값을 사용자 태그로 손실 없이 저장한다", () => {
    expect(COURSE_OPTIONS.map((course) => getCourseTag(course.value))).toEqual(["초등", "중고등", "고등/대입", "일반/직장인"]);
  });

  it("로그인 사용자의 과정 태그를 전용 커리큘럼 키로 복원한다", () => {
    expect(getCourseTypeFromUserTag("초등")).toBe("elementary");
    expect(getCourseTypeFromUserTag("중고등")).toBe("middle_high");
    expect(getCourseTypeFromUserTag("고등/대입")).toBe("high_univ");
    expect(getCourseTypeFromUserTag("일반/직장인")).toBe("general_adult");
    expect(getCourseTypeFromUserTag("일반")).toBe("general_adult");
    expect(getCourseTypeFromUserTag("학부모")).toBe("middle_high");
  });
});
