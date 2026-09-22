import type { RetrievalResult } from "./types.js";

export function rerank(
  query: string,
  results: RetrievalResult[],
  limit = 3
): RetrievalResult[] {
  const queryTokens = new Set(
    query.toLowerCase().split(/\W+/).filter(Boolean)
  );

  return results.map((result) => {
     
      const text = `${result.chunk.title} ${result.chunk.content}`.toLowerCase();

      let exactMatches = 0;

      for (const token of queryTokens) {
        if (text.includes(token)) {
          exactMatches += 1;
        }
      }

      return {
        ...result,
        score:
          result.score +
          exactMatches * 0.01,
      };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}