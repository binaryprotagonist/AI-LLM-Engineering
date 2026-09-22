import { documents } from "./documents.js";
import { filterByTenant } from "./filters.js";
import { retrieveLexically } from "./retriever.js";
import { retrieveDense } from "./dense-retriever.js";
import { reciprocalRankFusion } from "./fusion.js";
import { rerank } from "./reranker.js";
import { logEvent } from "../observability/logger.js";
import type { RAGResult } from "./types.js";

export function runRAG(query: string, tenantId: string): RAGResult {
  const startAt = new Date();

  const tenantDocuments = filterByTenant(documents, tenantId);

  const denseResults = retrieveDense(query, tenantDocuments, 5);

  const lexicalResults = retrieveLexically(query, tenantDocuments, 5);

  const hybridResults = reciprocalRankFusion([denseResults, lexicalResults]);

  const finalResults = rerank(query, hybridResults, 3);

  const context = finalResults
    .map((result) => `[${result.chunk.title}]\n${result.chunk.content}`)
    .join("\n\n");

  const sources = finalResults.map((result) => ({
    chunkId: result.chunk.id,
    documentId: result.chunk.documentId,
    title: result.chunk.title,
    score: result.score,
  }));

  const durationMs = Date.now() - startAt.getTime();

  const metrics = {
    candidateCount: denseResults.length + lexicalResults.length,
    finalResultCount: finalResults.length,
    durationMs,
  };

  logEvent({
    operation: "rag.retrieve",
    durationMs,
    status: "success",
    metadata: {
      tenantId,
      candidateCount: hybridResults.length,
      finalResultCount: finalResults.length,
    },
  });

  return {
    query,
    results: finalResults,
    context,
    sources,
    metrics
  };
}