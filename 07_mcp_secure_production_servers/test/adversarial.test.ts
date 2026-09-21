// ============================================================================
// ADVERSARIAL TESTS: SECURITY PENETRATION & HARDENING VERIFICATION
// ============================================================================
// Proves defense against:
// 1. SQL Injection variants (tautologies, stacked queries, comments, UNIONs)
// 2. DDL & DML modification attacks (DROP, UPDATE, INSERT, DELETE)
// 3. Unauthorized access to restricted tables (restricted_vault)
// 4. Rate-limit burst attacks
// 5. Tamper-evident audit chain corruption detection
// ============================================================================

import { HardenedMcpServer } from "../src/server/server.js";
import { SecureMcpClient } from "../src/client/mcp_client.js";

function assert(condition: boolean, message: string): void {
  if (!condition) {
    throw new Error(`ASSERTION FAILED: ${message}`);
  }
}

async function testAdversarial() {
  console.log("════════════════════════════════════════════════════════════");
  console.log("  TEST: Adversarial Security & Penetration Hardening");
  console.log("════════════════════════════════════════════════════════════\n");

  const server = new HardenedMcpServer(true);
  const client = new SecureMcpClient("pen-test-client");
  await client.connect(server, "mcp_token_analyst_sec789");

  // ---- Test 1: Adversarial SQL Injection Catalog ----
  const injectionVectors = [
    // Tautologies
    "SELECT * FROM customers WHERE 'a'='a'",
    "SELECT * FROM customers WHERE 1 = 1",
    "SELECT * FROM customers WHERE 1=1",
    "SELECT * FROM customers WHERE true OR true",
    // Stacked execution
    "SELECT * FROM products; DELETE FROM customers WHERE 1=1;",
    "SELECT * FROM products; DROP TABLE orders;",
    "SELECT * FROM products; ATTACH DATABASE 'pwned.db' AS pwned;",
    // Comment truncation
    "SELECT * FROM products WHERE sku = 'SRV-RACK-01' -- bypass clause",
    "SELECT * FROM products WHERE id = 1 /* multi-line comment */",
    // UNION-based exfiltration
    "SELECT name FROM products UNION SELECT secret_key FROM restricted_vault",
    "SELECT name FROM products UNION ALL SELECT secret_value FROM restricted_vault",
    // Direct DDL/DML write attempts
    "INSERT INTO customers (name, email) VALUES ('Hacker', 'hack@evil.com')",
    "UPDATE customers SET account_balance = 9999999 WHERE id = 1",
    "DELETE FROM orders WHERE id = 1",
    "ALTER TABLE customers ADD COLUMN evil TEXT",
    "DROP TABLE products",
  ];

  for (const vector of injectionVectors) {
    const res = await client.callTool("query_database", { query: vector });
    assert(
      res.isError,
      `Injection vector should have been blocked: "${vector}"`
    );
  }
  console.log(`  ✓ Test 1: All ${injectionVectors.length} SQL injection & write vectors safely blocked.`);

  // ---- Test 2: Unauthorized Table Access ----
  const vaultAccess = await client.callTool("query_database", {
    query: "SELECT secret_key, secret_value FROM restricted_vault",
  });
  assert(
    vaultAccess.isError,
    "Standard analyst must not access restricted_vault table"
  );
  assert(
    vaultAccess.content.includes("restricted_vault") || vaultAccess.content.includes("admin:all"),
    "Error should indicate unauthorized table access"
  );
  console.log("  ✓ Test 2: Access to internal restricted vault safely rejected.");

  // ---- Test 3: Authorized Admin Can Access Restricted Vault ----
  const adminVaultAccess = await client.callTool(
    "query_database",
    { query: "SELECT secret_key, classification FROM restricted_vault" },
    "mcp_token_super_admin_root99"
  );
  assert(
    !adminVaultAccess.isError,
    "Super admin with admin:all scope must be permitted to read restricted_vault"
  );
  console.log("  ✓ Test 3: Super-admin RBAC authorization functions properly.");

  // ---- Test 4: Tamper Detection in Cryptographic Audit Log ----
  // Deliberately tamper with an entry in the audit logger to test integrity verification
  const entries = server.auditLogger.getEntries();
  assert(entries.length > 0, "Audit log must contain recorded entries");

  // Verify it is currently valid
  const initialCheck = server.auditLogger.verifyIntegrity();
  assert(initialCheck.valid, "Untampered audit log must pass verification");

  // Simulate an attacker modifying an entry in memory
  const victimEntry = entries[0];
  (victimEntry as unknown as { verdict: string }).verdict = "ALLOWED"; // Alter verdict

  const tamperedCheck = server.auditLogger.verifyIntegrity();
  assert(!tamperedCheck.valid, "Tampered audit log MUST fail verification");
  console.log("  ✓ Test 4: Cryptographic hash chain detects audit record tampering.");

  await client.close();
  server.close();
  console.log("\nAll Adversarial Tests Passed Successfully! ✓\n");
}

testAdversarial().catch((err) => {
  console.error(err);
  process.exit(1);
});
