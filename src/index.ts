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
config();

// Admin API credentials (separate client)
const SFCC_ADMIN_CLIENT_ID = process.env.SFCC_ADMIN_CLIENT_ID || "";
const SFCC_ADMIN_CLIENT_SECRET = process.env.SFCC_ADMIN_CLIENT_SECRET || "";

// Shared configuration
const SFCC_SITE_ID = process.env.SFCC_SITE_ID || "RefArch";
const SFCC_ORGANIZATION_ID = process.env.SFCC_ORGANIZATION_ID || "";
const SFCC_SHORT_CODE = process.env.SFCC_SHORT_CODE || "";
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
      clientId:  SFCC_ADMIN_CLIENT_ID,
      organizationId: SFCC_ORGANIZATION_ID,
      shortCode: SFCC_SHORT_CODE,
      siteId: SFCC_SITE_ID,
    },
  };
};

// Get authentication token for SFCC OCAPI using Client Credentials
async function getAuthToken() {
  try {
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
    console.log(`Successfully obtained admin token with scopes: ${tokenData.scope || 'not specified'}`);
    
    return tokenData.access_token;
  } catch (error) {
    console.error("Error getting admin auth token:", error);
    throw error;
  }
}

// Utility function for making GET requests to SFCC API
async function makeSFCCRequest(endpoint: string) {
  try {
    const accessToken = await getAuthToken();
    const url = `${SFCC_API_BASE}/s/-/dw/data/v24_5/${endpoint}`;
    
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'x-dw-client-id': SFCC_ADMIN_CLIENT_ID,
        'User-Agent': USER_AGENT
      }
    });
    
    if (!response.ok) {
      throw new Error(`SFCC API request failed: ${response.status} ${response.statusText}`);
    }
    
    return await response.json();
  } catch (error) {
    console.error(`Error making SFCC request to ${endpoint}:`, error);
    throw error;
  }
}

// Define endpoint structure
interface EndpointParam {
  name: string;
  description: string;
  type: string;
}

interface Endpoint {
  path: string;
  description: string;
  params: EndpointParam[];
}

// Load endpoints from JSON file
function loadEndpoints(): Endpoint[] {
  try {
    const endpointsPath = path.join(__dirname, 'endpoints.json');
    const endpointsData = fs.readFileSync(endpointsPath, 'utf8');
    const { endpoints } = JSON.parse(endpointsData);
    return endpoints;
  } catch (error) {
    console.error('Error loading endpoints from JSON file:', error);
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

// Function to create a tool name from an endpoint path
function createToolName(path: string): string {
  // Remove leading slash and replace path separators with underscores
  const name = path.replace(/^\//, '').replace(/\//g, '_');
  // Replace parameter placeholders with 'by' to create a more readable function name
  return name.replace(/\{([^}]+)\}/g, 'by_$1');
}

// Function to handle SFCC API requests
async function handleSFCCRequest(endpoint: Endpoint, params: Record<string, string>) {
  const path = replacePathParams(endpoint.path, params);
  return makeSFCCRequest(path);
}

// Register tools for each endpoint
endpoints.forEach(endpoint => {
  const toolName = createToolName(endpoint.path);
  
  // Create the tool schema
  const toolSchema: Record<string, any> = {};
  endpoint.params.forEach(param => {
    toolSchema[param.name] = z.string().describe(param.description);
  });
  
  // Create the tool handler
  const toolHandler = async (input: Record<string, string>) => {
    try {
      const data = await handleSFCCRequest(endpoint, input);
      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(data),
          },
        ],
      };
    } catch (error) {
      console.error(`Error in ${toolName} tool:`, error);
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

async function main() {
  try {
    // Set up stdio transport
    const transport = new StdioServerTransport();
    await server.connect(transport);
    
    // Keep the process running
    process.stdin.resume();
    
    // Handle process termination
    process.on('SIGINT', () => {
      console.log('Received SIGINT. Shutting down gracefully...');
      process.exit(0);
    });
    
    process.on('SIGTERM', () => {
      console.log('Received SIGTERM. Shutting down gracefully...');
      process.exit(0);
    });
    
    // Log that the server is running (but don't use console.error)
    process.stdout.write('SFCC Services MCP Server running on stdio\n');
  } catch (error) {
    console.error('Error starting server:', error);
    process.exit(1);
  }
}

main().catch((error) => {
  console.error("Fatal error in main():", error);
  process.exit(1);
});