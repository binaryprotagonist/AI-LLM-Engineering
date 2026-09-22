import type { AuthenticatedUser } from "./types.js";

export interface AuthToken {
  token: string;
}

export class AuthenticationService {
  authenticate(input: AuthToken): AuthenticatedUser | null {
    if (!input.token) {
      return null;
    }

    // Temporary simulation.
    // Real authentication will be connected at the application boundary.
    return {
      userId: "user-001",
      tenantId: "tenant-001",
      roles: ["employee"]
    };
  }
}