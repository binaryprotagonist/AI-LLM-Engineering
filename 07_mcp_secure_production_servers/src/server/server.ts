// ============================================================================
// HARDENED MCP SERVER (Production Security Boundary)
// ============================================================================
// Standard MCP Server implementation exposing SQL database & internal resources
// with AuthN/Z, rate limiting, SQL injection defense, and cryptographic audit logs.
// ============================================================================

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  ListResourcesRequestSchema,
  ReadResourceRequestSchema,
  ListPromptsRequestSchema,
  GetPromptRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { ProductionDatabase } from "./db/database.js";
import { SecurityAuthority } from "./security/auth.js";
import { SecurityRateLimiter } from "./security/rate_limiter.js";
import { SqlSecurityValidator, QueryDatabaseInputSchema } from "./security/validator.js";
import { SecurityAuditLogger } from "./security/audit_logger.js";
import { McpErrorCode, ToolDefinition } from "./protocol.js";

export interface ToolExecutionResponse {
  success: boolean;
  data?: unknown;
  error?: {
    code: McpErrorCode;
    message: string;
    details?: unknown;
  };
  auditId: string;
  latencyMs: number;
}

export class HardenedMcpServer {
  public readonly server: Server;
  public readonly db: ProductionDatabase;
  public readonly auth: SecurityAuthority;
  public readonly rateLimiter: SecurityRateLimiter;
  public readonly auditLogger: SecurityAuditLogger;
  private startTime: number = Date.now();

  constructor(inMemoryDb: boolean = true) {
    this.server = new Server(
      {
        name: "hardened-secure-sql-mcp-server",
        version: "1.0.0",
      },
      {
        capabilities: {
          tools: {},
          resources: {},
          prompts: {},
        },
      }
    );

    this.db = new ProductionDatabase(inMemoryDb);
    this.auth = new SecurityAuthority();
    this.rateLimiter = new SecurityRateLimiter(60_000); // 1 minute sliding window
    this.auditLogger = new SecurityAuditLogger();

    this.registerMcpHandlers();
  }

  /**
   * Tool definitions exposed through MCP capability negotiation
   */
  public getToolDefinitions(): ToolDefinition[] {
    return [
      {
        name: "query_database",
        description:
          "Executes a secure, read-only SQL query on whitelisted tables (customers, products, orders, system_metrics) with strict injection guards and row limits.",
        requiredScope: "db:read",
        inputSchema: {
          type: "object",
          properties: {
            query: {
              type: "string",
              description: "SQL SELECT query (e.g. 'SELECT * FROM products WHERE price < ?')",
            },
            params: {
              type: "array",
              description: "Parameterized query values",
              items: { type: ["string", "number", "boolean"] },
            },
            maxRows: {
              type: "integer",
              description: "Max number of rows to return (1-100, default 50)",
              default: 50,
            },
            authToken: {
              type: "string",
              description: "Bearer authentication token for RBAC authorization",
            },
          },
          required: ["query"],
        },
      },
      {
        name: "describe_schema",
        description:
          "Returns schema structure and columns for all public database tables. Does not expose restricted internal tables to standard callers.",
        requiredScope: "db:schema",
        inputSchema: {
          type: "object",
          properties: {
            authToken: {
              type: "string",
              description: "Bearer authentication token for RBAC authorization",
            },
          },
        },
      },
      {
        name: "get_system_metrics",
        description:
          "Returns operational and health metrics (p99 latency, CPU, DB connections).",
        requiredScope: "metrics:read",
        inputSchema: {
          type: "object",
          properties: {
            authToken: {
              type: "string",
              description: "Bearer authentication token for RBAC authorization",
            },
          },
        },
      },
    ];
  }

  /**
   * Core execution pipeline:
   * 1. AuthN (Token validation)
   * 2. Rate Limiting check
   * 3. AuthZ (Scope check)
   * 4. Input validation & SQL injection defense
   * 5. Execution (with bounds & timeouts)
   * 6. Chained Audit Logging
   */
  public async executeTool(
    name: string,
    args: Record<string, unknown> = {}
  ): Promise<ToolExecutionResponse> {
    const start = Date.now();
    const authToken = typeof args.authToken === "string" ? args.authToken : undefined;
    const authContext = this.auth.authenticate(authToken);

    // 1. AuthN Guard
    if (!authContext.isAuthenticated) {
      const latencyMs = Date.now() - start;
      const audit = this.auditLogger.log({
        clientId: authContext.clientId,
        clientName: authContext.clientName,
        toolName: name,
        params: this.sanitizeParams(args),
        verdict: "BLOCKED_UNAUTHENTICATED",
        reason: "Missing or invalid bearer authorization token",
        latencyMs,
      });

      return {
        success: false,
        error: {
          code: McpErrorCode.UNAUTHENTICATED,
          message: "Authentication required: Valid bearer token must be provided.",
        },
        auditId: audit.id,
        latencyMs,
      };
    }

    // 2. Rate Limiting Guard
    const rateLimit = this.rateLimiter.checkLimit(
      authContext.clientId,
      authContext.rateLimitPerMin
    );
    if (!rateLimit.allowed) {
      const latencyMs = Date.now() - start;
      const audit = this.auditLogger.log({
        clientId: authContext.clientId,
        clientName: authContext.clientName,
        toolName: name,
        params: this.sanitizeParams(args),
        verdict: "BLOCKED_RATE_LIMIT",
        reason: `Rate limit exceeded (${rateLimit.limit} req/min). Retry after ${rateLimit.retryAfterSeconds}s`,
        latencyMs,
      });

      return {
        success: false,
        error: {
          code: McpErrorCode.RATE_LIMITED,
          message: `Rate limit exceeded. Try again in ${rateLimit.retryAfterSeconds} seconds.`,
          details: rateLimit,
        },
        auditId: audit.id,
        latencyMs,
      };
    }

    // 3. Tool Discovery & Scope Check
    const toolDef = this.getToolDefinitions().find((t) => t.name === name);
    if (!toolDef) {
      const latencyMs = Date.now() - start;
      const audit = this.auditLogger.log({
        clientId: authContext.clientId,
        clientName: authContext.clientName,
        toolName: name,
        params: this.sanitizeParams(args),
        verdict: "EXECUTION_ERROR",
        reason: `Tool '${name}' not found`,
        latencyMs,
      });

      return {
        success: false,
        error: {
          code: McpErrorCode.METHOD_NOT_FOUND,
          message: `Tool '${name}' not found on this MCP server.`,
        },
        auditId: audit.id,
        latencyMs,
      };
    }

    if (!this.auth.hasScope(authContext, toolDef.requiredScope)) {
      const latencyMs = Date.now() - start;
      const audit = this.auditLogger.log({
        clientId: authContext.clientId,
        clientName: authContext.clientName,
        toolName: name,
        params: this.sanitizeParams(args),
        verdict: "BLOCKED_SCOPE",
        reason: `Insufficient privileges: requires '${toolDef.requiredScope}'`,
        latencyMs,
      });

      return {
        success: false,
        error: {
          code: McpErrorCode.SCOPE_INSUFFICIENT,
          message: `Access forbidden: Client lacks required scope '${toolDef.requiredScope}'`,
        },
        auditId: audit.id,
        latencyMs,
      };
    }

    // 4. Tool Execution Handlers
    try {
      if (name === "describe_schema") {
        const hasAdmin = authContext.scopes.includes("admin:all");
        const schema = this.db.getSchema(hasAdmin);
        const latencyMs = Date.now() - start;
        const audit = this.auditLogger.log({
          clientId: authContext.clientId,
          clientName: authContext.clientName,
          toolName: name,
          params: this.sanitizeParams(args),
          verdict: "ALLOWED",
          latencyMs,
          rowCount: schema.length,
        });

        return {
          success: true,
          data: schema,
          auditId: audit.id,
          latencyMs,
        };
      }

      if (name === "get_system_metrics") {
        const metrics = this.db.query("SELECT * FROM system_metrics ORDER BY recorded_at DESC");
        const latencyMs = Date.now() - start;
        const audit = this.auditLogger.log({
          clientId: authContext.clientId,
          clientName: authContext.clientName,
          toolName: name,
          params: this.sanitizeParams(args),
          verdict: "ALLOWED",
          latencyMs,
          rowCount: metrics.length,
        });

        return {
          success: true,
          data: metrics,
          auditId: audit.id,
          latencyMs,
        };
      }

      if (name === "query_database") {
        // Parse input schema
        const parsed = QueryDatabaseInputSchema.safeParse(args);
        if (!parsed.success) {
          const latencyMs = Date.now() - start;
          const audit = this.auditLogger.log({
            clientId: authContext.clientId,
            clientName: authContext.clientName,
            toolName: name,
            params: this.sanitizeParams(args),
            verdict: "EXECUTION_ERROR",
            reason: "Schema validation failed",
            latencyMs,
          });

          return {
            success: false,
            error: {
              code: McpErrorCode.INVALID_PARAMS,
              message: "Invalid parameters provided",
              details: parsed.error.issues,
            },
            auditId: audit.id,
            latencyMs,
          };
        }

        const { query, params, maxRows } = parsed.data;
        const hasAdmin = authContext.scopes.includes("admin:all");

        // SQL Injection and Lexical Security Analysis
        const valResult = SqlSecurityValidator.validate(query, hasAdmin);
        if (!valResult.valid) {
          const latencyMs = Date.now() - start;
          const audit = this.auditLogger.log({
            clientId: authContext.clientId,
            clientName: authContext.clientName,
            toolName: name,
            params: { query, paramsCount: params.length, maxRows },
            verdict: "BLOCKED_INJECTION",
            reason: `Query rejected: ${valResult.violations.join(" | ")}`,
            latencyMs,
          });

          return {
            success: false,
            error: {
              code: McpErrorCode.INJECTION_DETECTED,
              message: `Security violation: Query rejected by injection guard.`,
              details: valResult.violations,
            },
            auditId: audit.id,
            latencyMs,
          };
        }

        // Execute safe parameterized query
        const rows = this.db.query(
          valResult.normalizedQuery,
          params as Array<string | number>,
          maxRows
        );
        const latencyMs = Date.now() - start;
        const audit = this.auditLogger.log({
          clientId: authContext.clientId,
          clientName: authContext.clientName,
          toolName: name,
          params: { query: valResult.normalizedQuery, paramsCount: params.length, maxRows },
          verdict: "ALLOWED",
          latencyMs,
          rowCount: rows.length,
        });

        return {
          success: true,
          data: rows,
          auditId: audit.id,
          latencyMs,
        };
      }

      throw new Error(`Unhandled tool handler: ${name}`);
    } catch (err: unknown) {
      const latencyMs = Date.now() - start;
      const errorMessage = err instanceof Error ? err.message : String(err);
      const audit = this.auditLogger.log({
        clientId: authContext.clientId,
        clientName: authContext.clientName,
        toolName: name,
        params: this.sanitizeParams(args),
        verdict: "EXECUTION_ERROR",
        reason: errorMessage,
        latencyMs,
      });

      return {
        success: false,
        error: {
          code: McpErrorCode.INTERNAL_ERROR,
          message: `Database execution error: ${errorMessage}`,
        },
        auditId: audit.id,
        latencyMs,
      };
    }
  }

  private sanitizeParams(params: Record<string, unknown>): Record<string, unknown> {
    const sanitized = { ...params };
    if ("authToken" in sanitized) {
      sanitized.authToken = "[REDACTED_BEARER_TOKEN]";
    }
    return sanitized;
  }

  /**
   * Registers MCP protocol request handlers on the SDK server instance.
   */
  private registerMcpHandlers(): void {
    // 1. List Tools
    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      const tools = this.getToolDefinitions().map((t) => ({
        name: t.name,
        description: t.description,
        inputSchema: t.inputSchema,
      }));
      return { tools };
    });

    // 2. Call Tool
    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: toolArgs } = request.params;
      const result = await this.executeTool(name, toolArgs || {});

      if (!result.success) {
        return {
          isError: true,
          content: [
            {
              type: "text",
              text: JSON.stringify({
                error: result.error,
                auditId: result.auditId,
                latencyMs: result.latencyMs,
              }),
            },
          ],
        };
      }

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(result.data, null, 2),
          },
        ],
      };
    });

    // 3. List Resources
    this.server.setRequestHandler(ListResourcesRequestSchema, async () => {
      return {
        resources: [
          {
            uri: "system://health",
            name: "Server Health & Stats",
            description: "Real-time health status, uptime, and audit log telemetry",
            mimeType: "application/json",
          },
          {
            uri: "schema://catalog",
            name: "Database Catalog",
            description: "Authorized relational table catalog",
            mimeType: "application/json",
          },
        ],
      };
    });

    // 4. Read Resource
    this.server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
      const { uri } = request.params;
      if (uri === "system://health") {
        const uptimeSeconds = Math.floor((Date.now() - this.startTime) / 1000);
        const stats = {
          status: "healthy",
          uptimeSeconds,
          totalAuditEntries: this.auditLogger.getEntries().length,
          verdictCounts: this.auditLogger.getVerdictCounts(),
          integrity: this.auditLogger.verifyIntegrity(),
        };
        return {
          contents: [
            {
              uri,
              mimeType: "application/json",
              text: JSON.stringify(stats, null, 2),
            },
          ],
        };
      }

      if (uri === "schema://catalog") {
        const schema = this.db.getSchema(false);
        return {
          contents: [
            {
              uri,
              mimeType: "application/json",
              text: JSON.stringify(schema, null, 2),
            },
          ],
        };
      }

      throw new Error(`Resource not found: ${uri}`);
    });

    // 5. List Prompts
    this.server.setRequestHandler(ListPromptsRequestSchema, async () => {
      return {
        prompts: [
          {
            name: "incident_investigation",
            description: "Guided investigative prompt for diagnosing customer order discrepancies safely",
            arguments: [
              {
                name: "customerId",
                description: "Customer identifier to inspect",
                required: true,
              },
            ],
          },
        ],
      };
    });

    // 6. Get Prompt
    this.server.setRequestHandler(GetPromptRequestSchema, async (request) => {
      const { name, arguments: promptArgs } = request.params;
      if (name === "incident_investigation") {
        const customerId = promptArgs?.customerId ?? "1";
        return {
          description: "Investigation Prompt for Customer Incidents",
          messages: [
            {
              role: "user",
              content: {
                type: "text",
                text: `You are an authorized incident investigator. Investigate order records for customer ${customerId}. Use only parameterized query_database calls. Never alter database records or attempt out-of-scope reads.`,
              },
            },
          ],
        };
      }
      throw new Error(`Prompt template not found: ${name}`);
    });
  }

  public close(): void {
    this.db.close();
  }
}
