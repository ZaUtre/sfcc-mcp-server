import express from 'express';
import cors from 'cors';
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import { v4 as uuidv4 } from 'uuid';
import { configManager } from './config.js';
import { Logger } from './logger.js';
import { EndpointLoader } from './endpoint-loader.js';
import { HandlerRegistry } from './handler-registry.js';
import { ToolNameGenerator, ToolSchemaBuilder } from './tool-utils.js';
import { Endpoint } from './types.js';

// Express app setup
const app = express();
const port = process.env.PORT || 3000;

// Middleware
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'OPTIONS', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Mcp-Session-Id'],
  exposedHeaders: ['Mcp-Session-Id', 'WWW-Authenticate']
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Add OPTIONS handler for preflight requests
app.options('*', (req, res) => {
  res.status(200).end();
});

// Store active transports by session ID
const transports: Record<string, any> = {};
const pendingTransports: Record<string, any> = {};

// Helper function to get base URL
function getBaseUrl(req: express.Request): string {
  const protocol = req.headers['x-forwarded-proto'] || req.protocol;
  const host = req.headers['x-forwarded-host'] || req.headers.host;
  return `${protocol}://${host}`;
}

// Authentication helper function (simplified for SFCC)
async function authenticateToken(req: express.Request, res: express.Response, rpcId: any = null) {
  const authHeader = req.headers['authorization'] || '';
  const token = authHeader.replace(/^Bearer\s+/i, '').trim();
  const baseUrl = getBaseUrl(req);

  if (!token) {
    const wwwAuthHeader = `Bearer realm="SFCC MCP Server", resource_metadata_uri="${baseUrl}/.well-known/oauth-protected-resource"`;
    
    return {
      success: false,
      response: res.status(401)
        .header('WWW-Authenticate', wwwAuthHeader)
        .json({
          jsonrpc: '2.0',
          error: { code: -32000, message: 'Missing Bearer token' },
          id: rpcId
        })
    };
  }

  // For SFCC, we'll implement a simple token validation
  // In a production environment, you would validate against your auth system
  try {
    // Simple validation - check if token matches expected format or value
    if (!token || token.length < 10) {
      return {
        success: false,
        response: res.status(403).json({
          jsonrpc: '2.0',
          error: { code: -32001, message: 'Invalid or expired token' },
          id: rpcId
        })
      };
    }

    // Create auth object for MCP server
    const authObject = {
      token: token,
      clientId: 'sfcc-client',
      scopes: ['sfcc:read', 'sfcc:write']
    };

    return {
      success: true,
      authObject
    };
  } catch (error) {
    return {
      success: false,
      response: res.status(500).json({
        jsonrpc: '2.0',
        error: { code: -32002, message: 'Authentication error' },
        id: rpcId
      })
    };
  }
}

// OAuth 2.1 endpoints
app.get('/.well-known/oauth-protected-resource', (req, res) => {
  const baseUrl = getBaseUrl(req);
  
  const metadata = {
    authorization_servers: [
      {
        issuer: baseUrl,
        authorization_endpoint: `${baseUrl}/authorize`,
      }
    ]
  };
  
  res.json(metadata);
});

app.get('/.well-known/oauth-authorization-server', (req, res) => {
  const baseUrl = getBaseUrl(req);
  
  res.json({
    issuer: baseUrl,
    authorization_endpoint: `${baseUrl}/authorize`,
    token_endpoint: `${baseUrl}/token`,
    registration_endpoint: `${baseUrl}/register`,
    token_endpoint_auth_methods_supported: ["none"],
    scopes_supported: ["sfcc:read", "sfcc:write"],
    response_types_supported: ["code"],
    response_modes_supported: ["query"],
    grant_types_supported: ["authorization_code"],
    code_challenge_methods_supported: ["S256"]
  });
});

app.get('/authorize', (req, res) => {
  // Simple authorization page
  res.send(`
    <!DOCTYPE html>
    <html>
    <head>
        <title>SFCC MCP Server Authorization</title>
        <style>
            body { font-family: Arial, sans-serif; max-width: 600px; margin: 50px auto; padding: 20px; }
            .container { text-align: center; }
            button { background: #007cba; color: white; padding: 15px 30px; border: none; border-radius: 5px; font-size: 16px; cursor: pointer; }
            button:hover { background: #005a87; }
        </style>
    </head>
    <body>
        <div class="container">
            <h1>SFCC MCP Server Authorization</h1>
            <p>This would typically redirect to your authentication provider.</p>
            <p>For this demo, click the button below to authorize:</p>
            <button onclick="authorize()">Authorize Access</button>
            <div id="status"></div>
        </div>
        <script>
            function authorize() {
                const urlParams = new URLSearchParams(window.location.search);
                const redirectUri = urlParams.get('redirect_uri');
                const state = urlParams.get('state');
                const codeChallenge = urlParams.get('code_challenge');
                
                // Generate a simple authorization code
                const authCode = 'auth_' + Math.random().toString(36).substring(2, 15);
                
                const callbackUrl = new URL('/callback', window.location.origin);
                callbackUrl.searchParams.set('code', authCode);
                if (state) callbackUrl.searchParams.set('state', state);
                if (redirectUri) callbackUrl.searchParams.set('redirect_uri', redirectUri);
                if (codeChallenge) callbackUrl.searchParams.set('code_challenge', codeChallenge);
                
                window.location.href = callbackUrl.toString();
            }
        </script>
    </body>
    </html>
  `);
});

app.get('/callback', (req, res) => {
  const { code, state, redirect_uri } = req.query;
  
  if (redirect_uri) {
    const redirectUrl = new URL(redirect_uri as string);
    if (code) redirectUrl.searchParams.set('code', code as string);
    if (state) redirectUrl.searchParams.set('state', state as string);
    
    res.redirect(redirectUrl.toString());
  } else {
    res.json({ code, state });
  }
});

app.post('/token', express.json(), (req, res) => {
  const { grant_type, code, redirect_uri, code_verifier } = req.body;
  
  if (grant_type !== 'authorization_code') {
    res.status(400).json({ error: 'unsupported_grant_type' });
    return;
  }
  
  if (!code) {
    res.status(400).json({ error: 'invalid_grant' });
    return;
  }
  
  // Generate access token
  const accessToken = 'sfcc_token_' + Math.random().toString(36).substring(2, 15) + Date.now();
  
  res.json({
    access_token: accessToken,
    token_type: 'Bearer',
    expires_in: 3600,
    scope: 'sfcc:read sfcc:write'
  });
});

app.post('/register', express.json(), (req, res) => {
  const { client_name, redirect_uris = [] } = req.body;
  const client_id = uuidv4();
  
  res.status(201).json({
    client_id,
    token_endpoint_auth_method: 'none',
    redirect_uris
  });
});

// Helper function to create and connect a transport
async function createAndConnectTransport(sessionId: string, mcpServer: McpServer, transports: Record<string, any>) {
  if (pendingTransports[sessionId] || transports[sessionId]) {
    return pendingTransports[sessionId] || transports[sessionId];
  }  const transport = new StreamableHTTPServerTransport({
    enableJsonResponse: true,
    sessionIdGenerator: () => sessionId,
    onsessioninitialized: (actualId) => {
      delete pendingTransports[actualId];
    }
  });

  // Manually assign session ID
  transport.sessionId = sessionId;

  // Set cleanup handler
  transport.onclose = () => {
    if (transports[sessionId]) {
      delete transports[sessionId];
    }
  };

  // Track pending transport and store immediately
  pendingTransports[sessionId] = transport;
  transports[sessionId] = transport;

  // Connect to MCP server
  try {
    await mcpServer.connect(transport);
  } catch (error) {
    delete pendingTransports[sessionId];
    delete transports[sessionId];
    throw error;
  }

  return transport;
}

// Create and configure MCP server
export function createMCPServer(): McpServer {
  const server = new McpServer({
    name: "sfcc-services-remote",
    version: "1.0.0",
    instructions: "SFCC MCP Server providing Commerce Cloud services via remote transport"
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

  return server;
}

// Modern transport endpoint (Streamable HTTP)
app.post('/mcp', async (req, res) => {
  const body = req.body;
  const rpcId = (body && body.id !== undefined) ? body.id : null;

  // Authenticate the token
  const authResult = await authenticateToken(req, res, rpcId);
  if (!authResult.success) {
    return;
  }

  (req as any).auth = authResult.authObject;

  // Extract session ID from header
  const clientSessionIdHeader = req.headers['mcp-session-id'];
  const actualClientSessionId = Array.isArray(clientSessionIdHeader) 
    ? clientSessionIdHeader[0] 
    : clientSessionIdHeader;

  let transport;
  let effectiveSessionId;

  // Check if this is an initialize request
  const isInitRequest = body && body.method === 'initialize';

  if (isInitRequest) {
    // Create new session for initialize requests
    effectiveSessionId = uuidv4();
    transport = await createAndConnectTransport(effectiveSessionId, mcpServer, transports);
    
    // Set session ID in response header
    res.setHeader('Mcp-Session-Id', effectiveSessionId);
  } else if (actualClientSessionId && transports[actualClientSessionId]) {
    // Use existing transport for known sessions
    transport = transports[actualClientSessionId];
    effectiveSessionId = actualClientSessionId;  } else {
    // Error: non-initialize request without valid session ID
    res.status(400).json({
      jsonrpc: '2.0',
      error: { 
        code: -32003, 
        message: 'Bad Request: No valid session ID for non-initialize request.' 
      },
      id: rpcId
    });
    return;
  }

  // Set session ID in request headers for the transport
  req.headers['mcp-session-id'] = effectiveSessionId;
  res.setHeader('Mcp-Session-Id', effectiveSessionId);

  // Handle the request using the transport
  try {
    await transport.handleRequest(req, res, body);
  } catch (handleError) {
    Logger.error('mcp-server', 'MCP POST handleRequest error', handleError as Error);
    if (!res.headersSent) {
      res.status(500).json({ 
        jsonrpc: '2.0', 
        error: { code: -32603, message: 'Internal server error during MCP request handling' }, 
        id: rpcId 
      });
    }
  }
});

// Legacy transport endpoints (HTTP+SSE)
app.get('/mcp', async (req, res) => {
  // Authenticate the token
  const authResult = await authenticateToken(req, res, null);
  if (!authResult.success) {
    return;
  }
  
  (req as any).auth = authResult.authObject;
  
  // Create SSE transport
  const transport = new SSEServerTransport('/messages', res);
  
  // Store transport for future messages
  transports[transport.sessionId] = transport;
  
  // Set SSE headers
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.setHeader('Mcp-Session-Id', transport.sessionId);
  
  // Connect to MCP server
  try {
    await mcpServer.connect(transport);
  } catch (error) {
    Logger.error('mcp-server', 'SSE setup error', error as Error);
    if (!res.headersSent) {
      res.status(500).send('Internal server error during SSE setup.');
    } else {
      res.end();
    }
    
    // Clean up transport
    if (transports[transport.sessionId]) {
      delete transports[transport.sessionId];
    }
  }
});

app.post('/messages', express.json(), async (req, res) => {
  const sessionId = req.query.sessionId as string;
  const body = req.body;
  const rpcId = (body && body.id !== undefined) ? body.id : null;
  
  // Authenticate the token
  const authResult = await authenticateToken(req, res, rpcId);
  if (!authResult.success) {
    return;
  }
  
  (req as any).auth = authResult.authObject;
    if (!sessionId) {
    res.status(400).json({
      jsonrpc: '2.0',
      error: { code: -32000, message: 'Missing sessionId in query parameters' },
      id: rpcId
    });
    return;
  }
  
  const transport = transports[sessionId];
    if (!transport || !(transport instanceof SSEServerTransport)) {
    res.status(404).json({
      jsonrpc: '2.0',
      error: { code: -32001, message: 'Session not found or not an SSE session' },
      id: rpcId
    });
    return;
  }
  
  try {
    await transport.handlePostMessage(req, res, body);
  } catch (error) {
    Logger.error('mcp-server', 'SSE message handling error', error as Error);
    if (!res.headersSent) {
      res.status(500).json({
        jsonrpc: '2.0',
        error: { code: -32603, message: 'Internal server error handling message' },
        id: rpcId
      });
    }
  }
});

// Session cleanup endpoint
app.delete('/mcp', async (req, res) => {
  const sessionId = req.headers['mcp-session-id'] as string;
  
  if (transports[sessionId]) {
    // Clean up the session
    delete transports[sessionId];
    res.status(204).end();
  } else {
    res.status(404).json({ error: 'Session not found' });
  }
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    service: 'sfcc-services',
    version: '1.0.0',
    timestamp: new Date().toISOString() 
  });
});

// Create the MCP server instance
const mcpServer = createMCPServer();

// Start the server
export function startRemoteServer() {
  const requestId = configManager.getRequestId();
  
  app.listen(port, () => {
    Logger.info(requestId, `SFCC MCP Remote Server running on port ${port}`);
    Logger.info(requestId, `MCP endpoint available at http://localhost:${port}/mcp`);
    Logger.info(requestId, `OAuth endpoints available at http://localhost:${port}/.well-known/`);
  });

  // Handle process termination
  process.on('SIGINT', () => {
    Logger.info(requestId, 'Received SIGINT. Shutting down gracefully...');
    process.exit(0);
  });

  process.on('SIGTERM', () => {
    Logger.info(requestId, 'Received SIGTERM. Shutting down gracefully...');
    process.exit(0);
  });
}

export { mcpServer, app };
