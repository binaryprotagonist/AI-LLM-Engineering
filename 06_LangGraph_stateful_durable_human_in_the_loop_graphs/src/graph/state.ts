// ============================================================================
// STATE DEFINITION — Typed State with Annotation API and Reducers
// ============================================================================
// LangGraph state is defined using Annotation.Root. Each field has a reducer
// that controls how partial updates from nodes are merged into the full state.
// This is the single source of truth for the entire graph's data model.
// ============================================================================

import { Annotation } from "@langchain/langgraph";

// ============================================================================
// State Schema
// ============================================================================

/**
 * WorkflowState — the full state schema for our durable multi-agent graph.
 *
 * Reducer semantics:
 *   - Last-Write-Wins: (_, v) => v — scalar fields replaced on each update
 *   - Append-Only: (a, b) => [...a, ...b] — arrays accumulate across nodes
 *   - Additive: (a, b) => a + b — numeric counters sum deltas
 */
export const WorkflowState = Annotation.Root({
  // ---- Core Task Fields ----

  /** The task description — what work needs to be done */
  task: Annotation<string>({
    reducer: (_, newVal) => newVal,
    default: () => "",
  }),

  /** The plan produced by the planner node */
  plan: Annotation<string>({
    reducer: (_, newVal) => newVal,
    default: () => "",
  }),

  /** Current workflow status */
  status: Annotation<string>({
    reducer: (_, newVal) => newVal,
    default: () => "pending",
  }),

  /** Final result from the workflow */
  result: Annotation<string>({
    reducer: (_, newVal) => newVal,
    default: () => "",
  }),

  // ---- Human-in-the-Loop Fields ----

  /** Name of the human approver (set on resume from interrupt) */
  approvedBy: Annotation<string>({
    reducer: (_, newVal) => newVal,
    default: () => "",
  }),

  // ---- Retry Cycle Fields ----

  /** Number of retry attempts (additive: each retry adds 1) */
  retryCount: Annotation<number>({
    reducer: (current, delta) => current + delta,
    default: () => 0,
  }),

  /** Reviewer feedback (last-write-wins — only latest feedback matters) */
  feedback: Annotation<string>({
    reducer: (_, newVal) => newVal,
    default: () => "",
  }),

  // ---- Map-Reduce Fields ----

  /** Worker results — append-only for fan-in aggregation */
  workerResults: Annotation<string[]>({
    reducer: (current, update) => [...current, ...update],
    default: () => [],
  }),

  // ---- Cost & Observability ----

  /** Accumulated cost (additive counter) */
  totalCost: Annotation<number>({
    reducer: (current, delta) => current + delta,
    default: () => 0,
  }),

  /** Maximum cost budget */
  maxBudget: Annotation<number>({
    reducer: (_, newVal) => newVal,
    default: () => 1.0,
  }),

  /** Append-only audit log — every node logs here */
  messages: Annotation<string[]>({
    reducer: (current, update) => [...current, ...update],
    default: () => [],
  }),

  /** Error message (if any) */
  error: Annotation<string>({
    reducer: (_, newVal) => newVal,
    default: () => "",
  }),
});

/** TypeScript type for the full state (used in node function signatures) */
export type WorkflowStateType = typeof WorkflowState.State;
