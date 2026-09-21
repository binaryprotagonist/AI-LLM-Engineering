// ============================================================================
// AUTHENTICATION & ROLE-BASED ACCESS CONTROL (RBAC)
// ============================================================================
// Verifies bearer tokens / API keys, maps to caller identity and scopes,
// and enforces least-privilege boundary before tool/resource execution.
// ============================================================================

import { AuthContext, Scope } from "../protocol.js";

export interface ApiClientConfig {
  clientId: string;
  clientName: string;
  apiKey: string;
  scopes: Scope[];
  rateLimitPerMin: number;
}

export class SecurityAuthority {
  private clientRegistry: Map<string, ApiClientConfig> = new Map();

  constructor() {
    this.registerDefaultClients();
  }

  private registerDefaultClients(): void {
    // 1. Analyst Agent (standard read scopes for DB & metrics)
    this.registerClient({
      clientId: "agent_analyst_01",
      clientName: "Reporting & Data Analyst Agent",
      apiKey: "mcp_token_analyst_sec789",
      scopes: ["db:read", "db:schema", "metrics:read"],
      rateLimitPerMin: 30,
    });

    // 2. Readonly Agent (minimal DB read only)
    this.registerClient({
      clientId: "agent_readonly_02",
      clientName: "Minimal Read-Only Query Agent",
      apiKey: "mcp_token_readonly_min123",
      scopes: ["db:read"],
      rateLimitPerMin: 20,
    });

    // 3. Admin Client (full privileges including restricted vault)
    this.registerClient({
      clientId: "admin_super_00",
      clientName: "System Administrator Gateway",
      apiKey: "mcp_token_super_admin_root99",
      scopes: ["admin:all", "db:read", "db:schema", "metrics:read"],
      rateLimitPerMin: 120,
    });

    // 4. Low-Privilege / Unscoped Agent (no valid DB scopes)
    this.registerClient({
      clientId: "agent_unscoped_03",
      clientName: "Unprivileged Guest Agent",
      apiKey: "mcp_token_guest_unscoped00",
      scopes: [],
      rateLimitPerMin: 5,
    });
  }

  public registerClient(config: ApiClientConfig): void {
    this.clientRegistry.set(config.apiKey, config);
  }

  /**
   * Authenticate token provided in request header or tool payload.
   */
  public authenticate(token?: string): AuthContext {
    if (!token) {
      return {
        clientId: "anonymous",
        clientName: "Anonymous Unauthenticated Caller",
        scopes: [],
        isAuthenticated: false,
        rateLimitPerMin: 0,
      };
    }

    const client = this.clientRegistry.get(token.trim());
    if (!client) {
      return {
        clientId: "unrecognized",
        clientName: "Unknown Caller",
        scopes: [],
        isAuthenticated: false,
        rateLimitPerMin: 0,
      };
    }

    return {
      clientId: client.clientId,
      clientName: client.clientName,
      scopes: [...client.scopes],
      isAuthenticated: true,
      rateLimitPerMin: client.rateLimitPerMin,
    };
  }

  /**
   * Enforces least-privilege scope check.
   */
  public hasScope(context: AuthContext, requiredScope: Scope): boolean {
    if (!context.isAuthenticated) return false;
    if (context.scopes.includes("admin:all")) return true;
    return context.scopes.includes(requiredScope);
  }
}
