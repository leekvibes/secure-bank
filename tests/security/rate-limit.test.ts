import test from "node:test";
import assert from "node:assert/strict";
import { __resetRateLimitForTests, checkRateLimit } from "@/lib/rate-limit";

test("in-memory rate limiter blocks after max requests", async () => {
  const oldUrl = process.env.UPSTASH_REDIS_REST_URL;
  const oldToken = process.env.UPSTASH_REDIS_REST_TOKEN;
  delete process.env.UPSTASH_REDIS_REST_URL;
  delete process.env.UPSTASH_REDIS_REST_TOKEN;

  __resetRateLimitForTests();
  const key = "test-rate-limit";

  const first = await checkRateLimit(key, { maxRequests: 2, windowMs: 60_000 });
  const second = await checkRateLimit(key, { maxRequests: 2, windowMs: 60_000 });
  const third = await checkRateLimit(key, { maxRequests: 2, windowMs: 60_000 });

  assert.equal(first.allowed, true);
  assert.equal(second.allowed, true);
  assert.equal(third.allowed, false);

  process.env.UPSTASH_REDIS_REST_URL = oldUrl;
  process.env.UPSTASH_REDIS_REST_TOKEN = oldToken;
});
