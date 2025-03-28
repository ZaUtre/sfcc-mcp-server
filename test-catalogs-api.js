// test-catalogs-api.js
import { config } from "dotenv";
import fetch from "node-fetch";

// Load environment variables
config();

// Get environment variables
const SFCC_ADMIN_CLIENT_ID = process.env.SFCC_ADMIN_CLIENT_ID || "";
const SFCC_ADMIN_CLIENT_SECRET = process.env.SFCC_ADMIN_CLIENT_SECRET || "";
const SFCC_ORGANIZATION_ID = process.env.SFCC_ORGANIZATION_ID || "";
const SFCC_SHORT_CODE = process.env.SFCC_SHORT_CODE || "";
const USER_AGENT = "sfcc-mcp-server/1.0";

// Get authentication token
async function getAdminAuthToken() {
  try {
    // Token URL for authentication
    const tokenUrl = `https://account.demandware.com/dwsso/oauth2/access_token`;
    
    // Create form data for POST request with credentials included (client_secret_post method)
    const formData = new URLSearchParams();
    formData.append('grant_type', 'client_credentials');
    formData.append('scope', 'sfcc.catalogs.rw');  // Update to request read-write scope
    formData.append('client_id', SFCC_ADMIN_CLIENT_ID);
    formData.append('client_secret', SFCC_ADMIN_CLIENT_SECRET);
    
    console.log("Requesting authentication token...");
    const response = await fetch(tokenUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: formData.toString()
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to obtain token: ${response.status} ${response.statusText} - ${errorText}`);
    }
    
    const tokenData = await response.json();
    console.log("Successfully obtained token!");
    
    return tokenData.access_token;
  } catch (error) {
    console.error("Error getting admin auth token:", error);
    throw error;
  }
}

// Get catalogs
async function getCatalogs() {
  try {
    // Get auth token
    const accessToken = await getAdminAuthToken();
    
    // Construct catalog API URL
    const catalogsUrl = `https://${SFCC_SHORT_CODE}.api.commercecloud.salesforce.com/product/catalogs/v1/organizations/${SFCC_ORGANIZATION_ID}/catalogs`;
    console.log("Requesting catalogs from:", catalogsUrl);
    
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
      const errorText = await response.text();
      throw new Error(`Failed to fetch catalogs: ${response.status} ${response.statusText} - ${errorText}`);
    }
    
    return await response.json();
  } catch (error) {
    console.error("Error fetching catalogs:", error);
    throw error;
  }
}

// Main function
async function main() {
  try {
    console.log("Testing Catalogs API...");
    console.log("Using configuration:");
    console.log(`- Admin Client ID: ${SFCC_ADMIN_CLIENT_ID ? "****" + SFCC_ADMIN_CLIENT_ID.slice(-4) : "Not set"}`);
    console.log(`- Admin Client Secret: ${SFCC_ADMIN_CLIENT_SECRET ? "Present" : "Not set"}`);
    console.log(`- Organization ID: ${SFCC_ORGANIZATION_ID}`);
    console.log(`- Short Code: ${SFCC_SHORT_CODE}`);
    
    // Get catalogs
    console.log("\nFetching catalogs...");
    const catalogsData = await getCatalogs();
    
    console.log("\nCatalogs Response:");
    console.log(JSON.stringify(catalogsData, null, 2));
    
    // Display catalogs in a formatted way
    if (catalogsData.data && catalogsData.data.length > 0) {
      console.log("\nAvailable Catalogs:");
      catalogsData.data.forEach((catalog, index) => {
        console.log(`\n${index + 1}. ID: ${catalog.id}`);
        if (catalog.name) console.log(`   Name: ${catalog.name}`);
        if (catalog.description) console.log(`   Description: ${catalog.description}`);
      });
      console.log(`\nTotal Catalogs: ${catalogsData.data.length}`);
    } else {
      console.log("\nNo catalogs found or empty response.");
    }
    
  } catch (error) {
    console.error("\nTest failed with error:", error);
  }
}

// Run the main function
main();