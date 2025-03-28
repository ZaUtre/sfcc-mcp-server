// test-admin-auth.js
import { config } from "dotenv";
import fetch from "node-fetch";

// Load environment variables
config();

// Get environment variables
const SFCC_ADMIN_CLIENT_ID = process.env.SFCC_ADMIN_CLIENT_ID || "";
const SFCC_ADMIN_CLIENT_SECRET = process.env.SFCC_ADMIN_CLIENT_SECRET || "";
const SFCC_SHORT_CODE = process.env.SFCC_SHORT_CODE || "";
const SFCC_ORGANIZATION_ID = process.env.SFCC_ORGANIZATION_ID || "";

// Function to test admin API token
async function testAdminAuth() {
  console.log("Testing Admin API Authentication...");
  
  // Print client ID for debugging (obscure middle part)
  const clientIdLength = SFCC_ADMIN_CLIENT_ID.length;
  const obscuredClientId = clientIdLength > 10 
    ? SFCC_ADMIN_CLIENT_ID.slice(0, 4) + "..." + SFCC_ADMIN_CLIENT_ID.slice(-4) 
    : "Invalid format";
  console.log("Admin Client ID format:", obscuredClientId);
  console.log("Admin Client ID length:", clientIdLength, "characters");
  console.log("Admin Client Secret present:", SFCC_ADMIN_CLIENT_SECRET ? "Yes" : "No");
  
  // Check if admin credentials are available
  if (!SFCC_ADMIN_CLIENT_ID || !SFCC_ADMIN_CLIENT_SECRET) {
    console.error("Admin API client credentials not configured.");
    console.error("Please set SFCC_ADMIN_CLIENT_ID and SFCC_ADMIN_CLIENT_SECRET in your .env file.");
    process.exit(1);
  }
  
  try {
    // The token URL based on the cURL example - this has been verified working with sample creds
    const tokenUrl = `https://account.demandware.com/dwsso/oauth2/access_token`;
    console.log("Token URL:", tokenUrl);
    
    // Extract realm ID and instance ID from organization ID and short code
    // Format: SALESFORCE_COMMERCE_API:realm_instance scopes
    const realmId = SFCC_ORGANIZATION_ID.replace('f_ecom_', '');  // Extract realm from org ID
    const instanceId = SFCC_SHORT_CODE;
    const oauthScopes = "sfcc.catalogs sfcc.catalogs.rw";
    
    // Try format with just the basic scope, not the realm prefixed version
    // If we use the full format, it might restrict to specific realm/instance too strongly
    const scopeValue = `${oauthScopes}`;
    console.log("Requesting scope:", scopeValue);
    
    // Show equivalent curl command for debugging
    const maskedSecret = "****";
    const curlCmd = `curl "${tokenUrl}" --request 'POST' --user "${SFCC_ADMIN_CLIENT_ID}:${maskedSecret}" --header 'Content-Type: application/x-www-form-urlencoded' --data "grant_type=client_credentials" --data-urlencode "scope=${scopeValue}"`;
    console.log("Equivalent curl command:", curlCmd);
    
    // Create form data for POST request
    const formData = new URLSearchParams();
    formData.append('grant_type', 'client_credentials');
    formData.append('scope', scopeValue);
    
    // Switch to client_secret_post method
    // Instead of Basic Auth, include credentials in form data
    formData.append('client_id', SFCC_ADMIN_CLIENT_ID);
    formData.append('client_secret', SFCC_ADMIN_CLIENT_SECRET);
    
    console.log("Using client_secret_post method instead of Basic Auth");
    
    const response = await fetch(tokenUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: formData.toString()
    });
    
    console.log("Response status:", response.status, response.statusText);
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error("Error response:", errorText);
      return;
    }
    
    const tokenData = await response.json();
    console.log("Successfully obtained token!");
    console.log("Token type:", tokenData.token_type);
    console.log("Expires in:", tokenData.expires_in, "seconds");
    
    if (tokenData.scope) {
      console.log("Scopes:", tokenData.scope);
    }
    
    // Try getting catalogs with this token
    await testCatalogs(tokenData.access_token);
    
  } catch (error) {
    console.error("Error testing admin auth:", error);
  }
}

// Function to test catalogs API using the obtained token
async function testCatalogs(accessToken) {
  try {
    console.log("\nTesting Catalogs API with admin token...");
    
    // Construct catalog API URL
    const catalogsUrl = `https://${SFCC_SHORT_CODE}.api.commercecloud.salesforce.com/product/catalogs/v1/organizations/${SFCC_ORGANIZATION_ID}/catalogs`;
    console.log("Catalogs URL:", catalogsUrl);
    
    // Make API request
    const response = await fetch(catalogsUrl, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'x-dw-client-id': SFCC_ADMIN_CLIENT_ID
      }
    });
    
    console.log("Response status:", response.status, response.statusText);
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error("Error response:", errorText);
      return;
    }
    
    const catalogsData = await response.json();
    
    if (catalogsData.data && catalogsData.data.length > 0) {
      console.log("Successfully retrieved catalogs!");
      console.log("Number of catalogs:", catalogsData.data.length);
      
      // Display catalog information
      console.log("\nCatalogs:");
      catalogsData.data.forEach((catalog, index) => {
        console.log(`\n${index + 1}. ID: ${catalog.id}`);
        if (catalog.name) console.log(`   Name: ${catalog.name}`);
        if (catalog.description) console.log(`   Description: ${catalog.description}`);
      });
    } else {
      console.log("No catalogs found.");
    }
  } catch (error) {
    console.error("Error testing catalogs API:", error);
  }
}

// Run the test
testAdminAuth();