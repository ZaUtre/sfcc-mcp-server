// test-mock-fallback.js
import { config } from "dotenv";
import fetch from "node-fetch";

// API types
const ApiType = {
  SHOPPER: 'shopper',
  ADMIN: 'admin'
};

// Load environment variables
config();

// Global configuration
const SFCC_ADMIN_CLIENT_ID = process.env.SFCC_ADMIN_CLIENT_ID || "";
const SFCC_ADMIN_CLIENT_SECRET = process.env.SFCC_ADMIN_CLIENT_SECRET || "";
const SFCC_SITE_ID = process.env.SFCC_SITE_ID || "RefArch";
const SFCC_ORGANIZATION_ID = process.env.SFCC_ORGANIZATION_ID || "";
const SFCC_SHORT_CODE = process.env.SFCC_SHORT_CODE || "";
const USER_AGENT = "sfcc-mcp-server/1.0";

// Mock implementation of getAdminAuthToken function (will always fail)
async function getAdminAuthToken() {
  console.log("Simulating auth failure...");
  throw new Error("Admin API client credentials not configured. Please set SFCC_ADMIN_CLIENT_ID and SFCC_ADMIN_CLIENT_SECRET in your .env file.");
}

// Get catalogs function (similar to our implementation)
async function getCatalogs() {
  try {
    // Get admin auth token
    console.log("Attempting to get admin auth token...");
    const accessToken = await getAdminAuthToken();
    
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
      throw new Error(`Failed to fetch catalogs: ${response.status} ${response.statusText}`);
    }
    
    return await response.json();
  } catch (error) {
    console.error("Error fetching catalogs:", error.message);
    
    // Fall back to mock data if admin credentials aren't configured
    if (error.message && error.message.includes('not configured')) {
      console.log("Falling back to mock data...");
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
    
    throw error;
  }
}

// Main function to run the test
async function main() {
  try {
    console.log("Testing getCatalogs fallback to mock data:");
    
    const catalogsData = await getCatalogs();
    
    console.log("\nCatalogs Data:");
    console.log(JSON.stringify(catalogsData, null, 2));
    
    if (catalogsData.data && catalogsData.data.length > 0) {
      console.log("\nCatalogs found:");
      catalogsData.data.forEach((catalog, index) => {
        console.log(`\n${index + 1}. ID: ${catalog.id}`);
        if (catalog.name) console.log(`   Name: ${catalog.name}`);
        if (catalog.description) console.log(`   Description: ${catalog.description}`);
      });
    } else {
      console.log("No catalogs found.");
    }
    
  } catch (error) {
    console.error("Test failed:", error);
  }
}

// Run the test
main();