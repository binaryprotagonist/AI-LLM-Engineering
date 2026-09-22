import type { GraphStateType } from "./state.js";
import { logEvent } from "../observability/logger.js";

export function supervisorNode(
  state: GraphStateType
): Partial<GraphStateType> {
  const question = state.question.toLowerCase();

  let route: GraphStateType["route"] = "unknown";

  // Prioritize action-oriented and live data tool queries for MCP
  if (
    question.includes("request leave") ||
    question.includes("apply leave") ||
    question.includes("take leave") ||
    question.includes("employee record") ||
    question.includes("my record") ||
    question.includes("department stats") ||
    question.includes("remaining leave") ||
    question.includes("employee-001") ||
    question.includes("user-001") ||
    question.includes("workforce")
  ) {
    route = "mcp";
  } else if (
    question.includes("analyze") ||
    question.includes("compare") ||
    question.includes("why") ||
    question.includes("evaluation") ||
    question.includes("recommendation")
  ) {
    route = "analysis";
  } else if (
    question.includes("policy") ||
    question.includes("document") ||
    question.includes("leave") ||
    question.includes("remote") ||
    question.includes("security") ||
    question.includes("annual") ||
    question.includes("handbook") ||
    question.includes("what is") ||
    question.includes("how many") ||
    question.includes("how long")
  ) {
    route = "rag";
  } else {
    // Default fallback
    route = "rag";
  }

  logEvent({
    requestId: state.requestId,
    traceId: state.traceId,
    operation: "graph.supervisor.route",
    status: "success",
    metadata: { route, question: state.question }
  });

  return {
    route,
    status: "running",
    stepsUsed: 1,
  };
}