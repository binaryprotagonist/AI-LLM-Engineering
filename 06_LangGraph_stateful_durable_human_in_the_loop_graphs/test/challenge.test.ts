// ============================================================================
// TEST: Coding Challenge — Interrupt + Resume + Crash Recovery
// ============================================================================
// Proves:
//   1. Graph pauses at human-approval interrupt
//   2. Resume with Command({ resume }) continues execution
//   3. Simulated crash → rebuild graph → resume from last checkpoint
//   4. Retry cycle bounded correctly
//   5. Final state is correct
// ============================================================================

import { runChallenge } from "../src/challenge.js";

function assert(condition: boolean, message: string): void {
  if (!condition) {
    throw new Error(`ASSERTION FAILED: ${message}`);
  }
}

async function testChallenge() {
  console.log("════════════════════════════════════════════════════════════");
  console.log("  TEST: Coding Challenge — Durable Interrupt + Resume");
  console.log("════════════════════════════════════════════════════════════\n");

  const result = await runChallenge();

  // ---- Assertion 1: Interrupt behavior ----
  assert(
    result.interruptWorked,
    "Graph should pause at humanApproval interrupt"
  );
  console.log("  ✓ Test 1: Interrupt pauses graph correctly");

  // ---- Assertion 2: Resume behavior ----
  assert(
    result.resumeWorked,
    "Graph should resume after Command({ resume: 'approve' })"
  );
  console.log("  ✓ Test 2: Resume continues execution after approval");

  // ---- Assertion 3: Crash recovery ----
  assert(
    result.crashRecoveryWorked,
    "Graph should complete after crash recovery with new graph instance"
  );
  console.log("  ✓ Test 3: Crash recovery resumes from correct checkpoint");

  // ---- Assertion 4: Retry cycle ----
  assert(
    result.retryCycleWorked,
    "Retry cycle should execute at least once before passing"
  );
  assert(
    result.totalRetries >= 1,
    `Expected at least 1 retry, got ${result.totalRetries}`
  );
  assert(
    result.totalRetries <= 3,
    `Expected at most 3 retries, got ${result.totalRetries}`
  );
  console.log(`  ✓ Test 4: Retry cycle bounded correctly (${result.totalRetries} retries)`);

  // ---- Assertion 5: Final state ----
  assert(
    result.finalStatus === "completed",
    `Expected status "completed", got "${result.finalStatus}"`
  );
  assert(
    result.nodesVisited.includes("planner"),
    "planner should have been visited"
  );
  assert(
    result.nodesVisited.includes("approval"),
    "approval should have been visited"
  );
  assert(
    result.nodesVisited.includes("worker"),
    "worker should have been visited"
  );
  assert(
    result.nodesVisited.includes("reviewer"),
    "reviewer should have been visited"
  );
  assert(
    result.nodesVisited.includes("finalizer"),
    "finalizer should have been visited"
  );
  console.log("  ✓ Test 5: Final state correct — all required nodes visited");

  // ---- Assertion 6: Audit log ----
  assert(
    result.messages.length >= 5,
    `Expected at least 5 log messages, got ${result.messages.length}`
  );
  console.log(`  ✓ Test 6: Audit log has ${result.messages.length} entries`);

  // ---- Overall ----
  assert(result.success, "Overall challenge should pass");
  console.log("\n  ✅ ALL CHALLENGE TESTS PASSED!\n");
}

testChallenge().catch((err) => {
  console.error("\n  ✗ Test failed:", err.message || err);
  process.exit(1);
});
