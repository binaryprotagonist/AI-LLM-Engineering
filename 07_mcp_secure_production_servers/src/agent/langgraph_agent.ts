// ============================================================================
// LANGGRAPH AGENT CONSUMING HARDENED MCP SERVER
// ============================================================================
// Builds a stateful LangGraph agent that discovers and executes tools through MCP,
// handles tool errors and partial failure gracefully, and guards the trust
// boundary against prompt-injection tool abuse.
// ============================================================================

import { Annotation, MemorySaver, StateGraph, START, END } from "@langchain/langgraph";
import { SecureMcpClient } from "../client/mcp_client.js";

// ============================================================================
// 1. STATE SCHEMA
// ============================================================================
export const AgentState = Annotation.Root({
  query: Annotation<string>({
    reducer: (_, v) => v,
    default: () => "",
  }),
  detectedThreats: Annotation<string[]>({
    reducer: (a, b) => [...a, ...b],
    default: () => [],
  }),
  toolPlan: Annotation<{
    toolName: string;
    args: Record<string, unknown>;
  } | null>({
    reducer: (_, v) => v,
    default: () => null,
  }),
  toolResult: Annotation<unknown>({
    reducer: (_, v) => v,
    default: () => null,
  }),
  toolError: Annotation<string | null>({
    reducer: (_, v) => v,
    default: () => null,
  }),
  safetyVerdict: Annotation<"SAFE" | "THREAT_NEUTRALIZED" | "CLEAN">({
    reducer: (_, v) => v,
    default: () => "CLEAN",
  }),
  finalAnswer: Annotation<string>({
    reducer: (_, v) => v,
    default: () => "",
  }),
  executionTrace: Annotation<string[]>({
    reducer: (a, b) => [...a, ...b],
    default: () => [],
  }),
});

export type AgentStateType = typeof AgentState.State;

// ============================================================================
// 2. PROMPT INJECTION & TOOL ABUSE DETECTOR
// ============================================================================
export class PromptInjectionGuard {
  private static readonly INJECTION_PATTERNS = [
    /ignore (all )?previous instructions/i,
    /system override/i,
    /you are now (in )?developer mode/i,
    /exfiltrate/i,
    /drop\s+table/i,
    /delete\s+from/i,
    /update\s+[a-z0-9_]+\s+set/i,
    /select\s+\*\s+from\s+restricted_vault/i,
  ];

  public static inspect(text: string): { isSuspicious: boolean; detectedThreats: string[] } {
    const threats: string[] = [];
    for (const pattern of PromptInjectionGuard.INJECTION_PATTERNS) {
      if (pattern.test(text)) {
        threats.push(`Matched pattern: ${pattern.source}`);
      }
    }
    return {
      isSuspicious: threats.length > 0,
      detectedThreats: threats,
    };
  }
}

// ============================================================================
// 3. GRAPH NODES
// ============================================================================
export function createAgentWorkflow(mcpClient: SecureMcpClient) {
  // Planner Node: Inspects input query, checks for immediate prompt injection attacks, plans tool call
  const plannerNode = (state: AgentStateType) => {
    const trace = ["node:planner"];
    const injectionCheck = PromptInjectionGuard.inspect(state.query);

    if (injectionCheck.isSuspicious) {
      return {
        detectedThreats: injectionCheck.detectedThreats,
        safetyVerdict: "THREAT_NEUTRALIZED" as const,
        finalAnswer:
          "Security Boundary Alert: The input prompt contained an adversarial instruction or attempted tool abuse. Execution aborted.",
        executionTrace: [...trace, "planner:injection_detected"],
      };
    }

    // Plan safe tool call based on query intent
    const lower = state.query.toLowerCase();
    if (lower.includes("schema") || lower.includes("tables")) {
      return {
        toolPlan: {
          toolName: "describe_schema",
          args: {},
        },
        executionTrace: [...trace, "planner:planned_describe_schema"],
      };
    }

    if (lower.includes("metrics") || lower.includes("cpu") || lower.includes("latency")) {
      return {
        toolPlan: {
          toolName: "get_system_metrics",
          args: {},
        },
        executionTrace: [...trace, "planner:planned_get_system_metrics"],
      };
    }

    if (lower.includes("order") || lower.includes("customer") || lower.includes("product")) {
      // Formulate parameterized read-only query
      let sql = "SELECT * FROM orders ORDER BY created_at DESC LIMIT 5";
      const params: Array<string | number> = [];

      if (lower.includes("customer")) {
        const idMatch = state.query.match(/customer\s+(?:id\s+)?(\d+)/i);
        if (idMatch) {
          sql = "SELECT * FROM orders WHERE customer_id = ? ORDER BY created_at DESC";
          params.push(parseInt(idMatch[1], 10));
        }
      }

      return {
        toolPlan: {
          toolName: "query_database",
          args: { query: sql, params },
        },
        executionTrace: [...trace, "planner:planned_query_database"],
      };
    }

    // Fallback default query
    return {
      toolPlan: {
        toolName: "query_database",
        args: { query: "SELECT * FROM products LIMIT 5", params: [] },
      },
      executionTrace: [...trace, "planner:planned_default_query"],
    };
  };

  // MCP Tool Execution Node: Calls MCP server and captures response or errors
  const mcpToolNode = async (state: AgentStateType) => {
    const trace = ["node:mcp_tool_execution"];
    if (!state.toolPlan) {
      return {
        executionTrace: [...trace, "mcp_tool:no_plan"],
      };
    }

    try {
      const result = await mcpClient.callTool(state.toolPlan.toolName, state.toolPlan.args);

      if (result.isError) {
        return {
          toolResult: null,
          toolError: result.content || "Unknown tool execution error",
          executionTrace: [...trace, `mcp_tool:error:${result.content}`],
        };
      }

      return {
        toolResult: result.parsedData,
        toolError: null,
        executionTrace: [...trace, "mcp_tool:success"],
      };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      return {
        toolResult: null,
        toolError: msg,
        executionTrace: [...trace, `mcp_tool:exception:${msg}`],
      };
    }
  };

  // Safety & Data Boundary Inspector: Protects against indirect prompt injection in retrieved DB data
  const dataSafetyNode = (state: AgentStateType) => {
    const trace = ["node:data_safety"];
    if (!state.toolResult) {
      return { executionTrace: trace };
    }

    const stringified = JSON.stringify(state.toolResult);
    const injectionCheck = PromptInjectionGuard.inspect(stringified);

    if (injectionCheck.isSuspicious) {
      return {
        detectedThreats: injectionCheck.detectedThreats,
        safetyVerdict: "THREAT_NEUTRALIZED" as const,
        finalAnswer:
          "Warning: Retrieved database payload contained indirect prompt injection markers. Data safely neutralized.",
        executionTrace: [...trace, "data_safety:indirect_injection_neutralized"],
      };
    }

    return {
      safetyVerdict: "SAFE" as const,
      executionTrace: [...trace, "data_safety:data_clean"],
    };
  };

  // Synthesizer Node: Produces the final answer for the user
  const synthesizerNode = (state: AgentStateType) => {
    const trace = ["node:synthesizer"];
    if (state.safetyVerdict === "THREAT_NEUTRALIZED") {
      return { executionTrace: trace };
    }

    if (state.toolError) {
      return {
        finalAnswer: `Graceful Recovery: Tool call encountered an error: ${state.toolError}. The agent continues safely without crashing.`,
        executionTrace: [...trace, "synthesizer:handled_error"],
      };
    }

    const formattedData = JSON.stringify(state.toolResult, null, 2);
    return {
      finalAnswer: `Task completed successfully via MCP tool '${state.toolPlan?.toolName}'. Result: ${formattedData}`,
      executionTrace: [...trace, "synthesizer:success"],
    };
  };

  // Routing conditions
  const routeAfterPlanner = (state: AgentStateType) => {
    if (state.safetyVerdict === "THREAT_NEUTRALIZED") {
      return END;
    }
    return "mcp_tool_execution";
  };

  const routeAfterSafety = (state: AgentStateType) => {
    if (state.safetyVerdict === "THREAT_NEUTRALIZED") {
      return END;
    }
    return "synthesizer";
  };

  // Build the graph
  const workflow = new StateGraph(AgentState)
    .addNode("planner", plannerNode)
    .addNode("mcp_tool_execution", mcpToolNode)
    .addNode("data_safety", dataSafetyNode)
    .addNode("synthesizer", synthesizerNode)
    .addEdge(START, "planner")
    .addConditionalEdges("planner", routeAfterPlanner)
    .addEdge("mcp_tool_execution", "data_safety")
    .addConditionalEdges("data_safety", routeAfterSafety)
    .addEdge("synthesizer", END);

  const checkpointer = new MemorySaver();
  return workflow.compile({ checkpointer });
}
