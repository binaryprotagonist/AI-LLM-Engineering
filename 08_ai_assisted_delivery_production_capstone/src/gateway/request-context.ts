import { randomUUID } from "node:crypto";
import type { AuthenticatedUser, GatewayContext } from "./types.js";

export function createGatewayContext(user: AuthenticatedUser): GatewayContext {

  const now = Date.now();

  return {
    requestId: randomUUID(),
    traceId: randomUUID(),
    user,
    budget: {
      maxSteps: 12,
      maxTokens: 20_000,
      maxCostUsd: 0.05,
      deadlineAt: now + 30_000
    }
  };
}