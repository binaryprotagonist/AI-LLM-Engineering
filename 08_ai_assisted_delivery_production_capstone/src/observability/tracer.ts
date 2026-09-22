import { randomUUID } from "node:crypto";

export interface Span {
  spanId: string;
  traceId: string;
  parentSpanId?: string;
  name: string;
  startTime: number;
  endTime?: number;
  durationMs?: number;
  status: "ok" | "error";
  attributes: Record<string, unknown>;
  events: Array<{ name: string; timestamp: number; attributes?: Record<string, unknown> }>;
}

export class Tracer {
  private readonly spans: Span[] = [];

  startSpan(name: string, traceId: string, parentSpanId?: string, attributes: Record<string, unknown> = {}): Span {
    const span: Span = {
      spanId: randomUUID().slice(0, 16),
      traceId,
      ...(parentSpanId ? { parentSpanId } : {}),
      name,
      startTime: Date.now(),
      status: "ok",
      attributes: { ...attributes },
      events: []
    };
    this.spans.push(span);
    return span;
  }

  endSpan(spanId: string, status: "ok" | "error" = "ok", extraAttributes?: Record<string, unknown>): Span | undefined {
    const span = this.spans.find((s) => s.spanId === spanId);
    if (!span) return undefined;

    span.endTime = Date.now();
    span.durationMs = span.endTime - span.startTime;
    span.status = status;
    if (extraAttributes) {
      Object.assign(span.attributes, extraAttributes);
    }
    return span;
  }

  addEvent(spanId: string, name: string, attributes?: Record<string, unknown>): void {
    const span = this.spans.find((s) => s.spanId === spanId);
    if (span) {
      span.events.push({
        name,
        timestamp: Date.now(),
        ...(attributes ? { attributes } : {})
      });
    }
  }

  getSpansForTrace(traceId: string): Span[] {
    return this.spans.filter((s) => s.traceId === traceId);
  }

  getAllSpans(): readonly Span[] {
    return this.spans;
  }

  clear(): void {
    this.spans.length = 0;
  }
}

export const globalTracer = new Tracer();
