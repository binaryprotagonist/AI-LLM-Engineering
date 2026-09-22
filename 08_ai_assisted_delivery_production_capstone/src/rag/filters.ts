import type { DocumentChunk } from "./types.js";

export function filterByTenant(
  documents: DocumentChunk[],
  tenantId: string
): DocumentChunk[] {
  return documents.filter(
    (document) => document.tenantId === tenantId
  );
}