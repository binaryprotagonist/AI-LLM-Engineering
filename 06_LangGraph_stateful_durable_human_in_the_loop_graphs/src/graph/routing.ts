// ============================================================================
// ROUTING FUNCTIONS — Conditional Edge Logic
// ============================================================================
// These functions are passed to .addConditionalEdges() and determine the
// next node based on the current state. They implement the graph's control
// flow: branching, looping, fan-out, and termination decisions.
// ============================================================================

import { END, Send } from "@langchain/langgraph";
import type { WorkflowStateType } from "./state.js";

// ============================================================================
// 1. ROUTE AFTER HUMAN APPROVAL
//    Branches based on the human's decision:
//      approved → costGuard (then worker)
//      rejected → END
// ============================================================================
export function routeAfterApproval(state: WorkflowStateType): string {
  if (state.status === "approved") {
    return "costGuard";
  }
  return END;
}

// ============================================================================
// 2. ROUTE AFTER COST GUARD
//    If over budget, terminate. Otherwise, proceed to worker.
// ============================================================================
export function routeAfterCostGuard(state: WorkflowStateType): string {
  if (state.status === "over_budget") {
    return END;
  }
  return "worker";
}

// ============================================================================
// 3. ROUTE AFTER REVIEW
//    Implements the retry cycle:
//      pass → finalizer
//      needs_revision (retries left) → costGuard → worker (cycle)
//      needs_revision (no retries left) → finalizer (with degraded result)
// ============================================================================
const MAX_RETRIES = 3;

export function routeAfterReview(state: WorkflowStateType): string {
  if (state.status === "review_passed") {
    return "finalizer";
  }

  // Needs revision — check retry budget
  if (state.retryCount < MAX_RETRIES) {
    return "costGuard"; // goes through cost check before retrying worker
  }

  // Exhausted retries — finalize with whatever we have
  return "finalizer";
}

// ============================================================================
// 4. ROUTE TO MAP-REDUCE WORKERS (Fan-Out via Send)
//    Dynamically spawns parallel worker instances for each sub-task.
//    Returns an array of Send objects — one per sub-task.
// ============================================================================
export function routeToMapWorkers(
  state: WorkflowStateType
): Send[] {
  // Split the task into sub-tasks for parallel processing
  const subTasks = [
    `${state.task} — research phase`,
    `${state.task} — analysis phase`,
    `${state.task} — synthesis phase`,
  ];

  console.log(
    `  [Router] Fan-out: dispatching ${subTasks.length} parallel workers`
  );

  return subTasks.map(
    (subTask) =>
      new Send("mapWorker", {
        task: subTask,
        messages: [`[router] Dispatched sub-task: ${subTask}`],
        totalCost: 0,
      })
  );
}
