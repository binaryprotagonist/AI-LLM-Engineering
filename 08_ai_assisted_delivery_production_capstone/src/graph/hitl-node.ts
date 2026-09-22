import type { GraphStateType } from "./state.js";
import { logEvent } from "../observability/logger.js";

export function hitlGateNode(
  state: GraphStateType
): Partial<GraphStateType> {
  // If no approval is pending, pass through
  if (!state.pendingApproval) {
    return {};
  }

  logEvent({
    requestId: state.requestId,
    traceId: state.traceId,
    operation: "graph.hitl_gate.evaluated",
    status: state.approvalDecision ? "success" : "pending",
    metadata: {
      approvalId: state.pendingApproval.id,
      decision: state.approvalDecision?.decision ?? "AWAITING_HUMAN"
    }
  });

  if (!state.approvalDecision) {
    return {
      status: "interrupted",
      answer: `[EXECUTION INTERRUPTED] Pending human authorization for action: '${state.pendingApproval.action}'. Approval ID: ${state.pendingApproval.id}`
    };
  }

  if (state.approvalDecision.decision === "reject") {
    return {
      status: "failed",
      answer: `[ACTION REJECTED] Human reviewer '${state.approvalDecision.reviewerId}' rejected the request: ${state.approvalDecision.reviewerNotes ?? "No notes provided"}`
    };
  }

  // Approved or edited
  return {
    status: "completed",
    answer: `[ACTION APPROVED] Human reviewer '${state.approvalDecision.reviewerId}' approved execution with parameters: ${JSON.stringify(state.approvalDecision.editedParameters ?? state.pendingApproval.parameters)}`
  };
}

export function routeAfterMCP(
  state: GraphStateType
): "hitl_gate" | "end" {
  if (state.hitlRequired || state.pendingApproval) {
    return "hitl_gate";
  }
  return "end";
}
