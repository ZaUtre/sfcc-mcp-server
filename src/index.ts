import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { config } from "dotenv";
import { Product, ClientConfig, Customer, slasHelpers } from "commerce-sdk";
import fetch from "node-fetch";
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Get the directory name of the current module
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables
config({ path: path.resolve(__dirname, "../.env") });

// Admin API credentials (separate client)
const SFCC_ADMIN_CLIENT_ID = process.env.SFCC_ADMIN_CLIENT_ID || "";
const SFCC_ADMIN_CLIENT_SECRET = process.env.SFCC_ADMIN_CLIENT_SECRET || "";
const USER_AGENT = "sfcc-mcp-server/1.0";
const SFCC_API_BASE = process.env.SFCC_API_BASE;

// Create server instance
const server = new McpServer({
  name: "sfcc-services",
  version: "1.0.0",
});

// Create basic client config based on API type
const getBaseClientConfig = (): ClientConfig => {
  return {
    headers: {
      "User-Agent": USER_AGENT,
    },
    parameters: {
      clientId:  SFCC_ADMIN_CLIENT_ID
    },
  };
};

// Get authentication token for SFCC OCAPI using Client Credentials
async function getAuthToken() {
  const requestId = process.env.REQUEST_ID || 'default-request';
  try {
    logToFile(requestId, 'Attempting to obtain authentication token.');
    // Check if admin credentials are available
    if (!SFCC_ADMIN_CLIENT_ID || !SFCC_ADMIN_CLIENT_SECRET) {
      throw new Error("Admin API client credentials not configured. Please set SFCC_ADMIN_CLIENT_ID and SFCC_ADMIN_CLIENT_SECRET in your .env file.");
    }
    
    const tokenUrl = `https://account.demandware.com/dwsso/oauth2/access_token`;
    
    // Create form data for POST request with credentials included (client_secret_post method)
    const formData = new URLSearchParams();
    formData.append('grant_type', 'client_credentials');
    formData.append('client_id', SFCC_ADMIN_CLIENT_ID);
    formData.append('client_secret', SFCC_ADMIN_CLIENT_SECRET);
    
    // Create token request with client credentials grant
    const response = await fetch(tokenUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: formData.toString()
    });
    
    if (!response.ok) {
      // Extract error information
      let errorDetails = "";
      try {
        const errorText = await response.text();
        errorDetails = errorText;
      } catch (e) {
        errorDetails = "Could not read error response";
      }
      
      throw new Error(`Failed to obtain admin token: ${response.status} ${response.statusText} - ${errorDetails}`);
    }
    
    const tokenData = await response.json() as { 
      access_token: string;
      scope?: string;
      token_type: string;
      expires_in: number 
    };
    
    // Log success but not the token itself
    logToFile(requestId, 'Authentication token obtained successfully.');
    return tokenData.access_token;
  } catch (error) {
    logToFile(requestId, `Error obtaining authentication token: ${error instanceof Error ? error.message : 'Unknown error'}`);
    throw error;
  }
}

// Utility function for making HTTP requests to SFCC API
async function makeSFCCRequest(endpoint: string, queryParams: URLSearchParams, method = 'GET', body?: any) {
  const requestId = process.env.REQUEST_ID || 'default-request';
  try {
    logToFile(requestId, `Making SFCC API request to endpoint: ${endpoint} with method: ${method}`);
    const accessToken = await getAuthToken();
    let url;
    url = `${SFCC_API_BASE}/s/-/dw/data/v24_5/${endpoint}`;
    
    // Add site_id as a query param if not already in the URL
    if (endpoint === 'product_search' && !url.includes('site_id=')) {
      const siteId = queryParams.get('site_id');
      if (siteId) {
        // Keep site_id in query params as it's required for the Data API
        // queryParams already has site_id, no need to add it again
      }
    }
    
    // Append query parameters if any exist
    const queryString = queryParams.toString();
    if (queryString) {
      url += `?${queryString}`;
    }
    
    const requestConfig: any = {
      method: method,
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'x-dw-client-id': SFCC_ADMIN_CLIENT_ID,
        'User-Agent': USER_AGENT
      }
    };
    
    // Add body for POST/PUT requests
    if ((method === 'POST' || method === 'PUT') && body) {
      requestConfig.headers['Content-Type'] = 'application/json';
      requestConfig.body = JSON.stringify(body);
    }
    
    const response = await fetch(url, requestConfig);
    
    if (!response.ok) {
      throw new Error(`SFCC API request failed: ${response.status} ${response.statusText}`);
    }
    
    logToFile(requestId, `SFCC API request to ${endpoint} completed successfully.`);
    return await response.json();
  } catch (error) {
    logToFile(requestId, `Error in SFCC API request to ${endpoint}: ${error instanceof Error ? error.message : 'Unknown error'}`);
    throw error;
  }
}

// Define endpoint structure
interface EndpointParam {
  name: string;
  description: string;
  type: string;
  required: boolean;
}

interface Endpoint {
  path: string;
  description: string;
  params: EndpointParam[];
  method?: string; // HTTP method (GET, POST, PUT, DELETE)
  defaultBody?: any; // Default request body for POST/PUT requests
}

// Load endpoints from JSON file
function loadEndpoints(): Endpoint[] {
  try {
    const endpointsPath = path.join(__dirname, 'endpoints.json');
    const endpointsData = fs.readFileSync(endpointsPath, 'utf8');
    const { endpoints } = JSON.parse(endpointsData);
    return endpoints;
  } catch (error) {
    // Return default endpoints if file can't be loaded
    return [
      {
        path: "/catalogs",
        description: "Get a list of available catalogs",
        params: []
      }
    ];
  }
}

// Get endpoints from JSON file
const endpoints: Endpoint[] = loadEndpoints();

// Function to replace path parameters with actual values
function replacePathParams(path: string, params: Record<string, string>): string {
  let result = path;
  for (const [key, value] of Object.entries(params)) {
    result = result.replace(`{${key}}`, value);
  }
  return result;
}
// Keep track of used tool names to ensure uniqueness
const usedToolNames = new Set<string>();

// Function to create a tool name from an endpoint path
function createToolName(path: string): string {
  // Remove leading slash and replace path separators with underscores
  let name = path.replace(/^\//, '').replace(/\//g, '_');
  // Replace parameter placeholders with 'by' to create a more readable function name
  name = name.replace(/\{([^}]+)\}/g, 'by_$1');
  
  // If name is longer than 60 chars (leaving room for uniqueness suffix), truncate it
  if (name.length > 60) {
    // Keep the first 30 and last 30 chars with underscore in between
    name = `${name.slice(0, 30)}_${name.slice(-29)}`;
  }
  
  // Ensure uniqueness by adding a numeric suffix if needed
  let uniqueName = name;
  let counter = 1;
  while (usedToolNames.has(uniqueName)) {
    // If adding suffix would make it too long, truncate more
    const suffix = `_${counter}`;
    if (name.length + suffix.length > 64) {
      name = name.slice(0, 64 - suffix.length);
    }
    uniqueName = name + suffix;
    counter++;
  }
  
  // Add to used names set
  usedToolNames.add(uniqueName);
  
  return uniqueName;
}

// Function to handle SFCC API requests
async function handleSFCCRequest(endpoint: Endpoint, params: Record<string, any>) {
  const requestId = process.env.REQUEST_ID || 'default-request';
  try {
    const method = endpoint.method || 'GET';
    logToFile(requestId, `Handling SFCC request for endpoint: ${endpoint.path} with method: ${method}`);
    const path = replacePathParams(endpoint.path, params);
  
    // Find parameters that weren't used in the path - these are query parameters
    const queryParams = new URLSearchParams();
    const pathParamMatches = endpoint.path.match(/\{([^}]+)\}/g) || [];
    const pathParamNames = pathParamMatches.map(match => match.slice(1, -1));
  
    // Extract request body for POST/PUT requests
    let requestBody = null;
    if ((method === 'POST' || method === 'PUT') && params.requestBody) {
      try {
        if (typeof params.requestBody === 'string') {
          requestBody = JSON.parse(params.requestBody);
        } else {
          requestBody = params.requestBody;
        }
        logToFile(requestId, `Request body: ${JSON.stringify(requestBody)}`);
      } catch (e) {
        logToFile(requestId, `Error parsing request body: ${e instanceof Error ? e.message : 'Unknown error'}`);
        throw new Error(`Invalid request body format: ${e instanceof Error ? e.message : 'Unknown error'}`);
      }
    }
      // Use default request body if defined in the endpoint and no body provided
    if ((method === 'POST' || method === 'PUT') && !requestBody && 'defaultBody' in endpoint) {
      requestBody = endpoint.defaultBody;
      logToFile(requestId, `Using default request body: ${JSON.stringify(requestBody)}`);
    } 
  
    // Add unused parameters as query parameters (except requestBody)
    Object.entries(params).forEach(([key, value]) => {
      if (!pathParamNames.includes(key) && key !== 'requestBody') {
        queryParams.append(key, String(value));
      }
    });
  
    const result = await makeSFCCRequest(path, queryParams, method, requestBody);
    logToFile(requestId, `SFCC request for endpoint ${endpoint.path} handled successfully.`);
    return result;
  } catch (error) {
    logToFile(requestId, `Error handling SFCC request for endpoint ${endpoint.path}: ${error instanceof Error ? error.message : 'Unknown error'}`);
    throw error;
  }
}

// Register tools for each endpoint
endpoints.forEach(endpoint => {
  const toolName = createToolName(endpoint.path);
  
  // Create the tool schema
  const toolSchema: Record<string, any> = {};
  endpoint.params.forEach(param => {
    if (param.required) {
      toolSchema[param.name] = z.string().describe(param.description);
    } else {
      toolSchema[param.name] = z.string().optional().describe(param.description);
    }
  });
  
  // Create the tool handler
  const toolHandler = async (input: Record<string, string>) => {
    try {
      const requestId = process.env.REQUEST_ID || 'default-request';
      // Filter out undefined or empty optional parameters
      const filteredParams = Object.fromEntries(
        Object.entries(input).filter(([_, value]) => value !== undefined && value !== '')
      );
      
      const data = await handleSFCCRequest(endpoint, filteredParams);
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

// Update the logger utility to include request ID in the log file name
function getLogFilePath(requestId: string): string {
  return path.join(__dirname, `${requestId}.log`);
}

function logToFile(requestId: string, message: string) {
  const logFilePath = getLogFilePath(requestId);
  const timestamp = new Date().toISOString();
  const logMessage = `[${timestamp}] ${message}\n`;
  fs.appendFileSync(logFilePath, logMessage, 'utf8');
}

// Update main function to include request ID in logs
async function main() {
  const requestId = process.env.REQUEST_ID || 'default-request';
  try {
    // Set up stdio transport
    const transport = new StdioServerTransport();
    await server.connect(transport);

    // Log server start
    logToFile(requestId, 'Server started successfully.');

    // Keep the process running
    process.stdin.resume();

    // Handle process termination
    process.on('SIGINT', () => {
      logToFile(requestId, 'Received SIGINT. Shutting down gracefully...');
      process.exit(0);
    });

    process.on('SIGTERM', () => {
      logToFile(requestId, 'Received SIGTERM. Shutting down gracefully...');
      process.exit(0);
    });
  } catch (error) {
    logToFile(requestId, `Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    process.exit(1);
  }
}

main().catch((error) => {
  const requestId = process.env.REQUEST_ID || 'default-request';
  logToFile(requestId, `Unhandled error: ${error instanceof Error ? error.message : 'Unknown error'}`);
  process.exit(1);
});