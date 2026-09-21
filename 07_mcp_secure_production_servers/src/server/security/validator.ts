// ============================================================================
// SQL INPUT VALIDATOR & SECURITY ANALYZER
// ============================================================================
// Multi-layered defense preventing SQL injection, AST manipulation,
// stacked execution, comment truncation, and unauthorized table access.
// ============================================================================

import { z } from "zod";

export const QueryDatabaseInputSchema = z.object({
  query: z
    .string()
    .min(5, "Query must be at least 5 characters")
    .max(1000, "Query exceeds max length of 1000 characters"),
  params: z
    .array(z.union([z.string(), z.number(), z.boolean()]))
    .max(20, "Maximum 20 parameters allowed")
    .optional()
    .default([]),
  maxRows: z.number().int().min(1).max(100).optional().default(50),
});

export type QueryDatabaseInput = z.infer<typeof QueryDatabaseInputSchema>;

export interface ValidationResult {
  valid: boolean;
  normalizedQuery: string;
  violations: string[];
}

export class SqlSecurityValidator {
  private static readonly WHITELISTED_TABLES = new Set([
    "customers",
    "products",
    "orders",
    "system_metrics",
  ]);

  private static readonly RESTRICTED_TABLES = new Set([
    "restricted_vault",
    "sqlite_master",
    "sqlite_sequence",
    "sqlite_temp_master",
  ]);

  private static readonly FORBIDDEN_KEYWORDS = [
    /\bDROP\b/i,
    /\bDELETE\b/i,
    /\bINSERT\b/i,
    /\bUPDATE\b/i,
    /\bALTER\b/i,
    /\bCREATE\b/i,
    /\bTRUNCATE\b/i,
    /\bREPLACE\b/i,
    /\bATTACH\b/i,
    /\bDETACH\b/i,
    /\bPRAGMA\b/i,
    /\bEXEC\b/i,
    /\bEXECUTE\b/i,
    /\bVACUUM\b/i,
    /\bGRANT\b/i,
    /\bREVOKE\b/i,
    /\bINTO\s+OUTFILE\b/i,
    /\bLOAD_FILE\b/i,
  ];

  private static readonly INJECTION_PATTERNS = [
    // Stacked queries
    /;/g,
    // SQL comments used for masking/truncating statements
    /--/g,
    /\/\*/g,
    /\*\//g,
    // Union-based data exfiltration
    /\bUNION\s+(ALL\s+)?SELECT\b/i,
    // Classic tautologies in raw query (should use parameterized bindings instead)
    /(?:WHERE|OR|AND)\s+['"]?([a-zA-Z0-9_]+)['"]?\s*=\s*['"]?\1['"]?/i,
    /\b(?:WHERE|OR|AND)\s+true\b/i,
    /\b(?:OR|AND)\s+['"]?1['"]?\s*=\s*['"]?2['"]?/i,
    // Time-based blind injection primitives
    /\brandomblob\s*\(/i,
    /\bzeroblob\s*\(/i,
    /\bhex\s*\(/i,
  ];

  /**
   * Validate and analyze a SQL query for safety.
   * @param query Raw SQL query string
   * @param hasAdminScope Whether caller possesses admin:all scope
   */
  public static validate(query: string, hasAdminScope: boolean = false): ValidationResult {
    const violations: string[] = [];
    const trimmed = query.trim();

    // 1. Must strictly start with SELECT
    if (!/^SELECT\s+/i.test(trimmed)) {
      violations.push("Query must begin with a read-only SELECT statement.");
    }

    // 2. Check for stacked queries (semicolon separator)
    if (trimmed.includes(";")) {
      // Semicolon allowed ONLY if it is the very last trailing character
      const withoutTrailingSemicolon = trimmed.replace(/;+\s*$/, "");
      if (withoutTrailingSemicolon.includes(";")) {
        violations.push("Stacked queries or multiple statements are strictly forbidden.");
      }
    }

    // 3. Check for SQL comments (frequent injection vector)
    if (/--|\/\*|\*\//.test(trimmed)) {
      violations.push("SQL comments (-- or /* */) are prohibited to prevent query truncation attacks.");
    }

    // 4. Check forbidden DDL / DML / Admin keywords
    for (const pattern of SqlSecurityValidator.FORBIDDEN_KEYWORDS) {
      if (pattern.test(trimmed)) {
        violations.push(`Forbidden command keyword detected: ${pattern.source.replace(/\\b/g, "")}`);
      }
    }

    // 5. Check injection patterns
    for (const pattern of SqlSecurityValidator.INJECTION_PATTERNS) {
      if (pattern.test(trimmed)) {
        violations.push(`Malicious injection pattern detected: ${pattern.source}`);
      }
    }

    // 6. Table access check & whitelisting
    // Extract table names following FROM or JOIN
    const fromMatches = trimmed.matchAll(/\b(?:FROM|JOIN)\s+([a-zA-Z0-9_"]+)/gi);
    for (const match of fromMatches) {
      const rawTableName = match[1].replace(/["`]/g, "").toLowerCase();

      if (SqlSecurityValidator.RESTRICTED_TABLES.has(rawTableName)) {
        if (!hasAdminScope) {
          violations.push(`Access to restricted internal table '${rawTableName}' requires admin:all scope.`);
        }
      } else if (!SqlSecurityValidator.WHITELISTED_TABLES.has(rawTableName)) {
        violations.push(`Table '${rawTableName}' is not in the allowed schema whitelist.`);
      }
    }

    return {
      valid: violations.length === 0,
      normalizedQuery: trimmed,
      violations,
    };
  }
}
