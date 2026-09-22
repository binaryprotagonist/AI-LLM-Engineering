import type { GraphStateType } from "./state.js";
import { checkWorkflowBudget } from "./budget.js";


export function budgetGuardNode(
  state: GraphStateType
): Partial<GraphStateType> {
  const result = checkWorkflowBudget(state);

  if (result.allowed) {
    return {
      budgetExceeded: false,
    };
  }

  return {
    budgetExceeded: true,
    status: "failed",
    errors: [result.reason],
  };
}