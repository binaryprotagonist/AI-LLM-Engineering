import { HardenedMCPServer } from "../mcp/server.js";
import { MCPClient } from "../mcp/client.js";
import { HITLApprovalManager } from "../hitl/manager.js";

export interface AppContainer {
  mcpServer: HardenedMCPServer;
  mcpClient: MCPClient;
  hitlManager: HITLApprovalManager;
}

const mcpServer = new HardenedMCPServer();
const mcpClient = new MCPClient(mcpServer);
const hitlManager = new HITLApprovalManager();

export const container: AppContainer = {
  mcpServer,
  mcpClient,
  hitlManager
};
