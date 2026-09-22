import {
  END,
  START,
  StateGraph,
} from "@langchain/langgraph";

import { GraphState } from "./state.js";
import { supervisorNode } from "./supervisor.js";
import { routeFromSupervisor } from "./router.js";

import { ragAgentNode } from "../agents/rag-agent.js";
import { analysisAgentNode } from "../agents/analysis-agent.js";
import { mcpAgentNode } from "../agents/mcp-agent.js";
import { budgetGuardNode } from "./budget-node.js";
import { hitlGateNode, routeAfterMCP } from "./hitl-node.js";

export function createWorkflow() {
  const workflow = new StateGraph(GraphState)

    .addNode("supervisor", supervisorNode)

    .addNode("budget_guard", budgetGuardNode)

    .addNode("rag", ragAgentNode)

    .addNode("analysis", analysisAgentNode)

    .addNode("mcp", mcpAgentNode)

    .addNode("hitl_gate", hitlGateNode)

    .addEdge(START, "supervisor")

    .addEdge("supervisor", "budget_guard")

    .addConditionalEdges("budget_guard", routeFromSupervisor, {
      rag: "rag",
      analysis: "analysis",
      mcp: "mcp",
      budget_failed: END,
    })

    .addEdge("rag", END)

    .addEdge("analysis", END)

    .addConditionalEdges("mcp", routeAfterMCP, {
      hitl_gate: "hitl_gate",
      end: END,
    })

    .addEdge("hitl_gate", END);

  return workflow.compile();
}