#!/usr/bin/env node

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { configManager } from './config.js';
import { Logger } from './logger.js';
import { EndpointLoader } from './endpoint-loader.js';
import { HandlerRegistry } from './handler-registry.js';
import { ToolNameGenerator, ToolSchemaBuilder } from './tool-utils.js';
import { Endpoint } from './types.js';
import { startRemoteServer } from './remote-server.js';

// Check command line arguments
const args = process.argv.slice(2);
const isRemoteMode = args.includes('--remote') || process.env.MCP_MODE === 'remote';

if (isRemoteMode) {
  // Start remote server
  startRemoteServer();
} else {
  // Start stdio server (original functionality)
  startStdioServer();
}

function startStdioServer() {
  // Create server instance
  const server = new McpServer({
    name: "sfcc-services",
    version: "1.0.0",
  });

  // Initialize services
  const endpointLoader = EndpointLoader.getInstance();
  const handlerRegistry = HandlerRegistry.getInstance();
  const toolNameGenerator = new ToolNameGenerator();

  // Get endpoints from the loader
  const endpoints: Endpoint[] = endpointLoader.getEndpoints();

  // Register tools for each endpoint
  endpoints.forEach(endpoint => {
    // Use custom tool name if provided, otherwise generate one
    const toolName = endpoint.toolName || toolNameGenerator.createToolName(endpoint.path);
    
    // Create the tool schema
    const toolSchema = ToolSchemaBuilder.buildSchema(endpoint.params);
    
    // Create the tool handler
    const toolHandler = async (input: Record<string, string>) => {
      try {
        const requestId = configManager.getRequestId();
        
        // Filter out undefined or empty optional parameters
        const filteredParams = Object.fromEntries(
          Object.entries(input).filter(([_, value]) => value !== undefined && value !== '')
        );

        // Execute handler (custom or default)
        const data = await handlerRegistry.executeHandler(toolName, endpoint, filteredParams);
        
        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify(data),
            },
          ],
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text" as const,
              text: `Error retrieving data. ${error instanceof Error ? error.message : 'Unknown error'}`,
            },
          ],
        };
      }
    };
    
    // Register the tool
    server.tool(
      toolName,
      endpoint.description,
      endpoint.params.length > 0 ? toolSchema : {},
      toolHandler
    );
  });

  main(server).catch((error) => {
    const requestId = configManager.getRequestId();
    Logger.error(requestId, 'Unhandled error', error as Error);
    process.exit(1);
  });
}

async function main(server: McpServer) {
  const requestId = configManager.getRequestId();
  try {
    // Set up stdio transport
    const transport = new StdioServerTransport();
    await server.connect(transport);

    // Log server start
    Logger.info(requestId, 'SFCC MCP Stdio Server started successfully');

    // Keep the process running
    process.stdin.resume();

    // Handle process termination
    process.on('SIGINT', () => {
      Logger.info(requestId, 'Received SIGINT. Shutting down gracefully...');
      process.exit(0);
    });

    process.on('SIGTERM', () => {
      Logger.info(requestId, 'Received SIGTERM. Shutting down gracefully...');
      process.exit(0);
    });
  } catch (error) {
    Logger.error(requestId, 'Server startup error', error as Error);
    process.exit(1);
  }
}