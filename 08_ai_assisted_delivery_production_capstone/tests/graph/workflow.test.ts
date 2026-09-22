import { createWorkflow } from "../../src/graph/workflow.js";
import { container } from "../../src/shared/container.js";

export async function runWorkflowTests(): Promise<boolean> {
  const graph = createWorkflow();
  let allPassed = true;

  console.log("\n[LangGraph Workflow Tests]");

  // 1. RAG Route Execution Test
  const ragResult = await graph.invoke({
    question: "What is our remote work policy?",
    requestId: "req-wf-1",
    traceId: "tr-wf-1",
    userId: "user-001",
    tenantId: "tenant-001",
    roles: ["employee"],
    route: "unknown",
    answer: "",
    status: "pending",
    stepsUsed: 0,
    toolCallsUsed: 0,
    tokensUsed: 0,
    estimatedCostUsd: 0,
    maxSteps: 10,
    maxToolCalls: 5,
    maxCostUsd: 0.05,
    deadlineAt: Date.now() + 15000,
    budgetExceeded: false,
    hitlRequired: false,
    pendingApproval: null,
    approvalDecision: null,
    auditRecordIds: [],
    errors: []
  });

  if (ragResult.status === "completed" && ragResult.answer.includes("Remote Work Policy")) {
    console.log("  ✓ Supervisor routed to RAG agent and retrieved policy context");
  } else {
    console.error("  ✗ RAG workflow failed:", ragResult);
    allPassed = false;
  }

  // 2. Analysis Route Execution Test
  const analysisResult = await graph.invoke({
    question: "Analyze and compare remote work vs productivity",
    requestId: "req-wf-2",
    traceId: "tr-wf-2",
    userId: "user-001",
    tenantId: "tenant-001",
    roles: ["analyst"],
    route: "unknown",
    answer: "",
    status: "pending",
    stepsUsed: 0,
    toolCallsUsed: 0,
    tokensUsed: 0,
    estimatedCostUsd: 0,
    maxSteps: 10,
    maxToolCalls: 5,
    maxCostUsd: 0.05,
    deadlineAt: Date.now() + 15000,
    budgetExceeded: false,
    hitlRequired: false,
    pendingApproval: null,
    approvalDecision: null,
    auditRecordIds: [],
    errors: []
  });

  if (analysisResult.status === "completed" && analysisResult.answer.includes("Executive Analysis")) {
    console.log("  ✓ Supervisor routed to Analysis agent and synthesized response");
  } else {
    console.error("  ✗ Analysis workflow failed:", analysisResult);
    allPassed = false;
  }

  // 3. MCP Route with HITL Interruption Test
  const hitlResult = await graph.invoke({
    question: "Request leave 5 days for annual travel",
    requestId: "req-wf-3",
    traceId: "tr-wf-3",
    userId: "user-001",
    tenantId: "tenant-001",
    roles: ["employee", "hr_admin"],
    route: "unknown",
    answer: "",
    status: "pending",
    stepsUsed: 0,
    toolCallsUsed: 0,
    tokensUsed: 0,
    estimatedCostUsd: 0,
    maxSteps: 10,
    maxToolCalls: 5,
    maxCostUsd: 0.05,
    deadlineAt: Date.now() + 15000,
    budgetExceeded: false,
    hitlRequired: false,
    pendingApproval: null,
    approvalDecision: null,
    auditRecordIds: [],
    errors: []
  });

  if (hitlResult.status === "interrupted" && hitlResult.pendingApproval) {
    console.log("  ✓ MCP sensitive action halted workflow and set status to 'interrupted'");

    // Simulate Human Manager Approval
    const resolution = container.hitlManager.resolveApproval({
      approvalId: hitlResult.pendingApproval.id,
      decision: "approve",
      reviewerId: "manager-bob-01",
      reviewerNotes: "Approved - vacation covered by backup staff."
    });

    if (resolution.success && resolution.approval?.status === "approved") {
      console.log("  ✓ Human manager successfully approved pending approval token");
    } else {
      console.error("  ✗ HITL resolution failed:", resolution);
      allPassed = false;
    }
  } else {
    console.error("  ✗ MCP HITL workflow failed to interrupt:", hitlResult);
    allPassed = false;
  }

  return allPassed;
}
