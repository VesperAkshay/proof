import { NextResponse } from "next/server";
import { apiError } from "./api";

export interface RateLimitResult {
  allowed: boolean;
  limit: number;
  remaining: number;
  resetSeconds: number;
}

interface RateLimitBucket {
  timestamps: number[];
}

/**
 * In-memory sliding window rate limiter.
 * Tracks timestamps for rolling window calculations.
 */
class MemoryRateLimiter {
  private buckets = new Map<string, RateLimitBucket>();
  private lastCleanup = Date.now();
  private readonly cleanupIntervalMs = 60 * 1000; // 1 minute

  public check(key: string, limit: number, windowSeconds: number): RateLimitResult {
    const now = Date.now();
    this.maybeCleanup(now);

    const windowMs = windowSeconds * 1000;
    const windowStart = now - windowMs;

    let bucket = this.buckets.get(key);
    if (!bucket) {
      bucket = { timestamps: [] };
      this.buckets.set(key, bucket);
    }

    // Filter out expired timestamps
    bucket.timestamps = bucket.timestamps.filter((ts) => ts > windowStart);

    const count = bucket.timestamps.length;
    if (count >= limit) {
      // Calculate earliest expiring timestamp to find reset seconds
      const oldestTs = bucket.timestamps[0] ?? now;
      const resetMs = Math.max(0, oldestTs + windowMs - now);
      const resetSeconds = Math.max(1, Math.ceil(resetMs / 1000));

      return {
        allowed: false,
        limit,
        remaining: 0,
        resetSeconds,
      };
    }

    // Record this request
    bucket.timestamps.push(now);
    const resetSeconds = windowSeconds;

    return {
      allowed: true,
      limit,
      remaining: limit - bucket.timestamps.length,
      resetSeconds,
    };
  }

  public reset(): void {
    this.buckets.clear();
  }

  private maybeCleanup(now: number): void {
    if (now - this.lastCleanup < this.cleanupIntervalMs) {
      return;
    }
    this.lastCleanup = now;

    // Prune buckets older than 1 hour
    const oneHourAgo = now - 3600 * 1000;
    for (const [key, bucket] of this.buckets.entries()) {
      bucket.timestamps = bucket.timestamps.filter((ts) => ts > oneHourAgo);
      if (bucket.timestamps.length === 0) {
        this.buckets.delete(key);
      }
    }
  }
}

export const rateLimiter = new MemoryRateLimiter();

/**
 * Standard rate limit configurations from docs/api-contract.md
 */
export const RATE_LIMIT_CONFIGS = {
  AVAILABILITY_IP: { limit: 30, windowSeconds: 60 },
  AVAILABILITY_USER: { limit: 60, windowSeconds: 60 },
  UPLOAD_SESSION: { limit: 20, windowSeconds: 3600 },
  REPORT: { limit: 10, windowSeconds: 3600 },
  WRITE: { limit: 60, windowSeconds: 60 },
} as const;

/**
 * Generates a standard HTTP 429 Too Many Requests response with Retry-After header.
 */
export function rateLimitResponse(
  result: RateLimitResult,
  customMessage = "Rate limit exceeded. Please retry later."
): NextResponse {
  const response = apiError("RATE_LIMITED", customMessage, 429, {
    retry_after: result.resetSeconds,
    limit: result.limit,
    remaining: result.remaining,
  });

  response.headers.set("Retry-After", String(result.resetSeconds));
  response.headers.set("X-RateLimit-Limit", String(result.limit));
  response.headers.set("X-RateLimit-Remaining", String(result.remaining));
  response.headers.set("X-RateLimit-Reset", String(result.resetSeconds));

  return response;
}
