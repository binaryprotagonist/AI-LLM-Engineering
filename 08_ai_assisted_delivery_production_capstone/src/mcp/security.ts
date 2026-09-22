import type { MCPClientIdentity, MCPScope } from "./types.js";

export class SecurityGuard {
  private readonly rateLimits = new Map<string, { count: number; windowStart: number }>();

  constructor(
    private readonly maxRequestsPerWindow = 30,
    private readonly windowMs = 60_000
  ) {}

  checkRateLimit(key: string): { allowed: boolean; retryAfterMs?: number } {
    const now = Date.now();
    const entry = this.rateLimits.get(key);

    if (!entry || now - entry.windowStart >= this.windowMs) {
      this.rateLimits.set(key, { count: 1, windowStart: now });
      return { allowed: true };
    }

    if (entry.count >= this.maxRequestsPerWindow) {
      const retryAfterMs = this.windowMs - (now - entry.windowStart);
      return { allowed: false, retryAfterMs };
    }

    entry.count += 1;
    return { allowed: true };
  }

  checkAuthorization(identity: MCPClientIdentity, requiredScope: MCPScope): { authorized: boolean; reason?: string } {
    if (!identity.userId || !identity.tenantId) {
      return { authorized: false, reason: "Missing user or tenant identity" };
    }

    if (!identity.scopes.includes(requiredScope)) {
      return {
        authorized: false,
        reason: `Forbidden: required scope '${requiredScope}' missing from granted scopes [${identity.scopes.join(", ")}]`
      };
    }

    return { authorized: true };
  }

  validateLexicalInput(input: unknown): { safe: boolean; reason?: string } {
    if (typeof input === "string") {
      const dangerousPatterns = [
        /;\s*(drop|alter|delete|insert|update|create|truncate)\b/i,
        /--.*$/m,
        /\/\*[\s\S]*?\*\//,
        /\bunion\s+select\b/i,
        /\bor\s+1\s*=\s*1\b/i,
        /\bselect\s+.*\s+from\s+sqlite_master\b/i,
        /<script\b[^>]*>([\s\S]*?)<\/script>/i
      ];

      for (const pattern of dangerousPatterns) {
        if (pattern.test(input)) {
          return {
            safe: false,
            reason: `Malicious payload pattern detected matching: ${pattern.toString()}`
          };
        }
      }
    } else if (input && typeof input === "object") {
      for (const value of Object.values(input as Record<string, unknown>)) {
        const check = this.validateLexicalInput(value);
        if (!check.safe) return check;
      }
    }

    return { safe: true };
  }
}
