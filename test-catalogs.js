// test-catalogs.js
import { config } from "dotenv";
import fetch from "node-fetch";
import { Customer, slasHelpers } from "commerce-sdk";

// Load environment variables
config();

// Define API parameters from environment
const SFCC_CLIENT_ID = process.env.SFCC_CLIENT_ID || "";
const SFCC_CLIENT_SECRET = process.env.SFCC_CLIENT_SECRET || "";
const SFCC_SITE_ID = process.env.SFCC_SITE_ID || "RefArch";
const SFCC_ORGANIZATION_ID = process.env.SFCC_ORGANIZATION_ID || "";
const SFCC_SHORT_CODE = process.env.SFCC_SHORT_CODE || "";
const USER_AGENT = "sfcc-mcp-server/1.0";

// Get authentication token for SFCC APIs
async function getAuthToken() {
  console.log("Attempting to get authentication token...");
  
  try {
    // Create base config for ShopperLogin client
    const clientConfig = {
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
    
    console.log("Client config:", JSON.stringify(clientConfig, null, 2));
    
    // Create ShopperLogin client for authentication
    const shopperLoginClient = new Customer.ShopperLogin(clientConfig);
    
    // Get guest user token
    console.log("Requesting guest user token...");
    const token = await slasHelpers.loginGuestUser(shopperLoginClient, {
      redirectURI: "http://localhost:3000/callback" // not used server-side but required
    });
    
    // Decode JWT token to check scopes (if it's a JWT token)
    try {
      if (token.access_token && token.access_token.includes('.')) {
        const tokenParts = token.access_token.split('.');
        if (tokenParts.length === 3) {
          const payload = JSON.parse(Buffer.from(tokenParts[1], 'base64').toString());
          console.log("Token payload:", JSON.stringify(payload, null, 2));
          
          if (payload.scope) {
            console.log("Token scopes:", payload.scope);
          }
        }
      }
    } catch (error) {
      console.log("Could not decode token, may not be JWT format");
    }
    
    console.log("Successfully obtained token");
    return token.access_token;
  } catch (error) {
    console.error("Error getting auth token:", error);
    throw error;
  }
}

// Function to get catalogs using the same implementation as in index.ts
async function getCatalogs() {
  try {
    console.log("Getting authentication token...");
    const accessToken = await getAuthToken();
    
    // Construct catalog API URL
    const catalogsUrl = `https://${SFCC_SHORT_CODE}.api.commercecloud.salesforce.com/product/catalogs/v1/organizations/${SFCC_ORGANIZATION_ID}/catalogs`;
    
    console.log(`Making request to: ${catalogsUrl}`);
    
    // Make API request
    const response = await fetch(catalogsUrl, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'x-dw-client-id': SFCC_CLIENT_ID,
        'User-Agent': USER_AGENT
      }
    });
    
    console.log(`Response status: ${response.status} ${response.statusText}`);
    
    if (!response.ok) {
      const errorBody = await response.text();
      console.error(`Error response body: ${errorBody}`);
      throw new Error(`Failed to fetch catalogs: ${response.status} ${response.statusText}`);
    }
    
    return await response.json();
  } catch (error) {
    console.error("Error fetching catalogs:", error);
    throw error;
  }
}

// Main function to test the API
async function main() {
  try {
    console.log("Testing SFCC Catalogs API...");
    console.log("Using configuration:");
    console.log(`- Client ID: ${SFCC_CLIENT_ID ? "****" + SFCC_CLIENT_ID.slice(-4) : "Missing"}`);
    console.log(`- Organization ID: ${SFCC_ORGANIZATION_ID}`);
    console.log(`- Short Code: ${SFCC_SHORT_CODE}`);
    console.log(`- Site ID: ${SFCC_SITE_ID}`);
    
    console.log("\nFetching catalogs...");
    const catalogsData = await getCatalogs();
    
    console.log("\nCatalogs Response:");
    console.log(JSON.stringify(catalogsData, null, 2));
    
    // Format for display
    if (catalogsData && catalogsData.data && catalogsData.data.length > 0) {
      console.log("\nAvailable Catalogs:");
      catalogsData.data.forEach((catalog, index) => {
        console.log(`\n${index + 1}. ID: ${catalog.id}`);
        if (catalog.name) console.log(`   Name: ${catalog.name}`);
        if (catalog.description) console.log(`   Description: ${catalog.description}`);
      });
    } else {
      console.log("\nNo catalogs found.");
    }
    
  } catch (error) {
    console.error("\nTest failed with error:", error);
  }
}

// Run the main function
main();