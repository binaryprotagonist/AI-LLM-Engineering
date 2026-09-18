// ============================================================================
// DAY 06 — LANGGRAPH: STATEFUL, DURABLE, HUMAN-IN-THE-LOOP GRAPHS
// ============================================================================
// Main demo entry point running three demonstrations:
//
// Demo A: Core workflow with conditional edges, retry cycle, and streaming
// Demo B: Durable multi-agent graph with interrupt, approval, and map-reduce
// Demo C: Time-travel — replay from checkpoint history
// ============================================================================

import { Command, MemorySaver } from "@langchain/langgraph";
import { buildWorkflow } from "./graph/workflow.js";
import { buildSupervisorGraph } from "./agents/supervisor-graph.js";

// ============================================================================
// DEMO A: Core Workflow — Conditional Edges, Cycle, Streaming
// ============================================================================
async function demoA() {
  console.log("================================================================================");
  console.log("  DEMO A: Core Workflow — Conditional Edges, Retry Cycle, Streaming");
  console.log("================================================================================\n");

  // Build graph that approves on first review (no retry cycle)
  const { app, checkpointer } = buildWorkflow({
    reviewDecider: () => "pass", // approve immediately
  });

  const threadId = "demo-a-thread";
  const config = { configurable: { thread_id: threadId } };

  // Step 1: Start the graph — it will pause at humanApproval interrupt
  console.log("--- Step 1: Invoke graph (will pause at human approval) ---\n");

  const input = {
    task: "Analyze Q3 revenue trends",
    maxBudget: 2.0,
  };

  // Use stream to see step-by-step updates
  const stream1 = await app.stream(input, { ...config, streamMode: "updates" as const });

  for await (const event of stream1) {
    const nodeName = Object.keys(event)[0];
    console.log(`  📨 Stream event from: ${nodeName}`);
  }

  // Check interrupt state
  const state1 = await app.getState(config);
  console.log(`\n  ⏸  Graph paused. Next node(s): [${state1.next}]`);
  console.log(`  Current status: "${state1.values.status}"`);
  console.log(`  Plan: "${state1.values.plan}"\n`);

  // Step 2: Resume with approval
  console.log("--- Step 2: Resume with human approval ---\n");

  const stream2 = await app.stream(
    new Command({ resume: "approve" }),
    { ...config, streamMode: "updates" as const }
  );

  for await (const event of stream2) {
    const nodeName = Object.keys(event)[0];
    console.log(`  📨 Stream event from: ${nodeName}`);
  }

  // Final state
  const finalState = await app.getState(config);
  console.log(`\n  ✅ Final status: "${finalState.values.status}"`);
  console.log(`  Result: "${finalState.values.result}"`);
  console.log(`  Total cost: $${finalState.values.totalCost.toFixed(2)}`);
  console.log(`  Messages: ${finalState.values.messages.length} logged`);
  console.log(`  Retries: ${finalState.values.retryCount}\n`);
}

// ============================================================================
// DEMO B: Multi-Agent Supervisor Graph with Map-Reduce
// ============================================================================
async function demoB() {
  console.log("================================================================================");
  console.log("  DEMO B: Multi-Agent Supervisor — Map-Reduce + Interrupt + Cycle");
  console.log("================================================================================\n");

  const { app } = buildSupervisorGraph({
    reviewDecider: (state) => (state.retryCount >= 1 ? "pass" : "revise"),
  });

  const threadId = "demo-b-thread";
  const config = { configurable: { thread_id: threadId } };

  // Step 1: Start — will pause at human approval
  console.log("--- Step 1: Start supervisor graph ---\n");

  const input = { task: "Market analysis for product launch", maxBudget: 3.0 };
  await app.invoke(input, config);

  const state1 = await app.getState(config);
  console.log(`  ⏸  Paused at: [${state1.next}]`);
  console.log(`  Plan: "${state1.values.plan}"\n`);

  // Step 2: Approve and let it run
  console.log("--- Step 2: Approve and execute ---\n");

  const result = await app.invoke(
    new Command({ resume: "approve" }),
    config
  );

  console.log(`  ✅ Final status: "${result.status}"`);
  console.log(`  Worker results (fan-in): ${result.workerResults.length} items`);
  result.workerResults.forEach((r: string, i: number) => {
    console.log(`    [${i}] ${r}`);
  });
  console.log(`  Total cost: $${result.totalCost.toFixed(2)}`);
  console.log(`  Retries: ${result.retryCount}`);
  console.log(`  Final result: "${result.result}"`);
  console.log(`  Audit log: ${result.messages.length} entries\n`);
}

// ============================================================================
// DEMO C: Time-Travel — Inspect History and Fork from Past Checkpoint
// ============================================================================
async function demoC() {
  console.log("================================================================================");
  console.log("  DEMO C: Time-Travel — Checkpoint History and Replay");
  console.log("================================================================================\n");

  const checkpointer = new MemorySaver();
  const { app } = buildWorkflow({
    reviewDecider: () => "pass",
    checkpointer,
  });

  const threadId = "demo-c-thread";
  const config = { configurable: { thread_id: threadId } };

  // Run to interrupt
  await app.invoke({ task: "Time-travel demo task", maxBudget: 5.0 }, config);
  // Resume with approval
  await app.invoke(new Command({ resume: "approve" }), config);

  // Step 1: Inspect full history
  console.log("--- Step 1: Checkpoint History ---\n");

  const history: Array<{ step: number | undefined; node: string | undefined; next: string[] }> = [];
  for await (const snapshot of app.getStateHistory(config)) {
    history.push({
      step: snapshot.metadata?.step as number | undefined,
      node: snapshot.metadata?.source as string | undefined,
      next: snapshot.next || [],
    });
  }

  // Display history (newest first)
  history.forEach((h, i) => {
    console.log(
      `  [${i}] Step ${h.step ?? "?"} | Source: ${h.node ?? "?"} | Next: [${h.next.join(", ")}]`
    );
  });

  // Step 2: Fork from a past checkpoint
  console.log("\n--- Step 2: Fork from checkpoint (re-run from planner) ---\n");

  // Find the checkpoint right after START (before planner ran)
  const startCheckpoint = history.find(
    (h) => h.node === "loop" && h.next.includes("planner")
  );

  if (startCheckpoint) {
    console.log(`  Found checkpoint at step ${startCheckpoint.step} — next: [${startCheckpoint.next.join(", ")}]`);
    console.log(`  (In a full demo, we could fork and replay from here)`);
  } else {
    console.log(`  History has ${history.length} checkpoints available for time-travel`);
  }

  console.log("\n  ✅ Time-travel inspection complete\n");
}

// ============================================================================
// MAIN
// ============================================================================
async function main() {
  console.log("\n================================================================================");
  console.log("      DAY 06: LANGGRAPH — STATEFUL, DURABLE, HUMAN-IN-THE-LOOP GRAPHS");
  console.log("================================================================================\n");

  await demoA();
  await demoB();
  await demoC();

  console.log("================================================================================");
  console.log("  ALL DEMOS COMPLETE");
  console.log("================================================================================\n");
}

main().catch(console.error);
