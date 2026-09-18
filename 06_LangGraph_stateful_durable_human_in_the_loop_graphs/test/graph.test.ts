// ============================================================================
// TEST: Graph Model Features
// ============================================================================
// Tests:
//   1. Conditional edge routing correctness
//   2. Retry cycle terminates within bounds
//   3. State reducers accumulate correctly (append vs last-write-wins)
//   4. Checkpointer persists and restores state
//   5. Cost guard enforces budget
// ============================================================================

import { Command, MemorySaver } from "@langchain/langgraph";
import { buildWorkflow } from "../src/graph/workflow.js";

function assert(condition: boolean, message: string): void {
  if (!condition) {
    throw new Error(`ASSERTION FAILED: ${message}`);
  }
}

let passed = 0;
let failed = 0;

async function test(name: string, fn: () => Promise<void>) {
  try {
    await fn();
    passed++;
    console.log(`  ✓ ${name}`);
  } catch (err: unknown) {
    failed++;
    const msg = err instanceof Error ? err.message : String(err);
    console.log(`  ✗ ${name}: ${msg}`);
  }
}

async function runGraphTests() {
  console.log("════════════════════════════════════════════════════════════");
  console.log("  TEST: Graph Model Features");
  console.log("════════════════════════════════════════════════════════════\n");

  // ---------- Test 1: Interrupt pauses at correct node ----------
  await test("Interrupt pauses at humanApproval node", async () => {
    const { app } = buildWorkflow({ reviewDecider: () => "pass" });
    const config = { configurable: { thread_id: "test-interrupt" } };

    await app.invoke({ task: "Test task", maxBudget: 5.0 }, config);
    const state = await app.getState(config);

    assert(state.next.includes("humanApproval"), `Expected next to include humanApproval, got [${state.next}]`);
    assert(state.values.plan !== "", "Plan should be generated before interrupt");
  });

  // ---------- Test 2: Approval routes to worker ----------
  await test("Approval routes through costGuard to worker", async () => {
    const { app } = buildWorkflow({ reviewDecider: () => "pass" });
    const config = { configurable: { thread_id: "test-approval-route" } };

    await app.invoke({ task: "Route test", maxBudget: 5.0 }, config);
    const result = await app.invoke(new Command({ resume: "approve" }), config);

    assert(result.status === "completed", `Expected completed, got "${result.status}"`);
    assert(result.messages.some((m: string) => m.includes("[worker]")), "Worker should have executed");
  });

  // ---------- Test 3: Rejection routes to END ----------
  await test("Rejection terminates graph", async () => {
    const { app } = buildWorkflow({ reviewDecider: () => "pass" });
    const config = { configurable: { thread_id: "test-rejection" } };

    await app.invoke({ task: "Reject test", maxBudget: 5.0 }, config);
    const result = await app.invoke(new Command({ resume: "reject" }), config);

    assert(result.status === "rejected", `Expected rejected, got "${result.status}"`);
    assert(!result.messages.some((m: string) => m.includes("[worker]")), "Worker should NOT have executed");
  });

  // ---------- Test 4: Retry cycle executes correct number of times ----------
  await test("Retry cycle bounded at 2 retries then passes", async () => {
    let reviewCalls = 0;
    const { app } = buildWorkflow({
      reviewDecider: (state) => {
        reviewCalls++;
        return state.retryCount >= 2 ? "pass" : "revise";
      },
    });
    const config = { configurable: { thread_id: "test-retry-cycle" } };

    await app.invoke({ task: "Retry test", maxBudget: 10.0 }, config);
    const result = await app.invoke(new Command({ resume: "approve" }), config);

    assert(result.status === "completed", `Expected completed, got "${result.status}"`);
    assert(result.retryCount === 2, `Expected 2 retries, got ${result.retryCount}`);
    assert(reviewCalls === 3, `Expected 3 reviewer calls, got ${reviewCalls}`);
  });

  // ---------- Test 5: Append reducer accumulates messages ----------
  await test("Append reducer accumulates messages from all nodes", async () => {
    const { app } = buildWorkflow({ reviewDecider: () => "pass" });
    const config = { configurable: { thread_id: "test-reducer" } };

    await app.invoke({ task: "Reducer test", maxBudget: 5.0 }, config);
    const result = await app.invoke(new Command({ resume: "approve" }), config);

    assert(result.messages.length >= 4, `Expected >= 4 messages, got ${result.messages.length}`);
    assert(result.messages[0].includes("[planner]"), "First message should be from planner");
    assert(result.messages.some((m: string) => m.includes("[worker]")), "Should have worker message");
    assert(result.messages.some((m: string) => m.includes("[finalizer]")), "Should have finalizer message");
  });

  // ---------- Test 6: Additive cost reducer sums correctly ----------
  await test("Additive reducer sums cost across nodes", async () => {
    const { app } = buildWorkflow({ reviewDecider: () => "pass" });
    const config = { configurable: { thread_id: "test-cost" } };

    await app.invoke({ task: "Cost test", maxBudget: 5.0 }, config);
    const result = await app.invoke(new Command({ resume: "approve" }), config);

    assert(result.totalCost > 0, `Expected totalCost > 0, got ${result.totalCost}`);
    // planner(0.05) + costGuard(0) + worker(0.10) + reviewer(0.03) + finalizer(0.01) = 0.19
    assert(result.totalCost >= 0.15, `Expected totalCost >= 0.15, got ${result.totalCost}`);
  });

  // ---------- Test 7: Cost guard terminates on over-budget ----------
  await test("Cost guard terminates graph when over budget", async () => {
    const { app } = buildWorkflow({ reviewDecider: () => "pass" });
    const config = { configurable: { thread_id: "test-budget-guard" } };

    // Set tiny budget that will be exceeded after planner
    await app.invoke({ task: "Budget test", maxBudget: 0.01 }, config);
    const result = await app.invoke(new Command({ resume: "approve" }), config);

    assert(result.status === "over_budget", `Expected over_budget, got "${result.status}"`);
    assert(result.error.includes("Cost budget exceeded"), "Error should mention budget");
  });

  // ---------- Test 8: Checkpointer persists state between invocations ----------
  await test("Checkpointer persists state across invocations", async () => {
    const checkpointer = new MemorySaver();
    const { app } = buildWorkflow({
      reviewDecider: () => "pass",
      checkpointer,
    });
    const config = { configurable: { thread_id: "test-checkpoint" } };

    // First invocation — runs to interrupt
    await app.invoke({ task: "Checkpoint test", maxBudget: 5.0 }, config);

    // State should be persisted
    const state = await app.getState(config);
    assert(state.values.task === "Checkpoint test", "Task should be persisted");
    assert(state.values.plan !== "", "Plan should be persisted");
    assert(state.next.includes("humanApproval"), "Next node should be persisted");
  });

  // ---------- Summary ----------
  console.log(`\n  Results: ${passed} passed, ${failed} failed`);
  if (failed > 0) {
    console.log("  ✗ SOME TESTS FAILED\n");
    process.exit(1);
  } else {
    console.log("  ✅ ALL GRAPH MODEL TESTS PASSED!\n");
  }
}

runGraphTests().catch((err) => {
  console.error("Test suite failed:", err);
  process.exit(1);
});
