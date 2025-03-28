// mock-server.js
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { config } from "dotenv";

// Load environment variables
config();

// Create server instance
const server = new McpServer({
  name: "sfcc-services",
  version: "1.0.0",
});

// Mock catalog data
const mockCatalogs = {
  "data": [
    {
      "id": "multiopticas-catalog",
      "name": "Multiopticas Catalog",
      "description": "Main product catalog for Multiopticas"
    },
    {
      "id": "sunglasses-catalog",
      "name": "Sunglasses Catalog",
      "description": "Specialized catalog for sunglasses products"
    },
    {
      "id": "accessories-catalog",
      "name": "Accessories Catalog",
      "description": "Catalog for eyewear accessories and related products"
    }
  ]
};

// Mock product data
const mockProducts = {
  "5": {
    id: "5",
    name: "Cotton T-Shirt",
    brand: "SampleBrand",
    price: 19.99,
    currency: "USD",
    inventory: { orderable: true },
    shortDescription: "A comfortable cotton t-shirt, perfect for everyday wear.",
    imageGroups: [
      {
        images: [
          { link: "https://example.com/images/tshirt.jpg" }
        ]
      }
    ],
    variationAttributes: [
      {
        id: "color",
        name: "Color",
        values: [
          { name: "Blue" },
          { name: "Red" },
          { name: "White" }
        ]
      },
      {
        id: "size",
        name: "Size",
        values: [
          { name: "S" },
          { name: "M" },
          { name: "L" },
          { name: "XL" }
        ]
      }
    ],
    productPromotions: [
      { calloutMsg: "20% off with code SUMMER20" }
    ]
  },
  "10": {
    id: "10",
    name: "Denim Jeans",
    brand: "DenimCo",
    price: 49.99,
    currency: "USD",
    inventory: { orderable: true },
    shortDescription: "Classic denim jeans with a comfortable fit.",
    variationAttributes: [
      {
        id: "color",
        name: "Color",
        values: [
          { name: "Blue" },
          { name: "Black" }
        ]
      },
      {
        id: "size",
        name: "Size",
        values: [
          { name: "30x30" },
          { name: "32x32" },
          { name: "34x34" }
        ]
      }
    ]
  }
};

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
      // Get mock product data
      const productData = mockProducts[id];
      
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
        productData.variationAttributes.forEach((attr) => {
          if (attr.id && attr.values && attr.values.length > 0) {
            const values = attr.values.map((v) => v.name || v.value).join(", ");
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
        productData.productPromotions.forEach((promo) => {
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
      console.error("Error processing product:", error);
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

// Add get-catalogs tool
server.tool(
  "get-catalogs",
  "Get a list of available catalogs",
  {}, // No input parameters needed
  async () => {
    try {
      const catalogsData = mockCatalogs;
      
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
      
      catalogsData.data.forEach((catalog, index) => {
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
  // Set up custom transport to handle I/O with debugging
  const customTransport = {
    start: async () => {
      // Process stdin
      process.stdin.setEncoding('utf8');
      process.stdin.on('data', async (data) => {
        console.error("Received data from stdin:", data.toString().trim());
        
        try {
          const request = JSON.parse(data.toString().trim());
          console.error("Parsed request:", request);
          
          // Call the handler
          if (request.type === "request" && request.toolId === "get-catalogs") {
            // Handle get-catalogs request
            console.error("Processing get-catalogs request");
            
            // Format catalogs information
            const formattedCatalogs = ["Available Catalogs:"];
            
            mockCatalogs.data.forEach((catalog, index) => {
              formattedCatalogs.push(`\n${index + 1}. ID: ${catalog.id}`);
              
              if (catalog.name) {
                formattedCatalogs.push(`   Name: ${catalog.name}`);
              }
              
              if (catalog.description) {
                formattedCatalogs.push(`   Description: ${catalog.description}`);
              }
            });
            
            const response = {
              type: "response",
              id: request.id,
              content: [
                {
                  type: "text",
                  text: formattedCatalogs.join("\n"),
                },
              ],
            };
            
            console.error("Sending response:", JSON.stringify(response));
            console.log(JSON.stringify(response));
          } else {
            console.error("Unknown request type or tool");
          }
        } catch (error) {
          console.error("Error processing request:", error);
        }
      });
    },
    
    stop: async () => {
      // Nothing to do
    }
  };
  
  console.error("SFCC Services Mock MCP Server running on stdio (custom debug mode)");
  
  // Start the transport
  await customTransport.start();
}

main().catch((error) => {
  console.error("Fatal error in main():", error);
  process.exit(1);
});