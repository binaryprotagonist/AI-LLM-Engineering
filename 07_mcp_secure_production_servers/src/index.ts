// ============================================================================
// MAIN DEMO: DAY 07 — HARDENED MCP SERVER & AGENT INTEGRATION
// ============================================================================
// Demonstrates:
// 1. MCP Capability Negotiation (tools, resources, prompts)
// 2. AuthN/Z & Least-Privilege Scoping
// 3. Multi-layer SQL Injection Defense
// 4. Rate Limiting & Audit Logging
// 5. LangGraph Agent Client Integration with Safety Boundary
// ============================================================================

import { HardenedMcpServer } from "./server/server.js";
import { SecureMcpClient } from "./client/mcp_client.js";
import { createAgentWorkflow } from "./agent/langgraph_agent.js";

async function main() {
  console.log("================================================================================");
  console.log("      DAY 07: MCP — BUILDING SECURE, PRODUCTION SERVERS");
  console.log("================================================================================\n");

  // 1. Initialize Server & Client
  console.log("--- 1. Initializing Hardened MCP Server & Connecting Client ---");
  const server = new HardenedMcpServer(true);
  const client = new SecureMcpClient("demo-analyst-agent");
  await client.connect(server, "mcp_token_analyst_sec789");
  console.log("✓ Linked in-memory transport established with capability negotiation.\n");

  // 2. Discover Tools, Resources & Prompts
  console.log("--- 2. MCP Capability Discovery ---");
  const tools = await client.listTools();
  console.log(`Discovered ${tools.length} Tools:`);
  for (const t of tools) {
    console.log(`  • [Tool] ${t.name}: ${t.description}`);
  }

  const resources = await client.listResources();
  console.log(`\nDiscovered ${resources.length} Resources:`);
  for (const r of resources) {
    console.log(`  • [Resource] ${r.uri} (${r.name})`);
  }
  console.log();

  // 3. Read Resource
  console.log("--- 3. Reading Resource (system://health) ---");
  const healthContent = await client.readResource("system://health");
  console.log("Health Payload:\n" + healthContent + "\n");

  // 4. Executing Authorized SQL Tool
  console.log("--- 4. Authorized Tool Execution (query_database) ---");
  const queryResult = await client.callTool("query_database", {
    query: "SELECT id, name, category, price FROM products WHERE category = ?",
    params: ["hardware"],
  });
  console.log("Query Response Data:\n" + JSON.stringify(queryResult.parsedData, null, 2) + "\n");

  // 5. Demonstrating Security Defenses: SQL Injection Rejection
  console.log("--- 5. Security Defense: Blocking SQL Injection ---");
  const attackQuery = "SELECT * FROM products WHERE sku = 'SRV-RACK-01' OR 1=1; DROP TABLE orders; --";
  console.log(`Sending Malicious SQL Payload:\n  "${attackQuery}"`);
  const attackResult = await client.callTool("query_database", { query: attackQuery });
  console.log(`Attack Rejected: ${attackResult.isError}`);
  console.log(`Server Response:\n${attackResult.content}\n`);

  // 6. Demonstrating Security Defenses: Scope Enforcement
  console.log("--- 6. Security Defense: Scope & Privilege Escalation Prevention ---");
  console.log("Client with minimal read scope attempting to call describe_schema...");
  const scopeResult = await client.callTool(
    "describe_schema",
    {},
    "mcp_token_readonly_min123" // only has db:read, lacks db:schema
  );
  console.log(`Privilege Escalation Blocked: ${scopeResult.isError}`);
  console.log(`Server Response:\n${scopeResult.content}\n`);

  // 7. LangGraph Agent Client Integration
  console.log("--- 7. LangGraph Agent Integration & Safety Containment ---");
  const agentWorkflow = createAgentWorkflow(client);
  const legitimateTask = "Please retrieve recent orders placed for customer 1";
  console.log(`Submitting User Task: "${legitimateTask}"`);
  const agentResponse = await agentWorkflow.invoke(
    { query: legitimateTask },
    { configurable: { thread_id: "demo_thread_01" } }
  );
  console.log(`Agent Final Answer:\n${agentResponse.finalAnswer}\n`);

  // 8. Audit Log Verification
  console.log("--- 8. Tamper-Evident Audit Trail Integrity ---");
  const integrity = server.auditLogger.verifyIntegrity();
  console.log(`Total Audit Records: ${integrity.totalEntries}`);
  console.log(`SHA-256 Hash Chain Intact: ${integrity.valid}`);
  console.log("Verdict Distribution:", server.auditLogger.getVerdictCounts());

  await client.close();
  server.close();
  console.log("\nDemo completed successfully!");
}

main().catch((err) => {
  console.error("Demo failed:", err);
  process.exit(1);
});
