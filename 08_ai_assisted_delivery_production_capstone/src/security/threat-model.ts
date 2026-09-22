export interface ThreatBoundary {
  name: string;
  source: string;
  destination: string;
  protocol: string;
  threats: string[];
  mitigations: string[];
}

export interface SecurityInvariant {
  id: string;
  title: string;
  rule: string;
  enforcedAt: "Gateway" | "LangGraph" | "MCP" | "Database";
}

export const SYSTEM_THREAT_BOUNDARIES: ThreatBoundary[] = [
  {
    name: "Boundary 1: External Client -> API Gateway",
    source: "Untrusted Client / User Web/CLI",
    destination: "API Gateway",
    protocol: "HTTPS / REST / JSON",
    threats: [
      "Spoofing / Unauthorized user identity",
      "Tampering with input parameters",
      "Denial of Service via high request volume",
      "Cost explosion via massive context input"
    ],
    mitigations: [
      "Cryptographic token verification (AuthN)",
      "Strict schema validation via Zod (max length 4000 chars)",
      "Sliding window rate limiting per tenant/user",
      "Global request budget attachment (maxSteps, maxCostUsd, deadlineAt)"
    ]
  },
  {
    name: "Boundary 2: Orchestration -> Agents / Tools",
    source: "LangGraph State Machine / Supervisor",
    destination: "Specialized Agents (RAG, Analysis, MCP)",
    protocol: "In-Memory Typed State Annotation",
    threats: [
      "Infinite recursion / cycle loops",
      "Workflow budget overrun",
      "Cross-tenant data leakage",
      "State corruption across concurrent tasks"
    ],
    mitigations: [
      "Hard step limit (maxSteps = 12) & Budget Guard Node",
      "Strict tenantId scoping passed down to all retrievers and tools",
      "Immutable state reducers preventing unauthorized key overwrite",
      "Execution deadline enforcement (deadlineAt timestamp check)"
    ]
  },
  {
    name: "Boundary 3: MCP Agent -> MCP Server",
    source: "Untrusted LLM / Agent Generated Call",
    destination: "Hardened MCP Server",
    protocol: "JSON-RPC 2.0 / In-Process Channel",
    threats: [
      "Prompt injection attempting unauthorized tool execution",
      "Privilege escalation (standard employee invoking HR write tools)",
      "SQL injection or stacked queries via parameter fields",
      "Unilateral execution of high-risk actions (e.g., leave deduction, salary modify)"
    ],
    mitigations: [
      "Server-side RBAC authorization check (least-privilege scopes)",
      "Lexical security scanner rejecting SQL meta-characters (;, --, /*, DROP, UNION)",
      "Human-In-The-Loop (HITL) mandatory interrupt gate for write actions",
      "Cryptographic SHA-256 hash-chained tamper-evident audit logging"
    ]
  }
];

export const SECURITY_INVARIANTS: SecurityInvariant[] = [
  {
    id: "SEC-INV-01",
    title: "Server-Side Authorization Enforcement",
    rule: "The LLM never makes authorization decisions. All tool calls must be authenticated and authorized against server-side session identity.",
    enforcedAt: "MCP"
  },
  {
    id: "SEC-INV-02",
    title: "Zero Direct SQL Exposure",
    rule: "MCP tools only expose granular, strongly typed domain operations. Raw SQL execution or concatenation is forbidden.",
    enforcedAt: "MCP"
  },
  {
    id: "SEC-INV-03",
    title: "Mandatory HITL Gate for Sensitive Mutations",
    rule: "Any tool classified as high-impact (e.g. hr:write) cannot execute without an explicit, verifiable human approval token.",
    enforcedAt: "MCP"
  },
  {
    id: "SEC-INV-04",
    title: "Tamper-Evident Audit Logging",
    rule: "Every MCP tool invocation (allowed, denied, or pending) must append a cryptographically linked SHA-256 hash chain record.",
    enforcedAt: "MCP"
  },
  {
    id: "SEC-INV-05",
    title: "Hard Budget Caps",
    rule: "Workflows must abort immediately if step count, tool count, cost budget, or deadline is exceeded.",
    enforcedAt: "LangGraph"
  }
];
