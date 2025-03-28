// test-sdk.js
import { config } from "dotenv";
import { Product, Customer, slasHelpers } from "commerce-sdk";
import loglevel from 'loglevel';

// Load environment variables
config();

// Enable detailed logging
loglevel.setLevel('debug');

const SFCC_CLIENT_ID = process.env.SFCC_CLIENT_ID || "";
const SFCC_CLIENT_SECRET = process.env.SFCC_CLIENT_SECRET || "";
const SFCC_SITE_ID = process.env.SFCC_SITE_ID || "RefArch";
console.log(`Site ID from env: ${process.env.SFCC_SITE_ID}`);
const SFCC_ORGANIZATION_ID = process.env.SFCC_ORGANIZATION_ID || "";
const SFCC_SHORT_CODE = process.env.SFCC_SHORT_CODE || "";
const USER_AGENT = "sfcc-mcp-server/1.0";

// Create basic client config
const getBaseClientConfig = () => {
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
  
  // Debug configuration information
  console.log("Debug - Client Configuration:");
  console.log(JSON.stringify({
    clientId: SFCC_CLIENT_ID,
    organizationId: SFCC_ORGANIZATION_ID,
    shortCode: SFCC_SHORT_CODE,
    siteId: SFCC_SITE_ID
  }, null, 2));
  
  try {
    // Create ShopperLogin client for authentication
    console.log("Creating ShopperLogin client...");
    const shopperLoginClient = new Customer.ShopperLogin(clientConfig);
    
    // Debug the URL that will be used for SLAS
    const slasUrl = `https://${SFCC_SHORT_CODE}.api.commercecloud.salesforce.com/shopper/auth/v1/organizations/${SFCC_ORGANIZATION_ID}/oauth2/authorize`;
    console.log(`SLAS URL: ${slasUrl}`);
    
    // Get guest user token with additional logging
    console.log("Attempting to login as guest user...");
    const token = await slasHelpers.loginGuestUser(shopperLoginClient, {
      redirectURI: "http://localhost:3000/callback", // not used server-side but required
      fetchOptions: {
        // Add additional debugging
        onRequest: req => {
          console.log(`Debug - Request URL: ${req.url}`);
          console.log(`Debug - Request Method: ${req.method}`);
          console.log("Debug - Request Headers:", req.headers);
        },
        onResponse: res => {
          console.log(`Debug - Response Status: ${res.status}`);
          if (!res.ok) {
            console.log(`Debug - Response Status Text: ${res.statusText}`);
          }
        }
      }
    });
    
    console.log("Successfully obtained guest token.");
    
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
    console.error("Error Details:", error.message);
    if (error.response) {
      console.error("Response status:", error.response.status);
      try {
        // Try to get response body for more details
        const body = await error.response.text();
        console.error("Response body:", body);
      } catch (bodyError) {
        console.error("Could not read response body");
      }
    }
    throw error;
  }
}

// Function to retrieve a product by ID
async function getProduct(id) {
  try {
    console.log("Creating shopper products client...");
    const shopperProductsClient = await getShopperProductsClient();
    
    console.log(`Fetching product with ID: ${id}...`);
    // Make the API request
    const productData = await shopperProductsClient.getProduct({
      parameters: {
        id: id,
        allImages: true
      }
    });
    
    return productData;
  } catch (error) {
    console.error("Error fetching product:", error);
    throw error;
  }
}

// Main function
async function main() {
  try {
    console.log("Testing SFCC Commerce SDK...");
    console.log("Using configuration:");
    console.log(`- Client ID: ${SFCC_CLIENT_ID ? "****" + SFCC_CLIENT_ID.slice(-4) : "Missing"}`);
    console.log(`- Organization ID: ${SFCC_ORGANIZATION_ID}`);
    console.log(`- Short Code: ${SFCC_SHORT_CODE}`);
    console.log(`- Site ID: ${SFCC_SITE_ID}`);
    
    // Get a product
    const productId = process.argv[2] || "5"; // Default to product ID "5" if not provided
    console.log(`\nFetching product with ID: ${productId}`);
    
    const product = await getProduct(productId);
    console.log("\nProduct Details:");
    console.log(JSON.stringify(product, null, 2));
    
  } catch (error) {
    console.error("\nTest failed with error:", error);
  }
}

// Run the main function
main();