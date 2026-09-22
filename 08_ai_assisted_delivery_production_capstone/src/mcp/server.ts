import { z } from "zod";
import { AuditLogger } from "./audit.js";
import { SecurityGuard } from "./security.js";
import { BusinessServiceDatabase } from "./database.js";
import type {
  MCPRequest,
  MCPResponse,
  MCPToolDefinition
} from "./types.js";

export class HardenedMCPServer {
  private readonly tools = new Map<string, MCPToolDefinition<any, any>>();
  public readonly auditLogger = new AuditLogger();
  public readonly securityGuard = new SecurityGuard();
  public readonly database = new BusinessServiceDatabase();

  constructor() {
    this.registerDefaultTools();
  }

  private registerDefaultTools(): void {
    // Tool 1: Read Employee Record
    this.registerTool({
      name: "get_employee_record",
      description: "Retrieve official employee employment details, remaining leave, and status.",
      requiredScope: "employee:read",
      requiresHITL: false,
      schema: z.object({
        employeeId: z.string().min(1, "employeeId cannot be empty")
      }),
      handler: (input, identity) => {
        const record = this.database.getEmployee(identity.tenantId, input.employeeId);
        if (!record) {
          throw new Error(`Employee record '${input.employeeId}' not found in tenant '${identity.tenantId}'`);
        }
        return record;
      }
    });

    // Tool 2: Query Department Analytics
    this.registerTool({
      name: "query_department_stats",
      description: "Compute aggregated workforce and leave statistics for a specific department.",
      requiredScope: "analytics:read",
      requiresHITL: false,
      schema: z.object({
        department: z.string().min(1, "department cannot be empty")
      }),
      handler: (input, identity) => {
        const stats = this.database.getDepartmentStats(identity.tenantId, input.department);
        if (!stats) {
          throw new Error(`Department '${input.department}' not found in tenant '${identity.tenantId}'`);
        }
        return stats;
      }
    });

    // Tool 3: Request Leave Approval (Sensitive Operation -> requires HITL)
    this.registerTool({
      name: "request_leave_approval",
      description: "Submit a formal leave deduction request. High-impact action requiring human manager sign-off.",
      requiredScope: "hr:write",
      requiresHITL: true,
      schema: z.object({
        employeeId: z.string().min(1),
        days: z.number().int().positive().max(30),
        reason: z.string().min(3).max(200)
      }),
      handler: (input, identity) => {
        return this.database.createLeaveRequest(
          identity.tenantId,
          input.employeeId,
          input.days,
          input.reason
        );
      }
    });
  }

  public registerTool<TInput, TOutput>(tool: MCPToolDefinition<TInput, TOutput>): void {
    this.tools.set(tool.name, tool);
  }

  public getTool(name: string): MCPToolDefinition | undefined {
    return this.tools.get(name);
  }

  public listTools(): Array<{ name: string; description: string; requiredScope: string; requiresHITL: boolean }> {
    return Array.from(this.tools.values()).map((t) => ({
      name: t.name,
      description: t.description,
      requiredScope: t.requiredScope,
      requiresHITL: Boolean(t.requiresHITL)
    }));
  }

  public async execute<TInput = unknown, TOutput = unknown>(
    request: MCPRequest<TInput>,
    options?: { bypassHITL?: boolean }
  ): Promise<MCPResponse<TOutput>> {
    const { tool: toolName, parameters, identity } = request;

    // 1. Sliding window rate limiting
    const rateLimitCheck = this.securityGuard.checkRateLimit(`${identity.tenantId}:${identity.userId}`);
    if (!rateLimitCheck.allowed) {
      const audit = this.auditLogger.log({
        userId: identity.userId,
        tenantId: identity.tenantId,
        tool: toolName,
        parameters,
        status: "DENIED",
        reason: `Rate limit exceeded. Retry after ${rateLimitCheck.retryAfterMs}ms`
      });
      return {
        success: false,
        error: {
          code: "RATE_LIMITED",
          message: `Too many requests. Retry after ${rateLimitCheck.retryAfterMs}ms.`
        },
        auditRecordId: audit.id
      };
    }

    // 2. Lexical security injection checks
    const lexicalCheck = this.securityGuard.validateLexicalInput(parameters);
    if (!lexicalCheck.safe) {
      const audit = this.auditLogger.log({
        userId: identity.userId,
        tenantId: identity.tenantId,
        tool: toolName,
        parameters,
        status: "DENIED",
        reason: lexicalCheck.reason
      });
      return {
        success: false,
        error: {
          code: "SECURITY_VIOLATION",
          message: lexicalCheck.reason ?? "Malicious payload detected"
        },
        auditRecordId: audit.id
      };
    }

    // 3. Tool existence check
    const toolDef = this.tools.get(toolName);
    if (!toolDef) {
      const audit = this.auditLogger.log({
        userId: identity.userId,
        tenantId: identity.tenantId,
        tool: toolName,
        parameters,
        status: "DENIED",
        reason: `Tool '${toolName}' not found`
      });
      return {
        success: false,
        error: {
          code: "VALIDATION_ERROR",
          message: `Tool '${toolName}' is not registered.`
        },
        auditRecordId: audit.id
      };
    }

    // 4. RBAC Authorization check
    const authCheck = this.securityGuard.checkAuthorization(identity, toolDef.requiredScope);
    if (!authCheck.authorized) {
      const audit = this.auditLogger.log({
        userId: identity.userId,
        tenantId: identity.tenantId,
        tool: toolName,
        parameters,
        status: "DENIED",
        reason: authCheck.reason
      });
      return {
        success: false,
        error: {
          code: "UNAUTHORIZED",
          message: authCheck.reason ?? "Access denied"
        },
        auditRecordId: audit.id
      };
    }

    // 5. Schema Validation
    const parsed = toolDef.schema.safeParse(parameters);
    if (!parsed.success) {
      const issues = parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join(", ");
      const audit = this.auditLogger.log({
        userId: identity.userId,
        tenantId: identity.tenantId,
        tool: toolName,
        parameters,
        status: "DENIED",
        reason: `Schema validation failed: ${issues}`
      });
      return {
        success: false,
        error: {
          code: "VALIDATION_ERROR",
          message: `Invalid parameters for '${toolName}': ${issues}`,
          details: parsed.error.issues
        },
        auditRecordId: audit.id
      };
    }

    // 6. Human-In-The-Loop check (unless bypassed by manager approval execution)
    if (toolDef.requiresHITL && !options?.bypassHITL) {
      const audit = this.auditLogger.log({
        userId: identity.userId,
        tenantId: identity.tenantId,
        tool: toolName,
        parameters: parsed.data,
        status: "HITL_PENDING",
        reason: "Sensitive business operation requires manager approval"
      });
      return {
        success: false,
        requiresHITL: true,
        error: {
          code: "HITL_REQUIRED",
          message: `Operation '${toolName}' is classified as sensitive and requires human manager approval.`
        },
        hitlPayload: {
          action: toolName,
          target: `${identity.tenantId}:${identity.userId}`,
          parameters: parsed.data
        },
        auditRecordId: audit.id
      };
    }

    // 7. Execution
    try {
      const result = await toolDef.handler(parsed.data, identity);
      const audit = this.auditLogger.log({
        userId: identity.userId,
        tenantId: identity.tenantId,
        tool: toolName,
        parameters: parsed.data,
        status: "ALLOWED"
      });

      return {
        success: true,
        data: result,
        auditRecordId: audit.id
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : "Internal tool error";
      const audit = this.auditLogger.log({
        userId: identity.userId,
        tenantId: identity.tenantId,
        tool: toolName,
        parameters: parsed.data,
        status: "DENIED",
        reason: message
      });
      return {
        success: false,
        error: {
          code: "INTERNAL_ERROR",
          message
        },
        auditRecordId: audit.id
      };
    }
  }
}
