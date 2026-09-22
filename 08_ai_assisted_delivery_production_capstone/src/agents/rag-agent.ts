import { runRAG } from "../rag/pipeline.js";
import type { GraphStateType } from "../graph/state.js";
import { logEvent } from "../observability/logger.js";

export function ragAgentNode(
  state: GraphStateType
): Partial<GraphStateType> {
  const start = Date.now();
  const ragResult = runRAG(
    state.question,
    state.tenantId
  );

  const durationMs = Date.now() - start;

  if (ragResult.results.length === 0) {
    const tokens = Math.ceil(state.question.length / 4);
    const cost = tokens * 0.000002;

    logEvent({
      requestId: state.requestId,
      traceId: state.traceId,
      operation: "agent.rag",
      durationMs,
      status: "success",
      metadata: { resultsCount: 0 }
    });

    return {
      status: "completed",
      answer: "I could not find relevant information in the available knowledge base for your tenant.",
      stepsUsed: 1,
      tokensUsed: tokens,
      estimatedCostUsd: cost,
    };
  }

  const sourceText = ragResult.sources
    .map((source) => `• [${source.title}] (Doc ID: ${source.documentId}, Relevance Score: ${source.score.toFixed(3)})`)
    .join("\n");

  const totalContent = `${state.question}\n${ragResult.context}`;
  const tokens = Math.ceil(totalContent.length / 4);
  const cost = tokens * 0.000002;

  logEvent({
    requestId: state.requestId,
    traceId: state.traceId,
    operation: "agent.rag",
    durationMs,
    status: "success",
    metadata: {
      resultsCount: ragResult.results.length,
      topChunkId: ragResult.results[0]?.chunk.id
    }
  });

  return {
    status: "completed",
    answer:
      `Retrieved ${ragResult.results.length} relevant internal document(s):\n\n` +
      `${ragResult.context}\n\n` +
      `Validated Sources:\n${sourceText}`,
    stepsUsed: 1,
    tokensUsed: tokens,
    estimatedCostUsd: cost,
  };
}