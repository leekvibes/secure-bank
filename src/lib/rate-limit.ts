/**
 * Submission endpoint rate limiter.
 *
 * Uses Upstash Redis when configured (multi-instance safe),
 * with in-memory fallback for local development.
 */

const store = new Map<string, { count: number; resetAt: number }>();

const WINDOW_MS = 15 * 60 * 1000; // 15 minutes
const MAX_REQUESTS = 5;
const KEY_PREFIX = "rate:submit";

type RateLimitResult = {
  allowed: boolean;
  remaining: number;
  resetAt: number;
};

type RateLimitOptions = {
  maxRequests?: number;
  windowMs?: number;
  prefix?: string;
};

function inMemoryRateLimit(
  key: string,
  options: Required<RateLimitOptions>
): RateLimitResult {
  const now = Date.now();
  const entry = store.get(key);
  const maxRequests = options.maxRequests;
  const windowMs = options.windowMs;

  if (!entry || entry.resetAt < now) {
    store.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true, remaining: maxRequests - 1, resetAt: now + windowMs };
  }

  if (entry.count >= maxRequests) {
    return { allowed: false, remaining: 0, resetAt: entry.resetAt };
  }

  entry.count += 1;
  return {
    allowed: true,
    remaining: maxRequests - entry.count,
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

async function redisRateLimit(
  key: string,
  options: Required<RateLimitOptions>
): Promise<RateLimitResult> {
  const scopedKey = `${options.prefix}:${key}`;
  const now = Date.now();
  const windowSec = Math.ceil(options.windowMs / 1000);

  const incrResult = await upstashCommand(["INCR", scopedKey]);
  const count = Number(incrResult ?? 0);

  if (count === 1) {
    await upstashCommand(["EXPIRE", scopedKey, windowSec]);
  }

  const ttlResult = await upstashCommand(["TTL", scopedKey]);
  const ttl = Math.max(Number(ttlResult ?? windowSec), 0);
  const resetAt = now + ttl * 1000;

  if (count > options.maxRequests) {
    return { allowed: false, remaining: 0, resetAt };
  }

  return {
    allowed: true,
    remaining: Math.max(options.maxRequests - count, 0),
    resetAt,
  };
}

export async function checkRateLimit(
  key: string,
  options: RateLimitOptions = {}
): Promise<RateLimitResult> {
  const normalized: Required<RateLimitOptions> = {
    maxRequests: options.maxRequests ?? MAX_REQUESTS,
    windowMs: options.windowMs ?? WINDOW_MS,
    prefix: options.prefix ?? KEY_PREFIX,
  };
  if (upstashConfigured()) {
    try {
      return await redisRateLimit(key, normalized);
    } catch {
      return inMemoryRateLimit(key, normalized);
    }
  }
  return inMemoryRateLimit(key, normalized);
}

// Clean up expired entries periodically to prevent memory leaks
const cleanupTimer = setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of Array.from(store.entries())) {
    if (entry.resetAt < now) store.delete(key);
  }
}, 5 * 60 * 1000);
cleanupTimer.unref?.();

export function __resetRateLimitForTests() {
  store.clear();
}
