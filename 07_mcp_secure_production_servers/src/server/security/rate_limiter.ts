// ============================================================================
// RATE LIMITER (Sliding Window & Token Bucket)
// ============================================================================
// Enforces request-rate boundaries per client identity to prevent denial of
// service, automated scraping bursts, and looping agent cascades.
// ============================================================================

export interface RateLimitStatus {
  allowed: boolean;
  limit: number;
  remaining: number;
  resetInMs: number;
  retryAfterSeconds: number;
}

export class SecurityRateLimiter {
  private requestLog: Map<string, number[]> = new Map();
  private windowSizeMs: number;

  constructor(windowSizeMs: number = 60_000) {
    this.windowSizeMs = windowSizeMs;
  }

  /**
   * Check if a request from clientId with a given maxRequests limit is allowed.
   */
  public checkLimit(clientId: string, maxRequests: number): RateLimitStatus {
    const now = Date.now();
    const windowStart = now - this.windowSizeMs;

    let timestamps = this.requestLog.get(clientId) || [];
    // Evict timestamps outside current sliding window
    timestamps = timestamps.filter((t) => t > windowStart);

    if (timestamps.length >= maxRequests) {
      const oldestInWindow = timestamps[0];
      const resetInMs = Math.max(0, oldestInWindow + this.windowSizeMs - now);
      const retryAfterSeconds = Math.ceil(resetInMs / 1000);

      this.requestLog.set(clientId, timestamps);
      return {
        allowed: false,
        limit: maxRequests,
        remaining: 0,
        resetInMs,
        retryAfterSeconds,
      };
    }

    // Allow and record
    timestamps.push(now);
    this.requestLog.set(clientId, timestamps);

    return {
      allowed: true,
      limit: maxRequests,
      remaining: maxRequests - timestamps.length,
      resetInMs: this.windowSizeMs,
      retryAfterSeconds: 0,
    };
  }

  public reset(clientId?: string): void {
    if (clientId) {
      this.requestLog.delete(clientId);
    } else {
      this.requestLog.clear();
    }
  }
}
