import { runGatewayTests } from "./gateway/gateway.test.js";
import { runMCPTests } from "./mcp/mcp.test.js";
import { runWorkflowTests } from "./graph/workflow.test.js";
import { runAdversarialTests } from "./security/adversarial.test.js";

async function main() {
  console.log("========================================================");
  console.log("         DAY 08 PRODUCTION CAPSTONE: TEST SUITE         ");
  console.log("========================================================");

  const gwPassed = await runGatewayTests();
  const mcpPassed = await runMCPTests();
  const wfPassed = await runWorkflowTests();

  console.log("\n[Adversarial Security Tests]");
  const adv = await runAdversarialTests();
  for (const test of adv.results) {
    console.log(`  ${test.passed ? "✓" : "✗"} [${test.category.toUpperCase()}] ${test.name}: ${test.actualOutcome}`);
  }

  const allPassed = gwPassed && mcpPassed && wfPassed && adv.failed === 0;

  console.log("\n========================================================");
  console.log("                     TEST SUMMARY                       ");
  console.log("========================================================");
  console.log(`Gateway Tests:          ${gwPassed ? "PASSED" : "FAILED"}`);
  console.log(`MCP Contract Tests:     ${mcpPassed ? "PASSED" : "FAILED"}`);
  console.log(`Workflow / HITL Tests:  ${wfPassed ? "PASSED" : "FAILED"}`);
  console.log(`Adversarial Security:   ${adv.passed}/${adv.total} PASSED (${adv.failed} failed)`);
  console.log("========================================================");

  if (!allPassed) {
    console.error("\nTEST SUITE FAILED: One or more assertions did not pass.");
    process.exit(1);
  } else {
    console.log("\nTEST SUITE PASSED: All production contracts and security boundaries verified.\n");
  }
}

main().catch((err) => {
  console.error("Test runner crashed:", err);
  process.exit(1);
});
