// troubleshoot-catalogs.js
// A script to help troubleshoot SFCC Catalogs API access issues
import { config } from "dotenv";
import fetch from "node-fetch";

// Load environment variables
config();

// Global configuration
const SFCC_ADMIN_CLIENT_ID = process.env.SFCC_ADMIN_CLIENT_ID || "";
const SFCC_ADMIN_CLIENT_SECRET = process.env.SFCC_ADMIN_CLIENT_SECRET || "";
const SFCC_ORGANIZATION_ID = process.env.SFCC_ORGANIZATION_ID || "";
const SFCC_SHORT_CODE = process.env.SFCC_SHORT_CODE || "";
const USER_AGENT = "sfcc-mcp-server/1.0";

// Get authentication token with optional scope
async function getAdminAuthToken(scope = "sfcc.catalogs.rw") {
  try {
    // Check if admin credentials are available
    if (!SFCC_ADMIN_CLIENT_ID || !SFCC_ADMIN_CLIENT_SECRET) {
      throw new Error("Admin API client credentials not configured. Please set SFCC_ADMIN_CLIENT_ID and SFCC_ADMIN_CLIENT_SECRET in your .env file.");
    }
    
    // Build the token URL
    const tokenUrl = `https://account.demandware.com/dwsso/oauth2/access_token`;
    console.log(`Requesting token with scope: ${scope}`);
    
    // Create form data for POST request with credentials (client_secret_post method)
    const formData = new URLSearchParams();
    formData.append('grant_type', 'client_credentials');
    formData.append('scope', scope);
    formData.append('client_id', SFCC_ADMIN_CLIENT_ID);
    formData.append('client_secret', SFCC_ADMIN_CLIENT_SECRET);
    
    // Create token request
    const response = await fetch(tokenUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: formData.toString()
    });
    
    if (!response.ok) {
      // Extract error information
      const errorDetails = await response.text();
      throw new Error(`Failed to obtain admin token: ${response.status} ${response.statusText} - ${errorDetails}`);
    }
    
    const tokenData = await response.json();
    
    // Log success
    console.log(`Successfully obtained token with scopes: ${tokenData.scope || 'not specified'}`);
    console.log(`Token expires in: ${tokenData.expires_in} seconds`);
    
    return {
      token: tokenData.access_token,
      scope: tokenData.scope
    };
  } catch (error) {
    console.error("Error getting admin auth token:", error);
    throw error;
  }
}

// Test catalogs API access with a token
async function testCatalogs(token) {
  try {
    // Construct catalog API URL
    const catalogsUrl = `https://${SFCC_SHORT_CODE}.api.commercecloud.salesforce.com/product/catalogs/v1/organizations/${SFCC_ORGANIZATION_ID}/catalogs`;
    console.log("Requesting catalogs from:", catalogsUrl);
    
    // Make API request
    const response = await fetch(catalogsUrl, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'x-dw-client-id': SFCC_ADMIN_CLIENT_ID,
        'User-Agent': USER_AGENT
      }
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      if (response.status === 403) {
        console.error(`403 FORBIDDEN: The API client is authenticated but does not have permission to access catalogs.`);
        console.error(`Error details: ${errorText}`);
        console.error(`\nPossible resolution steps:`);
        console.error(`1. Verify the API client has the appropriate catalog-related roles assigned in Business Manager`);
        console.error(`2. Check that the client has access to catalogs in your organization`);
        console.error(`3. Ensure the organization_id and short_code values are correct`);
      } else {
        console.error(`API Error: ${response.status} ${response.statusText} - ${errorText}`);
      }
      return false;
    }
    
    const data = await response.json();
    return data;
  } catch (error) {
    console.error("Error testing catalogs API:", error);
    return false;
  }
}

// Main function to run tests
async function main() {
  try {
    console.log("SFCC Catalogs API Troubleshooter");
    console.log("===============================");
    console.log("Configuration:");
    console.log(`- Admin Client ID: ${SFCC_ADMIN_CLIENT_ID ? SFCC_ADMIN_CLIENT_ID.substring(0, 4) + "..." + SFCC_ADMIN_CLIENT_ID.substring(SFCC_ADMIN_CLIENT_ID.length - 4) : "Not set"}`);
    console.log(`- Admin Client Secret: ${SFCC_ADMIN_CLIENT_SECRET ? "Present (hidden)" : "Not set"}`);
    console.log(`- Organization ID: ${SFCC_ORGANIZATION_ID}`);
    console.log(`- Short Code: ${SFCC_SHORT_CODE}`);
    
    // Test authentication
    console.log("\nStep 1: Testing authentication with specific scopes...");
    
    // Test with different scope options
    const testScopes = [
      "sfcc.catalogs",
      "sfcc.catalogs.rw"
    ];
    
    let successfulToken = null;
    let successfulScope = null;
    
    for (const scope of testScopes) {
      try {
        console.log(`\nTrying scope: ${scope}`);
        const result = await getAdminAuthToken(scope);
        console.log(`✅ Successfully authenticated with scope: ${scope}`);
        successfulToken = result.token;
        successfulScope = result.scope;
        break;
      } catch (error) {
        console.log(`❌ Failed with scope ${scope}: ${error.message}`);
      }
    }
    
    if (!successfulToken) {
      console.error("❌ Authentication failed with all tested scopes. Please check your credentials.");
      return;
    }
    
    // Test catalogs API access
    console.log("\nStep 2: Testing Catalogs API access...");
    const catalogsData = await testCatalogs(successfulToken);
    
    if (catalogsData) {
      console.log("✅ Successfully accessed catalogs API!");
      console.log("\nAvailable Catalogs:");
      catalogsData.data.forEach((catalog, index) => {
        console.log(`\n${index + 1}. ID: ${catalog.id}`);
        if (catalog.name) console.log(`   Name: ${catalog.name}`);
        if (catalog.description) console.log(`   Description: ${catalog.description}`);
      });
    } else {
      console.log("\n❌ Failed to access catalogs API. Please check the error messages above.");
      console.log("\nTroubleshooting tips:");
      console.log("1. Verify that your API client has the correct roles assigned in Business Manager");
      console.log("2. Check that the API client has permission to access the Catalogs API");
      console.log("3. Ensure that your organization ID and short code are correct");
      console.log("4. Contact your SFCC administrator to verify permissions");
    }
    
  } catch (error) {
    console.error("\nError in troubleshooter script:", error);
  }
}

// Run the tests
main();