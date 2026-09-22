
export interface AuthenticatedUser {
  userId: string;
  tenantId: string;
  roles: string[];
}

export interface GatewayRequest {
  question: string;
  user: AuthenticatedUser;
}

export interface GatewayContext {
  requestId: string;
  traceId: string;
  user: AuthenticatedUser;

  budget: {
    maxSteps: number;
    maxTokens: number;
    maxCostUsd: number;
    deadlineAt: number;
  };
}

export interface GatewayResponse {
  accepted: boolean;
  context?: GatewayContext;
  error?: {
    code: string;
    message: string;
  };
}