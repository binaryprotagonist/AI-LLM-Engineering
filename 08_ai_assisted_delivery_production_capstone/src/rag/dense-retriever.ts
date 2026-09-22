import type { DocumentChunk, RetrievalResult } from "./types.js";

function similarity(query: string, content: string): number {
 
  const queryWords = new Set(query.toLowerCase().split(/\W+/).filter(Boolean));
 
  const contentWords = new Set(content.toLowerCase().split(/\W+/).filter(Boolean));

  if (queryWords.size === 0) {
    return 0;
  }

  let overlap = 0;

  for (const word of queryWords) {
    if (contentWords.has(word)) {
      overlap += 1;
    }
  }

  return overlap / queryWords.size;
}

export function retrieveDense(
  query: string,
  documents: DocumentChunk[],
  limit = 5
): RetrievalResult[] {
  return documents
    .map((chunk) => ({
      chunk,
      score: similarity(
        query,
        `${chunk.title} ${chunk.content}`
      ),
      source: "dense" as const,
    }))
    .filter((result) => result.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}