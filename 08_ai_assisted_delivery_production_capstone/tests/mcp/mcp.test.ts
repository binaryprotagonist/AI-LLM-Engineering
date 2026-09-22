import { HardenedMCPServer } from "../../src/mcp/server.js";
import { MCPClient } from "../../src/mcp/client.js";

export async function runMCPTests(): Promise<boolean> {
  const server = new HardenedMCPServer();
  const client = new MCPClient(server);
  let allPassed = true;

  console.log("\n[MCP Contract Tests]");

  // 1. Tool listing test
  const tools = client.listTools();
  if (tools.length >= 3 && tools.some((t) => t.name === "get_employee_record")) {
    console.log(`  ✓ Successfully enumerated ${tools.length} registered MCP tools`);
  } else {
    console.error("  ✗ Tool enumeration failed");
    allPassed = false;
  }

  // 2. Read employee record with authorized scope
  const empRes = await client.callTool(
    "get_employee_record",
    { employeeId: "user-001" },
    { userId: "user-001", tenantId: "tenant-001", roles: ["employee"], scopes: ["employee:read"] }
  );

  if (empRes.success && empRes.data && (empRes.data as any).name === "Alice Johnson") {
    console.log("  ✓ Executed get_employee_record with scope 'employee:read'");
  } else {
    console.error("  ✗ get_employee_record execution failed:", empRes);
    allPassed = false;
  }

  // 3. Department statistics with analyst role
  const deptRes = await client.callTool(
    "query_department_stats",
    { department: "Engineering" },
    { userId: "user-002", tenantId: "tenant-001", roles: ["analyst"], scopes: ["analytics:read"] }
  );

  if (deptRes.success && deptRes.data && (deptRes.data as any).totalEmployees >= 2) {
    console.log("  ✓ Executed query_department_stats with scope 'analytics:read'");
  } else {
    console.error("  ✗ query_department_stats failed:", deptRes);
    allPassed = false;
  }

  // 4. Sensitive leave request triggers HITL requirement
  const hitlRes = await client.callTool(
    "request_leave_approval",
    { employeeId: "user-001", days: 4, reason: "Family event" },
    { userId: "user-001", tenantId: "tenant-001", roles: ["hr_admin"], scopes: ["hr:write"] }
  );

  if (!hitlRes.success && hitlRes.requiresHITL && hitlRes.error?.code === "HITL_REQUIRED") {
    console.log("  ✓ High-impact tool correctly halts and demands HITL approval");
  } else {
    console.error("  ✗ HITL requirement failed to trigger:", hitlRes);
    allPassed = false;
  }

  // 5. Audit log hash verification
  const auditVerification = server.auditLogger.verifyChain();
  if (auditVerification.isValid && server.auditLogger.getRecordCount() >= 3) {
    console.log(`  ✓ Cryptographic SHA-256 audit chain valid (${server.auditLogger.getRecordCount()} events logged)`);
  } else {
    console.error("  ✗ Audit chain verification failed:", auditVerification);
    allPassed = false;
  }

  return allPassed;
}
