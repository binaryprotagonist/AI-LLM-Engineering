import { Gateway } from "./gateway/gateway.js";
import { createWorkflow } from "./graph/workflow.js";

const gateway = new Gateway();
const graph = createWorkflow();

const gatewayResponse = gateway.handle({
  question: "How many days can employees work remotely?",
  user: {
    userId: "user-001",
    tenantId: "tenant-001",
    roles: ["employee"],
  },
});

console.log("\n--- Gateway Response ---");
console.dir(gatewayResponse, { depth: null });

if (!gatewayResponse.accepted || !gatewayResponse.context) {
  console.error("Request rejected by gateway.");
  process.exit(1);
}

const context = gatewayResponse.context;

const result = await graph.invoke({
  question: "How many days can employees work remotely?",

  requestId: context.requestId,
  traceId: context.traceId,

  userId: context.user.userId,
  tenantId: context.user.tenantId,
  roles: context.user.roles,

  route: "unknown",
  answer: "",
  status: "pending",

  stepsUsed: 0,
  toolCallsUsed: 0,
  tokensUsed: 0,
  estimatedCostUsd: 0,

  maxSteps: context.budget.maxSteps,
  maxToolCalls: 8,
  maxCostUsd: context.budget.maxCostUsd,
  deadlineAt: context.budget.deadlineAt,

  budgetExceeded: false,
  hitlRequired: false,
  pendingApproval: null,
  approvalDecision: null,
  auditRecordIds: [],
  errors: [],
});

console.log("\n--- LangGraph Execution Result ---");
console.dir(result, { depth: null });