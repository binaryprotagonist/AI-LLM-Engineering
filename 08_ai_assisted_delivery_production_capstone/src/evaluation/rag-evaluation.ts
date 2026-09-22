import type { RAGResult } from "../rag/types.js";

export interface RAGEvaluationCase {
  query: string;
  expectedDocumentIds: string[];
}

export interface RAGEvaluationResult {
  query: string;
  recallAtK: number;
  precisionAtK: number;
  reciprocalRank: number;
  retrievedDocumentIds: string[];
  expectedDocumentIds: string[];
}

export function evaluateRAGCase(
  result: RAGResult,
  testCase: RAGEvaluationCase
): RAGEvaluationResult {
  const retrievedIds = result.results.map(
    (item) => item.chunk.documentId
  );

  const expectedIds = new Set(
    testCase.expectedDocumentIds
  );

  const matchedUnique = new Set(retrievedIds.filter((id) => expectedIds.has(id)));

  const recall =
    expectedIds.size === 0
      ? 1
      : Math.min(1, matchedUnique.size / expectedIds.size);

  const uniqueRetrieved = new Set(retrievedIds);
  const precision =
    uniqueRetrieved.size === 0
      ? 0
      : matchedUnique.size / uniqueRetrieved.size;

  let reciprocalRank = 0;
  for (let rank = 0; rank < retrievedIds.length; rank++) {
    const docId = retrievedIds[rank];
    if (docId && expectedIds.has(docId)) {
      reciprocalRank = 1 / (rank + 1);
      break;
    }
  }

  return {
    query: testCase.query,
    recallAtK: recall,
    precisionAtK: precision,
    reciprocalRank,
    retrievedDocumentIds: retrievedIds,
    expectedDocumentIds: testCase.expectedDocumentIds,
  };
}

// Preserve backward-compatible alias
export const evaluateRecallAtK = evaluateRAGCase;