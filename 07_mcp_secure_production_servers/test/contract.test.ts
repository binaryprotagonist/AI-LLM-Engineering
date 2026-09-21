// ============================================================================
// CONTRACT TESTS: MCP SERVER INDEPENDENT OF MODEL
// ============================================================================
// Proves protocol correctness, capability negotiation, schema conformity,
// and resource handling independently of any LLM model.
// ============================================================================

import { HardenedMcpServer } from "../src/server/server.js";
import { SecureMcpClient } from "../src/client/mcp_client.js";

function assert(condition: boolean, message: string): void {
  if (!condition) {
    throw new Error(`ASSERTION FAILED: ${message}`);
  }
}

async function testContract() {
  console.log("════════════════════════════════════════════════════════════");
  console.log("  TEST: MCP Server Contract Compliance");
  console.log("════════════════════════════════════════════════════════════\n");

  const server = new HardenedMcpServer(true);
  const client = new SecureMcpClient("contract-tester");
  await client.connect(server, "mcp_token_analyst_sec789");

  // ---- Test 1: Tool Discovery & Protocol Schema ----
  const tools = await client.listTools();
  assert(tools.length >= 3, `Expected at least 3 tools, got ${tools.length}`);

  const toolNames = tools.map((t) => t.name);
  assert(toolNames.includes("query_database"), "Missing query_database tool");
  assert(toolNames.includes("describe_schema"), "Missing describe_schema tool");
  assert(toolNames.includes("get_system_metrics"), "Missing get_system_metrics tool");

  const queryTool = tools.find((t) => t.name === "query_database");
  assert(
    typeof queryTool?.inputSchema === "object" && queryTool?.inputSchema !== null,
    "query_database must provide a valid JSON input schema"
  );
  console.log("  ✓ Test 1: Tool capability discovery complies with MCP schema");

  // ---- Test 2: Resource Discovery & Read ----
  const resources = await client.listResources();
  assert(resources.length >= 2, `Expected at least 2 resources, got ${resources.length}`);

  const healthRes = await client.readResource("system://health");
  const healthData = JSON.parse(healthRes);
  assert(healthData.status === "healthy", "Health resource must indicate healthy");
  assert(typeof healthData.uptimeSeconds === "number", "Health resource must have uptime");

  const catalogRes = await client.readResource("schema://catalog");
  const catalogData = JSON.parse(catalogRes);
  assert(Array.isArray(catalogData), "Catalog resource must return array of tables");
  const tableNames = catalogData.map((t: { table: string }) => t.table);
  assert(tableNames.includes("customers"), "Catalog should include customers");
  assert(!tableNames.includes("restricted_vault"), "Catalog must not expose restricted_vault");
  console.log("  ✓ Test 2: Resource templates and reads comply with contract");

  // ---- Test 3: Parameter Validation Contract ----
  // Passing empty string for query should violate min length 5
  const invalidCall = await client.callTool("query_database", { query: "" });
  assert(invalidCall.isError, "Invalid parameters should return an error result");
  assert(
    invalidCall.content.includes("Invalid parameters") || invalidCall.content.includes("too_small"),
    "Should specify schema parameter violation"
  );
  console.log("  ✓ Test 3: Input schema validation rejects malformed parameters");

  // ---- Test 4: Describe Schema Tool Contract ----
  const schemaCall = await client.callTool("describe_schema", {});
  assert(!schemaCall.isError, "describe_schema should execute successfully for analyst");
  assert(Array.isArray(schemaCall.parsedData), "describe_schema must return array of tables");
  console.log("  ✓ Test 4: Schema inspection adheres to contract");

  await client.close();
  server.close();
  console.log("\nAll Contract Tests Passed Successfully! ✓\n");
}

testContract().catch((err) => {
  console.error(err);
  process.exit(1);
});
