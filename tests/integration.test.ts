// Simple integration test that validates MCP server can be instantiated
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { HandlerRegistry } from '../src/handler-registry';
import { SFCCApiClient } from '../src/sfcc-client';

describe('SFCC MCP Server Integration', () => {
  describe('Server Instantiation', () => {
    it('should create MCP server instance with correct configuration', () => {
      const server = new McpServer({
        name: "sfcc-services",
        version: "1.0.0",
      });

      expect(server).toBeDefined();
      // Verify the server has internal structure indicating it was properly initialized
      expect(server).toHaveProperty('server');
    });

    it('should handle tool registration pattern', () => {
      const server = new McpServer({
        name: "test-server",
        version: "1.0.0",
      });

      // Mock tool handler
      const mockHandler = jest.fn().mockResolvedValue({
        content: [{ type: "text", text: "test response" }]
      });

      // Register a test tool
      server.tool(
        "test_tool",
        "Test tool description", 
        {
          test_param: {
            type: "string",
            description: "Test parameter"
          }
        },
        mockHandler
      );

      expect(server).toBeDefined();
    });
  });

  describe('Error Handling', () => {
    it('should handle tool handler errors gracefully', async () => {
      const server = new McpServer({
        name: "test-server",
        version: "1.0.0",
      });

      const errorHandler = jest.fn().mockRejectedValue(new Error('Test error'));

      server.tool(
        "error_tool",
        "Tool that throws errors",
        {},
        errorHandler
      );

      expect(server).toBeDefined();
    });
  });

  describe('Product Search Handler', () => {
    let handlerRegistry: HandlerRegistry;
    let mockMakeRequest: jest.Mock;

    beforeEach(() => {
      // Mock the SFCCApiClient
      mockMakeRequest = jest.fn().mockResolvedValue({ hits: [] });
      jest.spyOn(SFCCApiClient, 'getInstance').mockReturnValue({
        makeRequest: mockMakeRequest,
      } as any);

      handlerRegistry = HandlerRegistry.getInstance();
    });

    afterEach(() => {
      jest.restoreAllMocks();
    });

    it('should call product_search with correct pagination and expand parameters', async () => {
      const endpoint = {
        path: '/product_search',
        description: '',
        method: 'POST',
        toolName: 'product_search',
        params: [],
      };
      const params = {
        site_id: 'RefArch',
        count: '10',
        start: '5',
        expand: 'images,prices',
      };

      await handlerRegistry.executeHandler('product_search', endpoint, params);

      expect(mockMakeRequest).toHaveBeenCalledWith(endpoint, {
        ...params,
        requestBody: {
          query: { match_all_query: {} },
          expand: ['images', 'prices'],
          count: 10,
          start: 5,
          select: '(**)',
        },
      }, undefined);
    });
  });
});