// ============================================================================
// PRODUCTION-GRADE SQL DATABASE (node:sqlite)
// ============================================================================
// Uses Node 22's built-in DatabaseSync for zero-external-binary SQLite.
// Includes schema setup, seeded demo data, and parameter-safe query runners.
// ============================================================================

import { DatabaseSync } from "node:sqlite";

export interface DatabaseRow {
  [column: string]: string | number | boolean | null;
}

export class ProductionDatabase {
  private db: DatabaseSync;

  constructor(inMemory: boolean = true, filePath?: string) {
    this.db = new DatabaseSync(inMemory ? ":memory:" : (filePath ?? "production.db"));
    this.initSchema();
    this.seedData();
  }

  private initSchema(): void {
    // 1. Customers table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS customers (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        email TEXT UNIQUE NOT NULL,
        tier TEXT CHECK(tier IN ('standard', 'premium', 'enterprise')) DEFAULT 'standard',
        account_balance REAL DEFAULT 0.0,
        created_at TEXT NOT NULL
      );
    `);

    // 2. Products table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS products (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        sku TEXT UNIQUE NOT NULL,
        name TEXT NOT NULL,
        category TEXT NOT NULL,
        price REAL NOT NULL,
        stock_count INTEGER NOT NULL DEFAULT 0
      );
    `);

    // 3. Orders table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS orders (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        customer_id INTEGER NOT NULL,
        product_id INTEGER NOT NULL,
        quantity INTEGER NOT NULL,
        total_amount REAL NOT NULL,
        status TEXT CHECK(status IN ('pending', 'processing', 'completed', 'cancelled')) DEFAULT 'pending',
        created_at TEXT NOT NULL,
        FOREIGN KEY (customer_id) REFERENCES customers(id),
        FOREIGN KEY (product_id) REFERENCES products(id)
      );
    `);

    // 4. System Metrics table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS system_metrics (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        metric_name TEXT NOT NULL,
        metric_value REAL NOT NULL,
        environment TEXT DEFAULT 'production',
        recorded_at TEXT NOT NULL
      );
    `);

    // 5. RESTRICTED VAULT (Sensitive table that requires admin:all privilege)
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS restricted_vault (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        secret_key TEXT UNIQUE NOT NULL,
        secret_value TEXT NOT NULL,
        classification TEXT DEFAULT 'TOP_SECRET',
        created_at TEXT NOT NULL
      );
    `);
  }

  private seedData(): void {
    // Seed Customers
    const insertCustomer = this.db.prepare(
      "INSERT OR IGNORE INTO customers (name, email, tier, account_balance, created_at) VALUES (?, ?, ?, ?, ?)"
    );
    insertCustomer.run("Alice Henderson", "alice@enterprise.corp", "enterprise", 14500.0, "2026-01-10T10:00:00Z");
    insertCustomer.run("Bob Vance", "bob@vance-refrig.com", "premium", 3200.5, "2026-02-14T11:30:00Z");
    insertCustomer.run("Charlie Kelly", "charlie@paddys.pub", "standard", 45.0, "2026-03-01T08:15:00Z");

    // Seed Products
    const insertProduct = this.db.prepare(
      "INSERT OR IGNORE INTO products (sku, name, category, price, stock_count) VALUES (?, ?, ?, ?, ?)"
    );
    insertProduct.run("SRV-RACK-01", "Enterprise Rack Server 2U", "hardware", 2499.99, 14);
    insertProduct.run("SW-LLM-ENT", "LLM Gateway License Annual", "software", 12000.0, 999);
    insertProduct.run("SEC-KEY-YUBI", "Hardware Security Key FIDO2", "security", 65.0, 250);

    // Seed Orders
    const insertOrder = this.db.prepare(
      "INSERT OR IGNORE INTO orders (customer_id, product_id, quantity, total_amount, status, created_at) VALUES (?, ?, ?, ?, ?, ?)"
    );
    insertOrder.run(1, 1, 2, 4999.98, "completed", "2026-03-10T14:20:00Z");
    insertOrder.run(1, 2, 1, 12000.0, "completed", "2026-03-12T09:15:00Z");
    insertOrder.run(2, 3, 5, 325.0, "processing", "2026-03-15T16:45:00Z");
    insertOrder.run(3, 3, 1, 65.0, "pending", "2026-03-20T12:00:00Z");

    // Seed System Metrics
    const insertMetric = this.db.prepare(
      "INSERT OR IGNORE INTO system_metrics (metric_name, metric_value, environment, recorded_at) VALUES (?, ?, ?, ?)"
    );
    insertMetric.run("api_p99_latency_ms", 18.4, "production", "2026-03-21T00:00:00Z");
    insertMetric.run("cpu_utilization_pct", 42.1, "production", "2026-03-21T00:00:00Z");
    insertMetric.run("active_db_connections", 6, "production", "2026-03-21T00:00:00Z");

    // Seed Restricted Vault (Secret tokens & keys)
    const insertVault = this.db.prepare(
      "INSERT OR IGNORE INTO restricted_vault (secret_key, secret_value, classification, created_at) VALUES (?, ?, ?, ?)"
    );
    insertVault.run("PROD_PAYMENT_GATEWAY_KEY", "sk_live_99f8d7c6b5a4_SECRET", "TOP_SECRET", "2026-01-01T00:00:00Z");
    insertVault.run("ROOT_DB_ENCRYPTION_SALT", "salt_0xDEADBEEFCAFE_SECRET", "CRITICAL", "2026-01-01T00:00:00Z");
  }

  /**
   * Execute a read-only query safely with parameter binding and max row boundary.
   */
  public query(sql: string, params: Array<string | number> = [], maxRows: number = 50): DatabaseRow[] {
    const stmt = this.db.prepare(sql);
    const results = stmt.all(...params) as DatabaseRow[];
    if (results.length > maxRows) {
      return results.slice(0, maxRows);
    }
    return results;
  }

  /**
   * Returns schema metadata for authorized tables.
   */
  public getSchema(includeRestricted: boolean = false): Array<{ table: string; columns: Array<{ name: string; type: string; notNull: boolean }> }> {
    const tablesQuery = includeRestricted
      ? "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'"
      : "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name != 'restricted_vault'";

    const tables = this.db.prepare(tablesQuery).all() as Array<{ name: string }>;
    const schemaDetails: Array<{ table: string; columns: Array<{ name: string; type: string; notNull: boolean }> }> = [];

    for (const { name } of tables) {
      const colInfo = this.db.prepare(`PRAGMA table_info("${name}")`).all() as Array<{
        name: string;
        type: string;
        notnull: number;
      }>;

      schemaDetails.push({
        table: name,
        columns: colInfo.map((c) => ({
          name: c.name,
          type: c.type,
          notNull: Boolean(c.notnull),
        })),
      });
    }

    return schemaDetails;
  }

  public close(): void {
    this.db.close();
  }
}
