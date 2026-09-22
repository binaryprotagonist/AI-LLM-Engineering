import { runRAG } from "../rag/pipeline.js";
import { evaluateRAGCase } from "./rag-evaluation.js";
import { ragEvaluationCases } from "../evals/rag-cases.js";

const tenantId = "tenant-001";

let totalRecall = 0;
let totalPrecision = 0;
let totalMRR = 0;

console.log("\n========================================================");
console.log("            RAG RETRIEVAL EVALUATION SUITE             ");
console.log("========================================================\n");

for (const testCase of ragEvaluationCases) {
  const result = runRAG(
    testCase.query,
    tenantId
  );

  const evaluation = evaluateRAGCase(
    result,
    testCase
  );

  totalRecall += evaluation.recallAtK;
  totalPrecision += evaluation.precisionAtK;
  totalMRR += evaluation.reciprocalRank;

  console.log(`Query:     "${evaluation.query}"`);
  console.log(`Recall@K:  ${(evaluation.recallAtK * 100).toFixed(1)}%`);
  console.log(`Prec@K:    ${(evaluation.precisionAtK * 100).toFixed(1)}%`);
  console.log(`RR:        ${evaluation.reciprocalRank.toFixed(2)}`);
  console.log(`Retrieved: [${evaluation.retrievedDocumentIds.join(", ")}]`);
  console.log(`Expected:  [${evaluation.expectedDocumentIds.join(", ")}]`);
  console.log("--------------------------------------------------------");
}

const n = ragEvaluationCases.length;
const meanRecall = totalRecall / n;
const meanPrecision = totalPrecision / n;
const mrr = totalMRR / n;

console.log("\n========================================================");
console.log("                 EVALUATION SUMMARY                     ");
console.log("========================================================");
console.log(`Total Test Cases:       ${n}`);
console.log(`Mean Recall@K:          ${(meanRecall * 100).toFixed(1)}%`);
console.log(`Mean Precision@K:       ${(meanPrecision * 100).toFixed(1)}%`);
console.log(`Mean Reciprocal Rank:   ${mrr.toFixed(3)}`);
console.log("========================================================\n");

if (meanRecall < 0.8) {
  console.error("FAIL: Retrieval recall fell below required 80% threshold.");
  process.exit(1);
} else {
  console.log("SUCCESS: All RAG retrieval quality benchmarks passed!\n");
}