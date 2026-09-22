import type { RAGEvaluationCase } from "../evaluation/rag-evaluation.js";

export const ragEvaluationCases: RAGEvaluationCase[] = [
  {
    query: "What is our annual leave policy?",
    expectedDocumentIds: ["employee-handbook"],
  },

  {
    query: "How many days can employees work remotely?",
    expectedDocumentIds: ["employee-handbook"],
  },

  {
    query: "How long is parental leave?",
    expectedDocumentIds: ["employee-handbook"],
  },

  {
    query: "What should employees do with API keys?",
    expectedDocumentIds: ["security-handbook"],
  },
];