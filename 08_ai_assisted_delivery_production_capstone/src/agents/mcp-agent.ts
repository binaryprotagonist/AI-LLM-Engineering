import { container } from "../shared/container.js";
import type { GraphStateType } from "../graph/state.js";
import type { MCPClientIdentity, MCPRole, MCPScope } from "../mcp/types.js";
import { logEvent } from "../observability/logger.js";

function resolveScopes(roles: string[]): MCPScope[] {
  const scopes = new Set<MCPScope>();
  for (const role of roles) {
    if (role === "employee") {
      scopes.add("employee:read");
    } else if (role === "analyst") {
      scopes.add("employee:read");
      scopes.add("analytics:read");
    } else if (role === "hr_admin") {
      scopes.add("employee:read");
      scopes.add("analytics:read");
      scopes.add("hr:write");
    } else if (role === "security_admin") {
      scopes.add("employee:read");
      scopes.add("analytics:read");
      scopes.add("security:audit");
    }
  }
  return Array.from(scopes);
}

export async function mcpAgentNode(
  state: GraphStateType
): Promise<Partial<GraphStateType>> {
  const start = Date.now();
  const identity: MCPClientIdentity = {
    userId: state.userId,
    tenantId: state.tenantId,
    roles: state.roles as MCPRole[],
    scopes: resolveScopes(state.roles)
  };

  const q = state.question.toLowerCase();
  let toolName = "get_employee_record";
  let params: Record<string, unknown> = { employeeId: state.userId };

  if (q.includes("leave") && (q.includes("request") || q.includes("apply") || q.includes("submit") || q.includes("book"))) {
    toolName = "request_leave_approval";
    const daysMatch = q.match(/(\d+)\s*days?/);
    const days = daysMatch && daysMatch[1] ? parseInt(daysMatch[1], 10) : 3;
    params = {
      employeeId: state.userId,
      days,
      reason: "Annual vacation leave request"
    };
  } else if (q.includes("department") || q.includes("stats") || q.includes("engineering") || q.includes("product")) {
    toolName = "query_department_stats";
    const dept = q.includes("product") ? "Product" : "Engineering";
    params = { department: dept };
  } else if (q.includes("employee") || q.includes("profile") || q.includes("record") || q.includes("balance")) {
    toolName = "get_employee_record";
    params = { employeeId: state.userId };
  }

  // Check if we are resuming from an approved HITL decision
  let bypassHITL = false;
  if (state.approvalDecision && state.approvalDecision.decision === "approve") {
    bypassHITL = true;
    if (state.approvalDecision.editedParameters) {
      params = state.approvalDecision.editedParameters;
    }
  }

  const response = await container.mcpClient.callTool(toolName, params, identity, { bypassHITL });
  const durationMs = Date.now() - start;

  if (response.requiresHITL && response.hitlPayload) {
    const approval = container.hitlManager.createApprovalRequest({
      requestId: state.requestId,
      action: response.hitlPayload.action,
      target: response.hitlPayload.target,
      parameters: response.hitlPayload.parameters as Record<string, unknown>,
      requestedBy: {
        userId: state.userId,
        tenantId: state.tenantId,
        roles: state.roles
      }
    });

    logEvent({
      requestId: state.requestId,
      traceId: state.traceId,
      operation: `mcp.tool.${toolName}.hitl_pending`,
      durationMs,
      status: "pending",
      metadata: { approvalId: approval.id }
    });

    return {
      status: "interrupted",
      hitlRequired: true,
      pendingApproval: approval,
      toolCallsUsed: 1,
      stepsUsed: 1,
      tokensUsed: 60,
      estimatedCostUsd: 0.00012,
      auditRecordIds: response.auditRecordId ? [response.auditRecordId] : [],
      answer: `[ACTION PAUSED] Tool '${toolName}' requires human manager approval. Approval request submitted with ID: ${approval.id}`
    };
  }

  if (!response.success) {
    logEvent({
      requestId: state.requestId,
      traceId: state.traceId,
      operation: `mcp.tool.${toolName}.failed`,
      durationMs,
      status: "failure",
      metadata: { error: response.error }
    });

    return {
      status: "failed",
      errors: [response.error?.message ?? "MCP tool execution failed"],
      toolCallsUsed: 1,
      stepsUsed: 1,
      tokensUsed: 40,
      estimatedCostUsd: 0.00008,
      auditRecordIds: response.auditRecordId ? [response.auditRecordId] : [],
      answer: `MCP tool execution failed: ${response.error?.message} (Code: ${response.error?.code})`
    };
  }

  logEvent({
    requestId: state.requestId,
    traceId: state.traceId,
    operation: `mcp.tool.${toolName}.success`,
    durationMs,
    status: "success",
    metadata: { auditRecordId: response.auditRecordId }
  });

  return {
    status: "completed",
    toolCallsUsed: 1,
    stepsUsed: 1,
    tokensUsed: 80,
    estimatedCostUsd: 0.00016,
    auditRecordIds: response.auditRecordId ? [response.auditRecordId] : [],
    answer:
      `[MCP Server Execution Successful]\n` +
      `Tool: ${toolName}\n` +
      `Audit Hash Record ID: ${response.auditRecordId}\n` +
      `Result:\n${JSON.stringify(response.data, null, 2)}`
  };
}