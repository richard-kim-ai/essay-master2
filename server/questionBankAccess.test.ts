import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("./db", async (importOriginal) => ({
  ...await importOriginal<typeof import("./db")>(),
  getQuestionBankList: vi.fn(), getQuestionBankItemById: vi.fn(),
  getQuestionBankPublicStats: vi.fn(), getRandomQuestions: vi.fn(),
  getReorderingPracticeSet: vi.fn(), getSimilarQuestions: vi.fn(),
  getUserBookmarks: vi.fn(), toggleQuestionBookmark: vi.fn(),
  getLatestGuardianConsentStatusForUser: vi.fn(),
}));
import * as db from "./db";
import { appRouter } from "./routers";
import { clearGuardianStatusCache } from "./_core/trpc";
import type { TrpcContext } from "./_core/context";
import { COURSE_OPTIONS } from "../shared/course";

function caller(role = "user", tag = "중고등") {
  return appRouter.createCaller({
    user: { id: 999, openId: "isolated-archive-test", role, tag, teacherStatus: "approved" },
    req: { protocol: "https", headers: {} }, res: {},
  } as unknown as TrpcContext);
}
const row = (courseType = "middle_high", id = 12, isActive = 1) => ({
  id, courseType, toolType: "quiz", isActive, title: "논거 고르기", difficulty: "easy",
  contentData: JSON.stringify({ prompt: "근거를 고르세요.", answer: "비공개 정답", explanation: "비공개 해설" }),
});

beforeEach(() => {
  vi.clearAllMocks(); clearGuardianStatusCache();
  vi.mocked(db.getLatestGuardianConsentStatusForUser).mockResolvedValue("approved" as any);
  vi.mocked(db.getQuestionBankList).mockResolvedValue([row(), row("elementary", 13), row("middle_high", 14, 0)] as any);
  vi.mocked(db.getQuestionBankItemById).mockResolvedValue(row() as any);
  vi.mocked(db.getSimilarQuestions).mockResolvedValue([row("middle_high", 15), row("high_univ", 16), row("middle_high", 17, 0)] as any);
  vi.mocked(db.getQuestionBankPublicStats).mockResolvedValue([]);
  vi.mocked(db.getUserBookmarks).mockResolvedValue([12]);
  vi.mocked(db.toggleQuestionBookmark).mockResolvedValue(true);
});

describe("학생 아카이브의 가입 과정 접근", () => {
  it.each(COURSE_OPTIONS)("$label 학생은 가입 과정이 자동 적용되고 다른 과정 목록 요청은 DB 호출 전에 거절된다", async ({ value, label }) => {
    await caller("user", label).questionBank.list({});
    expect(db.getQuestionBankList).toHaveBeenLastCalledWith(value, undefined);
    vi.mocked(db.getQuestionBankList).mockClear();
    const other = COURSE_OPTIONS.find(c => c.value !== value)!.value;
    await expect(caller("user", label).questionBank.list({ courseType: other })).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(db.getQuestionBankList).not.toHaveBeenCalled();
  });
  it("자기 과정의 공개 문항만 반환하고 정답·해설은 노출하지 않는다", async () => {
    const result = await caller().questionBank.list({ courseType: "middle_high", toolType: "quiz" });
    expect(result.map(q => q.id)).toEqual([12]);
    expect(JSON.parse(result[0].contentData)).toEqual({ prompt: "근거를 고르세요." });
  });
  it("축약 일반 태그도 일반/직장인으로 판정한다", async () => {
    await caller("user", "일반").questionBank.list({});
    expect(db.getQuestionBankList).toHaveBeenCalledWith("general_adult", undefined);
  });
  it("다른 과정 랜덤·단락 재구성 문제도 직접 요청할 수 없다", async () => {
    await expect(caller().questionBank.random({ courseType: "high_univ", toolType: "quiz" })).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(caller().questionBank.reorderingPractice({ courseType: "elementary" })).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(db.getRandomQuestions).not.toHaveBeenCalled();
    expect(db.getReorderingPracticeSet).not.toHaveBeenCalled();
  });
  it("다른 과정·비활성·없는 문항 ID로 북마크 또는 유사문항 조회를 우회할 수 없다", async () => {
    for (const item of [row("elementary"), row("middle_high", 12, 0), undefined]) {
      vi.mocked(db.getQuestionBankItemById).mockResolvedValue(item as any);
      await expect(caller().questionBank.toggleBookmark({ questionId: 12 })).rejects.toMatchObject({ code: "FORBIDDEN" });
      await expect(caller().questionBank.similarQuestions({ questionId: 12 })).rejects.toMatchObject({ code: "FORBIDDEN" });
    }
    expect(db.toggleQuestionBookmark).not.toHaveBeenCalled();
    expect(db.getSimilarQuestions).not.toHaveBeenCalled();
  });
  it("정상 문항은 북마크하고 자기 과정 안에서만 유사 문항을 추천한다", async () => {
    await expect(caller().questionBank.toggleBookmark({ questionId: 12 })).resolves.toBe(true);
    expect(db.toggleQuestionBookmark).toHaveBeenCalledWith(999, 12);
    const similar = await caller().questionBank.similarQuestions({ questionId: 12 });
    expect(db.getSimilarQuestions).toHaveBeenCalledWith(12, "middle_high");
    expect(similar.map(q => q.id)).toEqual([15]);
    expect(JSON.parse(similar[0].contentData)).not.toHaveProperty("answer");
  });
  it("즐겨찾기·통계 조회도 가입 과정 SQL 필터를 전달한다", async () => {
    await caller().questionBank.getBookmarks();
    await caller().questionBank.publicStats();
    expect(db.getUserBookmarks).toHaveBeenCalledWith(999, "middle_high");
    expect(db.getQuestionBankPublicStats).toHaveBeenCalledWith("middle_high");
  });
  it.each(["admin", "teacher"])("%s는 기존 모든 과정 탐색 및 검수 권한을 유지한다", async role => {
    const result = await caller(role).questionBank.list({ courseType: "high_univ" });
    expect(db.getQuestionBankList).toHaveBeenCalledWith("high_univ", undefined);
    expect(result).toHaveLength(3);
    await caller(role).questionBank.similarQuestions({ questionId: 12 });
    expect(db.getQuestionBankItemById).toHaveBeenCalledWith(12);
    expect(db.getSimilarQuestions).toHaveBeenCalledWith(12, undefined);
  });
  it("학부모는 일반 학습 자료 경로를 이용할 수 없다", async () => {
    await expect(caller("user", "학부모").questionBank.list({ courseType: "high_univ" })).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(db.getQuestionBankList).not.toHaveBeenCalled();
  });
});
