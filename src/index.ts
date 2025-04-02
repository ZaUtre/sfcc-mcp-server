import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { config } from "dotenv";
import { Product, ClientConfig, Customer, slasHelpers } from "commerce-sdk";
import fetch from "node-fetch";

// Load environment variables
config();

// Shopper API credentials
const SFCC_CLIENT_ID = process.env.SFCC_CLIENT_ID || "";
const SFCC_CLIENT_SECRET = process.env.SFCC_CLIENT_SECRET || "";

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

// API types
enum ApiType {
  SHOPPER = 'shopper',
  ADMIN = 'admin'
}

// Create basic client config based on API type
const getBaseClientConfig = (apiType: ApiType = ApiType.SHOPPER): ClientConfig => {
  return {
    headers: {
      "User-Agent": USER_AGENT,
    },
    parameters: {
      clientId: apiType === ApiType.ADMIN ? SFCC_ADMIN_CLIENT_ID : SFCC_CLIENT_ID,
      organizationId: SFCC_ORGANIZATION_ID,
      shortCode: SFCC_SHORT_CODE,
      siteId: SFCC_SITE_ID,
    },
  };
};

// Get authentication token for SFCC Shopper APIs using SLAS
async function getShopperAuthToken() {
  try {
    // Create base config for shopper APIs
    const clientConfig = getBaseClientConfig(ApiType.SHOPPER);
    
    // Create ShopperLogin client for authentication
    const shopperLoginClient = new Customer.ShopperLogin(clientConfig);
    
    // Get guest user token
    const token = await slasHelpers.loginGuestUser(shopperLoginClient, {
      redirectURI: "http://localhost:3000/callback" // not used server-side but required
    });
    
    return token.access_token;
  } catch (error) {
    console.error("Error getting shopper auth token:", error);
    throw error;
  }
}

// Get authentication token for SFCC Admin APIs using Client Credentials
async function getAdminAuthToken() {
  try {
    // Check if admin credentials are available
    if (!SFCC_ADMIN_CLIENT_ID || !SFCC_ADMIN_CLIENT_SECRET) {
      throw new Error("Admin API client credentials not configured. Please set SFCC_ADMIN_CLIENT_ID and SFCC_ADMIN_CLIENT_SECRET in your .env file.");
    }
    
    // Build the token URL according to the documentation cURL example
    // This approach has been verified to work with valid credentials
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

// Get authentication token based on API type
async function getAuthToken(apiType: ApiType = ApiType.SHOPPER) {
  return apiType === ApiType.ADMIN ? getAdminAuthToken() : getShopperAuthToken();
}

// Function to get catalogs using the Admin API
async function getCatalogs() {
  try {
    // Get admin auth token
    const accessToken = await getAuthToken(ApiType.ADMIN);
    
    // Construct catalog API URL
    // https://bcdt-006.dx.commercecloud.salesforce.com/s/-/dw/data/v24_5/catalogs
    const catalogsUrl = `${SFCC_API_BASE}/s/-/dw/data/v24_5/catalogs`;
    
    // Make API request
    const response = await fetch(catalogsUrl, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'x-dw-client-id': SFCC_ADMIN_CLIENT_ID,
        'User-Agent': USER_AGENT
      }
    });
    
    return await response.json();
  } catch (error) {
    console.error("Error fetching catalogs:", error);
    
    throw error;
  }
}

// Define catalog data type
interface Catalog {
  id: string;
  name?: string;
  description?: string;
}

interface PermissionInfo {
  error: string;
  reason: string;
  resolution_steps?: string[];
}

interface CatalogsResponse {
  data: Catalog[];
  _permission_info?: PermissionInfo;
}

// Add get-catalogs tool
server.tool(
  "get-catalogs",
  "Get a list of available catalogs",
  {}, // No input parameters needed
  async () => {
    try {
      const catalogsData = await getCatalogs() as CatalogsResponse;
      
      if (!catalogsData || !catalogsData.data || catalogsData.data.length === 0) {
        return {
          content: [
            {
              type: "text",
              text: "No catalogs found.",
            },
          ],
        };
      }
      
      // Format catalogs information
      const formattedCatalogs = ["Available Catalogs:"];
      
      catalogsData.data.forEach((catalog: Catalog, index: number) => {
        formattedCatalogs.push(`\n${index + 1}. ID: ${catalog.id}`);
        
        if (catalog.name) {
          formattedCatalogs.push(`   Name: ${catalog.name}`);
        }
        
        if (catalog.description) {
          formattedCatalogs.push(`   Description: ${catalog.description}`);
        }
      });
      
      return {
        content: [
          {
            type: "text",
            text: formattedCatalogs.join("\n"),
          },
        ],
      };
    } catch (error) {
      console.error("Error in get-catalogs tool:", error);
      return {
        content: [
          {
            type: "text",
            text: `Error retrieving catalog data. ${error instanceof Error ? error.message : 'Unknown error'}`,
          },
        ],
      };
    }
  },
);

async function main() {
  // Set up stdio transport
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("SFCC Services MCP Server running on stdio");
}

main().catch((error) => {
  console.error("Fatal error in main():", error);
  process.exit(1);
});