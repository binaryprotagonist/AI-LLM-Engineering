// ============================================================================
// SECURE MCP CLIENT
// ============================================================================
// Consumes the hardened MCP server via standard MCP transports, handles
// capability negotiation, bearer token injection, and structured error parsing.
// ============================================================================

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { HardenedMcpServer } from "../server/server.js";

export interface McpToolCallOutput {
  isError: boolean;
  content: string;
  parsedData?: unknown;
}

export class SecureMcpClient {
  private client: Client;
  private serverRef?: HardenedMcpServer;
  private defaultAuthToken?: string;
  private isConnected: boolean = false;

  constructor(clientName: string = "secure-langgraph-mcp-client") {
    this.client = new Client(
      {
        name: clientName,
        version: "1.0.0",
      },
      {
        capabilities: {},
      }
    );
  }

  /**
   * Connect to the MCP server using an InMemory linked transport pair.
   */
  public async connect(server: HardenedMcpServer, authToken?: string): Promise<void> {
    this.serverRef = server;
    this.defaultAuthToken = authToken;

    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();

    await Promise.all([
      this.client.connect(clientTransport),
      server.server.connect(serverTransport),
    ]);

    this.isConnected = true;
  }

  public setAuthToken(token: string): void {
    this.defaultAuthToken = token;
  }

  public getAuthToken(): string | undefined {
    return this.defaultAuthToken;
  }

  /**
   * Discovers tools from the MCP server.
   */
  public async listTools(): Promise<Array<{ name: string; description?: string; inputSchema: Record<string, unknown> }>> {
    if (!this.isConnected) throw new Error("Client not connected to MCP server");
    const result = await this.client.listTools();
    return result.tools.map((t) => ({
      name: t.name,
      description: t.description,
      inputSchema: t.inputSchema as Record<string, unknown>,
    }));
  }

  /**
   * Discovers resources from the MCP server.
   */
  public async listResources(): Promise<Array<{ uri: string; name: string; description?: string }>> {
    if (!this.isConnected) throw new Error("Client not connected to MCP server");
    const result = await this.client.listResources();
    return result.resources.map((r) => ({
      uri: r.uri,
      name: r.name,
      description: r.description,
    }));
  }

  /**
   * Reads a resource by URI.
   */
  public async readResource(uri: string): Promise<string> {
    if (!this.isConnected) throw new Error("Client not connected to MCP server");
    const result = await this.client.readResource({ uri });
    const content = result.contents[0];
    if ("text" in content && typeof content.text === "string") {
      return content.text;
    }
    return JSON.stringify(content);
  }

  /**
   * Calls a tool through MCP protocol with automatic token injection.
   */
  public async callTool(
    name: string,
    toolArgs: Record<string, unknown> = {},
    overrideToken?: string
  ): Promise<McpToolCallOutput> {
    if (!this.isConnected) throw new Error("Client not connected to MCP server");

    const tokenToUse = overrideToken ?? this.defaultAuthToken;
    const finalArgs = {
      ...toolArgs,
      ...(tokenToUse ? { authToken: tokenToUse } : {}),
    };

    const response = await this.client.callTool({
      name,
      arguments: finalArgs,
    });

    const isError = Boolean(response.isError);
    const contentItems = Array.isArray(response.content) ? (response.content as Array<{ type: string; text?: string }>) : [];
    const firstTextItem = contentItems.find((item) => typeof item.text === "string");
    const textContent = firstTextItem?.text ?? "";

    let parsedData: unknown = undefined;
    try {
      if (textContent) {
        parsedData = JSON.parse(textContent);
      }
    } catch {
      parsedData = textContent;
    }

    return {
      isError,
      content: textContent,
      parsedData,
    };
  }

  public async close(): Promise<void> {
    if (this.isConnected) {
      await this.client.close();
      this.isConnected = false;
    }
  }
}
