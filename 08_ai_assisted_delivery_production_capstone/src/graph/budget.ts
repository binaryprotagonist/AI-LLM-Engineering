import type { GraphStateType } from "./state.js";

export type BudgetCheckResult =
  | {
      allowed: true;
    }
  | {
      allowed: false;
      reason: string;
    };
  

    
export function checkWorkflowBudget(
  state: GraphStateType
): BudgetCheckResult {
  if (state.stepsUsed >= state.maxSteps) {
    return {
      allowed: false,
      reason: `Maximum workflow steps exceeded: ${state.maxSteps}`,
    };
  }

  if (state.toolCallsUsed >= state.maxToolCalls) {
    return {
      allowed: false,
      reason: `Maximum tool calls exceeded: ${state.maxToolCalls}`,
    };
  }

  if (state.estimatedCostUsd >= state.maxCostUsd) {
    return {
      allowed: false,
      reason: `Maximum workflow cost exceeded: $${state.maxCostUsd}`,
    };
  }

  if (Date.now() >= state.deadlineAt) {
    return {
      allowed: false,
      reason: "Workflow deadline exceeded",
    };
  }

  return {
    allowed: true,
  };
}

