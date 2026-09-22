export type ApprovalStatus = "pending" | "approved" | "edited" | "rejected";

export interface PendingApproval {
  id: string;
  requestId: string;
  action: string;
  target: string;
  parameters: Record<string, unknown>;
  requestedBy: {
    userId: string;
    tenantId: string;
    roles: string[];
  };
  createdAt: string;
  expiresAt: string;
  status: ApprovalStatus;
  reviewerNotes?: string;
  editedParameters?: Record<string, unknown>;
}

export interface ApprovalDecision {
  approvalId: string;
  decision: "approve" | "edit" | "reject";
  reviewerId: string;
  reviewerNotes?: string;
  editedParameters?: Record<string, unknown>;
}
