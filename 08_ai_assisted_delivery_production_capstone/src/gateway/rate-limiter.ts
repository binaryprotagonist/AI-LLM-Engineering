

interface RateLimitEntry {
  count: number;
  windowStartedAt: number;
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  retryAfterMs?: number;
}

export class RateLimiter {
  private readonly entries = new Map<string, RateLimitEntry>();

  constructor(
    private readonly maxRequests: number,
    private readonly windowMs: number
  ) {}

  check(key: string): RateLimitResult {
    const now = Date.now();
    const existing = this.entries.get(key);

    if (!existing || now - existing.windowStartedAt >= this.windowMs) {
      this.entries.set(key, {
        count: 1,
        windowStartedAt: now
      });

      return {
        allowed: true,
        remaining: this.maxRequests - 1
      };
    }

    if (existing.count >= this.maxRequests) {
      return {
        allowed: false,
        remaining: 0,
        retryAfterMs: this.windowMs - (now - existing.windowStartedAt)
      };
    }

    existing.count += 1;

    return {
      allowed: true,
      remaining: this.maxRequests - existing.count
    };
  }
}