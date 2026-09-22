import type { DocumentChunk, RetrievalResult } from "./types.js";

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .split(/\W+/)
    .filter(Boolean);
}

function lexicalScore(query: string, content: string): number {
 
  const queryTokens = new Set(tokenize(query));
 
  const contentTokens = tokenize(content);

  let matches = 0;

  for (const token of contentTokens) {
    if (queryTokens.has(token)) {
      matches += 1;
    }
  }

  return matches;
}

export function retrieveLexically(
  query: string,
  documents: DocumentChunk[],
  limit = 5
): RetrievalResult[] {
  return documents.map((chunk) => ({
      chunk,
      score: lexicalScore(
        query, 
        `${chunk.title} ${chunk.content}`
      ),
      source: "bm25" as const,
    }))
    .filter((result) => result.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}