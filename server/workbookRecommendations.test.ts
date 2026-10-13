import { beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("./db", async (importOriginal) => ({
  ...await importOriginal<typeof import("./db")>(),
  getRecommendedQuestionsForUser: vi.fn(), getWorkbookLessonBundle: vi.fn(),
  getCurriculumWorkbookQuestions: vi.fn(), getLatestGuardianConsentStatusForUser: vi.fn(),
}));
import { selectWorkbookRecommendations } from "./workbookRecommendations";
import { COURSE_OPTIONS } from "../shared/course";
import { appRouter } from "./routers";
import * as db from "./db";
import { clearGuardianStatusCache } from "./_core/trpc";
import type { TrpcContext } from "./_core/context";
const candidates = COURSE_OPTIONS.flatMap(({ value }, idx) => [1, 2].flatMap(level => [0, 1, 2].map(lessonIndex => ({
  id: idx * 100 + level * 10 + lessonIndex, courseType: value, level, lessonIndex, questionNumber: 1,
  title: "주장과 근거", prompt: "제시문을 읽으세요", correctAnswer: "정답 비공개", explanation: "해설 비공개",
}))));
function caller(role = "user", tag = "중고등") {
  return appRouter.createCaller({ user: { id: 999, role, tag, openId: "isolated-recommendation", teacherStatus: "approved" }, req: { protocol: "https", headers: {} }, res: {} } as unknown as TrpcContext);
}
beforeEach(() => {
  vi.clearAllMocks();clearGuardianStatusCache();
  vi.mocked(db.getLatestGuardianConsentStatusForUser).mockResolvedValue("approved" as any);
  vi.mocked(db.getRecommendedQuestionsForUser).mockResolvedValue(candidates as any);
  vi.mocked(db.getCurriculumWorkbookQuestions).mockResolvedValue([]);
  vi.mocked(db.getWorkbookLessonBundle).mockResolvedValue({ workbookQuestions: [], theoryContent: [] } as any);
});

describe("가입 과정 전용 취약 영역 추천", () => {
  it.each(COURSE_OPTIONS)("$label 추천 후보와 기본 추천은 해당 과정만 선택한다", ({ value }) => {
    const result = selectWorkbookRecommendations(candidates, [], value);
    expect(result).toHaveLength(5);
    expect(result.every(q => q.courseType === value)).toBe(true);
  });
  it("해당 과정의 오답 문항을 기본 2단계 문제보다 먼저 추천한다", () => {
    const result = selectWorkbookRecommendations(candidates, [112, 20], "middle_high");
    expect(result[0].id).toBe(112);
    expect(result.every(q => q.courseType === "middle_high")).toBe(true);
    expect(result.map(q => q.id)).not.toContain(20);
  });
  it("내 과정이 비어 있으면 다른 과정의 문항으로 채우지 않는다", () => {
    expect(selectWorkbookRecommendations(candidates.filter(q => q.courseType === "elementary"), [20], "middle_high")).toEqual([]);
  });
  it("후보가 5개 미만이면 내 과정 문항만 반환한다", () => {
    expect(selectWorkbookRecommendations(candidates.slice(0, 2), [], "elementary")).toHaveLength(2);
  });
  it.each(COURSE_OPTIONS)("$label 학생의 추천 API는 클라이언트 입력 없이 세션 가입 과정을 사용한다", async ({ label, value }) => {
    const result = await caller("user", label).curriculum.getRecommendedQuestions();
    expect(db.getRecommendedQuestionsForUser).toHaveBeenCalledWith(999, value);
    expect(result.every(q => q.courseType === value)).toBe(true);
    expect(result.every(q => q.correctAnswer === "" && q.explanation === "")).toBe(true);
  });
  it("축약 일반 태그도 일반/직장인으로 추천한다", async () => {
    await caller("user", "일반").curriculum.getRecommendedQuestions();
    expect(db.getRecommendedQuestionsForUser).toHaveBeenCalledWith(999, "general_adult");
  });
  it("다른 과정 워크북 레슨·문항 API는 DB 호출 전에 차단한다", async () => {
    await expect(caller().curriculum.getWorkbookLessonBundle({ courseType: "elementary", level: 2, lessonIndex: 0 })).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(caller().curriculum.getWorkbookQuestions({ courseType: "high_univ", level: 2, lessonIndex: 0 })).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(db.getWorkbookLessonBundle).not.toHaveBeenCalled();
    expect(db.getCurriculumWorkbookQuestions).not.toHaveBeenCalled();
  });
  it("가입 과정의 워크북 레슨은 정상 연결된다", async () => {
    await caller().curriculum.getWorkbookLessonBundle({ courseType: "middle_high", level: 2, lessonIndex: 1 });
    expect(db.getWorkbookLessonBundle).toHaveBeenCalledWith({ courseType: "middle_high", lessonLevel: 2, lessonIndex: 1 });
  });
  it.each(["admin", "teacher"])("%s의 검수·전체 과정 탐색을 유지한다", async role => {
    await caller(role).curriculum.getRecommendedQuestions();
    expect(db.getRecommendedQuestionsForUser).toHaveBeenCalledWith(999, undefined);
    await caller(role).curriculum.getWorkbookLessonBundle({ courseType: "high_univ", level: 2, lessonIndex: 0 });
    expect(db.getWorkbookLessonBundle).toHaveBeenCalled();
  });
});
