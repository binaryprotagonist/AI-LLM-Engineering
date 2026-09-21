// ============================================================================
// AUDIT LOGGER & CRYPTOGRAPHIC TAMPER-EVIDENT TRAIL
// ============================================================================
// Append-only audit logger capturing 100% of MCP tool calls, parameter payloads,
// security verdicts, latencies, and row counts in a SHA-256 hash-chain.
// ============================================================================

import { createHash, randomUUID } from "node:crypto";
import { AuditLogEntry } from "../protocol.js";

export class SecurityAuditLogger {
  private logTrail: AuditLogEntry[] = [];
  private lastHash: string = "0000000000000000000000000000000000000000000000000000000000000000";

  /**
   * Records an audit entry and updates the cryptographic hash chain.
   */
  public log(entryData: Omit<AuditLogEntry, "id" | "timestamp" | "previousHash" | "hash">): AuditLogEntry {
    const id = randomUUID();
    const timestamp = new Date().toISOString();
    const previousHash = this.lastHash;

    const payloadToHash = JSON.stringify({
      id,
      timestamp,
      clientId: entryData.clientId,
      clientName: entryData.clientName,
      toolName: entryData.toolName,
      params: entryData.params,
      verdict: entryData.verdict,
      reason: entryData.reason,
      latencyMs: entryData.latencyMs,
      rowCount: entryData.rowCount,
      previousHash,
    });

    const hash = createHash("sha256").update(payloadToHash).digest("hex");

    const fullEntry: AuditLogEntry = {
      ...entryData,
      id,
      timestamp,
      previousHash,
      hash,
    };

    this.logTrail.push(fullEntry);
    this.lastHash = hash;

    return fullEntry;
  }

  /**
   * Verifies the cryptographic integrity of the entire audit chain.
   */
  public verifyIntegrity(): { valid: boolean; totalEntries: number; brokenIndex?: number } {
    let expectedPreviousHash = "0000000000000000000000000000000000000000000000000000000000000000";

    for (let i = 0; i < this.logTrail.length; i++) {
      const entry = this.logTrail[i];

      if (entry.previousHash !== expectedPreviousHash) {
        return { valid: false, totalEntries: this.logTrail.length, brokenIndex: i };
      }

      const payloadToHash = JSON.stringify({
        id: entry.id,
        timestamp: entry.timestamp,
        clientId: entry.clientId,
        clientName: entry.clientName,
        toolName: entry.toolName,
        params: entry.params,
        verdict: entry.verdict,
        reason: entry.reason,
        latencyMs: entry.latencyMs,
        rowCount: entry.rowCount,
        previousHash: entry.previousHash,
      });

      const recomputedHash = createHash("sha256").update(payloadToHash).digest("hex");
      if (recomputedHash !== entry.hash) {
        return { valid: false, totalEntries: this.logTrail.length, brokenIndex: i };
      }

      expectedPreviousHash = entry.hash;
    }

    return { valid: true, totalEntries: this.logTrail.length };
  }

  public getEntries(): AuditLogEntry[] {
    return [...this.logTrail];
  }

  public getEntriesByClient(clientId: string): AuditLogEntry[] {
    return this.logTrail.filter((e) => e.clientId === clientId);
  }

  public getVerdictCounts(): Record<string, number> {
    const counts: Record<string, number> = {};
    for (const entry of this.logTrail) {
      counts[entry.verdict] = (counts[entry.verdict] || 0) + 1;
    }
    return counts;
  }

  public clear(): void {
    this.logTrail = [];
    this.lastHash = "0000000000000000000000000000000000000000000000000000000000000000";
  }
}
