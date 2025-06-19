import express from 'express';
import cors from 'cors';
import fetch from 'node-fetch';
import { AsyncLocalStorage } from 'async_hooks';
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";

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

// Store user credentials temporarily (in production, use a secure session store)
const userCredentials: Record<string, { clientId: string; clientSecret: string; apiBase: string; sessionId: string }> = {};
const authCodes: Record<string, string> = {}; // Map auth codes to session IDs

// Async local storage for session context
const sessionContext = new AsyncLocalStorage<{ sessionId: string; credentials: { clientId: string; clientSecret: string; apiBase: string } }>();

// Helper function to get base URL
function getBaseUrl(req: express.Request): string {
  const protocol = req.headers['x-forwarded-proto'] || req.protocol;
  const host = req.headers['x-forwarded-host'] || req.headers.host;
  return `${protocol}://${host}`;
}

// Authentication helper function (using stored SFCC credentials)
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

  try {
    // Extract session ID from token format: sfcc_{sessionId}_{random}_{timestamp}
    const tokenParts = token.split('_');
    if (tokenParts.length < 4 || tokenParts[0] !== 'sfcc') {
      return {
        success: false,
        response: res.status(403).json({
          jsonrpc: '2.0',
          error: { code: -32001, message: 'Invalid token format' },
          id: rpcId
        })
      };
    }

    const sessionId = tokenParts[1];
    const credentials = userCredentials[sessionId];
    
    if (!credentials) {
      return {
        success: false,
        response: res.status(403).json({
          jsonrpc: '2.0',
          error: { code: -32001, message: 'Invalid or expired token' },
          id: rpcId
        })
      };
    }

    // Create auth object for MCP server with user's credentials
    const authObject = {
      token: token,
      sessionId: sessionId,
      clientId: credentials.clientId,
      clientSecret: credentials.clientSecret,
      apiBase: credentials.apiBase,
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
  // SFCC credentials collection page
  res.send(`
    <!DOCTYPE html>
    <html>
    <head>
        <title>SFCC MCP Server Authorization</title>
        <style>
            body { font-family: Arial, sans-serif; max-width: 600px; margin: 50px auto; padding: 20px; }
            .container { text-align: center; }
            .form-group { margin-bottom: 20px; text-align: left; }
            label { display: block; margin-bottom: 5px; font-weight: bold; }
            input[type="text"], input[type="password"] { 
                width: 100%; 
                padding: 10px; 
                border: 1px solid #ddd; 
                border-radius: 4px; 
                font-size: 14px;
                box-sizing: border-box;
            }
            button { 
                background: #007cba; 
                color: white; 
                padding: 15px 30px; 
                border: none; 
                border-radius: 5px; 
                font-size: 16px; 
                cursor: pointer; 
                width: 100%;
                margin-top: 20px;
            }
            button:hover { background: #005a87; }
            button:disabled { background: #ccc; cursor: not-allowed; }
            .error { color: red; margin-top: 10px; }
            .description { text-align: left; margin-bottom: 30px; color: #666; }
        </style>
    </head>
    <body>
        <div class="container">
            <h1>SFCC MCP Server Authorization</h1>
            <div class="description">
                <p>Please provide your SFCC credentials to authorize access:</p>
            </div>
            
            <form id="authForm">
                <div class="form-group">
                    <label for="clientId">SFCC Admin Client ID:</label>
                    <input type="text" id="clientId" name="clientId" required 
                           placeholder="Enter your SFCC Admin Client ID">
                </div>
                
                <div class="form-group">
                    <label for="clientSecret">SFCC Admin Client Secret:</label>
                    <input type="password" id="clientSecret" name="clientSecret" required 
                           placeholder="Enter your SFCC Admin Client Secret">
                </div>
                
                <div class="form-group">
                    <label for="apiBase">SFCC API Base URL:</label>
                    <input type="text" id="apiBase" name="apiBase" required 
                           placeholder="e.g., https://your-instance.api.commercecloud.salesforce.com">
                </div>
                
                <button type="submit" id="authorizeBtn">Authorize Access</button>
                <div id="status" class="error"></div>
            </form>
        </div>
        <script>
            document.getElementById('authForm').addEventListener('submit', function(e) {
                e.preventDefault();
                authorize();
            });
            
            async function authorize() {
                const form = document.getElementById('authForm');
                const button = document.getElementById('authorizeBtn');
                const status = document.getElementById('status');
                
                // Get form data
                const clientId = document.getElementById('clientId').value.trim();
                const clientSecret = document.getElementById('clientSecret').value.trim();
                const apiBase = document.getElementById('apiBase').value.trim();
                
                // Validate inputs
                if (!clientId || !clientSecret || !apiBase) {
                    status.textContent = 'All fields are required.';
                    return;
                }
                
                // Disable form
                button.disabled = true;
                button.textContent = 'Validating...';
                status.textContent = '';
                
                try {
                    // Validate credentials with SFCC
                    const response = await fetch('/validate-credentials', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                        },
                        body: JSON.stringify({
                            clientId: clientId,
                            clientSecret: clientSecret,
                            apiBase: apiBase
                        })
                    });
                    
                    const result = await response.json();
                    
                    if (result.success) {
                        // Get URL parameters for OAuth flow
                        const urlParams = new URLSearchParams(window.location.search);
                        const redirectUri = urlParams.get('redirect_uri');
                        const state = urlParams.get('state');
                        const codeChallenge = urlParams.get('code_challenge');
                        
                        // Generate authorization code with session info
                        const authCode = result.authCode;
                        
                        const callbackUrl = new URL('/callback', window.location.origin);
                        callbackUrl.searchParams.set('code', authCode);
                        if (state) callbackUrl.searchParams.set('state', state);
                        if (redirectUri) callbackUrl.searchParams.set('redirect_uri', redirectUri);
                        if (codeChallenge) callbackUrl.searchParams.set('code_challenge', codeChallenge);
                        
                        window.location.href = callbackUrl.toString();
                    } else {
                        status.textContent = result.error || 'Invalid credentials. Please check your SFCC settings.';
                        button.disabled = false;
                        button.textContent = 'Authorize Access';
                    }
                } catch (error) {
                    status.textContent = 'Error validating credentials. Please try again.';
                    button.disabled = false;
                    button.textContent = 'Authorize Access';
                }
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

app.post('/token', express.json(), (req: express.Request, res: express.Response) => {
  const { grant_type, code, redirect_uri, code_verifier } = req.body;
  
  if (grant_type !== 'authorization_code') {
    res.status(400).json({ error: 'unsupported_grant_type' });
    return;
  }
  
  if (!code) {
    res.status(400).json({ error: 'invalid_grant' });
    return;
  }
  
  // Validate auth code and get session ID
  const sessionId = authCodes[code];
  if (!sessionId || !userCredentials[sessionId]) {
    res.status(400).json({ error: 'invalid_grant' });
    return;
  }
  
  // Generate access token with session ID embedded
  const accessToken = `sfcc_${sessionId}_${Math.random().toString(36).substring(2, 15)}_${Date.now()}`;
  
  // Clean up the auth code (one-time use)
  delete authCodes[code];
  
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

// Credential validation endpoint
app.post('/validate-credentials', express.json(), async (req: express.Request, res: express.Response) => {
  const { clientId, clientSecret, apiBase } = req.body;
  
  if (!clientId || !clientSecret || !apiBase) {
    res.json({ success: false, error: 'All fields are required' });
    return;
  }
  
  try {
    // Validate credentials against SFCC OAuth endpoint
    const tokenUrl = `https://account.demandware.com/dwsso/oauth2/access_token`;
    
    const formData = new URLSearchParams();
    formData.append('grant_type', 'client_credentials');
    formData.append('client_id', clientId);
    formData.append('client_secret', clientSecret);
    
    const response = await fetch(tokenUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: formData.toString()
    });
    
    if (response.ok) {
      // Credentials are valid, store them temporarily and generate auth code
      const sessionId = uuidv4();
      const authCode = 'auth_' + Math.random().toString(36).substring(2, 15) + '_' + Date.now();
      
      userCredentials[sessionId] = {
        clientId,
        clientSecret,
        apiBase,
        sessionId
      };
      
      authCodes[authCode] = sessionId;
      
      // Clean up old auth codes (optional: implement proper cleanup)
      setTimeout(() => {
        delete authCodes[authCode];
      }, 10 * 60 * 1000); // 10 minutes
      
      res.json({ success: true, authCode });
    } else {
      const errorText = await response.text();
      Logger.error('default', `SFCC credential validation failed: ${response.status} ${errorText}`);
      res.json({ 
        success: false, 
        error: 'Invalid SFCC credentials. Please check your Client ID and Secret.' 
      });
    }
  } catch (error) {
    Logger.error('default', 'Error validating SFCC credentials', error as Error);
    res.json({ 
      success: false, 
      error: 'Error connecting to SFCC. Please check your API Base URL.' 
    });
  }
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

        // Get session context
        const context = sessionContext.getStore();
        const sessionId = context?.sessionId;

        // Execute handler (custom or default) with session ID
        const data = await handlerRegistry.executeHandler(toolName, endpoint, filteredParams, sessionId);
        
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

// MCP transport endpoint (Streamable HTTP)
app.post('/mcp', async (req, res) => {
  const body = req.body;
  const rpcId = (body && body.id !== undefined) ? body.id : null;

  // Authenticate the token
  const authResult = await authenticateToken(req, res, rpcId);  if (!authResult.success) {
    return;
  }

  const authObject = authResult.authObject!;
  (req as any).auth = authObject;
  // Store auth context for session using config manager
  if (authObject.sessionId) {
    configManager.setSessionCredentials(authObject.sessionId, {
      clientId: authObject.clientId,
      clientSecret: authObject.clientSecret,
      apiBase: authObject.apiBase
    });
  }

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
  // Handle the request using the transport with session context
  try {
    const sessionCredentials = configManager.getSessionCredentials(effectiveSessionId);
    if (sessionCredentials) {
      await sessionContext.run(
        { sessionId: effectiveSessionId, credentials: sessionCredentials },
        () => transport.handleRequest(req, res, body)
      );
    } else {
      await transport.handleRequest(req, res, body);
    }
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



// Session cleanup endpoint
app.delete('/mcp', async (req, res) => {
  const sessionId = req.headers['mcp-session-id'] as string;
  
  if (transports[sessionId]) {
    // Clean up the session and credentials
    delete transports[sessionId];
    configManager.clearSessionCredentials(sessionId);
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
