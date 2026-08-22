import { createHash } from "node:crypto";

type CacheEntry<T> = { expiresAt: number; value: T };
const values = new Map<string, CacheEntry<unknown>>();
const inFlight = new Map<string, Promise<unknown>>();
const MAX_MEMORY_CACHE_ITEMS = 160;

function pruneMemoryCache(now: number) {
  for (const [key, item] of Array.from(values.entries())) {
    if (item.expiresAt <= now) values.delete(key);
  }
  while (values.size > MAX_MEMORY_CACHE_ITEMS) {
    const oldest = values.keys().next().value;
    if (!oldest) break;
    values.delete(oldest);
  }
}

export function normalizeForFingerprint(value: string) {
  return value.trim().replace(/\s+/g, " ");
}

export function createRequestFingerprint(parts: Array<string | number>) {
  return createHash("sha256").update(parts.map((part) => String(part)).join("\u001f"), "utf8").digest("hex");
}

/** 동일 요청은 하나의 실행으로 병합하고, 짧은 TTL 동안 메모리 결과를 재사용합니다. */
export async function getOrComputeCached<T>(key: string, ttlMs: number, compute: () => Promise<T>): Promise<{ value: T; cacheHit: boolean }> {
  const now = Date.now();
  const existing = values.get(key) as CacheEntry<T> | undefined;
  if (existing && existing.expiresAt > now) return { value: existing.value, cacheHit: true };
  if (inFlight.has(key)) return { value: await inFlight.get(key) as T, cacheHit: true };

  const task = compute();
  inFlight.set(key, task);
  try {
    const value = await task;
    values.set(key, { value, expiresAt: now + ttlMs });
    pruneMemoryCache(now);
    return { value, cacheHit: false };
  } finally {
    inFlight.delete(key);
  }
}
