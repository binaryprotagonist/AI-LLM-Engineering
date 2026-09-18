// ============================================================================
// DEEP BUILD B — Durable Multi-Agent Graph (Supervisor Pattern)
// ============================================================================
// Ports Day-4's supervisor system to LangGraph with:
//   • Supervisor node routing to specialist workers
//   • Human-approval interrupt gate before execution
//   • Conditional revision cycle (reviewer → revise → reviewer)
//   • Parallel map-reduce branch (fan-out via Send, fan-in via reducer)
//   • Cost budget enforcement
//
// Graph topology:
//
//   START → supervisor → humanApproval (interrupt)
//                             │
//                       [approved?]
//                       ├── yes → fanOut ─→ Send("mapWorker", task1) ─┐
//                       │                → Send("mapWorker", task2) ──┤
//                       │                → Send("mapWorker", task3) ──┤
//                       │                                             │
//                       │                (append reducer fan-in) ─────┘
//                       │                         │
//                       │                    aggregator → reviewer ──┐
//                       │                                           │
//                       │                  ┌── [review decision] ───┘
//                       │                  │         │
//                       │             [revise] → costGuard → worker → reviewer
//                       │                  │
//                       │             [pass] → finalizer → END
//                       │
//                       └── no → END
// ============================================================================

import { StateGraph, START, END, MemorySaver } from "@langchain/langgraph";
import { WorkflowState } from "../graph/state.js";
import {
  plannerNode,
  humanApprovalNode,
  workerNode,
  createReviewerNode,
  finalizerNode,
  costGuardNode,
  mapWorkerNode,
  aggregatorNode,
} from "../graph/nodes.js";
import {
  routeAfterApproval,
  routeAfterCostGuard,
  routeAfterReview,
  routeToMapWorkers,
} from "../graph/routing.js";

// ============================================================================
// Supervisor Node
// Inspects the task, decides the execution strategy, sets the plan.
// In a real system this would be an LLM deciding which workers to invoke.
// ============================================================================
function supervisorNode(
  state: typeof WorkflowState.State
): Partial<typeof WorkflowState.State> {
  const plan = `Supervisor plan: Decompose "${state.task}" into research, analysis, and synthesis phases. Execute via parallel map-reduce, then review.`;

  console.log(`  [Supervisor] Decomposing task into parallel sub-tasks`);

  return {
    plan,
    status: "awaiting_approval",
    messages: [`[supervisor] Created multi-agent plan for: ${state.task}`],
    totalCost: 0.03,
  };
}

// ============================================================================
// Build the multi-agent supervisor graph
// ============================================================================

export interface SupervisorGraphOptions {
  reviewDecider?: (state: typeof WorkflowState.State) => "pass" | "revise";
  recursionLimit?: number;
  checkpointer?: MemorySaver;
}

export function buildSupervisorGraph(options: SupervisorGraphOptions = {}) {
  const {
    reviewDecider,
    recursionLimit = 30,
    checkpointer = new MemorySaver(),
  } = options;

  const reviewerNode = createReviewerNode(reviewDecider);

  const workflow = new StateGraph(WorkflowState)
    // ---- Register Nodes ----
    .addNode("supervisor", supervisorNode)
    .addNode("humanApproval", humanApprovalNode)
    .addNode("costGuard", costGuardNode)
    .addNode("mapWorker", mapWorkerNode)
    .addNode("aggregator", aggregatorNode)
    .addNode("worker", workerNode)
    .addNode("reviewer", reviewerNode)
    .addNode("finalizer", finalizerNode)
    .addNode("fanOut", (_state: typeof WorkflowState.State) => {
      // Pass-through node that triggers the conditional fan-out
      console.log(`  [FanOut] Initiating parallel map-reduce...`);
      return { messages: ["[fanOut] Dispatching parallel workers"] };
    })

    // ---- Entry ----
    .addEdge(START, "supervisor")
    .addEdge("supervisor", "humanApproval")

    // ---- After Human Approval ----
    // approved → costGuard (for initial map-reduce), rejected → END
    .addConditionalEdges("humanApproval", (state) => {
      if (state.status === "approved") return "costGuard";
      return END;
    }, {
      costGuard: "costGuard",
      [END]: END,
    })

    // ---- Cost Guard → Fan-Out ----
    .addConditionalEdges("costGuard", (state) => {
      if (state.status === "over_budget") return END;
      // If we have no worker results yet, fan out to map workers
      // If we're in a retry cycle, go to the single worker
      if (state.workerResults.length === 0 && state.retryCount === 0) {
        return "fanOut";
      }
      return "worker";
    }, {
      fanOut: "fanOut",
      worker: "worker",
      [END]: END,
    })

    // ---- Fan-Out: parallel map-reduce ----
    .addConditionalEdges("fanOut", routeToMapWorkers)

    // ---- Fan-In → Aggregator ----
    .addEdge("mapWorker", "aggregator")

    // ---- Aggregator → Reviewer ----
    .addEdge("aggregator", "reviewer")

    // ---- Worker (retry) → Reviewer ----
    .addEdge("worker", "reviewer")

    // ---- Review Cycle ----
    .addConditionalEdges("reviewer", routeAfterReview, {
      finalizer: "finalizer",
      costGuard: "costGuard",
    })

    // ---- Finalizer → END ----
    .addEdge("finalizer", END);

  const app = workflow.compile({
    checkpointer,
  });

  return { app, checkpointer, recursionLimit };
}
