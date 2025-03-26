import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { config } from "dotenv";
import { Product, ClientConfig, Customer, slasHelpers } from "commerce-sdk";

// Load environment variables
config();

const SFCC_CLIENT_ID = process.env.SFCC_CLIENT_ID || "";
const SFCC_CLIENT_SECRET = process.env.SFCC_CLIENT_SECRET || "";
const SFCC_SITE_ID = process.env.SFCC_SITE_ID || "RefArch";
const SFCC_ORGANIZATION_ID = process.env.SFCC_ORGANIZATION_ID || "";
const SFCC_SHORT_CODE = process.env.SFCC_SHORT_CODE || "";
const USER_AGENT = "sfcc-mcp-server/1.0";

// Create server instance
const server = new McpServer({
  name: "sfcc-services",
  version: "1.0.0",
});

// Create basic client config
const getBaseClientConfig = (): ClientConfig => {
  return {
    headers: {
      "User-Agent": USER_AGENT,
    },
    parameters: {
      clientId: SFCC_CLIENT_ID,
      organizationId: SFCC_ORGANIZATION_ID,
      shortCode: SFCC_SHORT_CODE,
      siteId: SFCC_SITE_ID,
    },
  };
};

// Get authenticated shopper product client
async function getShopperProductsClient() {
  // Create base config
  const clientConfig = getBaseClientConfig();
  
  try {
    // Create ShopperLogin client for authentication
    const shopperLoginClient = new Customer.ShopperLogin(clientConfig);
    
    // Get guest user token
    const token = await slasHelpers.loginGuestUser(shopperLoginClient, {
      redirectURI: "http://localhost:3000/callback" // not used server-side but required
    });
    
    // Add auth token to headers
    const authClientConfig = { 
      ...clientConfig,
      headers: {
        ...clientConfig.headers,
        authorization: `Bearer ${token.access_token}`,
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

async function main() {
  // Validate required environment variables
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

  // Set up stdio transport
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("SFCC Services MCP Server running on stdio");
}

main().catch((error) => {
  console.error("Fatal error in main():", error);
  process.exit(1);
});