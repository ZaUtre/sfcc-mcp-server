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
    
    // Use a scope format matching the client's allowed scopes
    const scopeValue = `sfcc.catalogs.rw`;
    
    // Create form data for POST request with credentials included (client_secret_post method)
    const formData = new URLSearchParams();
    formData.append('grant_type', 'client_credentials');
    formData.append('scope', scopeValue);
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

// Get authenticated shopper product client
async function getShopperProductsClient() {
  // Create base config for shopper APIs
  const clientConfig = getBaseClientConfig(ApiType.SHOPPER);
  
  try {
    // Get shopper auth token
    const accessToken = await getShopperAuthToken();
    
    // Add auth token to headers
    const authClientConfig = { 
      ...clientConfig,
      headers: {
        ...clientConfig.headers,
        authorization: `Bearer ${accessToken}`,
      }
    };
    
    // Return authenticated client
    return new Product.ShopperProducts(authClientConfig);
  } catch (error) {
    console.error("Error authenticating with SFCC:", error);
    // Fallback to unauthenticated client if authentication fails
    return new Product.ShopperProducts(clientConfig);
  }
}

// Simple weather tool that doesn't require SFCC credentials
server.tool(
  "get-weather",
  "Get current weather information for a location",
  {
    location: z.string().describe("The location to get weather information for (city name)"),
  },
  async ({ location }) => {
    try {
      // This is a mock implementation
      const weatherConditions = ["Sunny", "Cloudy", "Rainy", "Partly Cloudy", "Stormy", "Snowy", "Windy"];
      const randomCondition = weatherConditions[Math.floor(Math.random() * weatherConditions.length)];
      const temperature = Math.floor(Math.random() * 35) + 5; // Random temp between 5-40°C
      
      return {
        content: [
          {
            type: "text",
            text: `Weather for ${location}:\nCondition: ${randomCondition}\nTemperature: ${temperature}°C`,
          },
        ],
      };
    } catch (error) {
      console.error("Error in weather tool:", error);
      return {
        content: [
          {
            type: "text",
            text: `Error retrieving weather for ${location}. ${error instanceof Error ? error.message : 'Unknown error'}`,
          },
        ],
      };
    }
  },
);

server.tool(
  "get-product-by-id",
  "Get product details by product ID",
  {
    id: z.string().describe("The product ID to retrieve details for"),
    locale: z.string().optional().describe("Optional locale for product information"),
    currency: z.string().optional().describe("Optional currency code for pricing"),
  },
  async ({ id, locale, currency }) => {
    try {
      const shopperProductsClient = await getShopperProductsClient();
      
      // Prepare parameters for product request
      const params: {
        id: string;
        allImages: boolean;
        locale?: string;
        currency?: string;
      } = {
        id: id,
        allImages: true,
      };
      
      // Add optional parameters if provided
      if (locale) params.locale = locale;
      if (currency) params.currency = currency;
      
      console.log(`Fetching product with ID: ${id}`);
      
      // Make the API request
      const productData = await shopperProductsClient.getProduct({
        parameters: params
      });
      
      if (!productData) {
        return {
          content: [
            {
              type: "text",
              text: `Failed to retrieve product data for ID: ${id}`,
            },
          ],
        };
      }
      
      // Format product information
      const formattedProduct = [
        `Product: ${productData.name || "Unknown"}`,
        `ID: ${productData.id}`,
      ];
      
      // Add additional product information if available
      if (productData.brand) {
        formattedProduct.push(`Brand: ${productData.brand}`);
      }
      
      if (productData.price) {
        formattedProduct.push(`Price: ${productData.price} ${productData.currency || currency || "USD"}`);
      }
      
      if (productData.inventory && productData.inventory.orderable != null) {
        formattedProduct.push(`In Stock: ${productData.inventory.orderable ? "Yes" : "No"}`);
      }
      
      if (productData.shortDescription) {
        formattedProduct.push(`Description: ${productData.shortDescription}`);
      } else if (productData.longDescription) {
        formattedProduct.push(`Description: ${productData.longDescription}`);
      }
      
      // Add variation information if available
      if (productData.variationAttributes && productData.variationAttributes.length > 0) {
        productData.variationAttributes.forEach((attr: any) => {
          if (attr.id && attr.values && attr.values.length > 0) {
            const values = attr.values.map((v: any) => v.name || v.value).join(", ");
            formattedProduct.push(`${attr.name || attr.id}: ${values}`);
          }
        });
      }
      
      // Add image information if available
      if (productData.imageGroups && productData.imageGroups.length > 0 && 
          productData.imageGroups[0].images && productData.imageGroups[0].images.length > 0) {
        formattedProduct.push(`Primary Image: ${productData.imageGroups[0].images[0].link}`);
      }
      
      // Add promotions if available
      if (productData.productPromotions && productData.productPromotions.length > 0) {
        formattedProduct.push("\nActive Promotions:");
        productData.productPromotions.forEach((promo: any) => {
          if (promo.promotionId || promo.calloutMsg) {
            formattedProduct.push(`- ${promo.calloutMsg || promo.promotionId}`);
          }
        });
      }
      
      const productText = formattedProduct.join("\n");
      
      return {
        content: [
          {
            type: "text",
            text: productText,
          },
        ],
      };
    } catch (error) {
      console.error("Error fetching product:", error);
      return {
        content: [
          {
            type: "text",
            text: `Error retrieving product data for ID: ${id}. ${error instanceof Error ? error.message : 'Unknown error'}`,
          },
        ],
      };
    }
  },
);

// Function to get catalogs using the Admin API
async function getCatalogs() {
  try {
    // Get admin auth token
    const accessToken = await getAuthToken(ApiType.ADMIN);
    
    // Construct catalog API URL
    const catalogsUrl = `https://${SFCC_SHORT_CODE}.api.commercecloud.salesforce.com/product/catalogs/v1/organizations/${SFCC_ORGANIZATION_ID}/catalogs`;
    
    // Make API request
    const response = await fetch(catalogsUrl, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'x-dw-client-id': SFCC_ADMIN_CLIENT_ID,
        'User-Agent': USER_AGENT
      }
    });
    
    if (!response.ok) {
      if (response.status === 401) {
        // If unauthorized, likely missing required scope or incorrect credentials
        throw new Error(`Unauthorized to access catalogs. The admin API client may not have the required permissions or is not properly configured.`);
      } else if (response.status === 403) {
        // If forbidden, the API client doesn't have the necessary access rights
        console.warn("The API client is authenticated but doesn't have permission to access catalogs. Using mock data.");
        return {
          data: [
            {
              id: "multiopticas-catalog",
              name: "Mock Multiopticas Catalog (API client lacks permission)",
              description: "This is mock data because the API client is authenticated with sfcc.catalogs.rw scope but lacks necessary role assignments."
            },
            {
              id: "sunglasses-catalog",
              name: "Mock Sunglasses Catalog (API client lacks permission)",
              description: "To resolve this 403 error, contact your SFCC administrator to update API client roles in Business Manager."
            },
            {
              id: "accessories-catalog",
              name: "Mock Accessories Catalog (API client lacks permission)",
              description: "The API client needs both the sfcc.catalogs.rw scope AND appropriate role assignments in SFCC to access catalog data."
            }
          ],
          _permission_info: {
            error: "403 Forbidden",
            reason: "The API client is authenticated but lacks necessary permissions",
            resolution_steps: [
              "1. Have your SFCC administrator check API client configuration in Business Manager",
              "2. Ensure the API client has appropriate catalog-related roles assigned",
              "3. Verify the client has access to the specific catalogs in your organization",
              "4. Check that the organization_id and short_code values are correct"
            ]
          }
        };
      } else {
        throw new Error(`Failed to fetch catalogs: ${response.status} ${response.statusText}`);
      }
    }
    
    return await response.json();
  } catch (error) {
    console.error("Error fetching catalogs:", error);
    
    // Fall back to mock data if there are authentication issues
    if (error instanceof Error) {
      if (error.message.includes('not configured')) {
        console.warn("Admin credentials not configured, using mock catalog data");
        return {
          data: [
            {
              id: "mock-catalog",
              name: "Mock Catalog (Admin credentials not configured)",
              description: "This is mock data because admin API credentials are not available."
            }
          ]
        };
      }
      
      // For any other error, also provide mock data
      console.warn("Error accessing catalogs API, using mock catalog data");
      return {
        data: [
          {
            id: "mock-catalog",
            name: "Mock Catalog (API error)",
            description: "This is mock data because an error occurred while accessing the catalogs API."
          }
        ]
      };
    }
    
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
      
      // If this is mock data due to permission issues, include the resolution steps
      if (catalogsData._permission_info) {
        formattedCatalogs.push("\n=== Permission Issue Information ===");
        formattedCatalogs.push(`Error: ${catalogsData._permission_info.error}`);
        formattedCatalogs.push(`Reason: ${catalogsData._permission_info.reason}`);
        
        if (catalogsData._permission_info.resolution_steps) {
          formattedCatalogs.push("\nSteps to resolve:");
          catalogsData._permission_info.resolution_steps.forEach((step: string) => {
            formattedCatalogs.push(`  ${step}`);
          });
        }
      }
      
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
  // Validate required environment variables for Shopper APIs
  if (!SFCC_CLIENT_ID) {
    console.error("Error: SFCC_CLIENT_ID is required. Please set it in the .env file.");
    process.exit(1);
  }
  
  if (!SFCC_CLIENT_SECRET) {
    console.error("Error: SFCC_CLIENT_SECRET is required. Please set it in the .env file.");
    process.exit(1);
  }
  
  if (!SFCC_ORGANIZATION_ID) {
    console.error("Error: SFCC_ORGANIZATION_ID is required. Please set it in the .env file.");
    process.exit(1);
  }
  
  if (!SFCC_SHORT_CODE) {
    console.error("Error: SFCC_SHORT_CODE is required. Please set it in the .env file.");
    process.exit(1);
  }

  // Check for Admin API credentials (warn but don't exit if missing)
  if (!SFCC_ADMIN_CLIENT_ID || !SFCC_ADMIN_CLIENT_SECRET) {
    console.warn("Warning: Admin API credentials (SFCC_ADMIN_CLIENT_ID and SFCC_ADMIN_CLIENT_SECRET) are not set.");
    console.warn("The get-catalogs tool will fall back to mock data until these are configured.");
  } else {
    console.log("Admin API credentials configured. get-catalogs tool will use real API data.");
  }

  // Set up stdio transport
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("SFCC Services MCP Server running on stdio");
}

main().catch((error) => {
  console.error("Fatal error in main():", error);
  process.exit(1);
});