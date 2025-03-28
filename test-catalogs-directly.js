// test-catalogs-directly.js
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

// Direct implementation of getAdminAuthToken function
async function getAdminAuthToken() {
  try {
    // Check if admin credentials are available
    if (!SFCC_ADMIN_CLIENT_ID || !SFCC_ADMIN_CLIENT_SECRET) {
      throw new Error("Admin API client credentials not configured. Please set SFCC_ADMIN_CLIENT_ID and SFCC_ADMIN_CLIENT_SECRET in your .env file.");
    }
    
    // Build the token URL
    const tokenUrl = `https://account.demandware.com/dwsso/oauth2/access_token`;
    
    // Use the same scope format that worked in our tests
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
    
    const tokenData = await response.json();
    
    // Log success but not the token itself
    console.log(`Successfully obtained admin token with scopes: ${tokenData.scope || 'not specified'}`);
    
    return tokenData.access_token;
  } catch (error) {
    console.error("Error getting admin auth token:", error);
    throw error;
  }
}

// Direct implementation of getCatalogs function
async function getCatalogs() {
  try {
    // Get admin auth token
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
        const errorDetails = await response.text();
        throw new Error(`Failed to fetch catalogs: ${response.status} ${response.statusText} - ${errorDetails}`);
      }
    }
    
    return await response.json();
  } catch (error) {
    console.error("Error fetching catalogs:", error);
    
    // Fall back to mock data if there are authentication issues
    if (error.message && error.message.includes('not configured')) {
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
}

// Format and display catalogs data
function displayCatalogs(catalogsData) {
  if (!catalogsData || !catalogsData.data || catalogsData.data.length === 0) {
    console.log("No catalogs found.");
    return;
  }
  
  console.log("Available Catalogs:");
  
  catalogsData.data.forEach((catalog, index) => {
    console.log(`\n${index + 1}. ID: ${catalog.id}`);
    
    if (catalog.name) {
      console.log(`   Name: ${catalog.name}`);
    }
    
    if (catalog.description) {
      console.log(`   Description: ${catalog.description}`);
    }
  });

  // If this is mock data due to permission issues, include the resolution steps
  if (catalogsData._permission_info) {
    console.log("\n=== Permission Issue Information ===");
    console.log(`Error: ${catalogsData._permission_info.error}`);
    console.log(`Reason: ${catalogsData._permission_info.reason}`);
    
    if (catalogsData._permission_info.resolution_steps) {
      console.log("\nSteps to resolve:");
      catalogsData._permission_info.resolution_steps.forEach((step) => {
        console.log(`  ${step}`);
      });
    }
  }
}

// Main function to run the test
async function main() {
  try {
    console.log("Testing getCatalogs function directly:");
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
    console.log("\n");
    displayCatalogs(catalogsData);
    
  } catch (error) {
    console.error("\nTest failed with error:", error);
  }
}

// Run the test
main();