import { Annotation } from "@langchain/langgraph";
import type { PendingApproval, ApprovalDecision } from "../hitl/types.js";

export const GraphState = Annotation.Root({
  question: Annotation<string>,

  requestId: Annotation<string>,

  traceId: Annotation<string>,

  userId: Annotation<string>,

  tenantId: Annotation<string>,

  roles: Annotation<string[]>,

  route: Annotation<"rag" | "analysis" | "mcp" | "unknown">,

  answer: Annotation<string>,

  status: Annotation<"pending" | "running" | "completed" | "failed" | "interrupted">,

  stepsUsed: Annotation<number>({
    reducer: (existing, incoming) => existing + incoming,
    default: () => 0,
  }),

  toolCallsUsed: Annotation<number>({
    reducer: (existing, incoming) => existing + incoming,
    default: () => 0,
  }),

  tokensUsed: Annotation<number>({
    reducer: (existing, incoming) => existing + incoming,
    default: () => 0,
  }),

  estimatedCostUsd: Annotation<number>({
    reducer: (existing, incoming) => existing + incoming,
    default: () => 0,
  }),

  maxSteps: Annotation<number>,

  maxToolCalls: Annotation<number>,

  maxCostUsd: Annotation<number>,

  deadlineAt: Annotation<number>,

  budgetExceeded: Annotation<boolean>({
    reducer: (existing, incoming) => existing || incoming,
    default: () => false,
  }),

  hitlRequired: Annotation<boolean>({
    reducer: (existing, incoming) => existing || incoming,
    default: () => false,
  }),

  pendingApproval: Annotation<PendingApproval | null>({
    reducer: (_, incoming) => incoming,
    default: () => null,
  }),

  approvalDecision: Annotation<ApprovalDecision | null>({
    reducer: (_, incoming) => incoming,
    default: () => null,
  }),

  auditRecordIds: Annotation<string[]>({
    reducer: (existing, incoming) => [...existing, ...incoming],
    default: () => [],
  }),

  errors: Annotation<string[]>({
    reducer: (existing, incoming) => [
      ...existing,
      ...incoming,
    ],
    default: () => [],
  }),
});

export type GraphStateType = typeof GraphState.State;