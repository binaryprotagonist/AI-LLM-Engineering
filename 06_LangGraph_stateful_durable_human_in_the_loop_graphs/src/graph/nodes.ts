// ============================================================================
// NODE FUNCTIONS — Pure, Deterministic, Testable
// ============================================================================
// Each node receives the full state and returns a Partial<State> update.
// LangGraph merges the partial via the reducers defined in state.ts.
//
// All nodes are deterministic (no LLM calls) for testability and replay.
// In production, you'd replace the simulated logic with actual LLM calls.
// ============================================================================

import { interrupt } from "@langchain/langgraph";
import type { WorkflowStateType } from "./state.js";

// ============================================================================
// 1. PLANNER NODE
//    Generates a task plan from the task description.
// ============================================================================
export function plannerNode(
  state: WorkflowStateType
): Partial<WorkflowStateType> {
  const plan = `Plan for "${state.task}": Step 1) Research, Step 2) Analyze, Step 3) Summarize`;

  console.log(`  [Planner] Created plan for task: "${state.task}"`);

  return {
    plan,
    status: "awaiting_approval",
    messages: [`[planner] Generated plan for: ${state.task}`],
    totalCost: 0.05,
  };
}

// ============================================================================
// 2. HUMAN APPROVAL NODE
//    Pauses execution via interrupt() to wait for human decision.
//    On resume, the interrupt() call returns the human's response.
// ============================================================================
export function humanApprovalNode(
  state: WorkflowStateType
): Partial<WorkflowStateType> {
  console.log(`  [HumanApproval] Requesting approval for plan...`);
  console.log(`  [HumanApproval] Plan: "${state.plan}"`);

  // This pauses the graph. The value passed to interrupt() is returned
  // to the caller as the interrupt payload. When resumed with
  // Command({ resume: value }), interrupt() returns that value.
  const decision = interrupt({
    question: "Do you approve this plan?",
    plan: state.plan,
    estimatedCost: state.totalCost,
  });

  // Execution resumes here after Command({ resume }) is sent
  const approved = decision === "approve";

  console.log(
    `  [HumanApproval] Decision: ${decision} → ${approved ? "APPROVED" : "REJECTED"}`
  );

  return {
    status: approved ? "approved" : "rejected",
    approvedBy: approved ? "human-reviewer" : "",
    messages: [`[humanApproval] Decision: ${decision}`],
  };
}

// ============================================================================
// 3. WORKER NODE
//    Simulates specialist work. Produces a result based on the plan.
//    In a real system, this would call an LLM or external service.
// ============================================================================
export function workerNode(
  state: WorkflowStateType
): Partial<WorkflowStateType> {
  const attempt = state.retryCount + 1;
  const result = `Result (attempt ${attempt}): Analyzed "${state.task}" — findings: data processed, patterns identified, confidence=${attempt >= 2 ? "high" : "medium"}`;

  console.log(`  [Worker] Attempt ${attempt}: Producing result...`);

  return {
    result,
    status: "under_review",
    messages: [`[worker] Attempt ${attempt}: produced result`],
    totalCost: 0.10,
  };
}

// ============================================================================
// 4. REVIEWER NODE
//    Evaluates the worker's output. Decides: pass / revise / fail.
//    This creates the cycle: worker → reviewer → worker (if revision needed).
//
//    reviewDecider parameter allows tests to inject custom pass/fail logic.
// ============================================================================
export function createReviewerNode(
  reviewDecider?: (state: WorkflowStateType) => "pass" | "revise"
) {
  return function reviewerNode(
    state: WorkflowStateType
  ): Partial<WorkflowStateType> {
    let decision: "pass" | "revise";

    if (reviewDecider) {
      decision = reviewDecider(state);
    } else {
      // Default: approve after 2 retries (3 total attempts)
      decision = state.retryCount >= 2 ? "pass" : "revise";
    }

    console.log(
      `  [Reviewer] Review decision: ${decision} (retryCount=${state.retryCount})`
    );

    if (decision === "pass") {
      return {
        status: "review_passed",
        feedback: "Quality meets standards. Approved.",
        messages: [`[reviewer] PASSED — quality approved`],
        totalCost: 0.03,
      };
    }

    return {
      status: "needs_revision",
      feedback: `Revision needed: insufficient detail (attempt ${state.retryCount + 1})`,
      retryCount: 1, // additive reducer: adds 1 to current
      messages: [
        `[reviewer] REVISION NEEDED — attempt ${state.retryCount + 1}`,
      ],
      totalCost: 0.03,
    };
  };
}

// ============================================================================
// 5. FINALIZER NODE
//    Produces the final output after review approval.
// ============================================================================
export function finalizerNode(
  state: WorkflowStateType
): Partial<WorkflowStateType> {
  const finalResult = `FINAL: ${state.result} | Approved by: ${state.approvedBy} | Cost: $${state.totalCost.toFixed(2)} | Retries: ${state.retryCount}`;

  console.log(`  [Finalizer] Producing final output...`);

  return {
    result: finalResult,
    status: "completed",
    messages: [`[finalizer] Workflow completed successfully`],
    totalCost: 0.01,
  };
}

// ============================================================================
// 6. COST GUARD NODE
//    Checks if the accumulated cost exceeds the budget.
//    If over budget, sets status to "over_budget" for conditional routing.
// ============================================================================
export function costGuardNode(
  state: WorkflowStateType
): Partial<WorkflowStateType> {
  const overBudget = state.totalCost > state.maxBudget;

  if (overBudget) {
    console.log(
      `  [CostGuard] ⚠ OVER BUDGET: $${state.totalCost.toFixed(2)} > $${state.maxBudget.toFixed(2)}`
    );
    return {
      status: "over_budget",
      error: `Cost budget exceeded: $${state.totalCost.toFixed(2)} > $${state.maxBudget.toFixed(2)}`,
      messages: [
        `[costGuard] OVER BUDGET: $${state.totalCost.toFixed(2)} > $${state.maxBudget.toFixed(2)}`,
      ],
    };
  }

  console.log(
    `  [CostGuard] ✓ Within budget: $${state.totalCost.toFixed(2)} / $${state.maxBudget.toFixed(2)}`
  );
  return {
    messages: [
      `[costGuard] Within budget: $${state.totalCost.toFixed(2)} / $${state.maxBudget.toFixed(2)}`,
    ],
  };
}

// ============================================================================
// 7. MAP-REDUCE WORKER NODE
//    Used in fan-out: each parallel instance processes one sub-task.
//    Returns results via the workerResults append reducer.
// ============================================================================
export function mapWorkerNode(
  state: WorkflowStateType
): Partial<WorkflowStateType> {
  // In fan-out, each Send() passes a modified state with a specific task
  const taskLabel = state.task || "unknown";
  const workerResult = `[MapWorker] Processed: "${taskLabel}" → insights extracted`;

  console.log(`  ${workerResult}`);

  return {
    workerResults: [workerResult],
    messages: [`[mapWorker] Completed sub-task: ${taskLabel}`],
    totalCost: 0.05,
  };
}

// ============================================================================
// 8. AGGREGATOR NODE
//    Combines results from parallel map-reduce workers into a final output.
// ============================================================================
export function aggregatorNode(
  state: WorkflowStateType
): Partial<WorkflowStateType> {
  const count = state.workerResults.length;
  const combined = state.workerResults.join(" | ");
  const summary = `Aggregated ${count} worker results: ${combined}`;

  console.log(`  [Aggregator] Combined ${count} worker results`);

  return {
    result: summary,
    status: "aggregated",
    messages: [`[aggregator] Combined ${count} results`],
    totalCost: 0.02,
  };
}
