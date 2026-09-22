import type { DocumentChunk } from "./types.js";

export const documents: DocumentChunk[] = [
  {
    id: "leave-001",
    tenantId: "tenant-001",
    documentId: "employee-handbook",
    title: "Annual Leave Policy",
    content:
      "Employees are entitled to 20 days of annual leave per calendar year. Leave requests should be submitted through the employee portal.",
    metadata: {
      department: "HR",
      documentType: "policy",
      updatedAt: "2026-08-01",
    },
  },
  {
    id: "remote-001",
    tenantId: "tenant-001",
    documentId: "employee-handbook",
    title: "Remote Work Policy",
    content:
      "Employees may work remotely up to 3 days per week with manager approval. Remote work arrangements must follow team availability requirements.",
    metadata: {
      department: "HR",
      documentType: "policy",
      updatedAt: "2026-08-01",
    },
  },
  {
    id: "parental-001",
    tenantId: "tenant-001",
    documentId: "employee-handbook",
    title: "Parental Leave Policy",
    content:
      "Eligible employees may receive up to 26 weeks of parental leave according to company policy and applicable requirements.",
    metadata: {
      department: "HR",
      documentType: "policy",
      updatedAt: "2026-08-01",
    },
  },
  {
    id: "security-001",
    tenantId: "tenant-001",
    documentId: "security-handbook",
    title: "Security Policy",
    content:
      "Employees must not share credentials, API keys, passwords, or other authentication secrets with unauthorized individuals.",
    metadata: {
      department: "Security",
      documentType: "policy",
      updatedAt: "2026-07-15",
    },
  },
];