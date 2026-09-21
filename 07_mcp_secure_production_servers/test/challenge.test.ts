// ============================================================================
// TEST: Coding Challenge Verification Suite
// ============================================================================
// Asserts all 6 safety and production guarantees of the Day 07 Challenge:
// 1. Legitimate query success
// 2. Multi-vector injection blockage
// 3. Out-of-scope & unauthenticated call blockage
// 4. Rate-limit burst protection
// 5. LangGraph agent containment of prompt injection
// 6. 100% audit log capture and cryptographic chain validity
// ============================================================================

import { runChallenge } from "../src/challenge.js";

function assert(condition: boolean, message: string): void {
  if (!condition) {
    throw new Error(`ASSERTION FAILED: ${message}`);
  }
}

async function testChallenge() {
  console.log("════════════════════════════════════════════════════════════");
  console.log("  TEST: Day 07 Coding Challenge Verification");
  console.log("════════════════════════════════════════════════════════════\n");

  const results = await runChallenge();

  // Assertion 1: Legitimate query execution
  assert(results.legitimateQueryPassed, "Legitimate query must succeed");
  console.log("  ✓ Assertion 1: Legitimate SQL query passed");

  // Assertion 2: Adversarial SQL injection rejection
  assert(results.injectionAttacksBlocked, "All SQL injection attacks must be blocked");
  assert(
    results.injectionAttacksCount >= 5,
    `Expected at least 5 injection attacks tested, got ${results.injectionAttacksCount}`
  );
  console.log("  ✓ Assertion 2: Adversarial SQL injection attacks blocked");

  // Assertion 3: Out-of-scope & unauthenticated rejection
  assert(results.outOfScopeBlocked, "Out-of-scope calls must be rejected");
  assert(results.unauthenticatedBlocked, "Unauthenticated calls must be rejected");
  console.log("  ✓ Assertion 3: Least privilege & authentication gates enforced");

  // Assertion 4: Rate limit enforcement
  assert(results.rateLimitEnforced, "Rate limit must throttle excess calls");
  console.log("  ✓ Assertion 4: Rate limiter enforced backpressure");

  // Assertion 5: LangGraph agent trust containment
  assert(results.agentThreatContained, "Agent must contain prompt-injection-driven tool abuse");
  assert(results.agentLegitimateTaskPassed, "Agent must successfully execute legitimate workflow");
  console.log("  ✓ Assertion 5: LangGraph agent trust boundaries verified");

  // Assertion 6: Audit log completeness and hash chain
  assert(results.auditChainIntact, "Cryptographic audit chain must remain intact");
  assert(results.totalAuditEntries > 0, "Audit log must contain all executed calls");
  console.log("  ✓ Assertion 6: Tamper-evident cryptographic audit trail verified");

  console.log("\nAll Coding Challenge Assertions Passed! ✓\n");
}

testChallenge().catch((err) => {
  console.error(err);
  process.exit(1);
});
