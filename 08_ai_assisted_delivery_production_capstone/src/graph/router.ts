import type { GraphStateType } from "./state.js";

export function routeFromSupervisor(
  state: GraphStateType
): "rag" | "analysis" | "mcp" | "budget_failed" {
  if (state.budgetExceeded) {
    return "budget_failed";
  }

  switch (state.route) {
    case "rag":
      return "rag";

    case "analysis":
      return "analysis";

    case "mcp":
      return "mcp";

    default:
      return "budget_failed";
  }
}