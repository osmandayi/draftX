import "server-only";
import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

export const RATE_LIMIT_MESSAGE =
  "Çok fazla istek, biraz yavaşla. Lütfen birkaç saniye bekle.";

export type LimitKind =
  | "tick"
  | "create"
  | "join"
  | "pool"
  | "pick"
  | "manage"
  | "profile";

// Per-user sliding windows. Tuned so normal play never trips them.
const WINDOWS: Record<LimitKind, { limit: number; window: `${number} ${"s" | "m"}` }> = {
  tick: { limit: 12, window: "10 s" },
  create: { limit: 5, window: "1 m" },
  join: { limit: 10, window: "1 m" },
  pool: { limit: 40, window: "1 m" },
  pick: { limit: 30, window: "1 m" },
  manage: { limit: 10, window: "1 m" },
  profile: { limit: 10, window: "1 m" },
};

function redisFromEnv(): Redis | null {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;
  return new Redis({ url, token });
}

// Memoized Redis singleton instance.
let redisSingleton: Redis | null | undefined;

function redis(): Redis | null {
  if (redisSingleton === undefined) redisSingleton = redisFromEnv();
  return redisSingleton;
}

// Lazily built, memoized per-kind limiters. Null when Upstash is unconfigured.
let limiters: Partial<Record<LimitKind, Ratelimit>> | null | undefined;

function limiterFor(kind: LimitKind): Ratelimit | null {
  if (limiters === undefined) {
    const redisClient = redis();
    limiters = redisClient ? {} : null;
  }
  if (limiters === null) return null;
  if (!limiters[kind]) {
    const { limit, window } = WINDOWS[kind];
    limiters[kind] = new Ratelimit({
      redis: redis()!,
      limiter: Ratelimit.slidingWindow(limit, window),
      prefix: `rl:${kind}`,
    });
  }
  return limiters[kind]!;
}

/**
 * Check the per-user rate limit for an action kind. No-ops (allows) when
 * Upstash env vars are unset, so local dev and CI are unaffected.
 */
export async function checkLimit(
  userId: string,
  kind: LimitKind,
): Promise<{ ok: boolean; retryAfter: number }> {
  const limiter = limiterFor(kind);
  if (!limiter) return { ok: true, retryAfter: 0 };

  const { success, reset } = await limiter.limit(userId);
  if (success) return { ok: true, retryAfter: 0 };
  const retryAfter = Math.max(1, Math.ceil((reset - Date.now()) / 1000));
  return { ok: false, retryAfter };
}
