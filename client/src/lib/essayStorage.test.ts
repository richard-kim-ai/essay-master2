// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from "vitest";
import {
  newLocalEssay,
  readEssays,
  writeEssays,
  mergeServerEssays,
  applySyncedEssay,
  essayStorageKey,
  legacyEssayCandidates,
  importLegacyEssays,
  LEGACY_ESSAY_KEY,
} from "./essayStorage";
beforeEach(() => localStorage.clear());
describe("계정별 오프라인 논술 보관", () => {
  it("계정별 키를 사용하며 다른 학생의 글을 저장하거나 읽지 않는다", () => {
    const own = newLocalEssay(10, "내 글", "본문");
    const other = newLocalEssay(20, "다른 글", "본문");
    writeEssays(10, [own, other]);
    expect(readEssays(10)).toEqual([own]);
    expect(readEssays(20)).toEqual([]);
    localStorage.setItem(essayStorageKey(10), JSON.stringify([own, other]));
    expect(readEssays(10)).toEqual([own]);
  });
  it("서버 목록이 미동기화 기기 수정과 새 초안을 덮어쓰지 않는다", () => {
    const own = { ...newLocalEssay(10, "수정한 제목", "미동기화 본문"), id: 7 };
    const newDraft = newLocalEssay(10, "새 초안", "초안");
    const result = mergeServerEssays(
      [own, newDraft],
      [
        {
          id: 7,
          userId: 10,
          title: "이전 제목",
          content: "이전 본문",
          status: "draft",
          syncRevision: 1,
        },
        { id: 8, userId: 20, title: "남의 글", content: "본문" },
      ],
      10
    );
    expect(result).toHaveLength(2);
    expect(result.find(r => r.id === 7)?.content).toBe("미동기화 본문");
  });
  it("동기화한 글은 서버의 최신 피드백과 상태를 반영한다", () => {
    const own = { ...newLocalEssay(10, "글", "본문"), id: 7, isDirty: false };
    const result = mergeServerEssays(
      [own],
      [
        {
          id: 7,
          userId: 10,
          title: "글",
          content: "본문",
          status: "reviewed",
          syncRevision: 2,
          teacherFeedback: { overallComment: "근거를 추가하세요." },
        },
      ],
      10
    );
    expect(result[0].localId).toBe(own.localId);
    expect(result[0].status).toBe("reviewed");
    expect(result[0].teacherFeedback.overallComment).toContain("근거");
  });
  it("응답 대기 중 작성한 새 수정은 dirty 상태로 유지하면서 서버 ID를 보존한다", () => {
    const sent = newLocalEssay(10, "내 글", "이전 본문");
    const current = {
      ...sent,
      content: "새 본문",
      updatedAt: "2030-01-01T00:00:00.000Z",
    };
    const result = applySyncedEssay(current, sent, {
      id: 123,
      syncRevision: 2,
      status: "draft",
    });
    expect(result.content).toBe("새 본문");
    expect(result.isDirty).toBe(true);
    expect(result.id).toBe(123);
    expect(result.syncRevision).toBe(2);
  });
  it("동기화 완료는 같은 localId로 실제 서버 ID를 연결한다", () => {
    const sent = newLocalEssay(10, "글", "본문");
    const result = applySyncedEssay(sent, sent, {
      id: 123,
      syncRevision: 0,
      status: "draft",
    });
    expect(result.localId).toBe(sent.localId);
    expect(result.id).toBe(123);
    expect(result.isDirty).toBe(false);
  });
  it("구형 공유 캐시는 자동 업로드하지 않고 본인 확인 후 새 초안으로만 가져온다", () => {
    localStorage.setItem(
      LEGACY_ESSAY_KEY,
      JSON.stringify([
        { id: 111, title: "기존 글", content: "본문", status: "submitted" },
        { id: 222, userId: 20, title: "다른 계정", content: "본문" },
      ])
    );
    expect(readEssays(10)).toEqual([]);
    expect(legacyEssayCandidates(10)).toHaveLength(1);
    const imported = importLegacyEssays(10);
    expect(imported[0].id).toBeUndefined();
    expect(imported[0].status).toBe("draft");
    expect(imported[0].userId).toBe(10);
    expect(localStorage.getItem(LEGACY_ESSAY_KEY)).not.toBeNull();
  });
  it("저장 공간 실패는 성공으로 숨기지 않는다", () => {
    expect(() =>
      writeEssays(10, [newLocalEssay(10)], {
        setItem: () => {
          throw Error("quota");
        },
      } as unknown as Storage)
    ).toThrow("quota");
  });
});
