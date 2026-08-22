import { createRequestFingerprint, getOrComputeCached, normalizeForFingerprint } from "./runtimeEfficiency";
import { describe, expect, it } from "vitest";

describe("호출 효율 캐시", () => {
  it("공백 차이만 있는 같은 문장을 같은 지문으로 정규화하고 안정적인 요청 해시를 만든다", () => {
    const normalized = normalizeForFingerprint("  문장을   간결하게  고칩니다. ");
    expect(normalized).toBe("문장을 간결하게 고칩니다.");
    expect(createRequestFingerprint([1, 10, normalized])).toBe(createRequestFingerprint([1, 10, "문장을 간결하게 고칩니다."]));
  });

  it("동일한 진행 중 요청을 하나로 합치고 유효 TTL 동안 재계산하지 않는다", async () => {
    let calls = 0;
    const compute = async () => { calls += 1; return { score: 88 }; };
    const [first, second] = await Promise.all([
      getOrComputeCached("sentence:1", 60_000, compute),
      getOrComputeCached("sentence:1", 60_000, compute),
    ]);
    const third = await getOrComputeCached("sentence:1", 60_000, compute);
    expect(first.value.score).toBe(88);
    expect(second.value.score).toBe(88);
    expect(third.cacheHit).toBe(true);
    expect(calls).toBe(1);
  });
});
