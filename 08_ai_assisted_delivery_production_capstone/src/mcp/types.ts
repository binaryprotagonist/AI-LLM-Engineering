import { z } from "zod";

export type MCPRole = "employee" | "hr_admin" | "security_admin" | "analyst";

export type MCPScope =
  | "employee:read"
  | "analytics:read"
  | "hr:write"
  | "security:audit";

export interface MCPClientIdentity {
  userId: string;
  tenantId: string;
  roles: MCPRole[];
  scopes: MCPScope[];
}

export interface MCPToolDefinition<TInput = unknown, TOutput = unknown> {
  name: string;
  description: string;
  requiredScope: MCPScope;
  requiresHITL?: boolean;
  schema: z.ZodType<TInput>;
  handler: (input: TInput, identity: MCPClientIdentity) => Promise<TOutput> | TOutput;
}

export interface MCPRequest<T = unknown> {
  tool: string;
  parameters: T;
  identity: MCPClientIdentity;
  clientRequestId?: string;
}

export interface MCPResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: {
    code: "UNAUTHENTICATED" | "UNAUTHORIZED" | "VALIDATION_ERROR" | "RATE_LIMITED" | "HITL_REQUIRED" | "INTERNAL_ERROR" | "SECURITY_VIOLATION";
    message: string;
    details?: unknown;
  };
  auditRecordId?: string;
  requiresHITL?: boolean;
  hitlPayload?: {
    action: string;
    target: string;
    parameters: unknown;
  };
}

export interface AuditRecord {
  id: string;
  timestamp: string;
  previousHash: string;
  currentHash: string;
  userId: string;
  tenantId: string;
  tool: string;
  parametersHash: string;
  status: "ALLOWED" | "DENIED" | "HITL_PENDING";
  reason?: string;
}
