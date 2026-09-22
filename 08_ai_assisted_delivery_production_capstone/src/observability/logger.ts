export interface LogContext {
  requestId?: string;
  traceId?: string;
  spanId?: string;
  operation: string;
  durationMs?: number;
  status: "success" | "failure" | "pending";
  userId?: string;
  tenantId?: string;
  metadata?: Record<string, unknown>;
}

export function redactSensitiveData(data: unknown): unknown {
  if (typeof data !== "object" || data === null) {
    return data;
  }

  if (Array.isArray(data)) {
    return data.map(redactSensitiveData);
  }

  const redacted: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(data as Record<string, unknown>)) {
    if (/token|key|secret|password|authorization|credential/i.test(key)) {
      redacted[key] = "[REDACTED]";
    } else if (typeof value === "object" && value !== null) {
      redacted[key] = redactSensitiveData(value);
    } else {
      redacted[key] = value;
    }
  }
  return redacted;
}

export function logEvent(context: LogContext): void {
  const safeMetadata = context.metadata ? redactSensitiveData(context.metadata) : undefined;
  const entry = {
    timestamp: new Date().toISOString(),
    ...context,
    ...(safeMetadata ? { metadata: safeMetadata } : {})
  };
  console.log(JSON.stringify(entry));
}