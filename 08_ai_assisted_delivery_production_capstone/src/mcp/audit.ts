import { createHash, randomUUID } from "node:crypto";
import type { AuditRecord } from "./types.js";

export class AuditLogger {
  private readonly records: AuditRecord[] = [];
  private lastHash = "0000000000000000000000000000000000000000000000000000000000000000";

  private hashData(data: string): string {
    return createHash("sha256").update(data).digest("hex");
  }

  log(params: {
    userId: string;
    tenantId: string;
    tool: string;
    parameters: unknown;
    status: AuditRecord["status"];
    reason?: string | undefined;
  }): AuditRecord {
    const id = randomUUID();
    const timestamp = new Date().toISOString();
    const parametersHash = this.hashData(JSON.stringify(params.parameters ?? {}));

    const rawPayload = `${this.lastHash}|${id}|${timestamp}|${params.userId}|${params.tenantId}|${params.tool}|${parametersHash}|${params.status}|${params.reason ?? ""}`;
    const currentHash = this.hashData(rawPayload);

    const record: AuditRecord = {
      id,
      timestamp,
      previousHash: this.lastHash,
      currentHash,
      userId: params.userId,
      tenantId: params.tenantId,
      tool: params.tool,
      parametersHash,
      status: params.status,
      ...(params.reason ? { reason: params.reason } : {})
    };

    this.records.push(record);
    this.lastHash = currentHash;
    return record;
  }

  verifyChain(): { isValid: boolean; brokenAt?: number } {
    let prevHash = "0000000000000000000000000000000000000000000000000000000000000000";

    for (let i = 0; i < this.records.length; i++) {
      const record = this.records[i];
      if (!record) continue;

      if (record.previousHash !== prevHash) {
        return { isValid: false, brokenAt: i };
      }

      const expectedPayload = `${record.previousHash}|${record.id}|${record.timestamp}|${record.userId}|${record.tenantId}|${record.tool}|${record.parametersHash}|${record.status}|${record.reason ?? ""}`;
      const recomputedHash = this.hashData(expectedPayload);

      if (recomputedHash !== record.currentHash) {
        return { isValid: false, brokenAt: i };
      }

      prevHash = record.currentHash;
    }

    return { isValid: true };
  }

  getRecords(): readonly AuditRecord[] {
    return this.records;
  }

  getRecordCount(): number {
    return this.records.length;
  }
}
