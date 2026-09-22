import { randomUUID } from "node:crypto";
import type { ApprovalDecision, PendingApproval } from "./types.js";

export class HITLApprovalManager {
  private readonly approvals = new Map<string, PendingApproval>();

  createApprovalRequest(params: {
    requestId: string;
    action: string;
    target: string;
    parameters: Record<string, unknown>;
    requestedBy: {
      userId: string;
      tenantId: string;
      roles: string[];
    };
    ttlMs?: number;
  }): PendingApproval {
    const id = `approval-${randomUUID()}`;
    const now = Date.now();
    const ttl = params.ttlMs ?? 15 * 60 * 1000; // 15 mins default

    const record: PendingApproval = {
      id,
      requestId: params.requestId,
      action: params.action,
      target: params.target,
      parameters: params.parameters,
      requestedBy: params.requestedBy,
      createdAt: new Date(now).toISOString(),
      expiresAt: new Date(now + ttl).toISOString(),
      status: "pending"
    };

    this.approvals.set(id, record);
    return { ...record };
  }

  getApproval(id: string): PendingApproval | null {
    const approval = this.approvals.get(id);
    if (!approval) return null;

    if (approval.status === "pending" && new Date(approval.expiresAt).getTime() < Date.now()) {
      approval.status = "rejected";
      approval.reviewerNotes = "Approval expired without human intervention";
    }

    return { ...approval };
  }

  resolveApproval(decision: ApprovalDecision): { success: boolean; approval?: PendingApproval; error?: string } {
    const approval = this.approvals.get(decision.approvalId);
    if (!approval) {
      return { success: false, error: `Approval '${decision.approvalId}' not found.` };
    }

    if (approval.status !== "pending") {
      return { success: false, error: `Approval is already resolved with status '${approval.status}'` };
    }

    if (new Date(approval.expiresAt).getTime() < Date.now()) {
      approval.status = "rejected";
      approval.reviewerNotes = "Expired before resolution";
      return { success: false, error: "Approval request has expired." };
    }

    if (decision.decision === "approve") {
      approval.status = "approved";
    } else if (decision.decision === "edit") {
      approval.status = "edited";
      approval.editedParameters = decision.editedParameters ?? approval.parameters;
    } else {
      approval.status = "rejected";
    }

    if (decision.reviewerNotes) {
      approval.reviewerNotes = decision.reviewerNotes;
    }

    return { success: true, approval: { ...approval } };
  }

  listPending(tenantId?: string): PendingApproval[] {
    return Array.from(this.approvals.values()).filter((a) => {
      const notExpired = new Date(a.expiresAt).getTime() >= Date.now();
      const tenantMatch = !tenantId || a.requestedBy.tenantId === tenantId;
      return a.status === "pending" && notExpired && tenantMatch;
    });
  }
}
