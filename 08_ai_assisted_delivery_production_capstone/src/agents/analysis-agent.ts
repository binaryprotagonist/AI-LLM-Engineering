import type { GraphStateType } from "../graph/state.js";
import { logEvent } from "../observability/logger.js";

export function analysisAgentNode(
  state: GraphStateType
): Partial<GraphStateType> {
  const start = Date.now();
  const q = state.question;

  const analysisOutput = [
    `=== Executive Analysis ===`,
    `Query Subject: "${q}"`,
    `Tenant Context: ${state.tenantId} | Requester: ${state.userId}`,
    ``,
    `1. Synthesis & Evaluation:`,
    `   - Evaluated policy frameworks against current organizational baseline.`,
    `   - Identified operational constraints, compliance alignment, and risk vectors.`,
    ``,
    `2. Comparative Assessment:`,
    `   - Flexibility vs. On-site requirements: 3-day remote limit provides balanced operational coverage.`,
    `   - Security posture: Zero tolerance for credential sharing; API keys must be vaulted.`,
    ``,
    `3. Strategic Recommendation:`,
    `   - Ensure all exceptions are routed through the manager approval channel.`,
    `   - Maintain cryptographic audit trails for all related data actions.`
  ].join("\n");

  const tokens = Math.ceil(analysisOutput.length / 4);
  const cost = tokens * 0.000002;
  const durationMs = Date.now() - start;

  logEvent({
    requestId: state.requestId,
    traceId: state.traceId,
    operation: "agent.analysis",
    durationMs,
    status: "success",
    metadata: { tokens, cost }
  });

  return {
    answer: analysisOutput,
    status: "completed",
    stepsUsed: 1,
    tokensUsed: tokens,
    estimatedCostUsd: cost,
  };
}