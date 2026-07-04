import { afterEach, beforeEach, describe, expect, it } from "vitest";

const ORIGINAL = { ...process.env };

describe("checkLimit", () => {
  beforeEach(() => {
    delete process.env.UPSTASH_REDIS_REST_URL;
    delete process.env.UPSTASH_REDIS_REST_TOKEN;
  });
  afterEach(() => {
    process.env = { ...ORIGINAL };
  });

  it("no-ops (allows) when Upstash env is not configured", async () => {
    const { checkLimit } = await import("./rate-limit");
    const result = await checkLimit("user-123", "pick");
    expect(result).toEqual({ ok: true, retryAfter: 0 });
  });
});
