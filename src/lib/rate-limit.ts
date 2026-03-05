/**
 * Submission endpoint rate limiter.
 *
 * Uses Upstash Redis when configured (multi-instance safe),
 * with in-memory fallback for local development.
 */

const store = new Map<string, { count: number; resetAt: number }>();

const WINDOW_MS = 15 * 60 * 1000; // 15 minutes
const WINDOW_SEC = Math.ceil(WINDOW_MS / 1000);
const MAX_REQUESTS = 5;
const KEY_PREFIX = "rate:submit";

type RateLimitResult = {
  allowed: boolean;
  remaining: number;
  resetAt: number;
};

function inMemoryRateLimit(key: string): RateLimitResult {
  const now = Date.now();
  const entry = store.get(key);

  if (!entry || entry.resetAt < now) {
    store.set(key, { count: 1, resetAt: now + WINDOW_MS });
    return { allowed: true, remaining: MAX_REQUESTS - 1, resetAt: now + WINDOW_MS };
  }

  if (entry.count >= MAX_REQUESTS) {
    return { allowed: false, remaining: 0, resetAt: entry.resetAt };
  }

  entry.count += 1;
  return {
    allowed: true,
    remaining: MAX_REQUESTS - entry.count,
    resetAt: entry.resetAt,
  };
}

function upstashConfigured(): boolean {
  return Boolean(
    process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN
  );
}

async function upstashCommand(args: (string | number)[]): Promise<unknown> {
  const url = process.env.UPSTASH_REDIS_REST_URL!;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN!;
  const endpoint = `${url}/pipeline`;
  const res = await fetch(endpoint, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify([args]),
    cache: "no-store",
  });

  if (!res.ok) {
    throw new Error("Upstash request failed");
  }

  const data = (await res.json()) as Array<{ result?: unknown; error?: string }>;
  if (!Array.isArray(data) || data.length === 0 || data[0].error) {
    throw new Error("Upstash command error");
  }
  return data[0].result;
}

async function redisRateLimit(key: string): Promise<RateLimitResult> {
  const scopedKey = `${KEY_PREFIX}:${key}`;
  const now = Date.now();

  const incrResult = await upstashCommand(["INCR", scopedKey]);
  const count = Number(incrResult ?? 0);

  if (count === 1) {
    await upstashCommand(["EXPIRE", scopedKey, WINDOW_SEC]);
  }

  const ttlResult = await upstashCommand(["TTL", scopedKey]);
  const ttl = Math.max(Number(ttlResult ?? WINDOW_SEC), 0);
  const resetAt = now + ttl * 1000;

  if (count > MAX_REQUESTS) {
    return { allowed: false, remaining: 0, resetAt };
  }

  return {
    allowed: true,
    remaining: Math.max(MAX_REQUESTS - count, 0),
    resetAt,
  };
}

export async function checkRateLimit(key: string): Promise<RateLimitResult> {
  if (upstashConfigured()) {
    try {
      return await redisRateLimit(key);
    } catch {
      return inMemoryRateLimit(key);
    }
  }
  return inMemoryRateLimit(key);
}

// Clean up expired entries periodically to prevent memory leaks
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of Array.from(store.entries())) {
    if (entry.resetAt < now) store.delete(key);
  }
}, 5 * 60 * 1000);
