import { Gateway } from "../gateway/gateway.js";
import { createWorkflow } from "../graph/workflow.js";
import { MetricsCollector } from "../observability/metrics.js";
import { globalTracer } from "../observability/tracer.js";
import { container } from "../shared/container.js";

export interface BenchmarkReport {
  totalRequests: number;
  successful: number;
  interruptedHITL: number;
  rejectedOrFailed: number;
  p50LatencyMs: number;
  p95LatencyMs: number;
  p99LatencyMs: number;
  averageLatencyMs: number;
  totalTokensUsed: number;
  averageCostPerRequestUsd: number;
  auditRecordsLogged: number;
  auditChainIntegrity: boolean;
}

export async function runSystemBenchmark(requestCount = 100): Promise<BenchmarkReport> {
  const gateway = new Gateway();
  const graph = createWorkflow();
  const metrics = new MetricsCollector();

  const testQueries = [
    { q: "What is our annual leave policy?", roles: ["employee"] },
    { q: "How many days can employees work remotely?", roles: ["employee"] },
    { q: "How long is parental leave?", roles: ["employee"] },
    { q: "What should employees do with API keys?", roles: ["employee"] },
    { q: "Analyze and compare remote work vs productivity trade-offs", roles: ["analyst"] },
    { q: "Show employee record for current user", roles: ["employee"] },
    { q: "What are the department stats for Engineering?", roles: ["analyst"] },
    { q: "Request leave 3 days for medical checkup", roles: ["employee", "hr_admin"] }
  ];

  let successCount = 0;
  let hitlCount = 0;
  let failCount = 0;

  for (let i = 0; i < requestCount; i++) {
    const item = testQueries[i % testQueries.length]!;
    const start = Date.now();
    const trace = globalTracer.startSpan("system.request", `trace-${i}`, undefined, {
      query: item.q
    });

    const gwRes = gateway.handle({
      question: item.q,
      user: {
        userId: `user-00${(i % 3) + 1}`,
        tenantId: "tenant-001",
        roles: item.roles
      }
    });

    if (!gwRes.accepted || !gwRes.context) {
      const duration = Date.now() - start;
      metrics.recordRequest(duration, false, 0, 0);
      failCount += 1;
      globalTracer.endSpan(trace.spanId, "error");
      continue;
    }

    const ctx = gwRes.context;

    const result = await graph.invoke({
      question: item.q,
      requestId: ctx.requestId,
      traceId: ctx.traceId,
      userId: ctx.user.userId,
      tenantId: ctx.user.tenantId,
      roles: ctx.user.roles,
      route: "unknown",
      answer: "",
      status: "pending",
      stepsUsed: 0,
      toolCallsUsed: 0,
      tokensUsed: 0,
      estimatedCostUsd: 0,
      maxSteps: ctx.budget.maxSteps,
      maxToolCalls: 8,
      maxCostUsd: ctx.budget.maxCostUsd,
      deadlineAt: ctx.budget.deadlineAt,
      budgetExceeded: false,
      hitlRequired: false,
      pendingApproval: null,
      approvalDecision: null,
      auditRecordIds: [],
      errors: []
    });

    const duration = Date.now() - start;

    if (result.status === "interrupted" || result.hitlRequired) {
      hitlCount += 1;
      // Auto-resolve pending approval to test the HITL lifecycle
      if (result.pendingApproval) {
        container.hitlManager.resolveApproval({
          approvalId: result.pendingApproval.id,
          decision: "approve",
          reviewerId: "manager-lead-01",
          reviewerNotes: "Approved via automated benchmark test suite"
        });
      }
    } else if (result.status === "completed") {
      successCount += 1;
    } else {
      failCount += 1;
    }

    metrics.recordRequest(
      duration,
      result.status !== "failed",
      result.tokensUsed,
      result.estimatedCostUsd
    );

    globalTracer.endSpan(trace.spanId, result.status === "failed" ? "error" : "ok");
  }

  const perf = metrics.getMetrics();
  const auditChain = container.mcpServer.auditLogger.verifyChain();

  return {
    totalRequests: requestCount,
    successful: successCount,
    interruptedHITL: hitlCount,
    rejectedOrFailed: failCount,
    p50LatencyMs: perf.p50LatencyMs,
    p95LatencyMs: perf.p95LatencyMs,
    p99LatencyMs: perf.p99LatencyMs,
    averageLatencyMs: perf.averageLatencyMs,
    totalTokensUsed: perf.totalTokensUsed,
    averageCostPerRequestUsd: perf.averageCostPerRequestUsd,
    auditRecordsLogged: container.mcpServer.auditLogger.getRecordCount(),
    auditChainIntegrity: auditChain.isValid
  };
}
