import express from 'express';
import cors from 'cors';
import fetch from 'node-fetch';
import { readFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { AsyncLocalStorage } from 'async_hooks';
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";

import { v4 as uuidv4 } from 'uuid';
import { configManager } from './config.js';
import { sessionPersistence } from './session-persistence.js';
import { Logger } from './logger.js';
import { EndpointLoader } from './endpoint-loader.js';
import { HandlerRegistry } from './handler-registry.js';
import { ToolNameGenerator, ToolSchemaBuilder } from './tool-utils.js';
import { Endpoint } from './types.js';

// Get version from package.json
function getVersion(): string {
  try {
    const __filename = fileURLToPath(import.meta.url);
    const __dirname = dirname(__filename);
    const packageJsonPath = join(__dirname, '../package.json');
    const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf8'));
    return packageJson.version || '1.0.0';
  } catch (error) {
    return '1.0.0';
  }
}

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
const userCredentials: Record<string, { clientId: string; clientSecret: string; apiBase: string; sessionId: string; ocapiVersion?: string }> = {};
const authCodes: Record<string, string> = {}; // Map auth codes to session IDs

// Restore session data on startup
function restoreSessionData(): void {
  try {
    const sessionData = sessionPersistence.loadSessionData();
    if (sessionData) {
      if (sessionData.userCredentials) {
        Object.assign(userCredentials, sessionData.userCredentials);
      }
      if (sessionData.authCodes) {
        Object.assign(authCodes, sessionData.authCodes);
      }
      console.log('Restored session data for', Object.keys(userCredentials).length, 'users');
    }
  } catch (error) {
    console.warn('Failed to restore session data:', error);
  }
}

// Persist session data
function persistSessionData(): void {
  try {
    const existingData = sessionPersistence.loadSessionData() || {
      sessionCredentials: {},
      userCredentials: {},
      authCodes: {},
      timestamp: Date.now()
    };
    
    sessionPersistence.saveSessionData({
      ...existingData,
      userCredentials,
      authCodes
    });
  } catch (error) {
    console.warn('Failed to persist session data:', error);
  }
}

// Restore sessions on startup
restoreSessionData();

// Periodic session persistence (every 5 minutes)
setInterval(() => {
  persistSessionData();
}, 5 * 60 * 1000);

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
      ocapiVersion: credentials.ocapiVersion || 'v24_5',
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

// Endpoint to authorize with server defaults
app.post('/authorize-with-defaults', express.json(), async (req: express.Request, res: express.Response) => {
  try {
    const config = configManager.getConfig();
    
    if (!config.adminClientId || !config.adminClientSecret || !config.apiBase) {
      res.json({ 
        success: false, 
        error: 'Server default credentials are not configured properly.' 
      });
      return;
    }

    // Validate server credentials against SFCC OAuth endpoint
    const tokenUrl = `https://account.demandware.com/dwsso/oauth2/access_token`;
    
    const formData = new URLSearchParams();
    formData.append('grant_type', 'client_credentials');
    formData.append('client_id', config.adminClientId);
    formData.append('client_secret', config.adminClientSecret);
    
    const response = await fetch(tokenUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: formData.toString()
    });
    
    if (response.ok) {
      // Server credentials are valid, generate auth code
      const sessionId = uuidv4();
      const authCode = 'auth_' + Math.random().toString(36).substring(2, 15) + '_' + Date.now();
      
      userCredentials[sessionId] = {
        clientId: config.adminClientId,
        clientSecret: config.adminClientSecret,
        apiBase: config.apiBase,
        sessionId,
        ocapiVersion: config.ocapiVersion
      };
      
      authCodes[authCode] = sessionId;
      persistSessionData();
      
      // Clean up old auth codes
      setTimeout(() => {
        delete authCodes[authCode];
        persistSessionData();
      }, 10 * 60 * 1000); // 10 minutes
      
      res.json({ success: true, authCode });
    } else {
      const errorText = await response.text();
      Logger.error('default', `Server default credential validation failed: ${response.status} ${errorText}`);
      res.json({ 
        success: false, 
        error: 'Server default credentials are invalid. Please check server configuration.' 
      });
    }
  } catch (error) {
    Logger.error('default', 'Error validating server default credentials', error as Error);
    res.json({ 
      success: false, 
      error: 'Error validating server credentials. Please try again.' 
    });
  }
});

// Download OCAPI Business Manager configuration with client ID
app.get('/download-ocapi-config/:clientId', async (req, res) => {
  const { clientId } = req.params;
  const { version } = req.query;
  
  if (!clientId || clientId.trim() === '') {
    res.status(400).json({ error: 'Client ID is required' });
    return;
  }

  // Read the template OCAPI config file and replace the client ID
  const fs = await import('fs');
  const path = await import('path');
  const { fileURLToPath } = await import('url');
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);
  
  try {
    const configPath = path.join(__dirname, '../ocapi-bm-config.json');
    const configTemplate = fs.readFileSync(configPath, 'utf8');
    const configData = JSON.parse(configTemplate);
    
    // Update the client ID in the config
    if (configData.clients && configData.clients.length > 0) {
      configData.clients[0].client_id = clientId.trim();
    }
    
    // Update the OCAPI version if provided
    if (version && typeof version === 'string') {
      // Convert version format (e.g., v24_5 to 24.5)
      const versionString = version.replace(/^v/, '').replace(/_/g, '.');
      configData._v = versionString;
    }
    
    // Set headers for file download
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="ocapi-bm-config-${clientId.trim()}.json"`);
    
    // Send the modified config
    res.json(configData);
  } catch (error) {
    Logger.error('default', 'Error generating OCAPI config file', error as Error);
    res.status(500).json({ error: 'Error generating config file' });
  }
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
                padding: 12px 20px; 
                border: none; 
                border-radius: 5px; 
                font-size: 14px; 
                cursor: pointer; 
                margin: 5px;
            }
            button:hover { background: #005a87; }
            button:disabled { background: #ccc; cursor: not-allowed; }
            .primary-btn { 
                width: 100%;
                margin-top: 20px;
                padding: 15px 30px;
                font-size: 16px;
            }
            .secondary-btn { 
                background: #6c757d; 
                font-size: 12px;
                padding: 8px 12px;
            }
            .secondary-btn:hover { background: #5a6268; }
            .error { color: red; margin-top: 10px; }
            .success { color: green; margin-top: 10px; }
            .description { text-align: left; margin-bottom: 30px; color: #666; }
            .button-group { text-align: center; margin-bottom: 15px; }
        </style>
    </head>
    <body>
        <div class="container">
            <h1>SFCC MCP Server Authorization</h1>
            <div class="description">
                <p>Please provide your SFCC credentials to authorize access:</p>
                <p><small><strong>Tip:</strong> Enter your Client ID and click "Download OCAPI Config" to get a pre-configured OCAPI Business Manager settings file with your Client ID.</small></p>
            </div>
            
            <div class="button-group">
                <button type="button" id="authorizeWithDefaultsBtn" class="secondary-btn">Authorize with Server Defaults</button>
                <button type="button" id="loadStoredBtn" class="secondary-btn">Load Stored Credentials</button>
                <button type="button" id="clearStoredBtn" class="secondary-btn">Clear Stored</button>
                <button type="button" id="downloadConfigBtn" class="secondary-btn">Download OCAPI Config</button>
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
                
                <div class="form-group">
                    <label for="ocapiVersion">OCAPI Version:</label>
                    <input type="text" id="ocapiVersion" name="ocapiVersion" 
                           placeholder="e.g., v24_5" value="v24_5">
                </div>
                
                <button type="submit" id="authorizeBtn" class="primary-btn">Authorize Access</button>
                <div id="status" class="error"></div>
            </form>
        </div>
        <script>
            // Local storage keys
            const STORAGE_KEYS = {
                CLIENT_ID: 'sfcc_mcp_client_id',
                CLIENT_SECRET: 'sfcc_mcp_client_secret',
                API_BASE: 'sfcc_mcp_api_base',
                OCAPI_VERSION: 'sfcc_mcp_ocapi_version'
            };

            // Load stored credentials on page load
            document.addEventListener('DOMContentLoaded', function() {
                loadStoredCredentials();
                
                // Set default OCAPI version if not already set
                const ocapiVersionField = document.getElementById('ocapiVersion');
                if (!ocapiVersionField.value) {
                    ocapiVersionField.value = 'v24_5';
                }
            });

            // Event listeners
            document.getElementById('authForm').addEventListener('submit', function(e) {
                e.preventDefault();
                authorize();
            });

            document.getElementById('authorizeWithDefaultsBtn').addEventListener('click', authorizeWithDefaults);
            document.getElementById('loadStoredBtn').addEventListener('click', loadStoredCredentials);
            document.getElementById('clearStoredBtn').addEventListener('click', clearStoredCredentials);
            document.getElementById('downloadConfigBtn').addEventListener('click', downloadOcapiConfig);

            // Authorize with server defaults (no form validation needed)
            async function authorizeWithDefaults() {
                const button = document.getElementById('authorizeWithDefaultsBtn');
                const status = document.getElementById('status');
                const originalText = button.textContent;
                
                // Disable button
                button.disabled = true;
                button.textContent = 'Authorizing...';
                status.textContent = '';
                
                try {
                    // Use server defaults for authorization
                    const response = await fetch('/authorize-with-defaults', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                        }
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
                        status.textContent = result.error || 'Server authorization failed. Please check server configuration.';
                        status.className = 'error';
                        button.disabled = false;
                        button.textContent = originalText;
                    }
                } catch (error) {
                    status.textContent = 'Error during server authorization. Please try again.';
                    status.className = 'error';
                    button.disabled = false;
                    button.textContent = originalText;
                }
            }

            // Load default credentials from server
            async function loadDefaults() {
                const status = document.getElementById('status');
                
                try {
                    const response = await fetch('/default-credentials');
                    const defaults = await response.json();
                    
                    document.getElementById('clientId').value = defaults.clientId || '';
                    // Don't populate secret from server for security
                    document.getElementById('apiBase').value = defaults.apiBase || '';
                    
                    status.textContent = 'Default values loaded from server configuration.';
                    status.className = 'success';
                    setTimeout(() => {
                        status.textContent = '';
                        status.className = 'error';
                    }, 3000);
                } catch (error) {
                    status.textContent = 'Error loading defaults: ' + error.message;
                    status.className = 'error';
                }
            }

            // Load credentials from localStorage
            function loadStoredCredentials() {
                const status = document.getElementById('status');
                
                const clientId = localStorage.getItem(STORAGE_KEYS.CLIENT_ID);
                const clientSecret = localStorage.getItem(STORAGE_KEYS.CLIENT_SECRET);
                const apiBase = localStorage.getItem(STORAGE_KEYS.API_BASE);
                const ocapiVersion = localStorage.getItem(STORAGE_KEYS.OCAPI_VERSION);
                
                if (clientId || clientSecret || apiBase || ocapiVersion) {
                    document.getElementById('clientId').value = clientId || '';
                    document.getElementById('clientSecret').value = clientSecret || '';
                    document.getElementById('apiBase').value = apiBase || '';
                    document.getElementById('ocapiVersion').value = ocapiVersion || 'v24_5';
                    
                    status.textContent = 'Stored credentials loaded from browser.';
                    status.className = 'success';
                    setTimeout(() => {
                        status.textContent = '';
                        status.className = 'error';
                    }, 3000);
                } else {
                    status.textContent = 'No stored credentials found.';
                    status.className = 'error';
                    setTimeout(() => {
                        status.textContent = '';
                    }, 3000);
                }
            }

            // Clear stored credentials
            function clearStoredCredentials() {
                const status = document.getElementById('status');
                
                localStorage.removeItem(STORAGE_KEYS.CLIENT_ID);
                localStorage.removeItem(STORAGE_KEYS.CLIENT_SECRET);
                localStorage.removeItem(STORAGE_KEYS.API_BASE);
                localStorage.removeItem(STORAGE_KEYS.OCAPI_VERSION);
                
                document.getElementById('clientId').value = '';
                document.getElementById('clientSecret').value = '';
                document.getElementById('apiBase').value = '';
                document.getElementById('ocapiVersion').value = 'v24_5';
                
                status.textContent = 'Stored credentials cleared.';
                status.className = 'success';
                setTimeout(() => {
                    status.textContent = '';
                    status.className = 'error';
                }, 3000);
            }

            // Store credentials in localStorage
            function storeCredentials(clientId, clientSecret, apiBase, ocapiVersion) {
                localStorage.setItem(STORAGE_KEYS.CLIENT_ID, clientId);
                localStorage.setItem(STORAGE_KEYS.CLIENT_SECRET, clientSecret);
                localStorage.setItem(STORAGE_KEYS.API_BASE, apiBase);
                localStorage.setItem(STORAGE_KEYS.OCAPI_VERSION, ocapiVersion || 'v24_5');
            }

            // Download OCAPI Business Manager config file with client ID
            function downloadOcapiConfig() {
                const status = document.getElementById('status');
                const clientId = document.getElementById('clientId').value.trim();
                const ocapiVersion = document.getElementById('ocapiVersion').value.trim() || 'v24_5';
                
                if (!clientId) {
                    status.textContent = 'Please enter a Client ID before downloading the config.';
                    status.className = 'error';
                    setTimeout(() => {
                        status.textContent = '';
                    }, 3000);
                    return;
                }
                
                // Download from server endpoint with version parameter
                const downloadUrl = '/download-ocapi-config/' + encodeURIComponent(clientId) + '?version=' + encodeURIComponent(ocapiVersion);
                window.location.href = downloadUrl;
                
                status.textContent = 'OCAPI config download started.';
                status.className = 'success';
                setTimeout(() => {
                    status.textContent = '';
                    status.className = 'error';
                }, 3000);
            }
            
            async function authorize() {
                const form = document.getElementById('authForm');
                const button = document.getElementById('authorizeBtn');
                const status = document.getElementById('status');
                
                // Get form data
                const clientId = document.getElementById('clientId').value.trim();
                const clientSecret = document.getElementById('clientSecret').value.trim();
                const apiBase = document.getElementById('apiBase').value.trim();
                const ocapiVersion = document.getElementById('ocapiVersion').value.trim() || 'v24_5';
                
                // Validate inputs
                if (!clientId || !clientSecret || !apiBase) {
                    status.textContent = 'Client ID, Client Secret, and API Base URL are required.';
                    status.className = 'error';
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
                            apiBase: apiBase,
                            ocapiVersion: ocapiVersion
                        })
                    });
                    
                    const result = await response.json();
                    
                    if (result.success) {
                        // Store credentials in localStorage for future use
                        storeCredentials(clientId, clientSecret, apiBase, ocapiVersion);
                        
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
                        status.className = 'error';
                        button.disabled = false;
                        button.textContent = 'Authorize Access';
                    }
                } catch (error) {
                    status.textContent = 'Error validating credentials. Please try again.';
                    status.className = 'error';
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
  persistSessionData();
  
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
  const { clientId, clientSecret, apiBase, ocapiVersion } = req.body;
  
  if (!clientId || !clientSecret || !apiBase) {
    res.json({ success: false, error: 'Client ID, Client Secret, and API Base URL are required' });
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
        sessionId,
        ocapiVersion: ocapiVersion || 'v24_5'
      };
      
      authCodes[authCode] = sessionId;
      persistSessionData();
      
      // Clean up old auth codes (optional: implement proper cleanup)
      setTimeout(() => {
        delete authCodes[authCode];
        persistSessionData();
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
    version: getVersion(),
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
      apiBase: authObject.apiBase,
      ocapiVersion: authObject.ocapiVersion
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
    
    // Transfer credentials from auth to session if authenticated
    if (authResult.authObject?.sessionId && authResult.authObject?.clientId) {
      configManager.setSessionCredentials(effectiveSessionId, {
        clientId: authResult.authObject.clientId,
        clientSecret: authResult.authObject.clientSecret,
        apiBase: authResult.authObject.apiBase,
        ocapiVersion: authResult.authObject.ocapiVersion
      });
    }
    
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
    version: getVersion(),
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
    Logger.info(requestId, 'Received SIGINT. Saving sessions and shutting down gracefully...');
    persistSessionData();
    process.exit(0);
  });

  process.on('SIGTERM', () => {
    Logger.info(requestId, 'Received SIGTERM. Saving sessions and shutting down gracefully...');
    persistSessionData();
    process.exit(0);
  });
}

export { mcpServer, app };
