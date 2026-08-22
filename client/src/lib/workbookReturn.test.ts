import { describe, expect, it } from "vitest";
import { buildToolPathWithWorkbookReturn, buildWorkbookReturnPath, getInitialWorkbookLesson, getWorkbookReturnPath } from "./workbookReturn";

describe("워크북 학습 위치 복귀 경로", () => {
  it("과정·레벨·레슨 위치를 안전한 워크북 경로로 만든다", () => {
    expect(buildWorkbookReturnPath("middle_high", 2, 1)).toBe("/workbook/middle_high/2?lesson=1");
    expect(buildWorkbookReturnPath("invalid", 2, 1)).toBeNull();
  });

  it("학습 도구 이동 경로에 복귀 위치를 포함하고, 유효한 복귀 경로만 읽는다", () => {
    const returnPath = "/workbook/high_univ/1?lesson=2";
    expect(buildToolPathWithWorkbookReturn("/topic-wizard", returnPath)).toBe("/topic-wizard?return_to=%2Fworkbook%2Fhigh_univ%2F1%3Flesson%3D2");
    expect(getWorkbookReturnPath("?return_to=%2Fworkbook%2Fhigh_univ%2F1%3Flesson%3D2")).toBe(returnPath);
    expect(getWorkbookReturnPath("?return_to=https%3A%2F%2Funsafe.example")).toBeNull();
  });

  it("워크북 복귀 시 유효한 레슨 인덱스만 사용한다", () => {
    expect(getInitialWorkbookLesson("?lesson=2")).toBe(2);
    expect(getInitialWorkbookLesson("?lesson=-1")).toBe(0);
    expect(getInitialWorkbookLesson("?lesson=two")).toBe(0);
  });
});
