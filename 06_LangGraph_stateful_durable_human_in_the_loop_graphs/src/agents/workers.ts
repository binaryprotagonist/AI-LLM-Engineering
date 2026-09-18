// ============================================================================
// SPECIALIST WORKER NODES — Simulated Multi-Agent Workers
// ============================================================================
// These are the "specialist agents" from the Day-4 port:
//   - Research Worker: gathers data
//   - Analysis Worker: processes data into insights
//   - Summary Worker: produces final summary
//
// All deterministic (no LLM calls) for testability.
// ============================================================================

import type { WorkflowStateType } from "../graph/state.js";

// ============================================================================
// Research Worker
// ============================================================================
export function researchWorker(
  state: WorkflowStateType
): Partial<WorkflowStateType> {
  const findings = `Research on "${state.task}": Found 3 relevant papers, 2 datasets, and 5 case studies.`;

  console.log(`  [ResearchWorker] ${findings}`);

  return {
    workerResults: [findings],
    messages: [`[researchWorker] Completed research for: ${state.task}`],
    totalCost: 0.08,
  };
}

// ============================================================================
// Analysis Worker
// ============================================================================
export function analysisWorker(
  state: WorkflowStateType
): Partial<WorkflowStateType> {
  const analysis = `Analysis of "${state.task}": Identified 3 key trends, 2 risks, and 1 opportunity.`;

  console.log(`  [AnalysisWorker] ${analysis}`);

  return {
    workerResults: [analysis],
    messages: [`[analysisWorker] Completed analysis for: ${state.task}`],
    totalCost: 0.06,
  };
}

// ============================================================================
// Summary Worker
// ============================================================================
export function summaryWorker(
  state: WorkflowStateType
): Partial<WorkflowStateType> {
  const summary = `Summary of "${state.task}": Key findings synthesized into actionable recommendations.`;

  console.log(`  [SummaryWorker] ${summary}`);

  return {
    workerResults: [summary],
    messages: [`[summaryWorker] Completed summary for: ${state.task}`],
    totalCost: 0.04,
  };
}
