export interface PerformanceMetrics {
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  latenciesMs: number[];
  p50LatencyMs: number;
  p95LatencyMs: number;
  p99LatencyMs: number;
  averageLatencyMs: number;
  totalTokensUsed: number;
  totalCostUsd: number;
  averageCostPerRequestUsd: number;
}

export class MetricsCollector {
  private readonly latencies: number[] = [];
  private totalSuccess = 0;
  private totalFail = 0;
  private totalTokens = 0;
  private totalCost = 0;

  recordRequest(durationMs: number, success: boolean, tokens = 0, costUsd = 0): void {
    this.latencies.push(durationMs);
    if (success) {
      this.totalSuccess += 1;
    } else {
      this.totalFail += 1;
    }
    this.totalTokens += tokens;
    this.totalCost += costUsd;
  }

  private calculatePercentile(sorted: number[], p: number): number {
    if (sorted.length === 0) return 0;
    const index = Math.ceil((p / 100) * sorted.length) - 1;
    return sorted[Math.max(0, Math.min(index, sorted.length - 1))] ?? 0;
  }

  getMetrics(): PerformanceMetrics {
    const sorted = [...this.latencies].sort((a, b) => a - b);
    const total = this.latencies.length;
    const sum = this.latencies.reduce((acc, curr) => acc + curr, 0);

    return {
      totalRequests: total,
      successfulRequests: this.totalSuccess,
      failedRequests: this.totalFail,
      latenciesMs: this.latencies,
      p50LatencyMs: this.calculatePercentile(sorted, 50),
      p95LatencyMs: this.calculatePercentile(sorted, 95),
      p99LatencyMs: this.calculatePercentile(sorted, 99),
      averageLatencyMs: total > 0 ? Math.round((sum / total) * 100) / 100 : 0,
      totalTokensUsed: this.totalTokens,
      totalCostUsd: Math.round(this.totalCost * 10000) / 10000,
      averageCostPerRequestUsd: total > 0 ? Math.round((this.totalCost / total) * 100000) / 100000 : 0
    };
  }

  reset(): void {
    this.latencies.length = 0;
    this.totalSuccess = 0;
    this.totalFail = 0;
    this.totalTokens = 0;
    this.totalCost = 0;
  }
}

export const globalMetrics = new MetricsCollector();
