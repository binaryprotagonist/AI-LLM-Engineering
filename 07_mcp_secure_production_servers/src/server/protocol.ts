// ============================================================================
// MCP PROTOCOL & SECURITY CONSTANTS
// ============================================================================
// Standard JSON-RPC 2.0 error codes + MCP specific security error codes
// ============================================================================

export const JSONRPC_VERSION = "2.0";

export enum McpErrorCode {
  // Standard JSON-RPC 2.0
  PARSE_ERROR = -32700,
  INVALID_REQUEST = -32600,
  METHOD_NOT_FOUND = -32601,
  INVALID_PARAMS = -32602,
  INTERNAL_ERROR = -32603,

  // Custom Security & Hardening Error Codes
  UNAUTHENTICATED = -32001,
  FORBIDDEN = -32003,
  RATE_LIMITED = -32029,
  INJECTION_DETECTED = -32030,
  SCOPE_INSUFFICIENT = -32031,
  RESOURCE_RESTRICTED = -32032,
  EXECUTION_TIMEOUT = -32040,
}

export type Scope = "db:read" | "db:schema" | "metrics:read" | "admin:all";

export interface AuthContext {
  clientId: string;
  clientName: string;
  scopes: Scope[];
  isAuthenticated: boolean;
  rateLimitPerMin: number;
}

export interface ToolDefinition {
  name: string;
  description: string;
  requiredScope: Scope;
  inputSchema: Record<string, unknown>;
}

export interface ResourceDefinition {
  uri: string;
  name: string;
  description: string;
  mimeType: string;
  requiredScope?: Scope;
}

export interface PromptDefinition {
  name: string;
  description: string;
  arguments?: Array<{
    name: string;
    description: string;
    required: boolean;
  }>;
}

export interface AuditLogEntry {
  id: string;
  timestamp: string;
  clientId: string;
  clientName: string;
  toolName: string;
  params: Record<string, unknown>;
  verdict:
    | "ALLOWED"
    | "BLOCKED_UNAUTHENTICATED"
    | "BLOCKED_SCOPE"
    | "BLOCKED_INJECTION"
    | "BLOCKED_RATE_LIMIT"
    | "EXECUTION_ERROR";
  reason?: string;
  latencyMs: number;
  rowCount?: number;
  previousHash: string;
  hash: string;
}
