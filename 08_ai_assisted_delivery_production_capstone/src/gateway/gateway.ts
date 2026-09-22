import { GatewayRequestSchema } from "./schema.js";
import { createGatewayContext } from "./request-context.js";
import type { GatewayRequest, GatewayResponse } from "./types.js";
import { RateLimiter } from "./rate-limiter.js";

export class Gateway {

  private readonly rateLimiter = new RateLimiter(
    10, // max requests
    60_000 // 1 minute
  );

  handle(request: GatewayRequest): GatewayResponse {
   
    const result = GatewayRequestSchema.safeParse(request);

    if (!result.success) {
      return {
        accepted: false,
        error: {
          code: "INVALID_REQUEST",
          message: result.error.issues
            .map((issue) => issue.message)
            .join(", ")
        }
      };
    }

    const user = result.data.user;

    const rateLimit = this.rateLimiter.check(
      `${user.tenantId}:${user.userId}`
    );

    if (!rateLimit.allowed) {
      return {
        accepted: false,
        error: {
          code: "RATE_LIMITED",
          message: `Too many requests. Retry after ${rateLimit.retryAfterMs}ms.`
        }
      };
    }

    const context = createGatewayContext(result.data.user);

    return {
      accepted: true,
      context
    };
  }
}