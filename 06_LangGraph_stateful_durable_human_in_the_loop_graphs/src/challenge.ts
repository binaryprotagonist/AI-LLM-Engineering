// ============================================================================
// CODING CHALLENGE — Durable Interrupt + Retry + Crash Recovery
// ============================================================================
// Build a LangGraph workflow with:
//   1. A human-approval interrupt
//   2. A retry cycle (worker → reviewer → retry up to 3x)
//   3. Survive a simulated process kill mid-run
//   4. Resume from the last checkpoint to the correct next node
//
// The challenge function runs the full scenario and returns structured
// results for test assertions.
// ============================================================================

import { Command, MemorySaver, StateGraph, START, END } from "@langchain/langgraph";
import { Annotation, interrupt } from "@langchain/langgraph";

// ============================================================================
// 1. STATE SCHEMA (self-contained for the challenge)
// ============================================================================
const ChallengeState = Annotation.Root({
  task: Annotation<string>({
    reducer: (_, v) => v,
    default: () => "",
  }),
  plan: Annotation<string>({
    reducer: (_, v) => v,
    default: () => "",
  }),
  status: Annotation<string>({
    reducer: (_, v) => v,
    default: () => "pending",
  }),
  result: Annotation<string>({
    reducer: (_, v) => v,
    default: () => "",
  }),
  retryCount: Annotation<number>({
    reducer: (a, b) => a + b,
    default: () => 0,
  }),
  feedback: Annotation<string>({
    reducer: (_, v) => v,
    default: () => "",
  }),
  messages: Annotation<string[]>({
    reducer: (a, b) => [...a, ...b],
    default: () => [],
  }),
  nodesVisited: Annotation<string[]>({
    reducer: (a, b) => [...a, ...b],
    default: () => [],
  }),
});

type ChallengeStateType = typeof ChallengeState.State;

// ============================================================================
// 2. NODE FUNCTIONS
// ============================================================================

function challengePlanner(state: ChallengeStateType): Partial<ChallengeStateType> {
  return {
    plan: `Plan: execute "${state.task}" with quality review`,
    status: "awaiting_approval",
    messages: ["[planner] Created plan"],
    nodesVisited: ["planner"],
  };
}

function challengeApproval(state: ChallengeStateType): Partial<ChallengeStateType> {
  const decision = interrupt({
    question: "Approve this plan?",
    plan: state.plan,
  });

  return {
    status: decision === "approve" ? "approved" : "rejected",
    messages: [`[approval] Decision: ${decision}`],
    nodesVisited: ["approval"],
  };
}

/** Worker that can optionally crash (for testing crash recovery) */
function createChallengeWorker(crashOnAttempt?: number) {
  let callCount = 0;
  return function challengeWorker(state: ChallengeStateType): Partial<ChallengeStateType> {
    callCount++;
    if (crashOnAttempt !== undefined && callCount === crashOnAttempt) {
      throw new Error("SIMULATED_CRASH: Process killed mid-execution");
    }

    const attempt = state.retryCount + 1;
    return {
      result: `Worker output (attempt ${attempt})`,
      status: "under_review",
      messages: [`[worker] Produced result (attempt ${attempt})`],
      nodesVisited: ["worker"],
    };
  };
}

function createChallengeReviewer(approveAfterAttempt: number) {
  return function challengeReviewer(state: ChallengeStateType): Partial<ChallengeStateType> {
    const totalAttempts = state.retryCount + 1;

    if (totalAttempts >= approveAfterAttempt) {
      return {
        status: "review_passed",
        feedback: "Approved by reviewer",
        messages: [`[reviewer] PASSED on attempt ${totalAttempts}`],
        nodesVisited: ["reviewer"],
      };
    }

    return {
      status: "needs_revision",
      feedback: `Needs more work (attempt ${totalAttempts})`,
      retryCount: 1,
      messages: [`[reviewer] REVISION needed (attempt ${totalAttempts})`],
      nodesVisited: ["reviewer"],
    };
  };
}

function challengeFinalizer(state: ChallengeStateType): Partial<ChallengeStateType> {
  return {
    result: `FINAL: ${state.result} (retries: ${state.retryCount})`,
    status: "completed",
    messages: ["[finalizer] Workflow complete"],
    nodesVisited: ["finalizer"],
  };
}

// ============================================================================
// 3. GRAPH BUILDER
// ============================================================================

interface ChallengeGraphOptions {
  checkpointer: MemorySaver;
  approveAfterAttempt?: number;
  crashOnWorkerAttempt?: number;
}

function buildChallengeGraph(options: ChallengeGraphOptions) {
  const {
    checkpointer,
    approveAfterAttempt = 2,
    crashOnWorkerAttempt,
  } = options;

  const maxRetries = 3;

  const graph = new StateGraph(ChallengeState)
    .addNode("planner", challengePlanner)
    .addNode("approval", challengeApproval)
    .addNode("worker", createChallengeWorker(crashOnWorkerAttempt))
    .addNode("reviewer", createChallengeReviewer(approveAfterAttempt))
    .addNode("finalizer", challengeFinalizer)

    .addEdge(START, "planner")
    .addEdge("planner", "approval")

    .addConditionalEdges("approval", (state) => {
      return state.status === "approved" ? "worker" : END;
    }, { worker: "worker", [END]: END })

    .addEdge("worker", "reviewer")

    .addConditionalEdges("reviewer", (state) => {
      if (state.status === "review_passed") return "finalizer";
      if (state.retryCount < maxRetries) return "worker";
      return "finalizer"; // exhausted retries
    }, { finalizer: "finalizer", worker: "worker" })

    .addEdge("finalizer", END);

  return graph.compile({ checkpointer });
}

// ============================================================================
// 4. CHALLENGE RUNNER
// ============================================================================

export interface ChallengeResult {
  success: boolean;
  interruptWorked: boolean;
  resumeWorked: boolean;
  crashRecoveryWorked: boolean;
  retryCycleWorked: boolean;
  finalStatus: string;
  totalRetries: number;
  nodesVisited: string[];
  messages: string[];
}

export async function runChallenge(): Promise<ChallengeResult> {
  console.log("================================================================================");
  console.log("  CODING CHALLENGE: Durable Interrupt + Retry + Crash Recovery");
  console.log("================================================================================\n");

  const checkpointer = new MemorySaver();
  const threadId = "challenge-thread";
  const config = { configurable: { thread_id: threadId }, recursionLimit: 25 };

  // ---- Phase 1: Start graph → interrupt at approval ----
  console.log("--- Phase 1: Start graph (expect interrupt at approval) ---\n");

  const app1 = buildChallengeGraph({
    checkpointer,
    approveAfterAttempt: 2,  // reviewer approves on attempt 2
    crashOnWorkerAttempt: 2, // worker crashes on its 2nd call
  });

  await app1.invoke(
    { task: "Challenge task: durable execution" },
    config
  );

  const stateAfterInterrupt = await app1.getState(config);
  const interruptWorked =
    stateAfterInterrupt.next.includes("approval") &&
    stateAfterInterrupt.values.status === "awaiting_approval";

  console.log(`  ⏸  Interrupt worked: ${interruptWorked}`);
  console.log(`  Next node: [${stateAfterInterrupt.next}]`);
  console.log(`  Status: "${stateAfterInterrupt.values.status}"\n`);

  // ---- Phase 2: Resume with approval → runs worker → reviewer → retry → crash ----
  console.log("--- Phase 2: Resume with approval (expect crash on 2nd worker call) ---\n");

  let crashDetected = false;
  try {
    await app1.invoke(new Command({ resume: "approve" }), config);
  } catch (e: unknown) {
    if (e instanceof Error && e.message.includes("SIMULATED_CRASH")) {
      crashDetected = true;
      console.log(`  💥 Crash detected: ${e.message}`);
    } else {
      throw e;
    }
  }

  // Check state after crash — should be saved up to the last completed node
  const stateAfterCrash = await app1.getState(config);
  console.log(`  State after crash — next: [${stateAfterCrash.next}]`);
  console.log(`  Nodes visited: [${stateAfterCrash.values.nodesVisited.join(", ")}]`);
  console.log(`  Retry count: ${stateAfterCrash.values.retryCount}\n`);

  const resumeWorked = stateAfterCrash.values.nodesVisited.includes("approval") &&
    stateAfterCrash.values.status !== "awaiting_approval";

  // ---- Phase 3: Resume after crash with a NEW graph (same checkpointer) ----
  console.log("--- Phase 3: Resume after crash (new graph, same checkpointer) ---\n");

  const app2 = buildChallengeGraph({
    checkpointer,
    approveAfterAttempt: 2, // same config
    // No crash this time
  });

  const finalResult = await app2.invoke(null, config);

  const crashRecoveryWorked =
    finalResult.status === "completed" &&
    finalResult.nodesVisited.includes("finalizer");

  const retryCycleWorked = finalResult.retryCount >= 1;

  console.log(`  ✅ Resume completed successfully`);
  console.log(`  Final status: "${finalResult.status}"`);
  console.log(`  Result: "${finalResult.result}"`);
  console.log(`  Total retries: ${finalResult.retryCount}`);
  console.log(`  Nodes visited: [${finalResult.nodesVisited.join(", ")}]`);
  console.log(`  Messages: ${finalResult.messages.length} entries\n`);

  // ---- Summary ----
  const result: ChallengeResult = {
    success: interruptWorked && resumeWorked && crashRecoveryWorked && retryCycleWorked,
    interruptWorked,
    resumeWorked,
    crashRecoveryWorked,
    retryCycleWorked,
    finalStatus: finalResult.status,
    totalRetries: finalResult.retryCount,
    nodesVisited: finalResult.nodesVisited,
    messages: finalResult.messages,
  };

  console.log("--- Challenge Summary ---\n");
  console.log(`  Interrupt worked:       ${result.interruptWorked ? "✓" : "✗"}`);
  console.log(`  Resume worked:          ${result.resumeWorked ? "✓" : "✗"}`);
  console.log(`  Crash recovery worked:  ${result.crashRecoveryWorked ? "✓" : "✗"}`);
  console.log(`  Retry cycle worked:     ${result.retryCycleWorked ? "✓" : "✗"}`);
  console.log(`  Overall:                ${result.success ? "✓ PASS" : "✗ FAIL"}\n`);

  return result;
}

// ============================================================================
// CLI Entry Point
// ============================================================================
if (process.argv[1] && (
  process.argv[1].endsWith("challenge.ts") ||
  process.argv[1].endsWith("challenge.js")
)) {
  runChallenge().catch(console.error);
}
