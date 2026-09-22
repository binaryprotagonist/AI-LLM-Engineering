export interface DocumentChunk {
  id: string;
  tenantId: string;
  documentId: string;
  title: string;
  content: string;
  metadata: {
    department: string;
    documentType: string;
    updatedAt: string;
  };
}

export interface RetrievalResult {
  chunk: DocumentChunk;
  score: number;
  source: "dense" | "bm25" | "hybrid";
}

export interface RAGSource {
  chunkId: string;
  documentId: string;
  title: string;
  score: number;
}

export interface RAGMetrics {
  candidateCount: number;
  finalResultCount: number;
  durationMs: number;
}

export interface RAGResult {
  query: string;
  results: RetrievalResult[];
  context: string;
  sources: RAGSource[];
  metrics: RAGMetrics;
}