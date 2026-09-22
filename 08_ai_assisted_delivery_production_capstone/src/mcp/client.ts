import type { HardenedMCPServer } from "./server.js";
import type { MCPClientIdentity, MCPRequest, MCPResponse } from "./types.js";

export class MCPClient {
  constructor(
    private readonly server: HardenedMCPServer,
    private readonly timeoutMs = 5000
  ) {}

  async callTool<TInput = unknown, TOutput = unknown>(
    tool: string,
    parameters: TInput,
    identity: MCPClientIdentity,
    options?: { bypassHITL?: boolean }
  ): Promise<MCPResponse<TOutput>> {
    const request: MCPRequest<TInput> = {
      tool,
      parameters,
      identity
    };

    const timeoutPromise = new Promise<MCPResponse<TOutput>>((_, reject) =>
      setTimeout(() => reject(new Error(`MCP Tool call timed out after ${this.timeoutMs}ms`)), this.timeoutMs)
    );

    try {
      return await Promise.race([
        this.server.execute<TInput, TOutput>(request, options),
        timeoutPromise
      ]);
    } catch (err) {
      return {
        success: false,
        error: {
          code: "INTERNAL_ERROR",
          message: err instanceof Error ? err.message : "MCP call failed"
        }
      };
    }
  }

  listTools() {
    return this.server.listTools();
  }
}
