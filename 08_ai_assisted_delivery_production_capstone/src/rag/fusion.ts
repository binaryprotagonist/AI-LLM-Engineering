import type { RetrievalResult } from "./types.js";

export function reciprocalRankFusion(
  resultSets: RetrievalResult[][],
  limit = 5
): RetrievalResult[] {
  const scores = new Map<
    string,
    {
      result: RetrievalResult;
      score: number;
    }
  >();

  for (const results of resultSets) {
    results.forEach((result, index) => {
      const rank = index + 1;

      const existing = scores.get(result.chunk.id);

      if (existing) {
        existing.score += 1 / (60 + rank);
      } 
      else {
        scores.set(result.chunk.id, {
          result: {
            ...result,
            source: "hybrid",
          },
          score: 1 / (60 + rank),
        });
      }
    });
  }

  return [...scores.values()]
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map(({ result, score }) => ({
      ...result,
      score,
    }));
}