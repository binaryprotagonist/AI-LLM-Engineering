// ============================================================================
// DEEP BUILD A — The Graph Model, In Depth
// ============================================================================
// Demonstrates:
//   • Typed state with reducers (Annotation API)
//   • Conditional edges and dynamic routing
//   • Cycles (worker → reviewer → worker retry loop)
//   • Human-in-the-loop interrupt
//   • Cost guard (budget enforcement)
//   • Durable execution with MemorySaver checkpointer
//
// Graph topology:
//
//   START → planner → humanApproval (interrupt)
//                          │
//                    [approved?]
//                    ├── yes → costGuard → worker → reviewer ──┐
//                    │                                         │
//                    │           ┌── [review decision] ────────┘
//                    │           │         │
//                    │      [revise] → costGuard → worker (cycle)
//                    │           │
//                    │      [pass] → finalizer → END
//                    │
//                    └── no → END
// ============================================================================

import { StateGraph, START, END, MemorySaver } from "@langchain/langgraph";
import { WorkflowState } from "./state.js";
import {
  plannerNode,
  humanApprovalNode,
  workerNode,
  createReviewerNode,
  finalizerNode,
  costGuardNode,
} from "./nodes.js";
import {
  routeAfterApproval,
  routeAfterCostGuard,
  routeAfterReview,
} from "./routing.js";

// ============================================================================
// Build the core workflow graph
// ============================================================================

export interface WorkflowOptions {
  /** Custom reviewer logic for testing */
  reviewDecider?: (state: typeof WorkflowState.State) => "pass" | "revise";
  /** Recursion limit (default 25) */
  recursionLimit?: number;
  /** Provide an external checkpointer (default: creates new MemorySaver) */
  checkpointer?: MemorySaver;
}

/**
 * Builds the durable workflow graph with all Deep Build A features:
 * conditional edges, cycles, human interrupt, cost guard, and checkpointing.
 *
 * Returns the compiled graph AND the checkpointer reference (for resume tests).
 */
export function buildWorkflow(options: WorkflowOptions = {}) {
  const {
    reviewDecider,
    recursionLimit = 25,
    checkpointer = new MemorySaver(),
  } = options;

  const reviewerNode = createReviewerNode(reviewDecider);

  const workflow = new StateGraph(WorkflowState)
    // ---- Register Nodes ----
    .addNode("planner", plannerNode)
    .addNode("humanApproval", humanApprovalNode)
    .addNode("costGuard", costGuardNode)
    .addNode("worker", workerNode)
    .addNode("reviewer", reviewerNode)
    .addNode("finalizer", finalizerNode)

    // ---- Static Edges ----
    .addEdge(START, "planner")
    .addEdge("planner", "humanApproval")
    .addEdge("worker", "reviewer")
    .addEdge("finalizer", END)

    // ---- Conditional Edges ----
    // After human approval: approved → costGuard, rejected → END
    .addConditionalEdges("humanApproval", routeAfterApproval, {
      costGuard: "costGuard",
      [END]: END,
    })

    // After cost guard: within budget → worker, over budget → END
    .addConditionalEdges("costGuard", routeAfterCostGuard, {
      worker: "worker",
      [END]: END,
    })

    // After review: pass → finalizer, revise → costGuard (cycle), exhausted → finalizer
    .addConditionalEdges("reviewer", routeAfterReview, {
      finalizer: "finalizer",
      costGuard: "costGuard",
    });

  // ---- Compile with Checkpointer ----
  const app = workflow.compile({
    checkpointer,
  });

  return { app, checkpointer, recursionLimit };
}
