// 로그인·메일 발송처럼 반복 호출이 위험한 요청의 횟수를 제한한다(고정 시간 창 안의 시도 횟수).
// 서버 한 대의 메모리에 기록한다. 서버를 여러 대로 늘리면 공용 저장소(DB·Redis) 기반으로 바꿔야 한다.

export type RateLimitRule = { windowMs: number; max: number };
export type RateLimitResult = { allowed: boolean; retryAfterSec: number };

const hitsByKey = new Map<string, number[]>();
let lastSweep = 0;

function sweep(now: number, maxWindowMs: number) {
  if (now - lastSweep < 60_000) return;
  lastSweep = now;
  hitsByKey.forEach((hits, key) => {
    if (hits.length === 0 || now - hits[hits.length - 1] > maxWindowMs) hitsByKey.delete(key);
  });
}

/** 시도를 기록하고 허용 여부를 돌려준다. 한도를 넘긴 시도는 기록하지 않는다(창이 계속 밀리지 않도록). */
export function consumeRateLimit(name: string, key: string, rule: RateLimitRule, now = Date.now()): RateLimitResult {
  sweep(now, Math.max(rule.windowMs, 60 * 60 * 1000));
  const bucketKey = `${name}:${key}`;
  const hits = (hitsByKey.get(bucketKey) ?? []).filter((time) => now - time < rule.windowMs);
  if (hits.length >= rule.max) {
    hitsByKey.set(bucketKey, hits);
    return { allowed: false, retryAfterSec: Math.max(1, Math.ceil((rule.windowMs - (now - hits[0])) / 1000)) };
  }
  hits.push(now);
  hitsByKey.set(bucketKey, hits);
  return { allowed: true, retryAfterSec: 0 };
}

export function resetRateLimits() {
  hitsByKey.clear();
}

// 요청 종류별 규칙
export const RATE_RULES = {
  loginByEmail: { windowMs: 15 * 60 * 1000, max: 8 },
  loginByIp: { windowMs: 15 * 60 * 1000, max: 40 },
  mailByEmail: { windowMs: 60 * 60 * 1000, max: 3 },
  mailByIp: { windowMs: 60 * 60 * 1000, max: 15 },
  signupByIp: { windowMs: 60 * 60 * 1000, max: 10 },
  announceByAdmin: { windowMs: 60 * 60 * 1000, max: 10 },
  checkoutByUser: { windowMs: 60 * 60 * 1000, max: 10 },
  evalEngineByUser: { windowMs: 60 * 60 * 1000, max: 30 },
} as const satisfies Record<string, RateLimitRule>;
